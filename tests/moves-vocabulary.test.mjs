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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const geyser = readFileSync(join(root, 'src/app/components/GeyserView.tsx'), 'utf8');
const person = readFileSync(join(root, 'src/app/components/PersonView.tsx'), 'utf8');
const cev = readFileSync(join(root, 'src/app/components/CommunityEventsView.tsx'), 'utf8');

test('no To Do / In Progress words remain on the three surfaces', () => {
  for (const src of [geyser, person]) {
    assert.ok(!src.includes('>To Do<'));
    assert.ok(!src.includes('>In Progress<'));
    assert.ok(!src.includes("label: 'To Do'"));
    assert.ok(!src.includes("label: 'In Progress'"));
  }
});

test('stored values unchanged, labels read Next / Now', () => {
  assert.ok(geyser.includes('<option value="todo">Next</option>'));
  assert.ok(geyser.includes('<option value="in_progress">Now</option>'));
  assert.ok(person.includes("{ key: 'todo', label: 'Next' }"));
  assert.ok(person.includes("{ key: 'in_progress', label: 'Now' }"));
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
