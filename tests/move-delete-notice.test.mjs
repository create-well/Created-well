import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const context = await readFile(new URL('../src/contexts/DashboardContext.tsx', import.meta.url), 'utf8');
const notice = await readFile(new URL('../src/app/components/MoveDeleteNotice.tsx', import.meta.url), 'utf8');
const action = context.slice(context.indexOf('async deleteTask(id: number)'), context.indexOf('// Stations', context.indexOf('async deleteTask(id: number)')));
// Source contracts only. Actual React/mobile behavior has a separate isolated fixture receipt.
test('delete failure sets a notice without removing the Move in the catch path', () => {
  const caught = action.slice(action.indexOf('catch (e)'));
  assert.match(caught, /setFailedMoveDelete\(id\)/);
  assert.doesNotMatch(caught, /setTasks/);
});
test('a confirmed different delete cannot clear a previous failure notice', () => {
  assert.match(action, /setFailedMoveDelete\(prev => prev === id \? null : prev\)/);
});
test('notice is persistent, dismissible, and does not render provider errors', () => {
  assert.match(notice, /role="alert"/);
  assert.match(notice, /onClick=\{onDismiss\}/);
  assert.match(notice, /Refresh to check this Move before trying again/);
  assert.doesNotMatch(notice, /setTimeout|dangerouslySetInnerHTML|sync\.error|\{error/);
  assert.match(context, /failedMoveDelete !== null/);
});
