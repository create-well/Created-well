import { eventDateLabel, parseDateValue } from './dateLabel.ts';
import type { CalendarEventKV, CoFlowDate } from '../app/components/api.ts';

/**
 * FE-12 — the shared team calendar as a native agenda list: the
 * grouping logic. The component (CalendarAgenda.tsx) renders what
 * this builds from the events the dashboard already loads —
 * CalendarEventKV records from the iCal sync path plus
 * scheduled/happened coFlowDates — day-grouped over the next 14
 * days. Date labels go through FE-2's guarded formatter;
 * malformed rows are skipped, never rendered as "Invalid Date".
 *
 * Calendar math is local on purpose: whole days are computed
 * from local calendar components (Date.UTC over the components),
 * the DST-immune shape. This file deliberately does not extend
 * lib/dateLabel — the fix/date-arithmetic branch owns that
 * file's additions; the shapes dedupe in the tidy step once both
 * branches land.
 */

export const AGENDA_WINDOW_DAYS = 14;

function dayIndex(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
}

function localKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type AgendaRow = {
  key: string;
  title: string;
  time: string;
  location?: string;
  tag: 'CR8W' | 'BHD';
  sortAt: number;
};

export type AgendaDay = { key: string; rel: string; label: string; rows: AgendaRow[] };

export function buildAgenda(
  kvEvents: CalendarEventKV[],
  coFlowDates: CoFlowDate[],
  now: Date,
): AgendaDay[] {
  const todayIdx = dayIndex(now);
  const lastIdx = todayIdx + AGENDA_WINDOW_DAYS - 1;
  const byDay = new Map<string, { idx: number; rows: AgendaRow[] }>();
  const seen = new Set<string>();

  const add = (d: Date, row: AgendaRow) => {
    const idx = dayIndex(d);
    if (idx < todayIdx || idx > lastIdx) return;
    const key = localKey(d);
    const dedupe = `${key}::${row.title.trim().toLowerCase()}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    const bucket = byDay.get(key) ?? { idx, rows: [] };
    bucket.rows.push(row);
    byDay.set(key, bucket);
  };

  // KV calendar events — dedupe by canonical ID (strip kv- prefix),
  // the same rule the Next Up preview applies.
  const kvSeen = new Set<string>();
  for (const ev of kvEvents) {
    const canonical = ev.id.replace(/^kv-/, '');
    if (kvSeen.has(canonical)) continue;
    kvSeen.add(canonical);
    const start = parseDateValue(ev.start);
    if (!start) continue;
    const time = ev.start.includes('T')
      ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
      : '';
    add(start, {
      key: `kv-${ev.id}`,
      title: ev.title,
      time,
      location: ev.location || undefined,
      tag: 'CR8W',
      sortAt: start.getTime(),
    });
  }

  // Co-flow dates (behind h0es doors), deduped against the
  // calendar rows by day + title inside add().
  for (const cf of coFlowDates) {
    if (cf.status !== 'scheduled' && cf.status !== 'happened') continue;
    const d = parseDateValue(cf.date);
    if (!d) continue;
    add(d, {
      key: `cf-${cf.id}`,
      title: cf.theme ? `behind h0es doors — "${cf.theme}"` : 'behind h0es doors',
      time: cf.startTime && cf.endTime ? `${cf.startTime} – ${cf.endTime}` : cf.timeRange || '',
      location: cf.location || undefined,
      tag: 'BHD',
      sortAt: d.getTime(),
    });
  }

  return [...byDay.entries()]
    .sort((a, b) => a[1].idx - b[1].idx)
    .map(([key, bucket]) => {
      const rel = bucket.idx === todayIdx ? 'Today' : bucket.idx === todayIdx + 1 ? 'Tomorrow' : '';
      return {
        key,
        rel,
        label: eventDateLabel(key),
        rows: bucket.rows.sort((a, b) => a.sortAt - b.sortAt),
      };
    });
}
