// Register 1334 — the HubView open-mode banner carried the same
// retired audience claim as the dial's old stop-2 desc: "your
// presence is fully visible." The dial is device-local; the banner
// renders on the viewer's own composer and changes nothing anyone
// else sees (UX ruling: copy describes behavior, never audience).
// It now states the behavior, in the same words as the dial's
// stop-2 description. The NotesFromTheWell open banner ("your words
// carry warmth") was checked in the same pass: flavor, no audience
// claim — it stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');

test('the open-mode banner makes no audience claim', () => {
  assert.ok(!hub.includes('your presence is fully visible'));
  assert.ok(!hub.includes('fully visible'));
});

test('the banner states the behavior in the dial\u2019s own words', () => {
  assert.ok(hub.includes('🔥 open mode — your name shows on what you post'));
});
