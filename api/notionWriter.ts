/**
 * Notion write operations for CR8W.
 *
 * ── Why this file was rewritten ────────────────────────────────────────────────
 *
 * The previous version wrote property names that do not exist in the Create Well
 * databases. Notion rejects an unknown property with a 400, and the caller in
 * api/server/[...path].ts swallowed the error to console. The result was that
 * every task edit, every flow edit, every forum post looked saved in the
 * dashboard, saved in the KV store, and never reached Notion. Silent.
 *
 * Confirmed against the live schemas. What the old writer sent, and the truth:
 *
 *   MOVES    Priority     → does not exist. There is no priority in MOVES.
 *            Due Date     → the property is called `Due`.
 *            Category     → the property is called `Type`.
 *            Source       → does not exist. Closest are `Notes`, `Blocked By`.
 *            Person       → a RELATION to PEOPLE, was written as a select.
 *            Status       → options are Now / Next / Done / Dropped,
 *                           not Not Started / In Progress / Done / Blocked.
 *
 *   FLOWS    Location     → the property is called `Venue`.
 *            Host         → the property is `Flow Keeper`, a RELATION.
 *            Theme        → does not exist.
 *            Time Range   → does not exist. FLOWS has three real date fields:
 *                           `Date`, `Media Cutoff`, `Thank-you Due`.
 *            Session Notes→ the property is called `Retro`.
 *            Status       → options are Idea / Scheduled / Ready / Approved /
 *                           Happened / Wrapped / Cancelled.
 *
 *   PEOPLE   Status, Description, Emoji → none of them exist.
 *   CONTENT  the title property is `Name`, not `Content`.
 *
 * ── The rules this file now follows ───────────────────────────────────────────
 *
 * 1. Every property is checked against a schema before it is sent. An unknown
 *    property is DROPPED and reported, never sent. One bad field can no longer
 *    fail the whole write.
 * 2. Every select value is checked against the real option list. An unknown
 *    option is DROPPED, not sent. Notion would otherwise CREATE the option and
 *    quietly pollute the database with junk states.
 * 3. Relations are resolved from a display name to a page id. An unresolved
 *    name is dropped and reported, because writing a wrong relation is worse
 *    than writing none.
 * 4. Nothing is swallowed. Every call returns what it wrote and what it could
 *    not, so the dashboard can say "saved here, not in Notion" out loud.
 *
 * Governance: Notion writes. Supabase remembers. cr8w.com reads.
 * This module is the one place cr8w.com is allowed to write back, and it only
 * writes fields the team owns. Rollups, formulas and auto ids are never sent.
 */

import type { Task, Station, ForumPost, CoFlowDate } from '../src/types/contract.js';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// ── Real schemas, read from the live databases ─────────────────────────────────

type PropType = 'title' | 'text' | 'select' | 'date' | 'relation' | 'number' | 'checkbox' | 'url';

interface PropSpec {
  type: PropType;
  /** Exact option names, for select properties. Anything else is dropped. */
  options?: readonly string[];
}

/** MOVES. Tasks. Note: there is no priority property and never was. */
export const MOVES_SCHEMA: Record<string, PropSpec> = {
  'Name':       { type: 'title' },
  'Status':     { type: 'select', options: ['Now', 'Next', 'Done', 'Dropped'] },
  'Type':       { type: 'select', options: ['Prep', 'Day-Of', 'Follow-Up', 'Admin', 'Content'] },
  'Touchpoint': { type: 'select', options: [
    'Thank-you (24-48h)', 'Check-in (Day 5-7)', 'Next invite (Day 10-14)',
    'Personal invite (after 2nd)', 'Other',
  ] },
  'Due':        { type: 'date' },
  'Owner':      { type: 'relation' },
  'Person':     { type: 'relation' },
  'Flow':       { type: 'relation' },
  'Blocked By': { type: 'text' },
  'Notes':      { type: 'text' },
};

