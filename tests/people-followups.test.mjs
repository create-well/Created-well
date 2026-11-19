// Phase 3 Follow-Up Owed pins (packet M §2.3/§7): computed
// membership, open-move definition, the Do Not Contact exclusion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followUpOwedQueue, isOpenMove } from '../src/lib/followUps.ts';

const person = (over) => ({
  id: 1, emoji: '', name: 'Pat', status: 'Exploring', description: '',
  owner: 'pat', followUpMoveIds: [], ...over,
});
const move = (pageId, over) => ({
  id: 9, person: 'monny', title: 'Send the recap', status: 'todo',
  priority: 'medium', notionPageId: pageId, ...over,
});

test('membership: a filed Next Invitation alone owes a follow-up', () => {
  const q = followUpOwedQueue([person({ nextInvitation: '2026-12-01' })], []);
  assert.equal(q.length, 1);
  assert.equal(q[0].nextInvitation, '2026-12-01');
  assert.equal(q[0].moves.length, 0);
});

test('membership: one open Follow-up Move owes a follow-up', () => {
  const p = person({ followUpMoveIds: ['m1'] });
  const q = followUpOwedQueue([p], [move('m1')]);
  assert.equal(q.length, 1);
  assert.equal(q[0].moves[0].title, 'Send the recap');
});

test('done and dropped moves do not count; the person leaves the queue', () => {
  const p = person({ followUpMoveIds: ['m1', 'm2'] });
  const q = followUpOwedQueue([p], [
    move('m1', { status: 'done' }),
    move('m2', { status: 'dropped' }),
  ]);
  assert.equal(q.length, 0);
  assert.equal(isOpenMove({ status: 'blocked' }), true);
  assert.equal(isOpenMove({ status: 'in_progress' }), true);
});

test('a relation target missing from the tasks payload still counts as owed', () => {
  const p = person({ followUpMoveIds: ['ghost'] });
  const q = followUpOwedQueue([p], []);
  assert.equal(q.length, 1);
  assert.equal(q[0].unresolvedMoveCount, 1);
});

test('§7: Do Not Contact never enters the queue, invitation or not', () => {
  const p = person({
    status: 'Do Not Contact',
    nextInvitation: '2026-12-01',
    followUpMoveIds: ['m1'],
  });
  const q = followUpOwedQueue([p], [move('m1')]);
  assert.equal(q.length, 0);
});

test('no fields at all (cached payload) owes nothing and never crashes', () => {
  const bare = { id: 2, emoji: '', name: 'Sam', status: 'active', description: '', owner: 'sam' };
  assert.deepEqual(followUpOwedQueue([bare], []), []);
});
