// G-11 consumer port (FE-6): the public-content data layer against
// stubbed fetch responses. Covers the Flag 3 state machine (failure
// is an explicit unavailable state, never an empty release), FLAG 1
// (the rendered freshness derives from generatedAt at read time; the
// envelope's freshness field is never trusted), the six-field item
// mapping, and the name-key join against operational working rows.
// Fixture item names carry the [ ] placeholder marker per the
// program's placeholder standard — they are fixtures, not real data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchPublicContent, releaseBand, releasePresentable,
  workingRowName, matchWorkingRow, itemDateLabel,
} from '../src/lib/publicContent.ts';

function stubFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => { globalThis.fetch = original; };
}

function envelope(overrides = {}) {
  return {
    releaseId: 'rel-fixture-1',
    generatedAt: new Date().toISOString(),
    freshness: 'Fresh',
    source: 'cache',
    count: 1,
    items: [{
      name: '[ ] episode one', link: 'https://example.invalid/ep1',
      contentType: 'Episode', publishDate: '2026-10-21',
      where: 'Spotify', tag: 'reflection',
      internalNote: 'must not survive the mapping',
    }],
    ...overrides,
  };
}

test('ok: envelope maps to exactly the six item fields', async () => {
  const restore = stubFetch(async () => ({ ok: true, json: async () => envelope() }));
  try {
    const state = await fetchPublicContent();
    assert.equal(state.kind, 'ok');
    assert.equal(state.releaseId, 'rel-fixture-1');
    assert.equal(state.items.length, 1);
    assert.deepEqual(
      Object.keys(state.items[0]).sort(),
      ['contentType', 'link', 'name', 'publishDate', 'tag', 'where'],
    );
    assert.equal(releaseBand(state), 'Fresh');
    assert.equal(releasePresentable(state), true);
  } finally { restore(); }
});

test('failure shapes are the explicit unavailable state, never empty-ok', async () => {
  const cases = [
    async () => ({ ok: false, status: 503, json: async () => ({ error: 'projection unavailable' }) }),
    async () => { throw new Error('network down'); },
    async () => ({ ok: true, json: async () => ({ items: 'not-an-array' }) }),
    async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }),
    // G-45: no parseable generatedAt — no freshness can derive, so the
    // envelope is malformed; items never render beside a blank band.
    async () => ({ ok: true, json: async () => envelope({ generatedAt: undefined }) }),
    async () => ({ ok: true, json: async () => envelope({ generatedAt: 'not-a-date' }) }),
  ];
  for (const impl of cases) {
    const restore = stubFetch(impl);
    try {
      const state = await fetchPublicContent();
      assert.equal(state.kind, 'unavailable');
      assert.equal(releasePresentable(state), false);
    } finally { restore(); }
  }
});

test('FLAG 1: a stale generatedAt derives Stale even when the envelope claims Fresh', async () => {
  const stale = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const restore = stubFetch(async () => ({ ok: true, json: async () => envelope({ generatedAt: stale, freshness: 'Fresh' }) }));
  try {
    const state = await fetchPublicContent();
    assert.equal(state.kind, 'ok');
    assert.equal(releaseBand(state), 'Stale');
    assert.equal(releasePresentable(state), false, 'a stale release is not presented as current');
  } finally { restore(); }
});

test('aging band: 10 minutes old derives Aging and stays presentable', async () => {
  const aging = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const restore = stubFetch(async () => ({ ok: true, json: async () => envelope({ generatedAt: aging }) }));
  try {
    const state = await fetchPublicContent();
    assert.equal(releaseBand(state), 'Aging');
    assert.equal(releasePresentable(state), true);
  } finally { restore(); }
});

test('join: working-row names recover from the normalizer suffix; duplicates collide to the first', () => {
  assert.equal(workingRowName('[ ] episode one [published]'), '[ ] episode one');
  assert.equal(workingRowName('[ ] plain row'), '[ ] plain row');
  const rows = [
    { content: '[ ] episode one [published]', id: 1 },
    { content: '[ ] episode one [draft]', id: 2 },
    { content: 'something else', id: 3 },
  ];
  assert.equal(matchWorkingRow(rows, '[ ] episode one')?.id, 1);
  assert.equal(matchWorkingRow(rows, '[ ] not a row'), undefined);
});

test('item dates degrade in words, never Invalid Date', () => {
  assert.equal(itemDateLabel('2026-10-27'), new Date('2026-10-27T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  assert.equal(itemDateLabel(null), 'Date not set yet.');
  assert.equal(itemDateLabel('garbage'), 'Date not set yet.');
});