/** FLOWS. Events. Three separate date fields, each with its own meaning. */
export const FLOWS_SCHEMA: Record<string, PropSpec> = {
  'Name':              { type: 'title' },
  'Status':            { type: 'select', options: [
    'Idea', 'Scheduled', 'Ready', 'Approved', 'Happened', 'Wrapped', 'Cancelled',
  ] },
  'Type':              { type: 'select', options: [
    'Podyap', 'Open Studio', 'Book Club', 'Workshop', 'Pop-Up',
    'Surprise-ment', 'Geyser', 'Internal',
  ] },
  'Phase':             { type: 'select', options: [
    'Cohoe', 'Concepting', 'Coordinating', 'Marketing', 'Day of',
    'Decomprocessing', 'Depanty',
  ] },
  'Offering Arc':      { type: 'select', options: [
    'Sense', 'Name', 'Design', 'Practice', 'Integrate', 'Sustain',
  ] },
  'Readiness Outcome': { type: 'select', options: ['Not yet', 'Start here', 'Ready for depth'] },
  'Date':              { type: 'date' },
  'Media Cutoff':      { type: 'date' },   // Omar's deadline. Thursday for Podyaps.
  'Thank-you Due':     { type: 'date' },
  'Venue':             { type: 'text' },
  'Hard Stop':         { type: 'text' },
  'Notes':             { type: 'text' },
  'Retro':             { type: 'text' },
  'Primary Invitation':{ type: 'text' },
  'Desired Body-Feel': { type: 'text' },
  'Capacity':          { type: 'number' },
  'Public?':           { type: 'checkbox' },
  'Public URL':        { type: 'url' },
  'Drive Folder':      { type: 'url' },
  'Flow Keeper':       { type: 'relation' },
  'Support':           { type: 'relation' },
  'Guests':            { type: 'relation' },
  'Attended':          { type: 'relation' },
  'Moves':             { type: 'relation' },
};

/**
 * PEOPLE. Deliberately narrow.
 *
 * `Owner` is a Notion `person` type, which needs a workspace user id, not a
 * name. It is left out on purpose. `Next Invitation` is the field the team
 * actually needs to set, and Notion's own description on it reads: "The single
 * most important field in the system. Blank means nobody gets contacted."
 */
export const PEOPLE_SCHEMA: Record<string, PropSpec> = {
  'Name':            { type: 'title' },
  'Pathway Stage':   { type: 'select', options: [
    'Arrive', 'Exhale', 'Come Home', 'Return', 'Deepen', 'Paused', 'Do Not Contact',
  ] },
  'Next Invitation': { type: 'text' },
  'Notes':           { type: 'text' },
};

/** CONTENT. The title property is `Name`. `Copy` holds the body text. */
export const CONTENT_SCHEMA: Record<string, PropSpec> = {
  'Name':  { type: 'title' },
  'Copy':  { type: 'text' },
  'Notes': { type: 'text' },
};

// ── Status vocabularies ───────────────────────────────────────────────────────
//
// The dashboard's internal words are not Notion's words. Mapping happens here
// and nowhere else, in both directions, so the two can never drift apart.

/** Dashboard task status → MOVES Status option. */
export const TASK_STATUS_TO_NOTION: Record<string, string> = {
  todo: 'Next',
  in_progress: 'Now',
  done: 'Done',
  dropped: 'Dropped',
  // 'blocked' has no MOVES option. It stays Now and the reason goes in Blocked By.
  blocked: 'Now',
};

/** MOVES Status option → dashboard task status. */
export const NOTION_TO_TASK_STATUS: Record<string, Task['status']> = {
  Now: 'in_progress',
  Next: 'todo',
  Done: 'done',
  Dropped: 'dropped',
};

/** Dashboard flow status → FLOWS Status option. */
export const FLOW_STATUS_TO_NOTION: Record<string, string> = {
  upcoming: 'Scheduled',
  active: 'Ready',
  archived: 'Wrapped',
};

// ── Property value builders ───────────────────────────────────────────────────

