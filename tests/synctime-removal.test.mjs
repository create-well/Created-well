// FIX 4 sweep, Class 1 B — the retired "Synced {time}" label.
// ThisWeekPage computed a 'Synced …' string from lastSynced and
// passed it to HubView, which declared and destructured the prop
// and never rendered it: dead computation feeding a dead prop, left
// over from the label's retirement (freshness is told by the
// SyncStatusBar line under the header discipline). The whole chain
// is deleted — computation, JSX prop, type field, destructure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src/app/pages/ThisWeekPage.tsx'), 'utf8');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');

test('no syncTime chain remains on either side', () => {
  assert.ok(!page.includes('syncTime'));
  assert.ok(!hub.includes('syncTime'));
  assert.ok(!page.includes("'Synced '"));
});
