import snapshotJson from '../data/snapshot.json';
import syncJson from '../data/sync-state.json';

export interface DateVal {
  start: string | null;
  end?: string | null;
}

export type PropValue =
  | string
  | number
  | boolean
  | string[]
  | DateVal
  | null
  | undefined;

export interface Row {
  id: string;
  url?: string;
  props: Record<string, any>;
}

export interface PropertyMeta {
  name: string;
  type: string;
  options?: string[];
  relationTarget?: string;
}

export interface SourceData {
  id: string;
  title: string;
  properties: PropertyMeta[];
  rowCount: number;
  rows: Row[];
  stats?: { fillCounts?: Record<string, number> };
}

export const snapshot = snapshotJson as unknown as {
  pulledAt: string;
  sources: Record<string, SourceData>;
};

export const syncState = syncJson as any;

export const SOURCES: Record<string, SourceData> = snapshot.sources;
export const pulledAt: string = snapshot.pulledAt;

export const TITLE_PROP: Record<string, string> = {
  PEOPLE: 'Name',
  FLOWS: 'Name',
  MOVES: 'Name',
  CONTENT: 'Name',
  MONEY: 'Name',
  FEEDBACK: 'Name',
  EVENTS: 'Event',
  'SYNC LEDGER': 'Name',
  'OPEN ASKS': 'Ask',
};

export function titleOf(source: string, row: Row): string {
  const tp = TITLE_PROP[source] || 'Name';
  const v = row.props[tp];
  if (typeof v === 'string' && v.trim()) return v;
  if (typeof v === 'number') return String(v);
  return '(untitled)';
}

/** Global id -> {source, title} index across every source in the snapshot. */
export const rowIndex = new Map<string, { source: string; title: string; row: Row }>();
for (const [source, data] of Object.entries(SOURCES)) {
  for (const row of data.rows || []) {
    rowIndex.set(row.id, { source, title: titleOf(source, row), row });
  }
}

export function source(source: string): SourceData {
  return SOURCES[source];
}

export function propMeta(sourceName: string, propName: string): PropertyMeta | undefined {
  return SOURCES[sourceName]?.properties.find((p) => p.name === propName);
}

export function optionsOf(sourceName: string, propName: string): string[] {
  return propMeta(sourceName, propName)?.options ?? [];
}

export function fillCount(sourceName: string, propName: string): number | null {
  const fc = SOURCES[sourceName]?.stats?.fillCounts;
  if (!fc) return null;
  return typeof fc[propName] === 'number' ? fc[propName] : null;
}

/* ---------- typed value accessors (defensive over the simplified JSON) --- */

export function str(row: Row, name: string): string | null {
  const v = row.props[name];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

export function strList(row: Row, name: string): string[] {
  const v = row.props[name];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export function num(row: Row, name: string): number | null {
  const v = row.props[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function bool(row: Row, name: string): boolean {
  return row.props[name] === true;
}

export function dateVal(row: Row, name: string): DateVal | null {
  const v = row.props[name];
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.start === 'string' && v.start) {
    return v as DateVal;
  }
  return null;
}

export function relIds(row: Row, name: string): string[] {
  const v = row.props[name];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

/* ---------- date helpers -------------------------------------------------
   The snapshot's "today" is pinned to the pull date (2026-10-26) per the
   brief, so relative labels stay true to the data instead of drifting with
   the viewer's clock. Day math uses the YYYY-MM-DD prefix in UTC, which
   keeps labels stable across timezones. */

export const TODAY = '2026-10-26';

function ymdParts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function dayNumber(iso: string): number | null {
  const p = ymdParts(iso);
  if (!p) return null;
  return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const p = ymdParts(iso);
  if (!p) return iso;
  return `${MONTHS[p[1] - 1]} ${p[2]}, ${p[0]}`;
}

export function formatDateVal(dv: DateVal | null): string | null {
  if (!dv || !dv.start) return null;
  const a = formatDate(dv.start);
  if (!a) return null;
  if (dv.end && dv.end.slice(0, 10) !== dv.start.slice(0, 10)) {
    const b = formatDate(dv.end);
    if (b) return `${a} – ${b}`;
  }
  return a;
}

/** Whole days from TODAY to the given date's calendar day. Null if unparseable. */
export function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const a = dayNumber(TODAY);
  const b = dayNumber(iso);
  if (a === null || b === null) return null;
  return b - a;
}

export function relativeDay(iso: string | null | undefined): string | null {
  const d = daysFromToday(iso);
  if (d === null) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d > 1) return `in ${d} days`;
  if (d === -1) return 'yesterday';
  return `${-d} days ago`;
}

/** Sort key for a date value: its start, or '' when absent. */
export function dateSortKey(dv: DateVal | null): string {
  return dv && dv.start ? dv.start : '';
}

/* ---------- geyser marking ------------------------------------------------
   A geyser moment is emergence landing on the snapshot's pull day itself:
   an event day arriving, a release publishing, a flow starting. The mark is
   earned by the data or not at all — never decorative, never forced. */

export const PULL_DAY = pulledAt.slice(0, 10);

/** True when the ISO value's calendar day is the pull day. */
export function isPullDay(iso: string | null | undefined): boolean {
  return !!iso && iso.slice(0, 10) === PULL_DAY;
}

/** The sources whose dates can earn the mark, and the date that decides it
    for each: CONTENT publishes; events and flows start. Anything else
    (feedback, moves, people) is not an emergence moment in the allegory. */
const GEYSER_DATE_PROP: Record<string, string> = {
  CONTENT: 'Publish Date',
  EVENTS: 'Date',
  FLOWS: 'Date',
};

export function geyserDateFor(sourceName: string, row: Row): string | null {
  const prop = GEYSER_DATE_PROP[sourceName];
  if (!prop) return null;
  const dv = dateVal(row, prop);
  return dv && dv.start ? dv.start : null;
}

export function isGeyser(sourceName: string, row: Row): boolean {
  return isPullDay(geyserDateFor(sourceName, row));
}

/** Full timestamp (ledger rows) formatted in UTC. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d) +
    ', ' +
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d) +
    ' UTC'
  );
}

/* ---------- money -------------------------------------------------------- */

export function formatUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
