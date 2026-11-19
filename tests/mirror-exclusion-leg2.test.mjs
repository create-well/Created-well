// Register 1435 Leg 2 (carriage: Leg 1, register 1442) — the
// presentation reshapes exclude registryMirror-flagged rows.
// Original sites: RootLayout's reshape into PersonView's
// wellNotes, MovesPage's reshape into the flows view's well
// list, and MovesPage's forum prop into the flows view's forum
// tab. The slice itself stays whole: ContentFlowSnapshotPanel
// (the mirror rows' legitimate surface) and HomePanels'
// contentReadyCounts carry no part of this filter, pinned below.
//
// Phase 3 (packet M §2.2): PersonView retired, and RootLayout's
// reshape into its wellNotes retired with it — the person detail
// page renders no forum content at all, so the exclusion holds
// there by absence.
// Ghost cleanup (packet CC): MovesPage is deleted — both of its
// reshape sites retire with it, and the exclusion holds there by
// absence as well. The surviving pins are the legitimate
// surfaces' cleanliness and the retired sites' absence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(root, 'src/app/RootLayout.tsx'), 'utf8');
const panel = readFileSync(join(root, 'src/app/components/ContentFlowSnapshotPanel.tsx'), 'utf8');
const panels = readFileSync(join(root, 'src/lib/homePanels.ts'), 'utf8');

test('the retired reshape sites hold by absence', () => {
  // RootLayout's reshape retired with PersonView (Phase 3);
  // MovesPage's two reshapes retired with the page (packet CC).
  // Neither site may reintroduce the filter.
  assert.ok(!layout.includes('registryMirror'));
});

test('the legitimate surfaces carry no part of the filter', () => {
  assert.ok(!panel.includes('registryMirror'));
  assert.ok(!panels.includes('registryMirror'));
});
