/**
 * Namespace merge for the shared cr8w_calendar_events list
 * (Phase 6, packet OO §2 — QA amendment A2).
 *
 * Two writers share the list: the iCal feed sync (POST
 * /calendar-ical-sync) and the personal Google sync (POST
 * /calendar-events). Personal events carry ids prefixed 'gcal-'
 * (the /calendar-events normalizer defaults missing ids there, and
 * the sync client sends explicit 'gcal-<google event id>'); feed
 * events are everything else (ICS UIDs, 'ical-' generated ids).
 *
 * Each write replaces ONLY its own namespace and preserves the
 * other's rows verbatim, so the two syncs can interleave in any
 * order without wiping each other. The invariant lives here, in the
 * write routes — never in a client.
 */
export interface CalendarEventLike {
  id?: string;
  [k: string]: unknown;
}

export function isPersonalCalendarEvent(ev: CalendarEventLike): boolean {
  return typeof ev?.id === 'string' && ev.id.startsWith('gcal-');
}

/** A feed write: the fresh feed set replaces all non-personal rows;
 * personal rows survive untouched. */
export function mergeFeedWrite<T extends CalendarEventLike>(existing: T[], freshFeed: T[]): T[] {
  return [...freshFeed, ...existing.filter(isPersonalCalendarEvent)];
}

/** A personal write: the fresh personal set replaces all 'gcal-'
 * rows (an event removed from Google disappears here); feed rows
 * survive untouched. */
export function mergePersonalWrite<T extends CalendarEventLike>(existing: T[], freshPersonal: T[]): T[] {
  return [...freshPersonal, ...existing.filter((ev) => !isPersonalCalendarEvent(ev))];
}
