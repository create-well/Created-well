import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const decisions = await read('src/views/DecisionsView.tsx');
const app = await read('src/App.tsx');

test('Decisions view is wired to the decisions route and existing task payload', () => {
  assert.match(app, /<DecisionsView tasks=\{tasks\}/);
  assert.match(decisions, /data-testid="decisions-view"/);
  assert.match(decisions, /tasks: readonly any\[\]/);
});

test('Decisions wireframe exposes a calm queue hierarchy and next-right invitation', () => {
  assert.match(decisions, /A place to pause, see, and choose/);
  assert.match(decisions, /Next right invitation/);
  assert.match(decisions, /Land this decision/);
  assert.match(decisions, /Landed in the flow/);
  assert.match(decisions, /ready: 'Ready to respond'/);
  assert.match(decisions, /holding: 'Holding the boundary'/);
  assert.match(decisions, /decided: 'Decision landed'/);
});

test('Decisions wireframe includes Pia in consent-aware stewardship context', () => {
  assert.match(decisions, /owner: 'Pia'/);
  assert.match(decisions, /Confirm the consent signal before opening a channel/);
  assert.match(decisions, /Waiting for permission/);
});
