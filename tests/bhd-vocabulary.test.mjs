// Register 1378, Leg B — 'bhd' was a hardcoded build synonym for
// the ENTIRE co-flow-dates class: every co-flow row in the agenda
// rendered under a synthesized 'behind h0es doors' title with a
// BHD tag, and HubView's Next Up preview did the same with fixed
// persons. The record's BHD is ONE recurring gathering. Now:
// sessions render under their own names (the FLOWS Name the
// normalizer now carries, else theme, else type) with their own
// type word as the tag, and no category is invented in place.
// PLUS the dedupe defect: the agenda keyed dedupe on the exact
// rendered title, which the synthesized co-flow title could never
// match, so a gathering present in both calendar and co-flow data
// rendered twice. Dedupe now keys on date + normalized title, or
// date + start time with a shared real word in the titles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAgenda, coFlowTitle, startMinutes } from '../src/lib/calendarAgenda.ts';
import { normalizeFlow } from '../src/lib/notionNormalizer.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');
const now = new Date(2026, 10, 5, 9, 0, 0); // Nov 5 2026, local
const cf = (extra = {}) => ({
  id: 1, date: '2026-11-06', timeRange: '', location: 'Studio',
  rsvp: {}, agendaItems: [], notes: '', vibeCheck: '', status: 'scheduled',
  ...extra,
});
const kv = (extra = {}) => ({
  id: 'ev1', title: 'behind h0es doors', start: '2026-11-06T18:00:00',
  location: 'Studio', ...extra,
});
const rows = (days) => days.flatMap(d => d.rows);

test('a gathering in both sources renders ONCE in the agenda', () => {
  const days = buildAgenda([kv()], [cf({ title: 'behind h0es doors', startTime: '6:00 PM' })], now);
  assert.equal(rows(days).length, 1);
});

test('the same gathering named slightly differently still renders once (time + shared word)', () => {
  const days = buildAgenda(
    [kv({ title: 'Behind H0es Doors — weekly' })],
    [cf({ title: 'behind h0es doors', startTime: '6:00 PM' })],
    now,
  );
  assert.equal(rows(days).length, 1);
});

test('two different sessions on one day both render', () => {
  const days = buildAgenda([], [
    cf({ id: 1, title: 'behind h0es doors', startTime: '6:00 PM' }),
    cf({ id: 2, title: 'Book Club', flowType: 'Book Club', startTime: '7:30 PM' }),
  ], now);
  assert.equal(rows(days).length, 2);
});

test('co-flow sessions render under their own names and types', () => {
  const days = buildAgenda([], [
    cf({ id: 1, flowType: 'Book Club', theme: 'The Artist\u2019s Way' }),
    cf({ id: 2, title: 'behind h0es doors', host: 'bingle' }),
  ], now);
  const [a, b] = rows(days);
  assert.equal(a.title, 'The Artist\u2019s Way');
  assert.equal(a.tag, 'Book Club');
  assert.equal(b.title, 'behind h0es doors');
  assert.notEqual(b.tag, 'BHD');
});

test('coFlowTitle prefers the record Name, then theme, then type', () => {
  assert.equal(coFlowTitle(cf({ title: 'N', theme: 'T', flowType: 'Workshop' })), 'N');
  assert.equal(coFlowTitle(cf({ theme: 'T', flowType: 'Workshop' })), 'T');
  assert.equal(coFlowTitle(cf({ flowType: 'Workshop' })), 'Workshop');
});

test('startMinutes parses the free-text shapes and refuses the rest', () => {
  assert.equal(startMinutes('6:00 PM'), 18 * 60);
  assert.equal(startMinutes('18:00'), 18 * 60);
  assert.equal(startMinutes('9 AM'), 9 * 60);
  assert.equal(startMinutes('whenever'), null);
  assert.equal(startMinutes(undefined), null);
});

test('the normalizer carries the FLOWS Name onto the record', () => {
  const page = {
    id: 'page-1',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'behind h0es doors' }] },
      Date: { type: 'date', date: { start: '2026-11-06' } },
      Status: { type: 'select', select: { name: 'Scheduled' } },
    },
  };
  assert.equal(normalizeFlow(page).title, 'behind h0es doors');
});

test('the preview no longer synthesizes BHD entries', () => {
  assert.ok(!hub.includes("type: 'bhd' as const"));
  assert.ok(!hub.includes("persons: ['sunshine', 'monny', 'bingle']"));
  assert.ok(hub.includes('title: coFlowTitle(cf)'));
});
