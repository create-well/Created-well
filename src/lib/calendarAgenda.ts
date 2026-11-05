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
  /** The record's own type word ('CR8W' for calendar rows; a
      co-flow row carries its own flowType or theme). Never a class
      synonym: 'BHD' appears only when a record's own data says so
      (register 1378). Empty renders no badge. */
  tag: string;
  sortAt: number;
};

/** A co-flow session's own name, from its record: the FLOWS Name
 * first, then its theme, then its type. The class fallback names
 * the data class itself, never a synonym for one member of it. */
export function coFlowTitle(cf: CoFlowDate): string {
  return cf.title || cf.theme || cf.flowType || 'Co-flow session';
}

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleTokens(t: string): Set<string> {
  return new Set(normTitle(t).split(' ').filter(w => w.length >= 4));
}

/** Start-of-session in minutes since midnight, from a free-text
 * start ('6:00 PM', '18:00', '6 PM'); null when absent or
 * unparseable, in which case the time signal simply does not
 * participate in dedupe. */
export function startMinutes(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mins = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || mins > 59) return null;
  return h * 60 + mins;
}

export type AgendaDay = { key: string; rel: string; label: string; rows: AgendaRow[] };

export function buildAgenda(
  kvEvents: CalendarEventKV[],
  coFlowDates: CoFlowDate[],
  now: Date,
): AgendaDay[] {
  const todayIdx = dayIndex(now);
  const lastIdx = todayIdx + AGENDA_WINDOW_DAYS - 1;
  const byDay = new Map<string, { idx: number; rows: AgendaRow[] }>();
  // Dedupe on keys that can actually match (register 1378): the
  // old key was day + the exact rendered title, and the co-flow
  // side rendered a synthesized title no calendar title could
  // ever equal, so a gathering in both sources rendered twice.
  // Now: day + normalized title, OR day + start time when the two
  // titles also share a real word (the same gathering named
  // slightly differently on each side). A row registers both keys.
  const seenTitles = new Set<string>();
  const seenTimes = new Map<string, Set<string>>();

  const add = (d: Date, row: AgendaRow, minutes: number | null) => {
    const idx = dayIndex(d);
    if (idx < todayIdx || idx > lastIdx) return;
    const key = localKey(d);
    const titleKey = `${key}::${normTitle(row.title)}`;
    if (seenTitles.has(titleKey)) return;
    if (minutes !== null) {
      const prior = seenTimes.get(`${key}::${minutes}`);
      if (prior) {
        const mine = titleTokens(row.title);
        if ([...mine].some(t => prior.has(t))) return;
      }
    }
    seenTitles.add(titleKey);
    if (minutes !== null) {
      const tk = `${key}::${minutes}`;
      const set = seenTimes.get(tk) ?? new Set<string>();
      for (const t of titleTokens(row.title)) set.add(t);
      seenTimes.set(tk, set);
    }
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
    }, ev.start.includes('T') ? start.getHours() * 60 + start.getMinutes() : null);
  }

  // Co-flow dates, deduped against the calendar rows inside
  // add(). Each renders under its own record's name and type —
  // the class is not a synonym for any one of its sessions.
  for (const cf of coFlowDates) {
    if (cf.status !== 'scheduled' && cf.status !== 'happened') continue;
    const d = parseDateValue(cf.date);
    if (!d) continue;
    add(d, {
      key: `cf-${cf.id}`,
      title: coFlowTitle(cf),
      time: cf.startTime && cf.endTime ? `${cf.startTime} \u2013 ${cf.endTime}` : cf.timeRange || '',
      location: cf.location || undefined,
      tag: cf.flowType || cf.theme || '',
      sortAt: d.getTime(),
    }, startMinutes(cf.startTime));
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
