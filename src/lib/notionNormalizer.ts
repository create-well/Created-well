// Notion REST API v1 page types and per-database normalizers.
// No `any`. All property extraction is typed and narrowed.
// Import this file from server-side functions only (api/ directory).
//
// Property name conventions match the Create Well OS Notion schema:
//   MOVES  : Name, Owner (Relation→PEOPLE), Flow (Relation→FLOWS),
//             Due, Status (Now/Next/Done/Blocked/Dropped), Type, Blocked By, Touchpoint
//   PEOPLE : Name, Owner (Person), Roles, Consent, Consent Captured,
//             Next Invitation, Pathway Stage, Bench Stage, Interest Signal
//   FLOWS  : Name, Type, Date, Status, Phase, Flow Keeper (Relation→PEOPLE),
//             Hard Stop, Desired Body-Feel, Public URL, Retro
//   CONTENT: Name, Flow (Relation→FLOWS), Content Type, Audience,
//             Status, Final?, Publish Date, URL, Where

import type { Task, Station, ForumPost, CoFlowDate, FlowType } from '../app/components/api';

// ── CONTENT → FLOWS relation reader ─────────────────────────────
// Canonical home is THIS module: api/dashboard.ts loads it in the Vercel
// function graph, which cannot carry a runtime `.ts` import specifier
// (production boot failure, 2026-11-02). contentFlowRelation.ts re-exports
// these for the client and test graphs; do not move them back.
/** Internal CONTENT → FLOWS relation only. Never use in the public projection. */
export interface ContentFlowRelation {
  ids: string[];
  complete: boolean;
}

/** Accept only full Notion page UUIDs; do not join on shortened display IDs. */
export function fullPageId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  if (!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value)) return null;
  return compact.toLowerCase();
}

/** Missing/wrong-type properties are unknown, not empty. Truncated lists remain partial. */
export function readContentFlowRelation(property: unknown): ContentFlowRelation | null {
  if (!property || typeof property !== 'object') return null;
  const p = property as { type?: unknown; relation?: unknown; has_more?: unknown };
  if (p.type !== 'relation' || !Array.isArray(p.relation)) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  let complete = p.has_more === false;
  for (const entry of p.relation) {
    const raw = entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : null;
    const key = fullPageId(raw);
    if (!key || typeof raw !== 'string') { complete = false; continue; }
    if (!seen.has(key)) { seen.add(key); ids.push(raw); }
  }
  return { ids, complete };
}

// ── Notion property value types ───────────────────────────────────────────────

export interface NotionRT {
  plain_text: string;
  href: string | null;
}

export interface NPropTitle       { type: 'title';        title: NotionRT[] }
export interface NPropRichText    { type: 'rich_text';    rich_text: NotionRT[] }
export interface NPropSelect      { type: 'select';       select: { id: string; name: string; color: string } | null }
export interface NPropStatus      { type: 'status';       status: { id: string; name: string; color: string } | null }
export interface NPropMultiSelect { type: 'multi_select'; multi_select: Array<{ id: string; name: string; color: string }> }
export interface NPropDate        { type: 'date';         date: { start: string; end: string | null; time_zone: string | null } | null }
export interface NPropNumber      { type: 'number';       number: number | null }
export interface NPropCheckbox    { type: 'checkbox';     checkbox: boolean }
export interface NPropUrl         { type: 'url';          url: string | null }
export interface NPropPeople      { type: 'people';       people: Array<{ id: string; name: string; object: string }> }
export interface NPropRelation    { type: 'relation';     relation: Array<{ id: string }> }
export interface NPropUnknown     { type: string }

export type NotionPropValue =
  | NPropTitle | NPropRichText | NPropSelect | NPropStatus | NPropMultiSelect
  | NPropDate | NPropNumber | NPropCheckbox | NPropUrl | NPropPeople
  | NPropRelation | NPropUnknown;

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionPropValue>;
}

// ── Extractor helpers ─────────────────────────────────────────────────────────

function getText(p: NotionPropValue | undefined): string {
  if (!p) return '';
  if (p.type === 'title')     return (p as NPropTitle).title.map(r => r.plain_text).join('');
  if (p.type === 'rich_text') return (p as NPropRichText).rich_text.map(r => r.plain_text).join('');
  return '';
}

