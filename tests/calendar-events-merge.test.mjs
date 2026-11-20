// Phase 6 (packet OO §2, QA amendment A2): the cr8w_calendar_events
// namespace merge. Personal events live in the 'gcal-' id namespace;
// feed events are everything else. The A2 exit sequence — feed →
// personal → feed — must leave both sets intact after every step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeFeedWrite, mergePersonalWrite, isPersonalCalendarEvent } from '../api/_calendarEvents.ts';

const F1 = { id: 'feed-1@google.com', title: 'Feed one' };
const F2 = { id: 'feed-2@google.com', title: 'Feed two' };
const F3 = { id: 'ical-999', title: 'Feed three' };
const P1 = { id: 'gcal-aaa', title: 'Personal one' };
const P2 = { id: 'gcal-bbb', title: 'Personal two' };
const ids = (list) => list.map((e) => e.id).sort();

test('namespace: only gcal- ids are personal', () => {
  assert.equal(isPersonalCalendarEvent(P1), true);
  assert.equal(isPersonalCalendarEvent(F1), false);
  assert.equal(isPersonalCalendarEvent({}), false);
  assert.equal(isPersonalCalendarEvent({ id: 42 }), false);
});

test('A2 sequence: feed → personal → feed, both sets intact after each step', () => {
  let list = mergeFeedWrite([], [F1, F2]);
  assert.deepEqual(ids(list), ids([F1, F2]));

  list = mergePersonalWrite(list, [P1]);
  assert.deepEqual(ids(list), ids([F1, F2, P1]));

  // Second feed sync brings a refreshed feed set (F2 gone, F3 new).
  list = mergeFeedWrite(list, [F1, F3]);
  assert.deepEqual(ids(list), ids([F1, F3, P1]));
});

test('personal write drops stale personal events, feed rows untouched', () => {
  const list = mergePersonalWrite([F1, P1], [P2]);
  assert.deepEqual(ids(list), ids([F1, P2]));
});

test('feed write refreshes feed rows, personal rows untouched', () => {
  const list = mergeFeedWrite([F1, F2, P1], [F3]);
  assert.deepEqual(ids(list), ids([F3, P1]));
});

test('empty writes are safe: a personal write of [] clears only the personal namespace', () => {
  assert.deepEqual(ids(mergePersonalWrite([F1, P1], [])), ids([F1]));
  assert.deepEqual(ids(mergeFeedWrite([F1, P1], [])), ids([P1]));
});
