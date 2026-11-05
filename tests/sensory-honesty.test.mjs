// FIX 4 sweep, Class 1 A — SensorySettings consumer-less toggles.
// The sounds and haptics rows persisted cw_sound / cw_haptic and
// dispatched storage events, but nothing in the app consumes either
// key: no audio playback exists and navigator.vibrate is never
// called, so the toggles claimed effects that cannot occur. The rows
// (and their state, toggles, and the orphaned isMobile helper) are
// removed. The motion row stays: it is backed — toggleMotion applies
// html.cw-no-motion, which cr8w.css honors. If sounds or haptics are
// wanted later, they return as a feature build with real handlers,
// not as settings theater.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/components/SensorySettings.tsx'), 'utf8');

test('no sounds or haptics rows, state, or storage keys', () => {
  assert.ok(!src.includes('label="sounds"'));
  assert.ok(!src.includes('label="haptics"'));
  assert.ok(!src.includes('cw_sound'));
  assert.ok(!src.includes('cw_haptic'));
});

test('the backed motion setting remains', () => {
  assert.ok(src.includes('label="motion"'));
  assert.ok(src.includes('cw-no-motion'));
});
