// FIX 4 sweep, Class 3 — MOVES status vocabulary drift.
// The canonical client vocabulary for a Move's status is the wire set
// Now / Next / Done / Blocked / Dropped (the writer maps todo ->
// 'Next' and in_progress -> 'Now'). Three surfaces wore the retired
// "To Do" / "In Progress" words, and the community badge passed
// blocked/dropped through in raw lowercase. Stored values and filter
// keys are unchanged — only the words a person reads. The GeyserView
// leg also deletes the unused statusLabels/statusClasses consts,
// which carried the same drift (their Class 4 item, retired here
// because this packet already opens the file for the same words).
//
// Phase 3 (packet M §2.2): PersonView, one of the three surfaces,
// retired into the person detail route, so its legs of these pins
// retire with it, named here. The surviving surfaces keep theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const geyser = readFileSync(join(root, 'src/app/components/GeyserView.tsx'), 'utf8');
const cev = readFileSync(join(root, 'src/app/components/CommunityEventsView.tsx'), 'utf8');

test('no To Do / In Progress words remain on the surviving surfaces', () => {
  for (const src of [geyser]) {
    assert.ok(!src.includes('>To Do<'));
    assert.ok(!src.includes('>In Progress<'));
    assert.ok(!src.includes("label: 'To Do'"));
    assert.ok(!src.includes("label: 'In Progress'"));
  }
});

test('stored values unchanged, labels read Next / Now', () => {
  assert.ok(geyser.includes('<option value="todo">Next</option>'));
  assert.ok(geyser.includes('<option value="in_progress">Now</option>'));
});

test('the dead drifted consts are gone from GeyserView', () => {
  assert.ok(!geyser.includes('statusLabels'));
  assert.ok(!geyser.includes('statusClasses'));
});

test('the community badge maps every status to the vocabulary', () => {
  assert.ok(cev.includes("t.status === 'blocked' ? 'Blocked'"));
  assert.ok(cev.includes("t.status === 'dropped' ? 'Dropped'"));
  assert.ok(cev.includes("t.status === 'done' ? 'Done'"));
});
