import test from 'node:test';
import assert from 'node:assert/strict';
import { freshnessBand, flowsProvenanceText } from '../src/lib/freshnessLabel.ts';

// Label-consistency packet G-24..G-27 (Workstream E findings):
// G-25 — the FlowCommandCenter provenance chip asserted "Synced from
// Notion FLOWS" in every state, including beside "never" when nothing
// had loaded. The text now derives from the sync status at render, in
// the SyncStatusBar wording family, and no state may claim "Synced".
// G-26 — freshness labels derive from the load timestamp's age at
// render (CMS §4 family): Fresh ≤ 120s, Aging ≤ 15 min, Stale beyond.

const NOW = Date.parse('2026-10-27T12:00:00Z');
const at = (ageMs) => new Date(NOW - ageMs);

test('freshnessBand: boundaries of the §4 family', () => {
  assert.equal(freshnessBand(at(0), NOW), 'Fresh');
  assert.equal(freshnessBand(at(120_000), NOW), 'Fresh');
  assert.equal(freshnessBand(at(120_001), NOW), 'Aging');
  assert.equal(freshnessBand(at(15 * 60_000), NOW), 'Aging');
  assert.equal(freshnessBand(at(15 * 60_000 + 1), NOW), 'Stale');
  assert.equal(freshnessBand(at(60 * 60_000), NOW), 'Stale');
});

test('freshnessBand: missing or invalid load time yields no band', () => {
  assert.equal(freshnessBand(null, NOW), null);
  assert.equal(freshnessBand(new Date(NaN), NOW), null);
});

test('freshnessBand: a future load time reads Fresh, never Stale', () => {
  assert.equal(freshnessBand(new Date(NOW + 60_000), NOW), 'Fresh');
});

test('provenance chip: fresh state carries load time + unverified-source note', () => {
  const text = flowsProvenanceText('fresh', at(30_000));
  assert.match(text, /From Notion FLOWS · Last loaded /);
  assert.match(text, /Source sync not verified/);
});

test('provenance chip: stale state says Not current', () => {
  const text = flowsProvenanceText('stale', at(30 * 60_000));
  assert.match(text, /Not current/);
});

test('provenance chip: failed state says Dashboard unavailable', () => {
  assert.equal(flowsProvenanceText('failed', at(30_000)), 'From Notion FLOWS · Dashboard unavailable');
});

test('provenance chip: never-loaded states never claim a load', () => {
  assert.equal(flowsProvenanceText('fresh', null), 'From Notion FLOWS · No successful load yet');
  assert.equal(flowsProvenanceText('stale', null), 'From Notion FLOWS · No successful load yet');
  assert.equal(flowsProvenanceText('loading', null), 'Loading from Notion FLOWS…');
});

test('provenance chip: no state asserts "Synced"', () => {
  for (const status of ['loading', 'fresh', 'stale', 'failed']) {
    for (const loaded of [null, at(10_000), at(45 * 60_000)]) {
      assert.ok(!flowsProvenanceText(status, loaded).includes('Synced'),
        `${status} must not claim Synced`);
    }
  }
});
