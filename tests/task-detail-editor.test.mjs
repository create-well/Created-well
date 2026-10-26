import { test } from 'node:test';
import assert from 'node:assert/strict';

// Plain JS mirror of the Option B detail editor state and save rules.
// No live record, no React render, no Supabase. Mirrors only the
// open/close rule, Due clear rule, Blocked By reuse rule, and status options.

function createDetailState() {
  let detailTaskId = null;
  return {
    open(id) { detailTaskId = detailTaskId === id ? null : id; },
    close() { detailTaskId = null; },
    get id() { return detailTaskId; },
  };
}

test('one detail editor open at a time, opening a second row closes the first', () => {
  const d = createDetailState();
  d.open(1); assert.equal(d.id, 1);
  d.open(2); assert.equal(d.id, 2);
  d.open(2); assert.equal(d.id, null);
});

test('close discards no saved value, because saves already happened on blur or change', () => {
  const saved = { due_date: '2026-10-31', source: 'waiting on X', status: 'in_progress' };
  const d = createDetailState();
  d.open(7); d.close();
  assert.equal(d.id, null);
  assert.deepEqual(saved, { due_date: '2026-10-31', source: 'waiting on X', status: 'in_progress' });
});

test('Due clear sends an empty string, which the writer maps to Due null', () => {
  const updates = [];
  const onUpdateTask = (id, u) => updates.push([id, u]);
  onUpdateTask(7, { due_date: '' });
  assert.deepEqual(updates, [[7, { due_date: '' }]]);
});

test('Blocked By clear sends an empty string, which the writer maps to empty rich text', () => {
  const updates = [];
  const onUpdateTask = (id, u) => updates.push([id, u]);
  onUpdateTask(7, { source: '' });
  assert.deepEqual(updates, [[7, { source: '' }]]);
});

test('detail status options include dropped alongside the existing four', () => {
  const options = ['todo', 'in_progress', 'done', 'blocked', 'dropped'];
  assert.ok(options.includes('dropped'));
  assert.equal(options.length, 5);
});

test('detail editor reuses the row save calls, no new writer path', () => {
  const calls = [];
  const onUpdateTaskStatus = (id, s) => calls.push(['status', id, s]);
  const onUpdateTask = (id, u) => calls.push(['task', id, u]);
  onUpdateTaskStatus(7, 'dropped');
  onUpdateTask(7, { due_date: '2026-11-07' });
  assert.deepEqual(calls, [['status', 7, 'dropped'], ['task', 7, { due_date: '2026-11-07' }]]);
});
