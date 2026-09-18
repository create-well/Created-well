// Notion REST API v1 page types and per-database normalizers.
// No `any`. All property extraction is typed and narrowed.
// Import this file from server-side functions only (api/ directory).
//
// Property name conventions — update if your Notion DB schema uses different names.
// Each normalizer tries aliases in order; the first non-empty match wins.

import type { Task, Station, ForumPost, CoFlowDate } from '../app/components/api';

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

function getDate(p: NotionPropValue | undefined): string {
  if (!p || p.type !== 'date') return '';
  return (p as NPropDate).date?.start ?? '';
}

function getPeople(p: NotionPropValue | undefined): string {
  if (!p || p.type !== 'people') return '';
  return (p as NPropPeople).people[0]?.name ?? '';
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
// Stable across fetches; collision probability negligible for small datasets.
export function stableId(notionId: string): number {
  return parseInt(notionId.replace(/-/g, '').slice(0, 7), 16) || 0;
}

// ── Status / priority maps ────────────────────────────────────────────────────

const TASK_STATUS_MAP: Record<string, Task['status']> = {
  'todo':         'todo',
  'not started':  'todo',
  'not_started':  'todo',
  'backlog':      'todo',
  'open':         'todo',
  'in progress':  'in_progress',
  'in_progress':  'in_progress',
  'doing':        'in_progress',
  'active':       'in_progress',
  'done':         'done',
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

const FLOW_STATUS_MAP: Record<string, CoFlowDate['status']> = {
  'upcoming':   'upcoming',
  'scheduled':  'upcoming',
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
// Notion properties (first match wins):
//   Title    : "Name" | "Task" | "Title"
//   Assignee : "Person" | "Assigned To" | "Assignee" | "Owner"
//   Status   : "Status" | "Task Status"
//   Priority : "Priority" | "Urgency"
//   Due date : "Due Date" | "Due" | "Deadline"
//   Category : "Category" | "Type" | "Label"
//   Source   : "Source" | "Notes" | "Description"

export function normalizeMove(page: NotionPage): Task {
  const p = page.properties;
  const rawStatus   = getSelect(pick(p, 'Status', 'Task Status')).toLowerCase();
  const rawPriority = getSelect(pick(p, 'Priority', 'Urgency')).toLowerCase();
  const personRaw   =
    getSelect(pick(p, 'Person', 'Assigned To', 'Assignee', 'Owner')) ||
    getPeople(pick(p, 'Assigned To', 'Assignee', 'Person', 'Owner'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    person:       personRaw.toLowerCase(),
    title:        getText(pick(p, 'Name', 'Task', 'Title')) || 'Untitled',
    status:       TASK_STATUS_MAP[rawStatus]   ?? 'todo',
    priority:     TASK_PRIORITY_MAP[rawPriority] ?? 'medium',
    due_date:     getDate(pick(p, 'Due Date', 'Due', 'Deadline')) || undefined,
    category:     getSelect(pick(p, 'Category', 'Type', 'Label'))  || undefined,
    source:       getText(pick(p, 'Source', 'Notes', 'Description')) || undefined,
    created_at:   page.created_time,
  };
}

// ── PEOPLE → Station ──────────────────────────────────────────────────────────
// Notion properties:
//   Title    : "Name" | "Title"
//   Emoji    : "Emoji" | "Icon"
//   Status   : "Status" | "State"
//   Desc     : "Description" | "Bio" | "Notes" | "About"
//   Owner    : "Owner" | "Lead" | "Person" | "Contact"

export function normalizePerson(page: NotionPage): Station {
  const p = page.properties;
  const ownerRaw =
    getSelect(pick(p, 'Owner', 'Lead', 'Person', 'Contact')) ||
    getPeople(pick(p, 'Owner', 'Lead', 'Person', 'Contact')) ||
    getText(pick(p, 'Owner', 'Lead'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    emoji:        getText(pick(p, 'Emoji', 'Icon')) || getSelect(pick(p, 'Emoji', 'Icon')) || '👤',
    name:         getText(pick(p, 'Name', 'Title')) || 'Untitled',
    status:       getSelect(pick(p, 'Status', 'State')) || 'active',
    description:  getText(pick(p, 'Description', 'Bio', 'Notes', 'About')) || '',
    owner:        ownerRaw.toLowerCase(),
    created_at:   page.created_time,
  };
}

// ── CONTENT → ForumPost ───────────────────────────────────────────────────────
// Notion properties:
//   Content : "Content" | "Name" | "Post" | "Title"
//   Author  : "Author" | "Posted By" | "Person" | "By"
//   Tag     : "Tag" | "Category" | "Type"

export function normalizeContent(page: NotionPage): ForumPost {
  const p = page.properties;
  const authorRaw =
    getSelect(pick(p, 'Author', 'Posted By', 'Person', 'By')) ||
    getPeople(pick(p, 'Author', 'Posted By', 'Person'));

  return {
    id:           stableId(page.id),
    notionPageId: page.id,
    author:       authorRaw.toLowerCase() || 'anonymous',
    content:      getText(pick(p, 'Content', 'Name', 'Post', 'Title')) || '',
    tag:          getSelect(pick(p, 'Tag', 'Category', 'Type')) || undefined,
    created_at:   page.created_time,
  };
}

// ── FLOWS → CoFlowDate ────────────────────────────────────────────────────────
// FLOWS is the only dated table.
// Notion properties:
//   Date       : "Date" | "Session Date" | "Meeting Date"
//   Location   : "Location" | "Place" | "Venue"
//   Host       : "Host" | "Facilitator" | "Lead"
//   Theme      : "Theme" | "Topic"
//   Status     : "Status" | "State"
//   Start Time : "Start Time" | "Start"
//   End Time   : "End Time" | "End"
//   Time Range : "Time Range" | "Time"
//   Notes      : "Notes" | "Description"
//   Session Notes: "Session Notes" | "Recap"

export function normalizeFlow(page: NotionPage): CoFlowDate {
  const p = page.properties;
  const hostRaw =
    getSelect(pick(p, 'Host', 'Facilitator', 'Lead')) ||
    getPeople(pick(p, 'Host', 'Facilitator', 'Lead'));
  const rawStatus = getSelect(pick(p, 'Status', 'State')).toLowerCase();
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
      'TBD',
    host:         hostRaw.toLowerCase() || undefined,
    theme:        getText(pick(p, 'Theme', 'Topic'))  || undefined,
    rsvp:         {},
    agendaItems:  [],
    agendaLocked: false,
    notes:        getText(pick(p, 'Notes', 'Description')) || '',
    vibeCheck:    '',
    sessionNotes: getText(pick(p, 'Session Notes', 'Recap')) || undefined,
    attendees:    [],
    status:       FLOW_STATUS_MAP[rawStatus] ?? 'upcoming',
    created_at:   page.created_time,
  };
}
