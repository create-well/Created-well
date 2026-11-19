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
//
// Phase 3 (packet M §2.2): PersonView itself retired into the
// person detail route. The removal pin's strongest form is now
// the file's absence, plus the successor surface carrying none of
// the claim. The stations-grid sub-pin retired with the overlay:
// the detail page's specced sections carry no stations grid, and
// the pin below holds that line instead of the old survival form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const detail = readFileSync(join(root, 'src/app/pages/PersonDetailPage.tsx'), 'utf8');
const data = readFileSync(join(root, 'src/app/components/data.ts'), 'utf8');

test('no milestones section, computation, or claim remains on the person surface', () => {
  assert.ok(!existsSync(join(root, 'src/app/components/PersonView.tsx')));
  assert.ok(!detail.includes('MILESTONES'));
  assert.ok(!detail.includes('Hard Launch'));
  assert.ok(!detail.includes('doneCount'));
});

test('the export is gone from data.ts', () => {
  assert.ok(!data.includes('MILESTONES'));
  assert.ok(!data.includes('33 community guests confirmed'));
});

test('the stations grid does not reappear on the detail surface', () => {
  assert.ok(!detail.includes('stations-grid'));
});
