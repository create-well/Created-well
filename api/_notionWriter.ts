/**
 * Notion write operations for the 4 CR8W CMS content types:
 *   MOVES   → tasks          (NOTION_DB_MOVES)
 *   PEOPLE  → stations       (NOTION_DB_PEOPLE)
 *   CONTENT → forum posts    (NOTION_DB_CONTENT)
 *   FLOWS   → coflow dates   (NOTION_DB_FLOWS)
 * Plus the MONEY quick log (M-1b): create-only, no KV shadow —
 * see createMoneyPage below. (NOTION_DB_MONEY)
 *
 * Property names must match the actual Notion database schemas.
 * They mirror the aliases used in src/lib/notionNormalizer.ts.
 *
 * Env vars (shared with api/dashboard.ts):
 *   NOTION_SECRET, NOTION_DB_MOVES, NOTION_DB_PEOPLE, NOTION_DB_FLOWS, NOTION_DB_CONTENT
 */

import type { Task, Station, ForumPost, CoFlowDate } from '../src/app/components/api';

const NOTION_API     = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function notionHeaders(): Record<string, string> {
  const secret = process.env.NOTION_SECRET;
  if (!secret) throw new Error('NOTION_SECRET env var is not set');
  return {
    Authorization: `Bearer ${secret}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: notionHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ── Property value helpers ─────────────────────────────────────────────────────

const nTitle    = (s: string) => ({ title:     [{ text: { content: s.slice(0, 2000) } }] });
const nRichText = (s: string) => ({ rich_text: [{ text: { content: s.slice(0, 2000) } }] });
const nSelect   = (name: string) => ({ select: { name } });
const nDate     = (start: string) => ({ date: { start } });
const nNumber   = (n: number) => ({ number: n });

// ── Per-type property builders ─────────────────────────────────────────────────

type OmitMeta<T> = Omit<T, 'id' | 'created_at' | 'notionPageId'>;

export function taskToProperties(t: OmitMeta<Task>): Record<string, unknown> {
  // Canonical MOVES (Create Well OS 3da8c564...) Status: Now, Next, Done, Dropped
  const STATUS: Record<string, string> = {
    todo:        'Next',
    in_progress: 'Now',
    done:        'Done',
    blocked:     'Now',
    dropped:     'Dropped',
  };
  const props: Record<string, unknown> = {
    Name:   nTitle(t.title || 'Untitled'),
    Status: nSelect(STATUS[t.status] ?? 'Next'),
  };
  // Explicit clear: a present key with an empty value clears the field,
  // instead of being omitted. An absent key leaves the field untouched.
  if ('due_date' in t) props['Due'] = t.due_date ? nDate(t.due_date) : { date: null };
  if ('category' in t) props['Type'] = t.category ? nSelect(t.category) : { select: null };
  if ('source' in t) props['Blocked By'] = t.source ? nRichText(t.source) : { rich_text: [] };
  return props;
}

export function stationToProperties(s: OmitMeta<Station>): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name:        nTitle(s.name || 'Untitled'),
    Status:      nSelect(s.status || 'active'),
    Description: nRichText(s.description || ''),
    Owner:       nRichText(s.owner || ''),
  };
  if (s.emoji) props['Emoji'] = nRichText(s.emoji);
  return props;
}

export function forumPostToProperties(p: OmitMeta<ForumPost>): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Content: nTitle(p.content || ''),
    Author:  nSelect(p.author || 'anonymous'),
  };
  if (p.tag) props['Tag'] = nSelect(p.tag);
  return props;
}

export function coFlowDateToProperties(d: OmitMeta<CoFlowDate>): Record<string, unknown> {
  // Hub FLOWS DB Status options: Upcoming / Active / Archived
  const STATUS: Record<string, string> = {
    idea:      'Upcoming',
    ready:     'Upcoming',
    approved:  'Upcoming',
    scheduled: 'Upcoming',
    happened:  'Active',
    wrapped:   'Archived',
    cancelled: 'Archived',
  };
  const label = d.date ? `CoFlow – ${d.date}` : 'CoFlow';
  const props: Record<string, unknown> = {
    Name:   nTitle(label),
    Status: nSelect(STATUS[d.status] ?? 'Upcoming'),
    Notes:  nRichText(d.notes || ''),
  };
  if (d.date)         props['Date']          = nDate(d.date);
  if (d.host)         props['Host']          = nSelect(d.host);
  if (d.flowType)     props['Type']          = nSelect(d.flowType);
  if (d.theme)        props['Theme']         = nRichText(d.theme);
  if (d.location && d.location !== 'TBD') props['Location'] = nRichText(d.location);
  if (d.timeRange)    props['Time Range']    = nRichText(d.timeRange);
  if (d.sessionNotes) props['Session Notes'] = nRichText(d.sessionNotes);
  return props;
}

// ── CRUD operations ────────────────────────────────────────────────────────────

/** Create a new page in a Notion database. Returns the new page's UUID. */
export async function notionCreate(
  databaseId: string,
  properties: Record<string, unknown>,
): Promise<string> {
  const { id } = await notionFetch<{ id: string }>('POST', '/pages', {
    parent: { database_id: databaseId },
    properties,
  });
  return id;
}

/** Update properties on an existing Notion page. */
export async function notionUpdate(
  pageId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  await notionFetch('PATCH', `/pages/${pageId}`, { properties });
}

/** Archive (soft-delete) a Notion page. */
export async function notionArchive(pageId: string): Promise<void> {
  await notionFetch('PATCH', `/pages/${pageId}`, { archived: true });
}

// ── MONEY quick log (M-1b, 2026-11-04) ────────────────────────────────────────
// The Money view's quick log creates ONE canonical MONEY row. Unlike the
// four registry types below, money has no KV shadow list: MONEY is
// canonical in Notion and the dashboard reads it through the sync
// payload, so this writer is create-only and the route stores nothing
// anywhere else. Write shape (money-view-layout-review-2026-11-04.md):
// Name, Amount, Direction, Actual (the picked date), Stage. Type (the
// normalizer's "Kind") is left unset in v1 — the quick log is a
// real-money log, not a pipeline tool.

export interface MoneyCreateInput {
  name: string;
  amount: number;
  direction: 'In' | 'Out';
  actual: string;
  stage: 'Received' | 'Paid';
}

export type MoneyValidation =
  | { ok: true; value: MoneyCreateInput }
  | { ok: false; error: string };

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function validateMoneyCreate(input: unknown): MoneyValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'body must be an object' };
  }
  const b = input as Record<string, unknown>;
  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    return { ok: false, error: 'name is required' };
  }
  if (typeof b.amount !== 'number' || !Number.isFinite(b.amount) || b.amount <= 0) {
    return { ok: false, error: 'amount must be a finite number greater than 0' };
  }
  if (b.direction !== 'In' && b.direction !== 'Out') {
    return { ok: false, error: "direction must be 'In' or 'Out'" };
  }
  if (b.stage !== 'Received' && b.stage !== 'Paid') {
    return { ok: false, error: "stage must be 'Received' or 'Paid'" };
  }
  // Stage follows the direction (In → Received, Out → Paid): the client
  // derives it, and the pairing is the record's meaning, so a mismatch
  // is refused rather than written.
  if ((b.direction === 'In') !== (b.stage === 'Received')) {
    return { ok: false, error: "stage must follow direction ('In' → 'Received', 'Out' → 'Paid')" };
  }
  if (typeof b.actual !== 'string' || !DATE_SHAPE.test(b.actual)) {
    return { ok: false, error: 'actual must be a YYYY-MM-DD date' };
  }
  const parsed = new Date(`${b.actual}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== b.actual) {
    return { ok: false, error: 'actual must be a real calendar date' };
  }
  return {
    ok: true,
    value: {
      name: b.name.trim(),
      amount: b.amount,
      direction: b.direction,
      actual: b.actual,
      stage: b.stage,
    },
  };
}

