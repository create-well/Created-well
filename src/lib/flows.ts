import type { CoFlowDate, FlowType, Task } from '../app/components/api';

// Phase 2a unification (packet K §2): the FlowType union lives in
// api.ts as the one definition of record (the same 8 values this
// file used to define locally). Re-exported so this module's
// existing consumers keep their import path.
export type { FlowType };

/**
 * Canonical flow type matching logic for Create Well OS.
 * Prefers the structured flowType property (from Notion Type select),
 * then falls back to known theme strings and aliases.
 */
export function matchesFlowType(f: CoFlowDate, type: FlowType | string): boolean {
  const target = type.toLowerCase();
  if (f.flowType && f.flowType.toLowerCase() === target) {
    return true;
  }
  const theme = (f.theme || '').toLowerCase();
  if (theme === target) return true;

  // Canonical aliases per CR8W Podyaps Production Bible & FLOWS schema
  if (target === 'podyap') {
    return ['podyap', 'yapcast', 'playdate'].includes(theme);
  }
  if (target === 'workshop') {
    return ['workshop', 'wellshop', 'expresshop', 'playshop'].includes(theme);
  }
  if (target === 'book club') {
    return ['book club', 'bookclub'].includes(theme);
  }
  if (target === 'open studio') {
    return ['open studio', 'openstudio'].includes(theme);
  }
  return false;
}

export function isPodyap(f: CoFlowDate): boolean {
  return matchesFlowType(f, 'Podyap');
}

export function isWorkshop(f: CoFlowDate): boolean {
  return matchesFlowType(f, 'Workshop');
}

export function isBookClub(f: CoFlowDate): boolean {
  return matchesFlowType(f, 'Book Club');
}

/**
 * SLO Create is the core monthly offering — its own recurring series,
 * never a workshop (model of record, 2026-11-14). The payload does
 * not project the FLOWS Series property (projecting it would be a
 * source change, outside the rename step), so series membership is
 * read from the row's Name — sessions are filed "SLO Create (11/18)"
 * — carried on title, with theme as its fallback, the same name
 * resolution flowTitle uses.
 */
export function isSloCreateSeries(f: CoFlowDate): boolean {
  const name = (f.title || f.theme || '').trim().toLowerCase();
  return /^slo create\b/.test(name);
}

export function isGroupEvent(f: CoFlowDate): boolean {
  return isWorkshop(f) || isBookClub(f);
}

// ── Phase 2a: series key, board grouping, detail resolution ─────────────────
// Spec: packet K (as amended A1–A5). The board's one grouping key
// is seriesOf(); every 2a surface reads series through it, never
// off the raw field, so the fallback chain lives in exactly one
// place.

/** The label of the board group for rows with no series key. */
export const NO_SERIES_LABEL = 'No series filed';

/** Board group order (K §3): SLO Create first, the flagship
    series; the unfiled group always last (handled in the group
    builder, not this list). Values are the FLOWS Series select's
    option names verbatim. A series value outside this list (a
    future select option) sorts after the named groups, before
    the unfiled group, in encounter order. */
export const SERIES_GROUP_ORDER: readonly string[] = [
  'SLO Create', 'Book Club', 'Workshop', 'Open Studio', 'Geyser', 'Podyap', 'Internal',
];

/** Within-group stage order (K §3): the FLOWS Stage select's
    values in lifecycle order, casing as filed. A row with no
    stage sorts last inside its group. */
export const STAGE_ORDER: readonly string[] = [
  'In the water', 'Rising', 'Flowing', 'Wrapped', 'Depanty',
];

/**
 * The one series key (K §1.3): the projected Series field when
 * the row carries one; otherwise the landed name guard (a row
 * filed "SLO Create (11/18)" with no Series value still keys to
 * its series); otherwise undefined. Tolerates payloads cached
 * before the projection landed, which carry no series at all.
 */
export function seriesOf(f: CoFlowDate): string | undefined {
  if (f.series) return f.series;
  if (isSloCreateSeries(f)) return 'SLO Create';
  return undefined;
}

export interface SeriesGroup {
  /** The group label: a Series option name, or NO_SERIES_LABEL. */
  series: string;
  flows: CoFlowDate[];
}

function stageRank(stage: string | undefined): number {
  if (!stage) return STAGE_ORDER.length;
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? STAGE_ORDER.length : i;
}

/** Within-group order (K §3): stage order first, then date
    ascending with undated last, then id as the final tiebreak
    (the Phase 1 compare-don't-subtract discipline). */
export function compareFlowsInGroup(a: CoFlowDate, b: CoFlowDate): number {
  const sa = stageRank(a.stage), sb = stageRank(b.stage);
  if (sa !== sb) return sa - sb;
  const da = a.date || '', db = b.date || '';
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  return a.id - b.id;
}

/**
 * Group a board population by seriesOf() (K §3). Groups render
 * in SERIES_GROUP_ORDER, then any unlisted series in encounter
 * order, then the unfiled group last. Empty groups never appear.
 * Every input row lands in exactly one group; nothing is dropped
 * or duplicated (the A3 population rule, proven in tests).
 */
