// Register 1435 Leg 2 (carriage: Leg 1, register 1442) — the
// presentation reshapes exclude registryMirror-flagged rows.
// Three sites: RootLayout's reshape into PersonView's
// wellNotes, MovesPage's reshape into the flows view's well
// list, and MovesPage's forum prop into the flows view's forum
// tab (filtered at the pass, so the exclusion scopes to that
// view's consumption). The slice itself stays whole:
// ContentFlowSnapshotPanel (the mirror rows' legitimate
// surface) and HomePanels' contentReadyCounts carry no part of
// this filter, pinned below.
//
// Phase 3 (packet M §2.2): PersonView retired, and RootLayout's
// reshape into its wellNotes retired with it — the person detail
// page renders no forum content at all, so the exclusion holds
// there by absence. The two MovesPage reshapes keep their pins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(root, 'src/app/RootLayout.tsx'), 'utf8');
const moves = readFileSync(join(root, 'src/app/pages/MovesPage.tsx'), 'utf8');
const panel = readFileSync(join(root, 'src/app/components/ContentFlowSnapshotPanel.tsx'), 'utf8');
const panels = readFileSync(join(root, 'src/lib/homePanels.ts'), 'utf8');

test('the surviving reshapes filter on the flag', () => {
  assert.ok(moves.includes('data.forum.filter(f => !f.registryMirror).map(f => ({'));
  assert.ok(moves.includes('forum={data.forum.filter(f => !f.registryMirror)}'));
  // The RootLayout reshape site retired with PersonView (Phase 3);
  // its absence is the pin now.
  assert.ok(!layout.includes('registryMirror'));
});

test('the legitimate surfaces carry no part of the filter', () => {
  assert.ok(!panel.includes('registryMirror'));
  assert.ok(!panels.includes('registryMirror'));
});
