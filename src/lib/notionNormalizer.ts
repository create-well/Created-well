// Notion REST API v1 page types and per-database normalizers.
// No `any`. All property extraction is typed and narrowed.
// Import this file from server-side functions only (api/ directory).
//
// Property name conventions match the Create Well OS Notion schema:
//   MOVES  : Name, Owner (Relation→PEOPLE), Flow (Relation→FLOWS),
//             Due, Status (Now/Next/Done/Dropped), Type, Blocked By, Touchpoint
//   PEOPLE : Name, Owner (Person), Roles, Consent, Consent Captured,
//             Next Invitation, Pathway Stage, Bench Stage, Interest Signal
//   FLOWS  : Name, Type, Date, Status, Phase, Flow Keeper (Relation→PEOPLE),
//             Hard Stop, Desired Body-Feel, Public URL, Retro
//   CONTENT: Name, Flow (Relation→FLOWS), Content Type, Audience,
//             Status, Final?, Publish Date, URL, Where

import type { Task, Station, ForumPost, CoFlowDate, RevenueItem, Workshop } from '../app/components/api';

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

// Deterministic integer ID from Notion UUID (first 7 hex chars → ≤268 M).
export function stableId(notionId: string): number {
  return parseInt(notionId.replace(/-/g, '').slice(0, 7), 16) || 0;
}

// ── Status / priority maps ────────────────────────────────────────────────────

