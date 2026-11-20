/**
 * Personal-calendar sync — the pure half (Phase 6, packet OO §3).
 *
 * useCalendarSync.syncNow owns the fetch and localStorage; everything
 * decidable lives here so tests pin it without a DOM: the Google
 * events URL window and the normalization into the /calendar-events
 * write shape. Personal events carry the 'gcal-' id namespace — the
 * server merge (api/_calendarEvents.ts) keys coexistence with the
 * iCal feed on that prefix.
 */
export interface CalendarWriteEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  creator: string;
}

export const GCAL_SYNC_EXPIRED_MESSAGE = 'Google session expired — reconnect to sync.';
export const GCAL_SYNC_FAILED_MESSAGE = 'Calendar sync failed — try again.';

/** Primary-calendar events URL: start of day 7 days ago through end
 * of day 60 days ahead, instances expanded, start-time order. */
export function googleEventsUrl(now: Date): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 60);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  return `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
}

/** Google Calendar API event JSON → the /calendar-events write shape.
 * Cancelled events drop; all-day events (date, no dateTime) keep their
 * date strings; ids land in the 'gcal-' namespace. */
export function normalizeGoogleEvents(items: unknown): CalendarWriteEvent[] {
  if (!Array.isArray(items)) return [];
  const out: CalendarWriteEvent[] = [];
  for (const ev of items as any[]) {
    if (!ev || !ev.id || ev.status === 'cancelled') continue;
    const start = ev.start?.dateTime ?? ev.start?.date ?? '';
    const end = ev.end?.dateTime ?? ev.end?.date ?? start;
    out.push({
      id: `gcal-${ev.id}`,
      title: ev.summary || '(No title)',
      start,
      end,
      location: ev.location || '',
      description: ev.description || '',
      creator: ev.creator?.email || '',
    });
  }
  return out;
}
