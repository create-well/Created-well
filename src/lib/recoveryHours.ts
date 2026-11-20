import { startMinutes } from './calendarAgenda.ts';
import type { CoFlowDate } from '../app/components/api.ts';

/**
 * Recovery window after an archived gathering (Phase 6, packet OO §4).
 *
 * The end of the gathering is the flow's own recorded End Time (the
 * FLOWS row's End Time text, carried on CoFlowDate.endTime) parsed by
 * the shared calendarAgenda grammar. A flow with no recorded end — or
 * an end the parser cannot read — yields no window from that flow:
 * nothing is assumed. (The pre-Phase-6 helper assumed a 22:00 end for
 * every archived flow; that fabrication is what this module removes.)
 *
 * Semantics otherwise preserved from the original helper: the first
 * archived flow (array order) whose real end falls inside the last
 * 72 hours returns the whole hours remaining in that 72h window;
 * anything else returns null, and the caller renders no banner.
 */
const ARCHIVED: ReadonlySet<string> = new Set(['happened', 'wrapped', 'cancelled']);
const MAX_MS = 72 * 60 * 60 * 1000;

export function getRecoveryHours(flows: CoFlowDate[], now: number): number | null {
  for (const f of flows) {
    if (!f.date || !ARCHIVED.has(f.status)) continue;
    const endMin = startMinutes(f.endTime);
    if (endMin === null) continue;
    const end = new Date(`${f.date}T00:00:00`).getTime() + endMin * 60_000;
    const elapsed = now - end;
    if (elapsed > 0 && elapsed < MAX_MS) {
      return Math.ceil((MAX_MS - elapsed) / (60 * 60 * 1000));
    }
  }
  return null;
}
