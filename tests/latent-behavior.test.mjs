import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFlow } from '../src/lib/notionNormalizer.ts';

// Pins the two behavior changes staged after PR #34:
// (a) normalizeFlow writes the VALIDATED FlowType (FLOW_TYPES lookup), not the
//     raw select text. In-union values land in canonical casing; out-of-union
//     values write undefined and the raw label survives on `theme`.
// (b) The status vocabulary the dashboard comparisons rely on: Notion's hub
//     words map through FLOW_STATUS_MAP (Upcoming -> scheduled, Active ->
//     happened, Archived -> wrapped). HubView and DashboardContext compare
//     against the mapped values; with the (as string) assertions gone, tsc
//     itself rejects any comparison literal outside this vocabulary.

const sel = (name) => ({
  type: 'select',
  select: name === null ? null : { id: 'opt', name, color: 'default' },
});

const page = (props) => ({
  id: '3f024acf-799d-81fb-92c8-d733da89cb22',
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: 'A flow', href: null }] },
    Date: { type: 'date', date: { start: '2026-11-05', end: null, time_zone: null } },
    Status: sel('Upcoming'),
    ...props,
  },
});

// (a) validated FlowType wiring
test('in-union Type lands as the validated FlowType', () => {
  assert.equal(normalizeFlow(page({ Type: sel('Workshop') })).flowType, 'Workshop');
  assert.equal(normalizeFlow(page({ Type: sel('Open Studio') })).flowType, 'Open Studio');
  assert.equal(normalizeFlow(page({ Type: sel('Book Club') })).flowType, 'Book Club');
  assert.equal(normalizeFlow(page({ Type: sel('Geyser') })).flowType, 'Geyser');
});

test('in-union Type in non-canonical casing is canonicalized', () => {
  assert.equal(normalizeFlow(page({ Type: sel('workshop') })).flowType, 'Workshop');
  assert.equal(normalizeFlow(page({ Type: sel('podyap') })).flowType, 'Podyap');
});

test('out-of-union Type writes undefined flowType; the raw label survives on theme', () => {
  const podcast = normalizeFlow(page({ Type: sel('Podcast') }));
  assert.equal(podcast.flowType, undefined);
  assert.equal(podcast.theme, 'Podcast');
  const dropIn = normalizeFlow(page({ Type: sel('Drop-in') }));
  assert.equal(dropIn.flowType, undefined);
  assert.equal(dropIn.theme, 'Drop-in');
});

test('missing Type writes undefined flowType', () => {
  assert.equal(normalizeFlow(page({})).flowType, undefined);
});

// (b) the mapped status vocabulary the corrected comparisons consume
test('hub status words map to the values the comparisons now use', () => {
  assert.equal(normalizeFlow(page({ Status: sel('Upcoming') })).status, 'scheduled');
  assert.equal(normalizeFlow(page({ Status: sel('Active') })).status, 'happened');
  assert.equal(normalizeFlow(page({ Status: sel('Archived') })).status, 'wrapped');
});

test('operational status words pass through the map unchanged', () => {
  assert.equal(normalizeFlow(page({ Status: sel('Wrapped') })).status, 'wrapped');
  assert.equal(normalizeFlow(page({ Status: sel('Cancelled') })).status, 'cancelled');
  assert.equal(normalizeFlow(page({ Status: sel('Scheduled') })).status, 'scheduled');
});
