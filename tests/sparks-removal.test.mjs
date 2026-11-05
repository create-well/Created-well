// FIX 5 [C1·A] — PersonView "Sparks" capture removed (register 1320).
// The section invited capture, but its sole render path (RootLayout)
// passed momentumItems={[]} and onAddMomentum={() => {}}: a submitted
// spark cleared the input and wrote nowhere, and the list could never
// populate. Silent data loss — the worst facade class in this stack.
// No momentum store exists anywhere, and where sparks should live is
// a product call, not an invention; until a home is named, the honest
// surface is no capture at all. The removal takes the section, the
// input state and handler, both props at both ends, and the
// MomentumItem type whose only consumer this was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const person = readFileSync(join(root, 'src/app/components/PersonView.tsx'), 'utf8');
const layout = readFileSync(join(root, 'src/app/RootLayout.tsx'), 'utf8');
const data = readFileSync(join(root, 'src/app/components/data.ts'), 'utf8');

test('no sparks capture surface remains in PersonView', () => {
  assert.ok(!person.includes('Capture a spark'));
  assert.ok(!person.includes('spark-input'));
  assert.ok(!person.includes('addSpark'));
  assert.ok(!person.includes('onAddMomentum'));
  assert.ok(!person.includes('momentumItems'));
});

test('the RootLayout call site passes no momentum props', () => {
  assert.ok(!layout.includes('momentumItems'));
  assert.ok(!layout.includes('onAddMomentum'));
});

test('the MomentumItem type is gone with its only consumer', () => {
  assert.ok(!data.includes('MomentumItem'));
});
