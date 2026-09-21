/**
 * Notion write operations for the 4 CR8W CMS content types:
 *   MOVES   → tasks          (NOTION_DB_MOVES)
 *   PEOPLE  → stations       (NOTION_DB_PEOPLE)
 *   CONTENT → forum posts    (NOTION_DB_CONTENT)
 *   FLOWS   → coflow dates   (NOTION_DB_FLOWS)
 *
 * Property names must match the actual Notion database schemas.
 * They mirror the aliases used in src/lib/notionNormalizer.ts.
 *
 * Env vars (shared with api/dashboard.ts):
 *   NOTION_SECRET, NOTION_DB_MOVES, NOTION_DB_PEOPLE, NOTION_DB_FLOWS, NOTION_DB_CONTENT
 */

import type { Task, Station, ForumPost, CoFlowDate, RevenueItem } from '../src/app/components/api.js';
import { NOTION_DB_ENV } from './_notionConfig.js';

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

// ── Per-type property builders ─────────────────────────────────────────────────

type OmitMeta<T> = Omit<T, 'id' | 'created_at' | 'notionPageId'>;

export function taskToProperties(t: OmitMeta<Task>): Record<string, unknown> {
  const STATUS: Record<string, string> = {
    todo: 'Not Started', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked',
  };
  const PRIORITY: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };
  const props: Record<string, unknown> = {
    Name:     nTitle(t.title || 'Untitled'),
    Status:   nSelect(STATUS[t.status]   ?? 'Not Started'),
    Priority: nSelect(PRIORITY[t.priority] ?? 'Medium'),
  };
  if (t.person)   props['Person']   = nSelect(t.person);
  if (t.due_date) props['Due Date'] = nDate(t.due_date);
  if (t.category) props['Category'] = nSelect(t.category);
  if (t.source)   props['Source']   = nRichText(t.source);
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
  if (s.pathwayStage) props['Pathway Stage'] = nSelect(s.pathwayStage);
  if (s.nextInvitation !== undefined && s.nextInvitation !== null) {
    props['Next Invitation'] = nRichText(s.nextInvitation);
  }
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
  const STATUS: Record<string, string> = {
    upcoming: 'Upcoming', active: 'Active', archived: 'Archived',
  };
  // FLOWS databases typically use the date as the primary identifier.
  // "Name" is Notion's default title property; adapt if your DB uses a different name.
  const label = d.date ? `CoFlow – ${d.date}` : 'CoFlow';
  const props: Record<string, unknown> = {
    Name:     nTitle(label),
    Location: nRichText(d.location || 'TBD'),
    Status:   nSelect(STATUS[d.status] ?? 'Upcoming'),
    Notes:    nRichText(d.notes || ''),
  };
  if (d.date)         props['Date']          = nDate(d.date);
  if (d.host)         props['Host']          = nSelect(d.host);
  if (d.theme)        props['Theme']         = nRichText(d.theme);
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

// ── Resource → DB ID + property builder registry ──────────────────────────────

type PropsBuilder = (item: Record<string, unknown>) => Record<string, unknown>;

interface NotionResourceConfig {
  dbIdEnvVar: string;
  toProperties: PropsBuilder;
}

export function moneyToProperties(m: OmitMeta<RevenueItem>): Record<string, unknown> {
  const TYPE_LABELS: Record<string, string> = {
    sponsorship: 'Sponsorship',
    workshop: 'Workshop',
    open_studio: 'Open Studio',
    geyser: 'Geyser',
    grant: 'Grant',
    other: 'Other',
  };

  const STATUS_LABELS: Record<string, string> = {
    projected: 'Projected',
    committed: 'Committed',
    cleared: 'Cleared',
    invoiced: 'Invoiced',
    wrapped: 'Wrapped',
  };

  const props: Record<string, unknown> = {
    Name:   nTitle(m.title || 'Untitled Stream'),
    Amount: { number: Number(m.amount) || 0 },
    Type:   nSelect(TYPE_LABELS[m.type] ?? 'Other'),
    Status: nSelect(STATUS_LABELS[m.status] ?? 'Projected'),
  };

  if (m.date)  props['Date']  = nDate(m.date);
  if (m.notes) props['Notes'] = nRichText(m.notes);
  return props;
}

export const NOTION_RESOURCES: Record<string, NotionResourceConfig> = {
  tasks: {
    dbIdEnvVar:   NOTION_DB_ENV.tasks,
    toProperties: (item) => taskToProperties(item as OmitMeta<Task>),
  },
  stations: {
    dbIdEnvVar:   NOTION_DB_ENV.stations,
    toProperties: (item) => stationToProperties(item as OmitMeta<Station>),
  },
  forum: {
    dbIdEnvVar:   NOTION_DB_ENV.forum,
    toProperties: (item) => forumPostToProperties(item as OmitMeta<ForumPost>),
  },
  'coflow-dates': {
    dbIdEnvVar:   NOTION_DB_ENV['coflow-dates'],
    toProperties: (item) => coFlowDateToProperties(item as OmitMeta<CoFlowDate>),
  },
  money: {
    dbIdEnvVar:   NOTION_DB_ENV.money,
    toProperties: (item) => moneyToProperties(item as OmitMeta<RevenueItem>),
  },
};
