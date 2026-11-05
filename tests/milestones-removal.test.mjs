// MILESTONES removal (register 1296). The sweep called the data.ts
// MILESTONES export dead; it was live — PersonView imported it and
// rendered a "🚀 Hard Launch Milestones" section with a hardcoded
// progress bar ("5 of 7 complete") including the claim "33 community
// guests confirmed on invite pipeline" marked done. That is the
// parked Geyser launchpad cluster rendering on a second surface
// (F4 removed the same claim from GeyserView) and an A-equivalent
// facade. The section and the export are removed together —
// PersonView was the export's only consumer, re-verified at base.
// KEPT, deliberately: the stations grid that shared the section's
// conditional wrapper. It renders real stations data; its wrapper
// condition is now stations-driven and it carries its own heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const person = readFileSync(join(root, 'src/app/components/PersonView.tsx'), 'utf8');
const data = readFileSync(join(root, 'src/app/components/data.ts'), 'utf8');

test('no milestones section, computation, or claim remains in PersonView', () => {
  assert.ok(!person.includes('MILESTONES'));
  assert.ok(!person.includes('Hard Launch'));
  assert.ok(!person.includes('doneCount'));
});

test('the export is gone from data.ts', () => {
  assert.ok(!data.includes('MILESTONES'));
  assert.ok(!data.includes('33 community guests confirmed'));
});

test('the stations grid survives on its own condition and heading', () => {
  assert.ok(person.includes('stationList.length > 0'));
  assert.ok(person.includes('stations-grid'));
});
