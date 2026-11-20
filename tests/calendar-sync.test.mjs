// Phase 6 (packet OO §3): the pure half of the personal-calendar
// sync — Google events URL window + normalization into the
// /calendar-events write shape ('gcal-' id namespace).
import test from 'node:test';
import assert from 'node:assert/strict';
import { googleEventsUrl, normalizeGoogleEvents } from '../src/lib/calendarSync.ts';

test('events URL: primary calendar, −7d start-of-day → +60d end-of-day, instances expanded', () => {
  const u = new URL(googleEventsUrl(new Date('2026-11-20T15:04:05.000Z')));
  assert.equal(u.origin + u.pathname, 'https://www.googleapis.com/calendar/v3/calendars/primary/events');
  const timeMin = new Date(u.searchParams.get('timeMin'));
  const timeMax = new Date(u.searchParams.get('timeMax'));
  // Window spans 67 days of coverage (7 back + the day itself + 60 forward, end-of-day inclusive).
  const spanDays = (timeMax - timeMin) / 86_400_000;
  assert.ok(spanDays > 67 && spanDays < 68, `span ${spanDays}`);
  assert.equal(u.searchParams.get('singleEvents'), 'true');
  assert.equal(u.searchParams.get('orderBy'), 'startTime');
  assert.equal(u.searchParams.get('maxResults'), '250');
});

test('normalization: timed event maps into the write shape with a gcal- id', () => {
  const [ev] = normalizeGoogleEvents([{
    id: 'abc123', summary: 'Studio session',
    start: { dateTime: '2026-11-21T18:00:00-08:00' }, end: { dateTime: '2026-11-21T20:30:00-08:00' },
    location: 'Echo', description: 'notes', creator: { email: 'monny@example.com' },
  }]);
  assert.deepEqual(ev, {
    id: 'gcal-abc123', title: 'Studio session',
    start: '2026-11-21T18:00:00-08:00', end: '2026-11-21T20:30:00-08:00',
    location: 'Echo', description: 'notes', creator: 'monny@example.com',
  });
});

test('normalization: all-day events keep date strings; missing end falls back to start', () => {
  const [ev] = normalizeGoogleEvents([{ id: 'd1', summary: 'Retreat', start: { date: '2026-12-01' }, end: { date: '2026-12-03' } }]);
  assert.equal(ev.start, '2026-12-01');
  assert.equal(ev.end, '2026-12-03');
  const [ev2] = normalizeGoogleEvents([{ id: 'd2', start: { date: '2026-12-01' } }]);
  assert.equal(ev2.end, '2026-12-01');
  assert.equal(ev2.title, '(No title)');
});

test('normalization: cancelled and id-less events drop; non-array input yields []', () => {
  assert.deepEqual(normalizeGoogleEvents([
    { id: 'x', status: 'cancelled', start: { dateTime: '2026-11-21T00:00:00Z' } },
    { summary: 'no id', start: { dateTime: '2026-11-21T00:00:00Z' } },
  ]), []);
  assert.deepEqual(normalizeGoogleEvents(undefined), []);
  assert.deepEqual(normalizeGoogleEvents({ items: [] }), []);
});
