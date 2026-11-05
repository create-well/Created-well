// FIX 4 sweep, Class 1 A — FlowCommandCenter facade state.
// Three claims were hardcoded theater: a "Live gear" card asserting
// current hardware state ("battery 100% · backup audio rolling",
// "Omar ready"), "Collective resonance" counts that were one browser's
// useState, and a "Flow Keeper override / Locked topic" narrative with
// no vote or lock behind it. The fixes tell the truth: the gear card is
// a static setup reference, the resonance toggle is personal, and the
// topic banner states the topic. These pins keep the claims out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/components/FlowCommandCenter.tsx'), 'utf8');

test('no live-telemetry or readiness claims on the gear card', () => {
  assert.ok(!src.includes('battery 100%'));
  assert.ok(!src.includes('backup audio rolling'));
  assert.ok(!src.includes('Omar ready'));
  assert.ok(!src.includes('Live gear'));
  assert.ok(src.includes('Gear setup'));
});

test('resonance is personal: no counts, no collective label', () => {
  assert.ok(!src.includes('resonanceCounts'));
  assert.ok(!src.includes('Collective resonance'));
  assert.ok(src.includes('Your resonance'));
});

test('no override or lock narrative', () => {
  assert.ok(!src.includes('overrode the vote'));
  assert.ok(!src.includes('Flow Keeper override'));
  assert.ok(!src.includes('Locked topic'));
  assert.ok(src.includes('Session topic'));
});