const nTitle = (s: string) => ({ title: [{ text: { content: s.slice(0, 2000) } }] });
const nText = (s: string) => ({ rich_text: [{ text: { content: s.slice(0, 2000) } }] });
const nSelect = (name: string) => ({ select: { name } });
const nNumber = (n: number) => ({ number: n });
const nCheckbox = (b: boolean) => ({ checkbox: b });
const nUrl = (s: string) => ({ url: s });
const nRelation = (ids: string[]) => ({ relation: ids.map((id) => ({ id })) });

function nDate(value: string): { date: { start: string } } | null {
  const v = String(value).trim();
  if (!v) return null;
  // Accept a date or a full datetime. Reject anything Notion would refuse.
  if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(v)) return null;
  return { date: { start: v } };
}

// ── Relation resolution ───────────────────────────────────────────────────────

/**
 * Display name → Notion page id, for writing relations.
 *
 * The read side has `buildRelationIndex` in src/lib/notionNormalizer.ts, which
 * turns ids into names so the dashboard stops rendering UUIDs. This is that same
 * index pointed the other way, because a write needs the id back.
 */
export type NameToIdIndex = Record<string, string>;

/** Normalise a name for matching, so "Flow Keeper" casing never loses a match. */
function normKey(name: string): string {
  return name.trim().toLowerCase();
}

export function buildNameToIdIndex(
  pages: Array<{ id: string; name?: string }>,
): NameToIdIndex {
  const index: NameToIdIndex = {};
  for (const page of pages) {
    if (page?.name && page?.id) index[normKey(page.name)] = page.id;
  }
  return index;
}

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** Resolve one or many names/ids to page ids. Unresolved names are returned too. */
function resolveRelationIds(
  raw: unknown,
  index: NameToIdIndex,
): { ids: string[]; unresolved: string[] } {
  const values = Array.isArray(raw) ? raw : [raw];
  const ids: string[] = [];
  const unresolved: string[] = [];
  for (const value of values) {
    const s = String(value ?? '').trim();
    if (!s) continue;
    if (UUID_RE.test(s)) { ids.push(s); continue; }
    const hit = index[normKey(s)];
    if (hit) ids.push(hit);
    else unresolved.push(s);
  }
  return { ids, unresolved };
}

// ── The validating builder ────────────────────────────────────────────────────

export interface DroppedField {
  property: string;
  reason: string;
}

export interface BuiltProperties {
  properties: Record<string, unknown>;
  dropped: DroppedField[];
}

/**
 * Turn a set of intended property writes into a Notion payload, dropping
 * anything the database will not accept.
 *
 * This is the guard that makes a partial write possible. Before, one wrong
 * field 400'd the entire request and nothing saved. Now the good fields land
 * and the bad ones come back named.
 */
export function buildProperties(
  schema: Record<string, PropSpec>,
  intended: Record<string, unknown>,
  relationIndex: NameToIdIndex = {},
): BuiltProperties {
  const properties: Record<string, unknown> = {};
  const dropped: DroppedField[] = [];

  for (const [property, raw] of Object.entries(intended)) {
    if (raw === undefined || raw === null || raw === '') continue;

    const spec = schema[property];
    if (!spec) {
      dropped.push({ property, reason: 'no such property in this database' });
      continue;
    }

    switch (spec.type) {
      case 'title':
        properties[property] = nTitle(String(raw));
        break;

      case 'text':
        properties[property] = nText(String(raw));
        break;

      case 'select': {
        const wanted = String(raw).trim();
        const match = spec.options?.find((o) => normKey(o) === normKey(wanted));
        if (!match) {
          dropped.push({
            property,
            reason: `"${wanted}" is not an option. Valid: ${spec.options?.join(', ')}`,
          });
          break;
        }
        properties[property] = nSelect(match);
        break;
      }

      case 'date': {
        const built = nDate(String(raw));
        if (!built) {
          dropped.push({ property, reason: `"${raw}" is not an ISO date` });
          break;
        }
        properties[property] = built;
        break;
      }

      case 'relation': {
        const { ids, unresolved } = resolveRelationIds(raw, relationIndex);
        if (unresolved.length) {
          dropped.push({
            property,
            reason: `could not resolve to a page: ${unresolved.join(', ')}`,
          });
        }
        // Only send the relation when at least one id resolved. Sending an empty
        // array would CLEAR the relation, which is a destructive surprise.
        if (ids.length) properties[property] = nRelation(ids);
        break;
      }

      case 'number': {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          dropped.push({ property, reason: `"${raw}" is not a number` });
          break;
        }
        properties[property] = nNumber(n);
        break;
      }

      case 'checkbox':
        properties[property] = nCheckbox(
          raw === true || raw === 'true' || raw === '__YES__' || raw === 1,
        );
        break;

      case 'url':
        properties[property] = nUrl(String(raw));
        break;
    }
  }

  return { properties, dropped };
}

