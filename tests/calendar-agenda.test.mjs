// FE-12: the native agenda's grouping logic — window bounds,
// day-grouping from local calendar components (DST-immune),
// canonical-ID dedupe, co-flow inclusion by status, and the
// malformed-row guard. Dates are built from local components,
// so these hold in any TZ and exercise the Nov 1 fall-back
// under TZ=America/Los_Angeles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgenda } from '../src/lib/calendarAgenda.ts';

const NOW = new Date(2026, 9, 30, 10, 0); // Fri Oct 30 2026, local
const kv = (id, title, start) => ({ id, title, start, end: start, location: '', description: '', creator: '' });
const cf = (id, date, status, theme) => ({ id, date, status, theme, timeRange: '', location: '', rsvp: {}, agendaItems: [] });

test('agenda: groups by local calendar day across the fall-back', () => {
  const days = buildAgenda([
    kv('a', 'Fall-back Sunday thing', '2026-11-01T10:00:00'),
    kv('b', 'Today thing', '2026-10-30T09:00:00'),
    kv('c', 'Monday thing', '2026-11-02T09:00:00'),
  ], [], NOW);
  assert.deepEqual(days.map(d => d.key), ['2026-10-30', '2026-11-01', '2026-11-02']);
  assert.equal(days[0].rel, 'Today');
  assert.equal(days[1].rel, '');
  assert.equal(days[0].label, 'Fri, Oct 30');
});

test('agenda: window is today through +13 days, past excluded', () => {
  const days = buildAgenda([
    kv('p', 'Yesterday', '2026-10-29T09:00:00'),
    kv('e', 'Edge day 14', '2026-11-12T09:00:00'),
    kv('o', 'Day 15 is out', '2026-11-13T09:00:00'),
  ], [], NOW);
  assert.deepEqual(days.map(d => d.key), ['2026-11-12']);
});

test('agenda: kv dedupe by canonical id and by day+title', () => {
  const days = buildAgenda([
    kv('kv-7', 'Sync test', '2026-10-31T09:00:00'),
    kv('7', 'Sync test', '2026-10-31T09:00:00'),
    kv('9', 'sync test', '2026-10-31T11:00:00'),
  ], [], NOW);
  assert.equal(days.length, 1);
  assert.equal(days[0].rows.length, 1);
});

test('agenda: co-flow rows ride by status; malformed rows skip', () => {
  const days = buildAgenda([
    kv('x', 'Broken', 'not-a-date'),
  ], [
    cf(1, '2026-10-31', 'scheduled', 'spooky'),
    cf(2, '2026-10-31', 'draft', 'hidden'),
    cf(3, 'garbage', 'scheduled', 'lost'),
  ], NOW);
  assert.equal(days.length, 1);
  assert.equal(days[0].rows.length, 1);
  assert.equal(days[0].rows[0].tag, 'BHD');
  assert.match(days[0].rows[0].title, /spooky/);
});
