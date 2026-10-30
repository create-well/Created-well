import { parseDateValue } from './dateLabel.ts';
import type { SyncFreshnessBlock } from './syncFreshnessLine.ts';

/**
 * FE-5 — the settled Home panels' derivations (design diff §4,
 * D9–D15). Pure functions over the dashboard payload so the panel
 * order and wording live in one tested place. Every derivation
 * degrades in words, never in invented numbers: a source the
 * payload does not carry renders its honest absence downstream.
 */

export interface HomeFlow {
  id: number;
  date: string;
  timeRange?: string;
  flowType?: string;
  theme?: string;
  status: string;
}

export interface HomeTask {
  id: number;
  title: string;
  status: string;
  due_date?: string;
}

export interface HomeForumPost {
  id: number;
  content: string;
}

const CLOSED_FLOW_STATUSES = new Set(['happened', 'wrapped', 'cancelled']);

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function flowDate(f: HomeFlow): Date | null {
  return parseDateValue(f.date);
}

/** The soonest upcoming session or event, or null when none is set. */
export function nextUpFlow(flows: HomeFlow[], now: Date): HomeFlow | null {
  const today = startOfDay(now).getTime();
  let best: HomeFlow | null = null;
  let bestTime = Infinity;
  for (const f of flows) {
    if (CLOSED_FLOW_STATUSES.has(f.status)) continue;
    const d = flowDate(f);
    if (!d) continue;
    const t = startOfDay(d).getTime();
    if (t < today || t >= bestTime) continue;
    best = f;
    bestTime = t;
  }
  return best;
}

/** §7.1: the geyser marks the emergence day only — the day it happens. */
export function isEmergenceDay(f: HomeFlow, now: Date): boolean {
  const d = flowDate(f);
  if (!d) return false;
  return startOfDay(d).getTime() === startOfDay(now).getTime();
}

/** "Tuesday, Nov 3 · 6:00–8:00 PM PT" — or the §4 missing-date wording. */
export function nextUpDateLabel(f: HomeFlow | null): string {
  if (!f) return 'Date not set yet.';
  const d = flowDate(f);
  if (!d) return 'Date not set yet.';
  // House convention (FE-2's dateLabel): date-only values parse as
  // local midnight and format in the same local frame; the PT in
  // the label names the team's zone, per §4.
  const day = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  return f.timeRange ? `${day} · ${f.timeRange} PT` : `${day} · PT`;
}

/**
 * Tasks (§4 panel 2): open work, Due ascending, undated last.
 * "Now/Next" is the panel's frame; Task rows carry no lifecycle
 * stage in the payload, so ordering is the recipe's Due rule.
 */
export function homeTasks(tasks: HomeTask[]): HomeTask[] {
  const open = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'dropped',
  );
  const dated = open
    .filter((t) => parseDateValue(t.due_date) !== null)
    .sort(
      (a, b) =>
        (parseDateValue(a.due_date)?.getTime() ?? 0) -
        (parseDateValue(b.due_date)?.getTime() ?? 0),
    );
  const undated = open.filter((t) => parseDateValue(t.due_date) === null);
  return [...dated, ...undated];
}

/** Task row date wording: short date, or §4's "No date yet." */
export function taskDueLabel(t: HomeTask): string {
  const d = parseDateValue(t.due_date);
  if (!d) return 'No date yet.';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const PROJECT_MARK = /project/i;

/**
 * Starting soon (§4 panel 3): flows beginning within 14 days,
 * sessions and events only — a project never appears as a flow.
 * Project-marked rows (type or theme) are excluded by name.
 */
export function startingSoon(flows: HomeFlow[], now: Date): HomeFlow[] {
  const today = startOfDay(now).getTime();
  const horizon = today + 14 * 24 * 60 * 60 * 1000;
  return flows
    .filter((f) => {
      if (CLOSED_FLOW_STATUSES.has(f.status)) return false;
      if (PROJECT_MARK.test(f.flowType ?? '') || PROJECT_MARK.test(f.theme ?? ''))
        return false;
      const d = flowDate(f);
      if (!d) return false;
      const t = startOfDay(d).getTime();
      return t >= today && t <= horizon;
    })
    .sort(
      (a, b) =>
        (flowDate(a)?.getTime() ?? 0) - (flowDate(b)?.getTime() ?? 0),
    );
}

/**
 * Content ready (§4 panel 5): counts from the operational CONTENT
 * rows. The normalizer bakes Status into the content string as a
 * trailing " [Status]" suffix when the row carries a Link; rows
 * without one are counted as unmarked, never guessed into a state.
 */
export function contentReadyCounts(posts: HomeForumPost[]): {
  ready: number;
  published: number;
  unmarked: number;
} {
  let ready = 0;
  let published = 0;
  let unmarked = 0;
  for (const p of posts) {
    const m = /\[([^\]]+)\]\s*$/.exec(p.content ?? '');
    if (!m) {
      unmarked += 1;
      continue;
    }
    const status = m[1].trim().toLowerCase();
    if (status === 'published') published += 1;
    else if (status.startsWith('ready')) ready += 1;
    else unmarked += 1;
  }
  return { ready, published, unmarked };
}

/** The display name of a forum row: content minus its status suffix. */
export function forumRowName(content: string): string {
  return (content ?? '').replace(/\s*\[[^\]]+\]\s*$/, '').trim();
}

/**
 * Needs care (§4 panel 4), the sync group: counts of sources not
 * flowing, from the payload's delivery-state block (FE-3). Null
 * when the payload carried no block — the group then renders its
 * honest absence, not a zero.
 */
export function syncCareCount(
  block: SyncFreshnessBlock | null | undefined,
): { notFlowing: number; total: number } | null {
  if (!block || !Array.isArray(block.sources)) return null;
  const total = block.sources.length;
  if (total === 0) return null;
  const flowing = block.sources.filter(
    (s) => s.state === 'live' || s.state === 'reconciling',
  ).length;
  return { notFlowing: total - flowing, total };
}
