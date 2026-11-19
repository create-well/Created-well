// FIX 4 sweep, Class 3 — MOVES status vocabulary drift.
// The canonical client vocabulary for a Move's status is the wire set
// Now / Next / Done / Blocked / Dropped (the writer maps todo ->
// 'Next' and in_progress -> 'Now'). The GeyserView legs — the word
// sweep, the option labels, the dead statusLabels/statusClasses
// consts — retired with GeyserView in the ghost cleanup (packet CC).
//
// Phase 3 (packet M §2.2): PersonView retired, and its legs of these
// pins retired with it, named here. The surviving surface keeps its
// pin: the community badge maps every status to the vocabulary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cev = readFileSync(join(root, 'src/app/components/CommunityEventsView.tsx'), 'utf8');

test('the community badge maps every status to the vocabulary', () => {
  assert.ok(cev.includes("t.status === 'blocked' ? 'Blocked'"));
  assert.ok(cev.includes("t.status === 'dropped' ? 'Dropped'"));
  assert.ok(cev.includes("t.status === 'done' ? 'Done'"));
});