// ── Per-type mappers: dashboard shape → intended Notion properties ────────────

type OmitMeta<T> = Omit<T, 'id' | 'created_at' | 'notionPageId'>;

/** A task. Priority is deliberately not written: MOVES has no priority field. */
export function taskToIntended(t: Partial<OmitMeta<Task>> & Record<string, unknown>) {
  return {
    'Name':       t.title,
    'Status':     t.status ? TASK_STATUS_TO_NOTION[String(t.status)] : undefined,
    'Type':       t.category,
    'Touchpoint': (t as Record<string, unknown>).touchpoint,
    'Due':        t.due_date,
    'Person':     t.person,
    'Owner':      (t as Record<string, unknown>).owner,
    'Flow':       (t as Record<string, unknown>).flow,
    // 'blocked' is a dashboard state with no Notion option, so the fact that a
    // task is blocked is recorded as a sentence in the field built for it.
    'Blocked By': (t as Record<string, unknown>).blockedBy
      ?? (t.status === 'blocked' ? 'Blocked, reason not given' : undefined),
    // Deliberately NOT falling back to `t.source`. That field is a display
    // string the normalizer builds out of Blocked By or a Flow name, so using it
    // here would write a flow's name into Notes and call it a note.
    'Notes':      (t as Record<string, unknown>).notes,
  };
}

/** A flow. All three date fields are writable, including Omar's media cutoff. */
export function flowToIntended(d: Partial<OmitMeta<CoFlowDate>> & Record<string, unknown>) {
  const r = d as Record<string, unknown>;
  return {
    'Name':               r.name ?? r.theme ?? (d.date ? `Flow ${d.date}` : undefined),
    'Status':             d.status ? FLOW_STATUS_TO_NOTION[String(d.status)] : undefined,
    'Type':               r.type,
    'Phase':              r.phase,
    'Offering Arc':       r.offeringArc,
    'Readiness Outcome':  r.readinessOutcome,
    'Date':               d.startTime || d.date,
    'Media Cutoff':       r.mediaCutoff,
    'Thank-you Due':      r.thankYouDue,
    'Venue':              d.location,
    'Hard Stop':          r.hardStop ?? d.endTime,
    'Notes':              d.notes,
    'Retro':              d.sessionNotes ?? r.retro,
    'Primary Invitation': r.primaryInvitation,
    'Desired Body-Feel':  r.desiredBodyFeel ?? d.vibeCheck,
    'Capacity':           r.capacity,
    'Public?':            r.isPublic,
    'Public URL':         r.publicUrl,
    'Drive Folder':       r.driveFolder,
    'Flow Keeper':        d.host,
    'Support':            r.support,
    'Guests':             r.guests,
    'Attended':           d.attendees,
  };
}

/** A person. Narrow on purpose: the fields the team actually sets by hand. */
export function stationToIntended(s: Partial<OmitMeta<Station>> & Record<string, unknown>) {
  const r = s as Record<string, unknown>;
  return {
    'Name':            s.name,
    'Pathway Stage':   r.pathwayStage ?? s.status,
    'Next Invitation': r.nextInvitation,
    'Notes':           r.notes ?? s.description,
  };
}

