// FIX 5 low-rank bundle (register 1320): one stale claim and two
// dead surfaces.
// - templates/registry.json claimed the EventCard composition lives
//   in HomePanels.tsx "(imports Card + Button...)". HomePanels
//   imports neither; the Card reference belongs to the Code Connect
//   template's example markup. The note now says so.
// - src/index.ts was a 298-line barrel re-exporting the whole ui/
//   kit with zero importers — the app entry is /src/main.tsx and
//   package.json declares no entry. Deleted.
// - figma/ImageWithFallback.tsx was exported with zero importers.
//   Deleted (it was the figma/ directory's only file).
// NOT in this bundle, by name: src/imports/Cr8WDashV2Copy — dead by
// the same grep, but the imports snapshot is sealed reference
// material (G-51) and stays. And src/CrButton.tsx's comment about
// "the kit's src/index.ts" refers to the Figma Make kit's own file,
// not this barrel — checked, left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = readFileSync(join(root, 'templates/registry.json'), 'utf8');

test('the registry no longer claims HomePanels imports Card + Button', () => {
  assert.ok(!registry.includes('(imports Card + Button'));
  assert.ok(registry.includes('HomePanels.tsx itself imports neither Card nor Button'));
});

test('the barrel and the unimported figma component are gone', () => {
  assert.ok(!existsSync(join(root, 'src/index.ts')));
  assert.ok(!existsSync(join(root, 'src/app/components/figma/ImageWithFallback.tsx')));
});
