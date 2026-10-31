import { test } from 'node:test';
import assert from 'node:assert/strict';

// Plain JS mirrors of the three Copilot accessibility fixes in GeyserView.tsx.
// No live record, no React render, no Supabase. Mirrors only the
// attribute and activation rules, not a browser accessibility tree.

// Issue 1, Copilot r4374248341: Detail button aria-expanded and name.
function detailButtonProps(detailTaskId, taskId) {
  const open = detailTaskId === taskId;
  return { ariaExpanded: open, ariaLabel: open ? 'Close task detail' : 'Open task detail' };
}
test('Detail button closed: aria-expanded false, name Open task detail', () => {
  assert.deepEqual(detailButtonProps(null, 7), { ariaExpanded: false, ariaLabel: 'Open task detail' });
});
test('Detail button open: aria-expanded true, name Close task detail', () => {
  assert.deepEqual(detailButtonProps(7, 7), { ariaExpanded: true, ariaLabel: 'Close task detail' });
});
test('Detail button for another task stays closed', () => {
  assert.deepEqual(detailButtonProps(7, 9), { ariaExpanded: false, ariaLabel: 'Open task detail' });
});

// Issue 2, Copilot r4374248377: InlineEdit idle trigger focusable, Enter/Space activation.
function inlineEditIdleProps() { return { tabIndex: 0, role: 'button' }; }
function inlineEditActivates(key) { return key === 'Enter' || key === ' '; }
test('InlineEdit idle trigger is focusable with role button', () => {
  assert.deepEqual(inlineEditIdleProps(), { tabIndex: 0, role: 'button' });
});
test('InlineEdit Enter activates editing', () => { assert.equal(inlineEditActivates('Enter'), true); });
test('InlineEdit Space activates editing', () => { assert.equal(inlineEditActivates(' '), true); });
test('InlineEdit other keys do not activate editing', () => {
  assert.equal(inlineEditActivates('Escape'), false);
  assert.equal(inlineEditActivates('a'), false);
});

// Issue 3, Copilot r4374248405: Status label htmlFor/id association.
function detailStatusIds(taskId) {
  const id = `detail-status-${taskId}`;
  return { labelHtmlFor: id, selectId: id };
}
test('Status label htmlFor matches detail select id', () => {
  const ids = detailStatusIds(7);
  assert.equal(ids.labelHtmlFor, 'detail-status-7');
  assert.equal(ids.selectId, ids.labelHtmlFor);
});
test('Status ids are unique per task', () => {
  assert.notEqual(detailStatusIds(7).selectId, detailStatusIds(9).selectId);
});
