// Paired client leg for the legacy /sync retirement: the fallback
// response omits the four Notion-canonical slices (tasks, stations,
// coflowDates, money) instead of serving a stale KV mirror. A fallback
// load must hold last-good canonical state; a primary load governs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalOnLoad } from '../src/lib/canonicalFallback.ts';

test('primary load applies the incoming slice; an absent field reads as empty', () => {
  assert.deepEqual(canonicalOnLoad(false, [{ id: 1 }], [{ id: 9 }]), [{ id: 1 }]);
  assert.deepEqual(canonicalOnLoad(false, undefined, [{ id: 9 }]), []);
  assert.deepEqual(canonicalOnLoad(false, [], [{ id: 9 }]), []);
});

test('fallback load holds last-good, whatever the fallback carried', () => {
  const lastGood = [{ id: 1 }, { id: 2 }];
  // The retired-server shape: fields absent entirely.
  assert.equal(canonicalOnLoad(true, undefined, lastGood), lastGood);
  // Even a stray present value on a fallback load does not overwrite.
  assert.equal(canonicalOnLoad(true, [{ id: 7 }], lastGood), lastGood);
});

test('the load sequence: primary populates, transient failure, fallback holds', () => {
  let tasks = canonicalOnLoad(false, [{ id: 1 }], []);
  tasks = canonicalOnLoad(true, undefined, tasks);
  assert.deepEqual(tasks, [{ id: 1 }]);
  // Recovery: the next primary load governs again.
  tasks = canonicalOnLoad(false, [{ id: 2 }], tasks);
  assert.deepEqual(tasks, [{ id: 2 }]);
});

test('all four canonical setters route through the hold; KV setters stay unconditional', async () => {
  const ctx = await readFile(new URL('../src/contexts/DashboardContext.tsx', import.meta.url), 'utf8');
  for (const setter of ['setTasks', 'setStations', 'setCoFlowDates', 'setMoney']) {
    assert.match(ctx, new RegExp(`${setter}\\(canonicalOnLoad\\(usedFallback,`));
  }
  assert.doesNotMatch(ctx, /setTasks\(data\.tasks \|\| \[\]\)/);
  assert.doesNotMatch(ctx, /setMoney\(data\.money \|\| \[\]\)/);
  // KV-owned slices keep updating from the fallback exactly as before.
  assert.match(ctx, /setMessages\(deduplicateSystemMessages\(data\.messages \|\| \[\]\)\)/);
  assert.match(ctx, /setBrainDumps\(data\.braindumps \|\| \[\]\)/);
});

test('SyncData types the canonical slices as optional (the honest fallback shape)', async () => {
  const api = await readFile(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  assert.match(api, /tasks\?: Task\[\];/);
  assert.match(api, /stations\?: Station\[\];/);
  assert.match(api, /coflowDates\?: CoFlowDate\[\];/);
});