function getSelect(p: NotionPropValue | undefined): string {
  if (!p) return '';
  if (p.type === 'select')       return (p as NPropSelect).select?.name ?? '';
  if (p.type === 'status')       return (p as NPropStatus).status?.name ?? '';
  if (p.type === 'multi_select') return (p as NPropMultiSelect).multi_select[0]?.name ?? '';
  return '';
}

function getMultiSelect(p: NotionPropValue | undefined): string[] {
  if (!p || p.type !== 'multi_select') return [];
  return (p as NPropMultiSelect).multi_select.map(o => o.name);
}

function getDate(p: NotionPropValue | undefined): string {
  if (!p || p.type !== 'date') return '';
  return (p as NPropDate).date?.start ?? '';
}

function getPeople(p: NotionPropValue | undefined): string {
  if (!p || p.type !== 'people') return '';
  return (p as NPropPeople).people[0]?.name ?? '';
}

function getPeopleAll(p: NotionPropValue | undefined): string[] {
  if (!p || p.type !== 'people') return [];
  return (p as NPropPeople).people.map(u => u.name);
}

// Returns first relation page ID (UUID). Callers should cross-reference with
// the normalised PEOPLE/FLOWS list when a display name is needed.
function getRelationFirstId(p: NotionPropValue | undefined): string {
  if (!p || p.type !== 'relation') return '';
  return (p as NPropRelation).relation[0]?.id ?? '';
}

function getUrl(p: NotionPropValue | undefined): string {
  if (!p || p.type !== 'url') return '';
  return (p as NPropUrl).url ?? '';
}

function getCheckbox(p: NotionPropValue | undefined): boolean {
  if (!p || p.type !== 'checkbox') return false;
  return (p as NPropCheckbox).checkbox;
}

// Try property name aliases in order; return first found.
function pick(
  props: Record<string, NotionPropValue>,
  ...aliases: string[]
): NotionPropValue | undefined {
  for (const alias of aliases) {
    if (props[alias] !== undefined) return props[alias];
  }
  return undefined;
}

