// FE-5 homePanels derivations — panel order data rules (§4).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextUpFlow,
  isEmergenceDay,
  nextUpDateLabel,
  homeTasks,
  taskDueLabel,
  startingSoon,
  contentReadyCounts,
  forumRowName,
  syncCareCount,
  peopleCareValue,
  openAsksCareValue,
} from '../src/lib/homePanels.ts';

const NOW = new Date('2026-10-27T12:00:00-07:00');
const flow = (id, date, extra = {}) => ({
  id,
  date,
  status: 'scheduled',
  ...extra,
});

test('nextUpFlow picks the soonest upcoming open flow', () => {
  const flows = [
    flow(1, '2026-11-05'),
    flow(2, '2026-10-29'),
    flow(3, '2026-10-20'), // past
    flow(4, '2026-10-28', { status: 'cancelled' }),
    flow(5, 'not-a-date'),
  ];
  assert.equal(nextUpFlow(flows, NOW)?.id, 2);
  assert.equal(nextUpFlow([], NOW), null);
});

test('isEmergenceDay is true only on the day itself', () => {
  assert.equal(isEmergenceDay(flow(1, '2026-10-27'), NOW), true);
  assert.equal(isEmergenceDay(flow(2, '2026-10-28'), NOW), false);
  assert.equal(isEmergenceDay(flow(3, 'TBD'), NOW), false);
});

test('nextUpDateLabel carries weekday + PT; missing reads §4 wording', () => {
  const label = nextUpDateLabel(flow(1, '2026-11-03', { timeRange: '6:00–8:00 PM' }));
  assert.match(label, /Tuesday/);
  assert.match(label, /6:00–8:00 PM PT/);
  assert.equal(nextUpDateLabel(flow(2, 'TBD')), 'Date not set yet.');
  assert.equal(nextUpDateLabel(null), 'Date not set yet.');
});

test('homeTasks: open only, due ascending, undated last', () => {
  const tasks = [
    { id: 1, title: 'undated', status: 'todo' },
    { id: 2, title: 'later', status: 'todo', due_date: '2026-11-02' },
    { id: 3, title: 'sooner', status: 'in_progress', due_date: '2026-10-29' },
    { id: 4, title: 'done', status: 'done', due_date: '2026-10-28' },
    { id: 5, title: 'bad date', status: 'blocked', due_date: 'TBD' },
  ];
  assert.deepEqual(homeTasks(tasks).map((t) => t.id), [3, 2, 1, 5]);
  assert.equal(taskDueLabel(tasks[0]), 'No date yet.');
  assert.match(taskDueLabel(tasks[2]), /Oct 29/);
});

test('startingSoon: 14-day window, sessions/events only, no projects', () => {
  const flows = [
    flow(1, '2026-10-30'),
    flow(2, '2026-11-10'), // day 14 exactly — in
    flow(3, '2026-11-11'), // day 15 — out
    flow(4, '2026-10-29', { theme: 'Website Project' }),
    flow(5, '2026-10-29', { flowType: 'Project' }),
    flow(6, '2026-10-29', { status: 'happened' }),
    flow(7, '2026-10-26'), // past
  ];
  assert.deepEqual(startingSoon(flows, NOW).map((f) => f.id), [1, 2]);
});

test('contentReadyCounts reads the normalizer suffix, never guesses', () => {
  const posts = [
    { id: 1, content: 'Essay One [Published]' },
    { id: 2, content: 'Essay Two [Ready]' },
    { id: 3, content: 'Essay Three [Ready to Release]' },
    { id: 4, content: 'Draft With No Link' },
    { id: 5, content: 'Old Post [Archived]' },
  ];
  assert.deepEqual(contentReadyCounts(posts), {
    ready: 2,
    published: 1,
    unmarked: 2,
  });
  assert.equal(forumRowName('Essay One [Published]'), 'Essay One');
});

test('syncCareCount derives from delivery state; null block stays null', () => {
  const block = {
    generatedAt: '2026-10-27T19:00:00Z',
    sources: [
      { source: 'PEOPLE', state: 'live', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      { source: 'FLOWS', state: 'stale', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      { source: 'MOVES', state: 'degraded', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      { source: 'MONEY', state: 'reconciling', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      { source: 'CONTENT', state: 'unknown', lastEventAt: null, lastSyncOkAt: null, syncVersion: 0 },
    ],
  };
  assert.deepEqual(syncCareCount(block), { notFlowing: 3, total: 5 });
  assert.equal(syncCareCount(null), null);
  assert.equal(syncCareCount({ generatedAt: '', sources: [] }), null);
});

// ── PEOPLE care group (fix/people-care-slice): derivation over the
// payload's counts-only aggregate. Absent or empty stays absent.
test('peopleCareValue: absent slice renders honest absence', () => {
  assert.equal(peopleCareValue(undefined), null);
  assert.equal(peopleCareValue(null), null);
});

test('peopleCareValue: zero-total source renders honest absence, not 0 of 0', () => {
  assert.equal(peopleCareValue({ total: 0, consentGaps: 0 }), null);
});

test('peopleCareValue: counts pass through unchanged', () => {
  assert.deepEqual(peopleCareValue({ total: 28, consentGaps: 28 }), { gaps: 28, total: 28 });
  assert.deepEqual(peopleCareValue({ total: 3, consentGaps: 1 }), { gaps: 1, total: 3 });
});

// ── OPEN ASKS care group (fix/open-asks-source): same absence rules.
test('openAsksCareValue: absent slice renders honest absence', () => {
  assert.equal(openAsksCareValue(undefined), null);
  assert.equal(openAsksCareValue(null), null);
});

test('openAsksCareValue: zero-total source renders honest absence, not 0 of 0', () => {
  assert.equal(openAsksCareValue({ total: 0, unanswered: 0 }), null);
});

test('openAsksCareValue: counts pass through unchanged', () => {
  assert.deepEqual(openAsksCareValue({ total: 65, unanswered: 9 }), { unanswered: 9, total: 65 });
});
