// Freshness-block assembly tests (reader decision, 2026-10-27).
//
// The engine module's `.js` cross-file imports cannot resolve under
// `node --test` type stripping, so — same pattern as
// tests/sync-lease-engine.driver.mjs — this file compiles the api graph
// with the repo's own tsc into a temp dir and exercises the REAL compiled
// getSyncFreshness with an injected delivery-state reader. Nothing here
// touches the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
process.env.NOTION_SECRET = 'synthetic';

const outDir = mkdtempSync(join(tmpdir(), 'freshness-test-'));
execFileSync(
  'npx',
  [
    'tsc', 'api/_sync-engine.ts',
    '--outDir', outDir,
    '--rootDir', 'api',
    '--module', 'nodenext',
    '--target', 'es2022',
    '--moduleResolution', 'nodenext',
    '--skipLibCheck',
  ],
  { stdio: 'pipe' },
);
const { getSyncFreshness, SOURCES } = await import(join(outDir, '_sync-engine.js'));

const NOW = Date.parse('2026-10-27T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const base = {
  source: 'people', sync_version: 7, last_event_at: iso(NOW - 60_000),
  last_event_id: null, last_sync_started_at: iso(NOW - 120_000),
  last_sync_ok_at: iso(NOW - 120_000), dirty: false,
  pending_entity_ids: [], last_error: null,
};
const reader = (map) => async (source) => (source in map ? map[source] : null);

test('every source present with the snapshot entry shape', async () => {
  const out = await getSyncFreshness(NOW, reader({ people: base }));
  assert.deepEqual(Object.keys(out).sort(), [...SOURCES].sort());
  for (const name of SOURCES) {
    assert.deepEqual(Object.keys(out[name]).sort(),
      ['lastEventAt', 'lastSyncOkAt', 'state', 'syncVersion']);
  }
});

test('recent ok reads live and carries the state fields', async () => {
  const out = await getSyncFreshness(NOW, reader({ people: base }));
  assert.equal(out.people.state, 'live');
  assert.equal(out.people.lastSyncOkAt, base.last_sync_ok_at);
  assert.equal(out.people.lastEventAt, base.last_event_at);
  assert.equal(out.people.syncVersion, 7);
});

test('a source with no delivery row reads unknown, not empty-success', async () => {
  const out = await getSyncFreshness(NOW, reader({ people: base }));
  assert.equal(out.flows.state, 'unknown');
  assert.equal(out.flows.lastSyncOkAt, null);
  assert.equal(out.flows.syncVersion, 0);
});

test('a failing source is isolated: unknown there, live elsewhere', async () => {
  const flaky = async (source) => {
    if (source === 'flows') throw new Error('store down');
    return source === 'people' ? base : null;
  };
  const out = await getSyncFreshness(NOW, flaky);
  assert.equal(out.flows.state, 'unknown');
  assert.equal(out.people.state, 'live');
});

test('a recorded error reads degraded', async () => {
  const out = await getSyncFreshness(NOW,
    reader({ people: { ...base, last_error: 'boom' } }));
  assert.equal(out.people.state, 'degraded');
});

test('an unconfigured store marks every source unknown', async () => {
  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  try {
    const out = await getSyncFreshness(NOW, reader({ people: base }));
    for (const name of SOURCES) assert.equal(out[name].state, 'unknown');
  } finally {
    process.env.SUPABASE_URL = url;
  }
});