// Deterministic integer ID from a Notion UUID: a 53-bit hash (cyrb53)
// over the FULL id string. The previous implementation parsed only the
// first 7 hex characters; pages created in the same batch share long
// UUID prefixes, so those ids collided (11 of 15 live MOVES rows shared
// just two values). Every list keyed by these ids reconciled against
// duplicate React keys, and filter round-trips in the Moves list
// accumulated duplicate rows in-session. Hashing the whole id keeps the
// mapping deterministic across requests and deploys while making
// collisions negligible at this scale.
export function stableId(notionId: string): number {
  const str = String(notionId ?? '');
  if (!str) return 0;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ── Status / priority maps ────────────────────────────────────────────────────

// MOVES Status values (Create Well OS canonical):
//   Now → actively being worked on → in_progress
//   Next → queued, ready to pick up → todo
//   Done → completed → done
//   Blocked → blocked, with any reason carried separately in Blocked By
//   Dropped → its own client state, not done
const TASK_STATUS_MAP: Record<string, Task['status']> = {
  // Create Well MOVES canonical values
  'now':          'in_progress',
  'next':         'todo',
  'done':         'done',
  'dropped':      'dropped',
  // Legacy / generic fallbacks
  'todo':         'todo',
  'not started':  'todo',
  'not_started':  'todo',
  'backlog':      'todo',
  'open':         'todo',
  'in progress':  'in_progress',
  'in_progress':  'in_progress',
  'doing':        'in_progress',
  'active':       'in_progress',
  'complete':     'done',
  'completed':    'done',
  'closed':       'done',
  'blocked':      'blocked',
  'on hold':      'blocked',
  'on_hold':      'blocked',
};

const TASK_PRIORITY_MAP: Record<string, Task['priority']> = {
  'high':   'high',
  'urgent': 'high',
  'medium': 'medium',
  'med':    'medium',
  'normal': 'medium',
  'low':    'low',
};

// FLOWS Status values — hub CMS DB uses Upcoming/Active/Archived;
// operational FLOWS DB uses Idea/Scheduled/Ready/Approved/Happened/Wrapped/Cancelled.
// Both sets are handled here so either source round-trips cleanly.
const FLOW_STATUS_MAP: Record<string, CoFlowDate['status']> = {
  // Hub CMS (FLOWS hub DB — source of truth for dashboard reads)
  'upcoming':  'scheduled',
  'active':    'happened',
  'archived':  'wrapped',
  // Operational FLOWS DB canonical values
  'idea':      'idea',
  'ready':     'ready',
  'approved':  'approved',
  'scheduled': 'scheduled',
  'happened':  'happened',
  'wrapped':   'wrapped',
  'cancelled': 'cancelled',
  'canceled':  'cancelled',
};

// ── MOVES → Task ──────────────────────────────────────────────────────────────
// Canonical MOVES schema (Create Well OS):
//   Name        : Title
//   Owner       : Relation → PEOPLE (resolves to person field via relation ID)
//   Flow        : Relation → FLOWS
//   Due         : Date
//   Status      : Select (Now / Next / Done / Blocked / Dropped)
//   Type        : Select (Prep / Day-of / Follow-up / Admin / Content)
//   Blocked By  : Text
//   Person      : Relation → PEOPLE (relationship follow-up, secondary)
//   Touchpoint  : Select

// ── MOVES owner resolution ────────────────────────────────────────────────────
// MOVES carries Owner as a Relation → PEOPLE. A bare page cannot resolve
// that relation, so normalizeMove alone stores the relation ID as a last
// resort and the assignee composer renders "Assignee not listed" for it.
// buildOwnerSlugIndex builds the id → slug map from the PEOPLE pages the
// dashboard already loads (slug = the person's Name, lowercased: the key
// space the role table uses). Callers that hold both collections pass the
// index to normalizeMove; callers without it keep the legacy fallback.
//
// MULTI-OWNER RULE (named 2026-11-02, not inherited silently): when a
// Move carries several Owner relations, the FIRST target wins. If that
// target resolves in the index, its slug is the Move's person; if it
// does not resolve, the stored fallback (the lowercased relation ID)
// stands, so genuinely unresolvable values keep rendering unlisted.
export function buildOwnerSlugIndex(peoplePages: NotionPage[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const page of peoplePages) {
    const name = getText(pick(page.properties, 'Name')).trim().toLowerCase();
    if (name) index.set(page.id.toLowerCase(), name);
  }
  return index;
}

export function normalizeMove(page: NotionPage, ownerSlugs?: ReadonlyMap<string, string>): Task {
  const p = page.properties;

  const rawStatus   = getSelect(pick(p, 'Status', 'Task Status')).toLowerCase();
  const rawPriority = getSelect(pick(p, 'Priority', 'Urgency')).toLowerCase();

  // Owner is a Relation in MOVES (operational schema). Hub CMS schema uses a
  // Select named "Person". We try all aliases; store relation ID as last resort.
  const ownerRelationId = getRelationFirstId(pick(p, 'Owner'));
  const ownerText =
    getSelect(pick(p, 'Person', 'Assigned To', 'Assignee')) ||
    getPeople(pick(p, 'Person', 'Assigned To', 'Assignee', 'Owner'));
  // Prefer text if present (it's already a name), else store relation ID
  const personRaw = ownerText || ownerRelationId;
  // Owner-resolution: only the relation-ID fallback resolves (a text or
  // people-property value is already a name). First target wins per the
  // multi-owner rule above; an unresolvable target keeps the fallback.
  let person = personRaw.toLowerCase();
  if (!ownerText && ownerRelationId && ownerSlugs) {
    const slug = ownerSlugs.get(ownerRelationId.toLowerCase());
    if (slug) person = slug;
  }

  // Blocked By is the CR8W canonical name for what blocks this Move
  const blockedBy = getText(pick(p, 'Blocked By', 'Source', 'Notes', 'Description'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    person:       person,
    title:        getText(pick(p, 'Name', 'Task', 'Title')) || 'Untitled',
    status:       TASK_STATUS_MAP[rawStatus]    ?? 'todo',
    priority:     TASK_PRIORITY_MAP[rawPriority] ?? 'medium',
    due_date:     getDate(pick(p, 'Due', 'Due Date', 'Deadline')) || undefined,
    category:     getSelect(pick(p, 'Type', 'Category', 'Label'))  || undefined,
    source:       blockedBy || undefined,
    created_at:   page.created_time,
  };
}

// ── PEOPLE → Station ──────────────────────────────────────────────────────────
// Canonical PEOPLE schema (Create Well OS):
//   Name            : Title
//   Owner           : Person (Notion user who holds this relationship)
//   Roles           : Multi-select
//   Consent         : Multi-select
//   Consent Captured: Date
//   Next Invitation : Date
//   Pathway Stage   : Select
//   Bench Stage     : Select (Observer / Shadow / Solo / Anchor)
//   Interest Signal : Select
//
// Station is an imperfect mapping but the closest existing type.
// emoji defaults to '👤'. description surfaces Roles as a comma-joined string
// (structured only — Description prose rides descriptionFull, detail views only).
// status maps Pathway Stage. owner maps the Notion-user Owner.

export function normalizePerson(page: NotionPage): Station {
  const p = page.properties;

  const ownerRaw =
    getPeople(pick(p, 'Owner', 'Lead', 'Person', 'Contact')) ||
    getSelect(pick(p, 'Owner', 'Lead', 'Person', 'Contact')) ||
    getText(pick(p, 'Owner', 'Lead'));

  const roles = getMultiSelect(pick(p, 'Roles')).join(', ');
  const pathwayStage = getSelect(pick(p, 'Pathway Stage', 'Stage', 'Status', 'State'));
  // Card field = the structured Roles string only. The raw
  // Description prose NEVER falls through to it: member cards
  // render nothing from Description (UX ruling, register 1346 —
  // the prose is provenance plus a live to-do, not a person fact).
  // The prose rides descriptionFull instead, carried in full by
  // the detail view until the data cleanup lands.
  const description = roles;
  const descriptionFull = getText(pick(p, 'Description', 'Bio', 'Notes', 'About'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    emoji:        '👤',
    name:         getText(pick(p, 'Name', 'Title')) || 'Untitled',
    status:       pathwayStage || getSelect(pick(p, 'Status', 'State')) || 'active',
    description,
    descriptionFull,
    owner:        ownerRaw.toLowerCase(),
    created_at:   page.created_time,
  };
}

/**
 * PEOPLE care aggregate for Home's Needs care panel (design diff
 * §4: "consent gaps (PEOPLE)" — counts only, never values).
 * A person counts as captured when the Consent multi-select carries
 * any option OR a Consent Captured date is set; otherwise the row is
 * a consent gap. Reads the raw pages dashboard.ts already fetched;
 * no per-person data leaves this function.
 */
export function peopleCareCounts(pages: NotionPage[]): { total: number; consentGaps: number } {
  let consentGaps = 0;
  for (const page of pages) {
    const p = page.properties;
    const captured =
      getMultiSelect(pick(p, 'Consent')).length > 0 ||
      getDate(pick(p, 'Consent Captured')) !== '';
    if (!captured) consentGaps += 1;
  }
  return { total: pages.length, consentGaps };
}

/**
 * OPEN ASKS care aggregate for Home's Needs care panel (design diff
 * §4: "unanswered asks" — counts only, never values). The field of
 * record is Status (select): a row counts as unanswered when Status
 * is Open or Waiting. Held is a deliberate hold and Parked / Done /
 * Closed / Answered are settled states; all are excluded (packet:
 * open-asks-home-count-packet-2026-10-30, settled path 2026-10-30).
 * Reads the raw pages the sync path already fetched; no per-ask
 * data leaves this function.
 */
export function openAsksCareCounts(pages: NotionPage[]): { total: number; unanswered: number } {
  let unanswered = 0;
  for (const page of pages) {
    const status = getSelect(pick(page.properties, 'Status'));
    if (status === 'Open' || status === 'Waiting') unanswered += 1;
  }
  return { total: pages.length, unanswered };
}

// ── CONTENT → ForumPost ───────────────────────────────────────────────────────
// Canonical CONTENT schema (Create Well OS):
//   Name         : Title
//   Flow         : Relation → FLOWS
//   Content Type : Select (defines the deliverable)
//   Audience     : Select (Public / Team)
//   Status       : Select (Draft / Ready / Published / Archived)
//   Final?       : Checkbox (publishing gate)
//   Publish Date : Date
//   URL          : URL
//   Where        : Select (where the asset lives)
//
// ForumPost is an imperfect mapping. content = Name, tag = Content Type.
// author is empty for CONTENT (no author field); falls back to 'team'.

export function normalizeContent(page: NotionPage): ForumPost & { flowRelation: ReturnType<typeof readContentFlowRelation> } {
  const p = page.properties;

  // CONTENT has no author field; use Audience as a rough proxy
  const audienceRaw = getSelect(pick(p, 'Audience', 'Author', 'Posted By', 'Person', 'By'));
  const statusRaw   = getSelect(pick(p, 'Status', 'State'));
  const isFinal     = getCheckbox(pick(p, 'Final?', 'Final', 'Published'));
  const contentUrl  = getUrl(pick(p, 'URL', 'Link', 'Source'));

  // Surface the URL and status in the content field so the UI can use them
  const name = getText(pick(p, 'Name', 'Title', 'Content', 'Post'));
  const extra = contentUrl ? ` [${statusRaw || 'draft'}]` : '';

  // Registry-mirror rows (the CMS registry mirror in CONTENT) carry the
  // literal marker leading their Registry Details. The flag rides the
  // record so note/post reshapes can exclude mirror rows while the
  // content snapshot keeps them (register 1435, Leg 1).
  const registryMirror = getText(pick(p, 'Registry Details')).trimStart().startsWith('registry-mirror');

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    registryMirror,
    flowRelation: readContentFlowRelation(p['Flow']),
    author:       audienceRaw.toLowerCase() || 'team',
    content:      (name || 'Untitled') + extra,
    tag:          getSelect(pick(p, 'Content Type', 'Type', 'Tag', 'Category')) || undefined,
    created_at:   page.created_time,
  };
}

// ── MONEY → MoneyRecord ───────────────────────────────────────────────────────
// Canonical MONEY schema (Create Well OS):
//   Name   : Title  (description of the transaction / line item)
//   Stage  : Select (Possible / Committed / Invoiced / Received / Paid)
//   Kind   : Select (Sponsorship / Ticket / Workshop Fee / Facilitator Pay / Venue / Production)
//   Direction : Select (In / Out)
//   Amount : Number
//   Expected / Actual : Date
//   Flow   : Relation → FLOWS (which gathering this is tied to)
//   Doc    : URL (receipt, invoice, or Drive link)

export interface MoneyRecord {
  id:           number;
  notionPageId: string;
  name:         string;
  amount:       number;
  kind:         string;
  direction:    string;
  stage:        string;
  date:         string;
  flowId:       string;
  docUrl:       string;
  created_at:   string;
}

export function normalizeMoney(page: NotionPage): MoneyRecord {
  const p = page.properties;
  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    name:         getText(pick(p, 'Name', 'Title', 'Description')) || 'Untitled',
    amount:       (p['Amount'] as any)?.number ?? 0,
    kind:         getSelect(pick(p, 'Kind', 'Type', 'Category')) || '',
    direction:    getSelect(pick(p, 'Direction')) || '',
    stage:        getSelect(pick(p, 'Stage')) || '',
    // Expected is the forward-looking date for active records; Actual replaces it
    // once the line item has settled. Older imports may still provide Date.
    date:         getDate(pick(p, 'Actual', 'Expected', 'Date', 'Transaction Date', 'Due')) || '',
    flowId:       getRelationFirstId(pick(p, 'Flow', 'Event', 'Related Flow')) || '',
    docUrl:       getUrl(pick(p, 'Doc', 'Receipt', 'Invoice', 'Link')) || '',
    created_at:   page.created_time,
  };
}

// ── FLOWS → CoFlowDate ────────────────────────────────────────────────────────
// Canonical FLOWS schema (Create Well OS):
//   Name            : Title
//   Type            : Select (gathering type / container)
//   Date            : Date
//   Status          : Select (Scheduled / Planning / Confirmed / Wrapped / Cancelled)
//   Phase           : Select (current production moment)
//   Flow Keeper     : Relation → PEOPLE (accountable holder)
//   Hard Stop       : Text (non-negotiable boundary)
//   Desired Body-Feel: Text (felt design intention)
//   Public URL      : URL
//   Retro           : Text (short Depanty return)

export function normalizeFlow(page: NotionPage): CoFlowDate {
  const p = page.properties;

  // Flow Keeper is a Relation → PEOPLE. Fall back to text/select for legacy.
  const keeperRelationId = getRelationFirstId(pick(p, 'Flow Keeper'));
  const keeperText =
    getPeople(pick(p, 'Flow Keeper', 'Host', 'Facilitator', 'Lead')) ||
    getSelect(pick(p, 'Flow Keeper', 'Host', 'Facilitator', 'Lead'));
  const hostRaw = keeperText || keeperRelationId;

  const rawStatus = getSelect(pick(p, 'Status', 'State', 'Phase')).toLowerCase();

  // Type (hub FLOWS DB select: Podyap/Workshop/Book Club/Open Studio/Pop-Up/Geyser/Internal)
  // Theme (hub FLOWS DB free text — freeform topic label, used alongside Type)
  const typeRaw  = getSelect(pick(p, 'Type', 'Kind', 'Category'));
  const themeRaw = getText(pick(p, 'Theme', 'Topic')) || typeRaw;

  const FLOW_TYPES: FlowType[] = ['Podyap', 'Workshop', 'Book Club', 'Open Studio', 'Pop-Up', 'Geyser', 'Internal'];
  const flowType = FLOW_TYPES.find(t => t.toLowerCase() === typeRaw.toLowerCase()) ?? undefined;

  // Notes: combine Hard Stop and Retro as supplementary context
  const hardStop = getText(pick(p, 'Hard Stop', 'Hard stop', 'Notes', 'Description'));
  const retro    = getText(pick(p, 'Retro', 'Recap', 'Session Notes'));
  const notesRaw = [hardStop, retro].filter(Boolean).join(' | ') || '';

  const startTime = getText(pick(p, 'Start Time', 'Start'));
  const endTime   = getText(pick(p, 'End Time', 'End'));
  const timeRange =
    getText(pick(p, 'Time Range', 'Time')) ||
    (startTime && endTime ? `${startTime} – ${endTime}` : '');

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    date:         getDate(pick(p, 'Date', 'Session Date', 'Meeting Date')),
    timeRange,
    startTime:    startTime || undefined,
    endTime:      endTime   || undefined,
    location:
      getText(pick(p, 'Location', 'Place', 'Venue')) ||
      getSelect(pick(p, 'Location', 'Place', 'Venue')) ||
      getUrl(pick(p, 'Public URL', 'Public Url', 'Link')) ||
      'TBD',
    title:        getText(pick(p, 'Name', 'Title')) || undefined,
    host:         hostRaw.toLowerCase() || undefined,
    theme:        themeRaw || undefined,
    flowType:     flowType,
    rsvp:         {},
    agendaItems:  [],
    agendaLocked: false,
    notes:        notesRaw,
    vibeCheck:    getSelect(pick(p, 'Water state', 'Water State', 'Vibe')) || '',
    sessionNotes: retro || undefined,
    attendees:    [],
    status:       FLOW_STATUS_MAP[rawStatus] ?? 'idea',
    created_at:   page.created_time,
  };
}

