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
  careConsentGranted,
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

test('isEmergenceDay: a Geyser-marked flow, on its day only (register 1378)', () => {
  // Amended by the register-1378 packet: the FE-5-era version of
  // this test asserted an UNMARKED flow dated today was an
  // emergence day — the mislabel the vocabulary fix retires. The
  // marker now needs the record's Geyser marking AND the day.
  assert.equal(isEmergenceDay(flow(1, '2026-10-27', { flowType: 'Geyser' }), NOW), true);
  assert.equal(isEmergenceDay(flow(1, '2026-10-27'), NOW), false);
  assert.equal(isEmergenceDay(flow(2, '2026-10-28', { flowType: 'Geyser' }), NOW), false);
  assert.equal(isEmergenceDay(flow(3, 'TBD', { flowType: 'Geyser' }), NOW), false);
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

// ── Packet H §1 ordering: the queue tiebreaks. ─────────────────────
test('homeTasks: due date dominates created_at (most overdue leads)', () => {
  const tasks = [
    { id: 1, title: 'newer but less due', status: 'todo', due_date: '2026-11-10', created_at: '2026-10-01T00:00:00Z' },
    { id: 2, title: 'older and most overdue', status: 'todo', due_date: '2026-10-05', created_at: '2026-10-20T00:00:00Z' },
  ];
  assert.deepEqual(homeTasks(tasks).map((t) => t.id), [2, 1]);
});

test('homeTasks: same-day ties break by created_at, oldest first', () => {
  const tasks = [
    { id: 1, title: 'created later', status: 'todo', due_date: '2026-11-02', created_at: '2026-10-20T00:00:00Z' },
    { id: 2, title: 'created earlier', status: 'blocked', due_date: '2026-11-02', created_at: '2026-10-11T00:00:00Z' },
  ];
  assert.deepEqual(homeTasks(tasks).map((t) => t.id), [2, 1]);
});

test('homeTasks: a missing created_at falls after carried ones in a tie; id breaks the rest', () => {
  const tasks = [
    { id: 9, title: 'no created_at, high id', status: 'todo', due_date: '2026-11-02' },
    { id: 3, title: 'no created_at, low id', status: 'todo', due_date: '2026-11-02' },
    { id: 7, title: 'carries created_at', status: 'todo', due_date: '2026-11-02', created_at: '2026-10-25T00:00:00Z' },
  ];
  assert.deepEqual(homeTasks(tasks).map((t) => t.id), [7, 3, 9]);
});

test('homeTasks: undated group orders by created_at, missing last, id final', () => {
  const tasks = [
    { id: 5, title: 'undated, no created_at', status: 'todo' },
    { id: 2, title: 'undated, created later', status: 'todo', created_at: '2026-10-20T00:00:00Z' },
    { id: 8, title: 'undated, created earlier', status: 'in_progress', created_at: '2026-10-02T00:00:00Z' },
    { id: 1, title: 'dated beats every undated', status: 'todo', due_date: '2027-01-01' },
  ];
  assert.deepEqual(homeTasks(tasks).map((t) => t.id), [1, 8, 2, 5]);
});

test('homeTasks: order is deterministic — input order never changes the result', () => {
  const a = { id: 4, title: 'a', status: 'todo', due_date: '2026-11-02', created_at: '2026-10-10T00:00:00Z' };
  const b = { id: 9, title: 'b', status: 'todo', due_date: '2026-11-02', created_at: '2026-10-10T00:00:00Z' };
  const c = { id: 6, title: 'c', status: 'blocked', created_at: '2026-10-10T00:00:00Z' };
  const first = homeTasks([a, b, c]).map((t) => t.id);
  const second = homeTasks([c, b, a]).map((t) => t.id);
  assert.deepEqual(first, [4, 9, 6]);
  assert.deepEqual(second, first);
});

test('homeTasks: dropped tasks never render and never count', () => {
  const tasks = [
    { id: 1, title: 'open', status: 'todo' },
    { id: 2, title: 'dropped', status: 'dropped', due_date: '2026-10-01' },
    { id: 3, title: 'done', status: 'done' },
  ];
  assert.deepEqual(homeTasks(tasks).map((t) => t.id), [1]);
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
  // The fixture carries the payload's REAL shape (F-SYNCCARE-SHAPE):
  // sources is a Record keyed by source name, each entry carrying
  // {state, lastEventAt, lastSyncOkAt, syncVersion} — the shape
  // getSyncFreshness returns and SyncFreshnessBlock declares. The
  // previous array-shaped fixture let an Array.isArray guard pass
  // the suite while every real payload failed it.
  const block = {
    generatedAt: '2026-10-27T19:00:00Z',
    sources: {
      people: { state: 'live', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      flows: { state: 'stale', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      moves: { state: 'degraded', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      money: { state: 'reconciling', lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 },
      content: { state: 'unknown', lastEventAt: null, lastSyncOkAt: null, syncVersion: 0 },
    },
  };
  assert.deepEqual(syncCareCount(block), { notFlowing: 3, total: 5 });
  assert.equal(syncCareCount(null), null);
  assert.equal(syncCareCount({ generatedAt: '', sources: {} }), null);
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

test('careConsentGranted: only a complete census opens the gate', () => {
  // [ ] fixture aggregates — counts only, no realistic people.
  assert.equal(careConsentGranted(null), false);
  assert.equal(careConsentGranted(undefined), false);
  assert.equal(careConsentGranted({ total: 0, consentGaps: 0 }), false);
  assert.equal(careConsentGranted({ total: 28, consentGaps: 28 }), false);
  assert.equal(careConsentGranted({ total: 28, consentGaps: 1 }), false);
  assert.equal(careConsentGranted({ total: 28, consentGaps: 0 }), true);
  assert.equal(careConsentGranted({ total: '[]', consentGaps: 0 }), false);
});
