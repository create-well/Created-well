// FE-3: the Home freshness line derives from the payload's delivery
// state (PR #50 contract) at render. Fixtures use the server's state
// vocabulary ("live" | "stale" | "degraded" | "reconciling" |
// "unknown"); the segment names counts and exceptions in words and
// returns null — no claim — when the block cannot support one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcesCheckedSegment } from '../src/lib/syncFreshnessLine.ts';

const NOW = Date.parse('2026-10-27T15:00:00.000Z');
const src = (state) => ({ state, lastEventAt: null, lastSyncOkAt: null, syncVersion: 1 });
const block = (states, generatedAt = new Date(NOW - 30_000).toISOString()) => ({
  generatedAt,
  sources: Object.fromEntries(states.map((s, i) => [`s${i}`, src(s)])),
});

test('all flowing: live + reconciling count as flowing', () => {
  assert.equal(
    sourcesCheckedSegment(block(['live', 'live', 'reconciling', 'live', 'live']), NOW),
    'Sources checked just now · 5 of 5 flowing',
  );
});

test('exceptions are named in words with counts', () => {
  assert.equal(
    sourcesCheckedSegment(block(['live', 'live', 'live', 'stale', 'degraded']), NOW),
    'Sources checked just now · 3 of 5 flowing · 1 stale · 1 degraded',
  );
});

test('all unknown reads as state unknown, never a fake count', () => {
  assert.equal(
    sourcesCheckedSegment(block(['unknown', 'unknown']), NOW),
    'Sources checked just now · source state unknown',
  );
});

test('no claim without a usable block', () => {
  assert.equal(sourcesCheckedSegment(null, NOW), null);
  assert.equal(sourcesCheckedSegment(undefined, NOW), null);
  assert.equal(sourcesCheckedSegment({ generatedAt: 'garbage', sources: { a: src('live') } }, NOW), null);
  assert.equal(sourcesCheckedSegment({ generatedAt: new Date(NOW).toISOString(), sources: {} }, NOW), null);
});

test('relative time ages honestly', () => {
  const seg = sourcesCheckedSegment(block(['live'], new Date(NOW - 42 * 60_000).toISOString()), NOW);
  assert.ok(seg.startsWith('Sources checked 42m ago ·'));
});
