// Phase 4 (packet T) /making page shape pins: the section mount order
// on PodyapsPage, the retired sessions-page empty states, the two
// queue empty states verbatim, and the stale→stale sync mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const podyapsSrc = readFileSync(new URL('../src/app/pages/PodyapsPage.tsx', import.meta.url), 'utf8');
const queuesSrc = readFileSync(new URL('../src/app/components/making/MakingQueues.tsx', import.meta.url), 'utf8');

test('PodyapsPage mounts SessionsStrip, ReleaseStatusStrip, MakingQueues, MakingBoard in that order', () => {
  const order = ['SessionsStrip', 'ReleaseStatusStrip', 'MakingQueues', 'MakingBoard'];
  let lastIndex = -1;
  for (const name of order) {
    const idx = podyapsSrc.indexOf(`<${name}`);
    assert.ok(idx !== -1, `${name} mounts on PodyapsPage`);
    assert.ok(idx > lastIndex, `${name} mounts after the previous section`);
    lastIndex = idx;
  }
});

test('the old sessions-page empty states no longer appear in PodyapsPage', () => {
  assert.doesNotMatch(podyapsSrc, /No podyaps scheduled/);
  assert.doesNotMatch(podyapsSrc, /yapcast/);
});

test('MakingQueues carries both queue empty states verbatim', () => {
  assert.match(
    queuesSrc,
    /Nothing is at the Taste gate\. When a piece's Current Gate is filed as Taste in Notion, it waits here\./,
  );
  assert.match(
    queuesSrc,
    /Nothing is waiting for a release call\. When a piece is Final, Ready, and has its link and publish date filed in Notion, it waits here\./,
  );
});

test("PodyapsPage maps syncStatus 'stale' to ViewShell state 'stale' explicitly", () => {
  assert.match(podyapsSrc, /data\.syncStatus === 'stale' \? 'stale'/);
});