// ── EVENTS → EventRecord ──────────────────────────────────────────────────────
// Canonical EVENTS schema (Create Well OS; wired 2026-10-30, Amendment 2):
//   Event           : Title
//   Date            : Date
//   Location        : Text
//   Status          : Select
//   Visibility      : Select
//   Source          : Select
//   Partiful link   : URL
//   (Flow and Related to PEOPLE are Relations — never projected, the
//   standing rule; GCal ID is an internal identifier, not a display field.)
export interface EventRecord {
  id: number;
  notionPageId: string;
  name: string;
  date: string;
  status: string;
  location: string;
  visibility: string;
  source: string;
  link: string;
  created_at: string;
}

export function normalizeEvent(page: NotionPage): EventRecord {
  const p = page.properties;
  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    name:         getText(pick(p, 'Event', 'Name', 'Title')) || 'Untitled',
    date:         getDate(pick(p, 'Date')) || '',
    status:       getSelect(pick(p, 'Status')) || '',
    location:     getText(pick(p, 'Location')) || '',
    visibility:   getSelect(pick(p, 'Visibility')) || '',
    source:       getSelect(pick(p, 'Source')) || '',
    link:         getUrl(pick(p, 'Partiful link', 'Link')) || '',
    created_at:   page.created_time,
  };
}

// ── FEEDBACK → FeedbackRecord ─────────────────────────────────────────────────
// Canonical FEEDBACK schema (Create Well OS; wired 2026-10-30, Amendment 2):
//   Name            : Title
//   Date            : Date
//   Type            : Select
//   Status          : Select
//   Source          : Select
//   Body            : Text (rides this session-gated internal payload like
//   every other source's text fields; Person and Flow are Relations —
//   never projected.)
export interface FeedbackRecord {
  id: number;
  notionPageId: string;
  name: string;
  date: string;
  type: string;
  status: string;
  source: string;
  body: string;
  created_at: string;
}

export function normalizeFeedback(page: NotionPage): FeedbackRecord {
  const p = page.properties;
  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    name:         getText(pick(p, 'Name', 'Title')) || 'Untitled',
    date:         getDate(pick(p, 'Date')) || '',
    type:         getSelect(pick(p, 'Type')) || '',
    status:       getSelect(pick(p, 'Status')) || '',
    source:       getSelect(pick(p, 'Source')) || '',
    body:         getText(pick(p, 'Body')) || '',
    created_at:   page.created_time,
  };
}
