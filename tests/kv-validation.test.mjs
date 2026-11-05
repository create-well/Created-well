// KV payload boundary validation (2026-11-05).
// Stored KV rows used to reach the dashboard payload on trust alone.
// These cases pin the minimal contract: a row must be a record with a
// usable id and the string fields its consumers treat as load-bearing;
// valid rows pass through untouched, malformed rows are dropped and
// counted, and unknown slices fall back to the record-plus-id rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKvSlice } from '../api/_kv-validation.ts';

test('valid rows pass through by reference with zero dropped', () => {
  const row = { id: 1, author: 'monny', content: 'hello', extra: { nested: true } };
  const { values, dropped } = validateKvSlice('cr8w_messages', [row]);
  assert.equal(dropped, 0);
  assert.equal(values[0], row);
});

test('non-records and rows without a usable id are dropped', () => {
  const rows = [null, 'text', 42, [{ id: 1 }], { author: 'a', content: 'b' }, { id: '', author: 'a', content: 'b' }, { id: Number.NaN, author: 'a', content: 'b' }];
  const { values, dropped } = validateKvSlice('cr8w_messages', rows);
  assert.deepEqual(values, []);
  assert.equal(dropped, rows.length);
});

test('missing or mistyped load-bearing strings are dropped per slice', () => {
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_announcements', [{ id: 1, text: 9 }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_calendar_events', [{ id: 'e1', title: 'T', start: 's' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_well_notes', [{ id: 1, content: 'note', landed: 0 }]).dropped, 0);
});

test('forum replies require a usable postId', () => {
  assert.equal(validateKvSlice('cr8w_forum_replies', [{ id: 1, author: 'a', content: 'c' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_forum_replies', [{ id: 1, postId: 7, author: 'a', content: 'c' }]).dropped, 0);
});

test('workshop numeric fields are checked only when present', () => {
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1, title: 'W', date: '2026-11-10' }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1, title: 'W', date: '2026-11-10', capacity: '20' }]).dropped, 1);
});

test('decisions require the writable vocabularies; deferred is not a status', () => {
  const good = { id: 1, question: 'Ship it?', context: '', urgency: 'now', status: 'pending' };
  assert.equal(validateKvSlice('cr8w_decisions', [good]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_decisions', [{ ...good, status: 'deferred' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_decisions', [{ ...good, urgency: 'someday' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_decisions', [{ ...good, context: 3 }]).dropped, 1);
  const { context, ...withoutContext } = good;
  assert.equal(validateKvSlice('cr8w_decisions', [withoutContext]).dropped, 0);
});

test('unknown slices use the record-plus-id fallback rule', () => {
  assert.equal(validateKvSlice('cr8w_future', [{ id: 'x', anything: true }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_future', [{ anything: true }]).dropped, 1);
});
