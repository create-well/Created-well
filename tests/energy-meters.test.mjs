// FIX 4 sweep, Class 1 A — per-person "energy" meters.
// Two surfaces presented invented per-person state: the TopNav
// profile card's energy bar was a hardcoded width per person
// (55/65/75%), and HubView's profile battery computed every person's
// "energy" from the VIEWER's own arriveState mood. No per-person
// energy field exists in any source, so both meters are removed.
// The viewer's own mood surfaces (their arrive state, their own
// check-in) are untouched — the defect was attribution, not the mood.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const topnav = readFileSync(join(root, 'src/app/components/TopNav.tsx'), 'utf8');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');

test('TopNav carries no hardcoded per-person energy width', () => {
  assert.ok(!topnav.includes("expandedProfile === 'bingle' ? '55%'"));
  assert.ok(!topnav.includes("? '75%' : '65%'"));
});

test('HubView does not derive per-person energy from the viewer mood', () => {
  assert.ok(!hub.includes('energyLevel'));
  assert.ok(!hub.includes('Energy battery'));
});
