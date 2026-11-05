// KV payload boundary validation (2026-11-05).
// Stored KV rows used to reach the dashboard payload on trust alone.
// The contract is permissive on purpose: a row must be a plain record,
// and any field it carries must hold the primitive its consumers
// expect. Merely incomplete legacy rows survive untouched; definite
// wrong primitives drop the row; drops are counted for sourceErrors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKvSlice } from '../api/_kv-validation.ts';

test('valid rows pass through by reference with zero dropped', () => {
  const row = { id: 1, author: 'monny', content: 'hello', extra: { nested: true } };
  const { values, dropped } = validateKvSlice('cr8w_messages', [row]);
  assert.equal(dropped, 0);
  assert.equal(values[0], row);
});

test('non-records are dropped; incomplete records survive', () => {
  const incomplete = { author: 'a', content: 'b' };
  const rows = [null, 'text', 42, [{ id: 1 }], incomplete];
  const { values, dropped } = validateKvSlice('cr8w_messages', rows);
  assert.deepEqual(values, [incomplete]);
  assert.equal(dropped, 4);
});

test('a present id must be a non-empty string or a finite number', () => {
  assert.equal(validateKvSlice('cr8w_messages', [{ id: '', author: 'a', content: 'b' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: Number.NaN, author: 'a', content: 'b' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 'legacy-string-id', author: 'a', content: 'b' }]).dropped, 0);
});

test('wrong primitives in known fields drop the row, per slice', () => {
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a', content: 42 }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a', content: 'c', edited: 'yes' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a', content: 'c', reactions: { '👍': 'monny' } }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a', content: 'c', reactions: { '👍': ['monny'] }, tag: null }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_announcements', [{ id: 1, text: 't', active: '1' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1, title: {}, date: '2026-11-10' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1, title: 'W', tags: 'play' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1, title: 'W', capacity: '20' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_coflow_checkins', [{ id: 1, weekOf: 'w', confirmTime: 'yes' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_well_notes', [{ id: 1, content: 'n', landed: '3' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_calendar_events', [{ id: 'e', title: 123, start: 's', end: 'e' }]).dropped, 1);
});

test('missing fields and null optionals survive (legacy compatibility)', () => {
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1 }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_workshops', [{ id: 1, title: 'W', status: 'some-legacy-status' }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a', content: 'c', created_at: 'sometime last spring' }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_messages', [{ id: 1, author: 'a', content: 'c', created_at: 123 }]).dropped, 1);
});

test('forum replies: a present postId must be string-or-finite-number', () => {
  assert.equal(validateKvSlice('cr8w_forum_replies', [{ id: 1, postId: { x: 1 }, author: 'a', content: 'c' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_forum_replies', [{ id: 1, postId: 7, author: 'a', content: 'c' }]).dropped, 0);
});

test('decisions: closed vocabularies enforced when present; deferred is not a status', () => {
  const good = { id: 1, question: 'Ship it?', context: '', urgency: 'now', status: 'pending' };
  assert.equal(validateKvSlice('cr8w_decisions', [good]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_decisions', [{ ...good, status: 'deferred' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_decisions', [{ ...good, urgency: 'someday' }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_decisions', [{ ...good, context: 3 }]).dropped, 1);
  assert.equal(validateKvSlice('cr8w_decisions', [{ id: 2 }]).dropped, 0);
});

test('unknown slices use the plain-record fallback rule', () => {
  assert.equal(validateKvSlice('cr8w_future', [{ id: 'x', anything: true }]).dropped, 0);
  assert.equal(validateKvSlice('cr8w_future', ['not a record']).dropped, 1);
});
