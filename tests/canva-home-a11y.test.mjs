import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app/components/CanvaHomeView.tsx', import.meta.url), 'utf8');

test('CanvaHomeView wires Recent currents through latestWellNote', () => {
  assert.match(source, /latestWellNote\(wellNotes\)/);
});

test('arrival choices expose their selected state', () => {
  assert.match(source, /aria-pressed=\{arrival === option\}/);
});

test('mood choices expose their selected state', () => {
  assert.match(source, /aria-pressed=\{mood === label\}/);
});