export function moneyToProperties(m: MoneyCreateInput): Record<string, unknown> {
  return {
    Name:      nTitle(m.name),
    Amount:    nNumber(m.amount),
    Direction: nSelect(m.direction),
    Actual:    nDate(m.actual),
    Stage:     nSelect(m.stage),
  };
}

/** Create one MONEY page; resolves with the created page object. */
export async function createMoneyPage(m: MoneyCreateInput): Promise<Record<string, unknown>> {
  const databaseId = process.env.NOTION_DB_MONEY;
  if (!databaseId) throw new Error('NOTION_DB_MONEY env var is not set');
  return notionFetch<Record<string, unknown>>('POST', '/pages', {
    parent: { database_id: databaseId },
    properties: moneyToProperties(m),
  });
}

// ── Resource → DB ID + property builder registry ──────────────────────────────

type PropsBuilder = (item: Record<string, unknown>) => Record<string, unknown>;

interface NotionResourceConfig {
  dbIdEnvVar: string;
  toProperties: PropsBuilder;
}

export const NOTION_RESOURCES: Record<string, NotionResourceConfig> = {
  tasks: {
    dbIdEnvVar:   'NOTION_DB_MOVES',
    toProperties: (item) => taskToProperties(item as OmitMeta<Task>),
  },
  stations: {
    dbIdEnvVar:   'NOTION_DB_PEOPLE',
    toProperties: (item) => stationToProperties(item as OmitMeta<Station>),
  },
  forum: {
    dbIdEnvVar:   'NOTION_DB_CONTENT',
    toProperties: (item) => forumPostToProperties(item as OmitMeta<ForumPost>),
  },
  'coflow-dates': {
    dbIdEnvVar:   'NOTION_DB_FLOWS',
    toProperties: (item) => coFlowDateToProperties(item as OmitMeta<CoFlowDate>),
  },
};
