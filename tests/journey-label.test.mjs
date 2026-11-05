// FIX 4 sweep, Class 1 B — Guest Journey reference map.
// The Geyser Journey tab renders GUEST_JOURNEY, a hardcoded stage
// list in data.ts, under the title "Guest Journey Map" with nothing
// saying it is a standing reference rather than the configured,
// live journey. The tab now carries that disclosure in plain words.
// (Wiring the tab to EVENTS/FLOWS is a feature build with UX input,
// not an honesty fix; the label is the fix the finding names second.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/components/GeyserView.tsx'), 'utf8');

test('the journey tab discloses its reference nature', () => {
  assert.ok(src.includes('Reference map — the standing shape of a guest'));
  assert.ok(src.includes('Not wired to live event data.'));
});
