import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const intro = await readFile(new URL('../src/components/DashboardViewIntro.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('all seven dashboard views receive shared branded framing', () => {
  for (const view of ['hub', 'podcast', 'coflow', 'workshops', 'revenue', 'well', 'team']) {
    assert.match(intro, new RegExp(`\\b${view}:`));
  }
  assert.match(app, /<DashboardViewIntro view=\{currentView\}/);
});

test('remaining view copy follows Create Well operating language', () => {
  assert.match(intro, /The shared landing place/);
  assert.match(intro, /Ideas in motion/);
  assert.match(intro, /Relational timing/);
  assert.match(intro, /Practice made shareable/);
  assert.match(intro, /The Source/);
  assert.match(intro, /Conditions for flow/);
  assert.match(intro, /Next right move/);
});
