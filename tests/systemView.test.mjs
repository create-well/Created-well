import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const system = await read('src/views/SystemView.tsx');
const app = await read('src/App.tsx');

test('System route renders the SystemView from shared dashboard inputs', () => {
  assert.match(app, /<SystemView collaborators=\{collaborators\} tasks=\{tasks\} stations=\{stations\}/);
  assert.match(system, /data-testid="system-view"/);
  assert.match(system, /collaborators: readonly any\[\]/);
  assert.match(system, /tasks: readonly any\[\]/);
  assert.match(system, /stations: readonly any\[\]/);
});

test('System view exposes health, freshness, and tending states', () => {
  assert.match(system, /In good flow/);
  assert.match(system, /Worth tending/);
  assert.match(system, /Sources online/);
  assert.match(system, /Active inputs/);
  assert.match(system, /Needs tending/);
  assert.match(system, /Checked moments ago/);
  assert.match(system, /Next right tending/);
});

test('System view protects the Care boundary and provides expandable checks', () => {
  assert.match(system, /Contact invitations stay hidden until permission is present/);
  assert.match(system, /aria-expanded=\{expanded === check.id\}/);
  assert.match(system, /Review source flow/);
});
