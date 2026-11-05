// FIX 5 [C1·A] — VisibilityDial stop descriptions tell the truth
// (register 1320). The dial's value (device-local, localStorage) does
// exactly two things in the app: at 0, posts go anonymous (brain
// dumps, chat, well notes) with quiet banners; at 2, the well
// surfaces show the user an open-mode banner. Stops 1 and 2 are
// otherwise identical — reactions are never gated, and "receive
// invites" had no mechanism anywhere. The descriptions now claim
// only the real behavior. Stop 0's desc was already true and is
// unchanged. Whether 'open' should carry real tier semantics is a
// product call, named in the packet — not invented here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dial = readFileSync(join(root, 'src/app/components/VisibilityDial.tsx'), 'utf8');

test('no stop promises unimplemented behavior', () => {
  assert.ok(!dial.includes('receive invites'));
  assert.ok(!dial.includes('you can react and be seen'));
});

test('the descriptions state the real behavior per stop', () => {
  assert.ok(dial.includes("desc: 'anonymous mode, your notes are unsigned'"));
  assert.ok(dial.includes("desc: 'your name shows on what you post'"));
  assert.ok(dial.includes("desc: 'your name shows, plus an open-mode banner on your well'"));
});