/** A content row. `Name` is the title. `Copy` is the body. */
export function contentToIntended(p: Partial<OmitMeta<ForumPost>> & Record<string, unknown>) {
  const r = p as Record<string, unknown>;
  const body = String(p.content ?? '');
  return {
    'Name':  r.name ?? (body ? body.slice(0, 120) : undefined),
    'Copy':  body || undefined,
    'Notes': r.notes,
  };
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

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
    throw new Error(`Notion ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Create a page in a database. Returns the new page id. */
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

/** Update properties on a page. */
export async function notionUpdate(
  pageId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  await notionFetch('PATCH', `/pages/${pageId}`, { properties });
}

/** Archive a page. Never a hard delete. */
export async function notionArchive(pageId: string): Promise<void> {
  await notionFetch('PATCH', `/pages/${pageId}`, { archived: true });
}

// ── Resource registry ─────────────────────────────────────────────────────────

interface NotionResourceConfig {
  dbIdEnvVar: string;
  schema: Record<string, PropSpec>;
  toIntended: (item: Record<string, unknown>) => Record<string, unknown>;
  /** Human name, for error messages the team has to read. */
  label: string;
}

export const NOTION_RESOURCES: Record<string, NotionResourceConfig> = {
  tasks: {
    dbIdEnvVar: 'NOTION_DB_MOVES',
    schema: MOVES_SCHEMA,
    toIntended: (item) => taskToIntended(item as Partial<OmitMeta<Task>>),
    label: 'MOVES',
  },
  'coflow-dates': {
    dbIdEnvVar: 'NOTION_DB_FLOWS',
    schema: FLOWS_SCHEMA,
    toIntended: (item) => flowToIntended(item as Partial<OmitMeta<CoFlowDate>>),
    label: 'FLOWS',
  },
  stations: {
    dbIdEnvVar: 'NOTION_DB_PEOPLE',
    schema: PEOPLE_SCHEMA,
    toIntended: (item) => stationToIntended(item as Partial<OmitMeta<Station>>),
    label: 'PEOPLE',
  },
  forum: {
    dbIdEnvVar: 'NOTION_DB_CONTENT',
    schema: CONTENT_SCHEMA,
    toIntended: (item) => contentToIntended(item as Partial<OmitMeta<ForumPost>>),
    label: 'CONTENT',
  },
};

// ── Lazy relation index ───────────────────────────────────────────────────────
//
// Writing a relation needs a page id, but the dashboard only ever holds names.
// Rather than pay two Notion queries on every single write, the index is loaded
// only when an edit actually touches a relation field, then cached on the warm
// serverless instance for five minutes.

interface CachedIndex {
  index: NameToIdIndex;
  loadedAt: number;
}

const INDEX_TTL_MS = 5 * 60 * 1000;
const indexCache: Record<string, CachedIndex> = {};

/** Page id plus title for every row in a database, for name to id resolution. */
async function loadTitles(databaseId: string): Promise<Array<{ id: string; name?: string }>> {
  const out: Array<{ id: string; name?: string }> = [];
  let cursor: string | undefined;
  // Two pages of 100 is 200 rows, which comfortably covers PEOPLE and FLOWS.
  for (let page = 0; page < 2; page += 1) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await notionFetch<{
      results: Array<{ id: string; properties: Record<string, any> }>;
      next_cursor: string | null;
      has_more: boolean;
    }>('POST', `/databases/${databaseId}/query`, body);

    for (const row of res.results) {
      const titleProp = Object.values(row.properties ?? {}).find(
        (p: any) => p?.type === 'title',
      ) as any;
      const name = titleProp?.title?.map((t: any) => t?.plain_text ?? '').join('').trim();
      out.push({ id: row.id, name: name || undefined });
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

/**
 * Names to page ids across PEOPLE and FLOWS, which are the only two databases
 * anything relates to. Merged into one map because a name is unambiguous in
 * practice: nobody is called "Craft Night".
 */
export async function loadRelationIndex(): Promise<NameToIdIndex> {
  const cached = indexCache.all;
  if (cached && Date.now() - cached.loadedAt < INDEX_TTL_MS) return cached.index;

  const index: NameToIdIndex = {};
  for (const envVar of ['NOTION_DB_PEOPLE', 'NOTION_DB_FLOWS']) {
    const dbId = process.env[envVar];
    if (!dbId) continue;
    try {
      Object.assign(index, buildNameToIdIndex(await loadTitles(dbId)));
    } catch {
      // A relation that cannot be resolved is reported per field further down.
      // A lookup failure must not take the whole write with it.
    }
  }
  indexCache.all = { index, loadedAt: Date.now() };
  return index;
}

/** True when this edit is trying to set a relation to something not already an id. */
function needsRelationIndex(
  schema: Record<string, PropSpec>,
  intended: Record<string, unknown>,
): boolean {
  for (const [property, raw] of Object.entries(intended)) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (schema[property]?.type !== 'relation') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    if (values.some((v) => String(v ?? '').trim() && !UUID_RE.test(String(v).trim()))) return true;
  }
  return false;
}

// ── The one entry point the route calls ───────────────────────────────────────

export interface NotionSyncResult {
  /** 'written' | 'partial' | 'failed' | 'skipped' */
  state: 'written' | 'partial' | 'failed' | 'skipped';
  /** Which database, for a message the team can act on. */
  db?: string;
  /** New page id, on create. */
  pageId?: string;
  /** Properties that were refused, each with the reason. */
  dropped?: DroppedField[];
  /** Why it was skipped, or what the API said when it failed. */
  message?: string;
}

/**
 * Write one item through to Notion and report honestly what happened.
 *
 * Never throws. But unlike the old fire-and-forget version it never lies
 * either: a failure comes back as a failure so the caller can tell the team
 * their edit did not leave the building.
 */
export async function syncToNotion(
  resource: string,
  action: 'create' | 'update' | 'archive',
  item: Record<string, unknown>,
  relationIndex: NameToIdIndex = {},
): Promise<NotionSyncResult> {
  const cfg = NOTION_RESOURCES[resource];
  if (!cfg) return { state: 'skipped', message: `${resource} is not backed by Notion` };

  const dbId = process.env[cfg.dbIdEnvVar];
  if (!dbId) return { state: 'skipped', message: `${cfg.dbIdEnvVar} is not set` };
  if (!process.env.NOTION_SECRET) return { state: 'skipped', message: 'NOTION_SECRET is not set' };

  const pageId = item.notionPageId as string | undefined;

  try {
    if (action === 'archive') {
      if (!pageId) return { state: 'skipped', db: cfg.label, message: 'no Notion page to archive' };
      await notionArchive(pageId);
      return { state: 'written', db: cfg.label, pageId };
    }

    const intended = cfg.toIntended(item);

    // Only pay for the name to id lookup when this edit actually needs it.
    let index = relationIndex;
    if (!Object.keys(index).length && needsRelationIndex(cfg.schema, intended)) {
      index = await loadRelationIndex();
    }

    const { properties, dropped } = buildProperties(cfg.schema, intended, index);

    if (!Object.keys(properties).length) {
      return {
        state: 'failed',
        db: cfg.label,
        dropped,
        message: 'nothing in this edit maps to a real property',
      };
    }

    if (action === 'create') {
      const newId = await notionCreate(dbId, properties);
      return {
        state: dropped.length ? 'partial' : 'written',
        db: cfg.label,
        pageId: newId,
        dropped: dropped.length ? dropped : undefined,
      };
    }

    if (!pageId) {
      return { state: 'skipped', db: cfg.label, message: 'no Notion page id on this item' };
    }
    await notionUpdate(pageId, properties);
    return {
      state: dropped.length ? 'partial' : 'written',
      db: cfg.label,
      pageId,
      dropped: dropped.length ? dropped : undefined,
    };
  } catch (err) {
    return {
      state: 'failed',
      db: cfg.label,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
