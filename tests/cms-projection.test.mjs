import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjection,
  createManifestCache,
  freshnessLabel,
  passesGate,
} from '../api/_cms-projection.ts';

// Ported from the Phase 1 adapter fixture suite (archived repo,
// tests/cms-projection.test.ts) to this repo's node:test harness.
// Added on port (build packet verification plan): the missing_publish_date
// hold fixture, so every readiness hold carries its own case.

const NOW = new Date('2026-10-26T12:00:00Z');

function page(overrides = {}) {
  const props = {
    Name: { type: 'title', title: [{ plain_text: 'Released Episode' }] },
    Status: { type: 'select', select: { name: 'Published' } },
    Audience: { type: 'select', select: { name: 'Public' } },
    'Final?': { type: 'checkbox', checkbox: true },
    Link: { type: 'url', url: 'https://example.com/listen' },
    'Content Type': { type: 'select', select: { name: 'Episode' } },
    'Publish Date': { type: 'date', date: { start: '2026-10-20' } },
    Where: { type: 'select', select: { name: 'Spotify' } },
    Tag: { type: 'select', select: { name: 'reflection' } },
    // NEVER fields riding along on the record:
    Creator: { type: 'relation', relation: [{ id: 'person-1' }] },
    Flow: { type: 'relation', relation: [{ id: 'flow-1' }] },
    'Current Gate': { type: 'select', select: { name: 'Release' } },
    'Ready to Release?': { type: 'formula', formula: { type: 'boolean', boolean: true } },
  };
  for (const [key, value] of Object.entries(overrides)) props[key] = value;
  return { id: 'page-1', properties: props };
}

test('gate passes only when all three legs hold', () => {
  assert.equal(passesGate(page()), true);
  assert.equal(passesGate(page({ Status: { type: 'select', select: { name: 'Draft' } } })), false);
  assert.equal(passesGate(page({ Status: { type: 'select', select: { name: 'Ready' } } })), false);
  assert.equal(passesGate(page({ Audience: { type: 'select', select: { name: 'Team' } } })), false);
  assert.equal(passesGate(page({ 'Final?': { type: 'checkbox', checkbox: false } })), false);
});

test('projection carries allowlist fields only', () => {
  const { items, held } = buildProjection([page()], NOW);
  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(),
    ['contentType', 'link', 'name', 'publishDate', 'tag', 'where'].sort());
  assert.deepEqual(items[0], {
    name: 'Released Episode',
    link: 'https://example.com/listen',
    contentType: 'Episode',
    publishDate: '2026-10-20',
    where: 'Spotify',
    tag: 'reflection',
  });
  assert.equal(Object.values(held).reduce((a, b) => a + b, 0), 0);
  const serialized = JSON.stringify(items);
  assert.equal(serialized.includes('person-1'), false);
  assert.equal(serialized.includes('flow-1'), false);
});

test('each single-leg gate failure drops the row silently', () => {
  const rows = [
    page({ Status: { type: 'select', select: { name: 'Ready' } } }),
    page({ Audience: { type: 'select', select: { name: 'Team' } } }),
    page({ 'Final?': { type: 'checkbox', checkbox: false } }),
  ];
  assert.equal(buildProjection(rows, NOW).items.length, 0);
});

test('readiness holds exclude gated rows, naming the first reason', () => {
  const noLink = buildProjection([page({ Link: { type: 'url', url: null } })], NOW);
  assert.equal(noLink.items.length, 0);
  assert.equal(noLink.held.missing_link, 1);

  const noDate = buildProjection(
    [page({ 'Publish Date': { type: 'date', date: null } })], NOW);
  assert.equal(noDate.items.length, 0);
  assert.equal(noDate.held.missing_publish_date, 1);

  const future = buildProjection(
    [page({ 'Publish Date': { type: 'date', date: { start: '2026-12-01' } } })], NOW);
  assert.equal(future.held.future_publish_date, 1);

  const noWhere = buildProjection(
    [page({ Where: { type: 'select', select: null } })], NOW);
  assert.equal(noWhere.held.missing_where, 1);
});

test('items order by publish date descending', () => {
  const older = page({ Name: { type: 'title', title: [{ plain_text: 'Older' }] } });
  const newer = page({
    Name: { type: 'title', title: [{ plain_text: 'Newer' }] },
    'Publish Date': { type: 'date', date: { start: '2026-10-25' } },
  });
  const { items } = buildProjection([older, newer], NOW);
  assert.deepEqual(items.map((i) => i.name), ['Newer', 'Older']);
});

test('manifest cache serves fresh within TTL and labels by age', () => {
  const cache = createManifestCache(60_000);
  assert.equal(cache.current(), null);
  const manifest = cache.replace([], NOW);
  assert.ok(manifest.releaseId.endsWith('-1'));
  assert.equal(cache.isFresh(new Date(NOW.getTime() + 30_000)), true);
  assert.equal(cache.isFresh(new Date(NOW.getTime() + 61_000)), false);
  assert.equal(freshnessLabel(30_000), 'Fresh');
  assert.equal(freshnessLabel(300_000), 'Aging');
  assert.equal(freshnessLabel(3_600_000), 'Stale');
});

test('last good manifest stays addressable after TTL', () => {
  const cache = createManifestCache(60_000);
  const manifest = cache.replace([], NOW);
  assert.equal(cache.current(), manifest);
  assert.equal(cache.ageMs(new Date(NOW.getTime() + 120_000)), 120_000);
});