/**
 * The board's population (packet K §3, as amended A6): the
 * community-flows slice, plus every row with a Series filed.
 * The series leg is field-only — the projected Series value,
 * not the name fallback (grouping keeps the fallback;
 * membership does not). A6 exists because the frozen population
 * excluded all 3 live SLO Create rows: Series filed, Theme
 * empty, classifying outside the community slice, so the
 * flagship group could never render. When the union is empty
 * the board falls back to every flow, the parent's standing
 * behavior.
 */
export function boardPopulation(flows: CoFlowDate[]): CoFlowDate[] {
  const community = flows.filter(isCommunityFlow);
  const member = new Set<CoFlowDate>(community);
  const seriesFiled = flows.filter((f) => f.series !== undefined && !member.has(f));
  const population = [...community, ...seriesFiled];
  return population.length > 0 ? population : flows;
}

export function groupFlowsBySeries(flows: CoFlowDate[]): SeriesGroup[] {
  const byKey = new Map<string, CoFlowDate[]>();
  for (const f of flows) {
    const key = seriesOf(f) ?? NO_SERIES_LABEL;
    const list = byKey.get(key);
    if (list) list.push(f); else byKey.set(key, [f]);
  }
  const orderedKeys: string[] = [];
  for (const name of SERIES_GROUP_ORDER) if (byKey.has(name)) orderedKeys.push(name);
  for (const key of byKey.keys()) {
    if (key !== NO_SERIES_LABEL && !SERIES_GROUP_ORDER.includes(key)) orderedKeys.push(key);
  }
  if (byKey.has(NO_SERIES_LABEL)) orderedKeys.push(NO_SERIES_LABEL);
  return orderedKeys.map((series) => ({
    series,
    flows: [...(byKey.get(series) ?? [])].sort(compareFlowsInGroup),
  }));
}

/**
 * Detail resolution (K §4, amendment A2): an id resolves to a
 * gathering only on a SETTLED payload. While the payload is
 * loading, or has failed with nothing settled to show, the state
 * is 'loading' — never not-found, never another gathering's data.
 * A stale payload is settled (it carries last-good rows), so a
 * match resolves and a miss is an honest not-found under the
 * stale label the page renders.
 */
export type GatheringResolution =
  | { state: 'loading' }
  | { state: 'found'; flow: CoFlowDate }
  | { state: 'not-found' };

export function resolveGathering(
  flows: CoFlowDate[] | undefined,
  syncStatus: string,
  id: number,
): GatheringResolution {
  const settled = syncStatus === 'fresh' || syncStatus === 'stale';
  if (!settled) return { state: 'loading' };
  // A settled payload with no flows slice at all (the legacy
  // fallback omits it) is an honest not-found, not a forever load.
  const flow = (flows ?? []).find((f) => f.id === id);
  return flow ? { state: 'found', flow } : { state: 'not-found' };
}

/**
 * The detail money slice's state (K §4.5): the row's own recorded
 * Pleasure In / Out when the rollups resolved to numbers on the
 * payload; otherwise the honest absence — the bookkeeping
 * workbook is the books of record, and no figure is borrowed
 * from the Money page or invented. A filed 0 is a number the
 * source carries, and renders as one.
 */
export type MoneySliceState =
  | { kind: 'numbers'; in: number; out: number }
  | { kind: 'absent' };

export function moneySliceState(f: CoFlowDate): MoneySliceState {
  if (typeof f.pleasureIn === 'number' || typeof f.pleasureOut === 'number') {
    return { kind: 'numbers', in: f.pleasureIn ?? 0, out: f.pleasureOut ?? 0 };
  }
  return { kind: 'absent' };
}

/**
 * The detail page's work list (K §4.4): the payload tasks whose
 * Flow relation points at this gathering, joined on
 * flowPageId === notionPageId. Tasks without the link never
 * appear. Open work first, then done and dropped; each run in
 * the Phase 1 ordering (dated by due date ascending, same-day
 * ties and the undated by created_at ascending with missing
 * last, id the final tiebreak — compared, never subtracted,
 * where a missing value would produce NaN).
 */
export function gatheringWorkList(tasks: Task[], flow: CoFlowDate): Task[] {
  if (!flow.notionPageId) return [];
  const linked = tasks.filter((t) => t.flowPageId && t.flowPageId === flow.notionPageId);
  const open = linked.filter((t) => t.status !== 'done' && t.status !== 'dropped');
  const closed = linked.filter((t) => t.status === 'done' || t.status === 'dropped');
  return [...open.sort(compareWorkListTasks), ...closed.sort(compareWorkListTasks)];
}

export function compareWorkListTasks(a: Task, b: Task): number {
  const da = a.due_date || '', db = b.due_date || '';
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  const ca = a.created_at || '', cb = b.created_at || '';
  if (ca !== cb) {
    if (!ca) return 1;
    if (!cb) return -1;
    return ca < cb ? -1 : 1;
  }
  return a.id - b.id;
}

export function isCommunityFlow(f: CoFlowDate): boolean {
  const theme = (f.theme || '').toLowerCase();
  const type = (f.flowType || '').toLowerCase();
  return (
    isPodyap(f) ||
    isWorkshop(f) ||
    isBookClub(f) ||
    ['open studio', 'openstudio', 'pop-up', 'surprise-ment', 'geyser'].includes(theme) ||
    ['open studio', 'pop-up', 'surprise-ment', 'geyser'].includes(type)
  );
}