// MOVES Status values (Create Well OS canonical):
//   Now → actively being worked on → in_progress
//   Next → queued, ready to pick up → todo
//   Done → completed → done
//   Dropped → cancelled/deprioritised → done (no separate client state)
const TASK_STATUS_MAP: Record<string, Task['status']> = {
  // Create Well MOVES canonical values
  'now':          'in_progress',
  'next':         'todo',
  'done':         'done',
  'dropped':      'done',
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

// FLOWS Status values (Create Well OS canonical): Scheduled, Planning, Confirmed, Wrapped, Cancelled
const FLOW_STATUS_MAP: Record<string, CoFlowDate['status']> = {
  // Create Well FLOWS canonical values
  'scheduled':  'upcoming',
  'planning':   'upcoming',
  'confirmed':  'upcoming',
  'wrapped':    'archived',
  'cancelled':  'archived',
  'canceled':   'archived',
  // Generic fallbacks
  'upcoming':   'upcoming',
  'future':     'upcoming',
  'planned':    'upcoming',
  'active':     'active',
  'in progress':'active',
  'live':       'active',
  'current':    'active',
  'archived':   'archived',
  'past':       'archived',
  'done':       'archived',
  'completed':  'archived',
};

// ── MOVES → Task ──────────────────────────────────────────────────────────────
// Canonical MOVES schema (Create Well OS):
//   Name        : Title
//   Owner       : Relation → PEOPLE (resolves to person field via relation ID)
//   Flow        : Relation → FLOWS
//   Due         : Date
//   Status      : Select (Now / Next / Done / Dropped)
//   Type        : Select (Prep / Day-of / Follow-up / Admin / Content)
//   Blocked By  : Text
//   Person      : Relation → PEOPLE (relationship follow-up, secondary)
//   Touchpoint  : Select

export function normalizeMove(page: NotionPage): Task {
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

  // Blocked By is the CR8W canonical name for what blocks this Move
  const blockedBy = getText(pick(p, 'Blocked By', 'Source', 'Notes', 'Description'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    person:       personRaw.toLowerCase(),
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
// emoji defaults to '👤'. description surfaces Roles as a comma-joined string.
// status maps Pathway Stage. owner maps the Notion-user Owner.

export function normalizePerson(page: NotionPage): Station {
  const p = page.properties;

  const ownerRaw =
    getPeople(pick(p, 'Owner', 'Lead', 'Person', 'Contact')) ||
    getSelect(pick(p, 'Owner', 'Lead', 'Person', 'Contact')) ||
    getText(pick(p, 'Owner', 'Lead'));

  const roles = getMultiSelect(pick(p, 'Roles')).join(', ');
  const pathwayStage = getSelect(pick(p, 'Pathway Stage', 'Stage', 'Status', 'State'));
  const description =
    roles ||
    getText(pick(p, 'Description', 'Bio', 'Notes', 'About'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    emoji:        '👤',
    name:         getText(pick(p, 'Name', 'Title')) || 'Untitled',
    status:       pathwayStage || getSelect(pick(p, 'Status', 'State')) || 'active',
    description,
    owner:        ownerRaw.toLowerCase(),
    created_at:   page.created_time,
  };
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

export function normalizeContent(page: NotionPage): ForumPost {
  const p = page.properties;

  // CONTENT has no author field; use Audience as a rough proxy
  const audienceRaw = getSelect(pick(p, 'Audience', 'Author', 'Posted By', 'Person', 'By'));
  const statusRaw   = getSelect(pick(p, 'Status', 'State'));
  const isFinal     = getCheckbox(pick(p, 'Final?', 'Final', 'Published'));
  const contentUrl  = getUrl(pick(p, 'URL', 'Link', 'Source'));

  // Surface the URL and status in the content field so the UI can use them
  const name = getText(pick(p, 'Name', 'Title', 'Content', 'Post'));
  const extra = contentUrl ? ` [${statusRaw || 'draft'}]` : '';

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    author:       audienceRaw.toLowerCase() || 'team',
    content:      (name || 'Untitled') + extra,
    tag:          getSelect(pick(p, 'Content Type', 'Type', 'Tag', 'Category')) || undefined,
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

  // Type describes the kind of gathering; use as theme when no theme field exists
  const typeRaw  = getSelect(pick(p, 'Type', 'Kind', 'Category'));
  const themeRaw = getText(pick(p, 'Theme', 'Topic')) || typeRaw;

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
    host:         hostRaw.toLowerCase() || undefined,
    theme:        themeRaw || undefined,
    rsvp:         {},
    agendaItems:  [],
    agendaLocked: false,
    notes:        notesRaw,
    vibeCheck:    getSelect(pick(p, 'Water state', 'Water State', 'Vibe')) || '',
    sessionNotes: retro || undefined,
    attendees:    [],
    status:       FLOW_STATUS_MAP[rawStatus] ?? 'upcoming',
    created_at:   page.created_time,
  };
}

// ── MONEY → RevenueItem ──────────────────────────────────────────────────────
// Canonical MONEY schema (Create Well OS):
//   Name     : Title (Opportunity / Sponsor / Item name)
//   Amount   : Number (Currency value)
//   Type     : Select (Sponsorship / Workshop / Open Studio / Geyser / Grant)
//   Status   : Select (Projected / Committed / Cleared / Invoiced / Wrapped)
//   Date     : Date (Transaction or commitment date)
//   Flow     : Relation → FLOWS (associated gathering or program)
//   Closer   : Relation → PEOPLE (lead holder)
//   Notes    : Rich Text

export function normalizeMoney(page: NotionPage): RevenueItem {
  const p = page.properties;

  const rawType = getSelect(pick(p, 'Type', 'Category', 'Stream')).toLowerCase();
  const rawStatus = getSelect(pick(p, 'Status', 'State', 'Payment Status')).toLowerCase();

  const TYPE_MAP: Record<string, RevenueItem['type']> = {
    sponsorship: 'sponsorship',
    sponsor: 'sponsorship',
    workshop: 'workshop',
    'open studio': 'open_studio',
    open_studio: 'open_studio',
    geyser: 'geyser',
    grant: 'grant',
  };

  const STATUS_MAP: Record<string, RevenueItem['status']> = {
    projected: 'projected',
    committed: 'committed',
    cleared: 'cleared',
    paid: 'cleared',
    invoiced: 'invoiced',
    wrapped: 'wrapped',
  };

  const closerRelationId = getRelationFirstId(pick(p, 'Closer', 'Lead', 'Owner'));
  const closerText =
    getPeople(pick(p, 'Closer', 'Lead', 'Owner')) ||
    getSelect(pick(p, 'Closer', 'Lead', 'Owner'));

  const flowRelationId = getRelationFirstId(pick(p, 'Flow', 'Gathering', 'Event'));

  return {
    id: stableId(page.id),
    notionPageId: page.id,
    title: getText(pick(p, 'Name', 'Title', 'Item')) || 'Untitled Stream',
    amount: (pick(p, 'Amount', 'Value', 'Total') as NPropNumber)?.number ?? 0,
    type: TYPE_MAP[rawType] ?? 'other',
    status: STATUS_MAP[rawStatus] ?? 'projected',
    date: getDate(pick(p, 'Date', 'Due Date', 'Cleared Date')) || undefined,
    flowId: flowRelationId || undefined,
    closer: (closerText || closerRelationId).toLowerCase() || undefined,
    notes: getText(pick(p, 'Notes', 'Description')) || undefined,
    created_at: page.created_time,
  };
}

// ── WORKSHOPS → Workshop ─────────────────────────────────────────────────────
export function normalizeWorkshop(page: NotionPage): Workshop {
  const p = page.properties;
  const rawFacilitator = (getSelect(pick(p, 'Facilitator', 'Host', 'Lead')) || 'monny').toLowerCase();
  const rawStatus = (getSelect(pick(p, 'Status', 'State')) || 'planning').toLowerCase();

  const STATUS_MAP: Record<string, Workshop['status']> = {
    ideation: 'ideation',
    planning: 'planning',
    scheduled: 'scheduled',
    completed: 'completed',
    done: 'completed',
  };

  const FACILITATOR_LIST = ['monny', 'sunshine', 'bingle', 'pia', 'omar', 'event-support'] as const;
  const facilitator = FACILITATOR_LIST.includes(rawFacilitator as any)
    ? (rawFacilitator as Workshop['facilitator'])
    : 'monny';

  return {
    id: stableId(page.id),
    title: getText(pick(p, 'Name', 'Title', 'Workshop Title')) || 'Untitled Workshop',
    description: getText(pick(p, 'Description', 'Notes', 'About')) || '',
    facilitator,
    date: getDate(pick(p, 'Date', 'Workshop Date')) || '',
    capacity: (pick(p, 'Capacity', 'Max Attendees') as NPropNumber)?.number ?? 20,
    participants: (pick(p, 'Participants', 'Attendees', 'Signups') as NPropNumber)?.number ?? 0,
    location: getText(pick(p, 'Location', 'Venue')) || 'TBD',
    tags: getMultiSelect(pick(p, 'Tags', 'Category', 'Type')),
    googleDocLink: getUrl(pick(p, 'Google Doc', 'Run of Show', 'URL')) || undefined,
    status: STATUS_MAP[rawStatus] ?? 'planning',
    created_at: page.created_time,
  };
}
