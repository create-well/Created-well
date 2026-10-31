// Engine-level lease driver (G-02 Option A) — NOT a node --test file.
//
// Why this exists: the repo's node test harness cannot resolve the engine's
// `.js` cross-file imports. This driver uses Node's narrow native TypeScript
// resolver to exercise the real syncSource without a compiler install or
// emitted files. Under a held lease, it must defer, read no Notion pages,
// and write no state, using the same fake store as the lease unit tests.
//
// Requires Node.js >=22.15.0 and --experimental-strip-types.
// Run: node --experimental-strip-types tests/sync-lease-engine.driver.mjs

import * as nodeModule from 'node:module';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';

const row = {
  source: 'moves',
  sync_version: 3,
  last_event_at: null,
  last_event_id: null,
  last_sync_started_at: '2026-10-27T00:00:00.000Z',
  last_sync_ok_at: '2026-10-27T00:00:00.000Z',
  dirty: true,
  pending_entity_ids: ['p1'],
  last_error: null,
  updated_at: '2026-10-27T00:00:00.000Z',
  lease_owner: 'other-run',
  lease_epoch: 7,
  lease_expires_at: '2999-01-01T00:00:00.000Z',
};
let notionCalls = 0;
let stateWrites = 0;

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (value === null || value === undefined ? '' : JSON.stringify(value)),
  };
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === 'api.notion.com') {
    notionCalls += 1;
    return jsonResponse({ object: 'error' }, 500);
  }
  assert.equal(u.hostname, 'store.test');
  const q = u.searchParams;
  if (u.pathname.endsWith('/sync_snapshots')) return jsonResponse([]);
  assert.ok(u.pathname.endsWith('/sync_delivery_state'), u.pathname);
  const method = init.method ?? 'GET';
  if (method === 'GET') {
    const select = q.get('select') ?? '';
    if (select.includes('lease_owner')) {
      return jsonResponse({
        lease_owner: row.lease_owner,
        lease_epoch: row.lease_epoch,
        lease_expires_at: row.lease_expires_at,
      });
    }
    return jsonResponse({ ...row });
  }
  if (method === 'PATCH') {
    // The engine's acquire attempt: epoch pins at 7, but the expiry is
    // far-future, so the or-condition fails and the store returns [].
    const eq = (name) => (q.get(name) ?? '').replace(/^eq\./, '');
    let pass = true;
    if (q.has('lease_epoch')) pass &&= row.lease_epoch === Number(eq('lease_epoch'));
    if (q.has('lease_owner')) pass &&= row.lease_owner === eq('lease_owner');
    if (q.has('or')) {
      const or = decodeURIComponent(q.get('or'));
      const m = /lease_expires_at\.lt\.([^)]+)\)/.exec(or);
      pass &&= row.lease_expires_at === null || (m !== null && row.lease_expires_at < m[1]);
    }
    if (!pass) return jsonResponse([]);
    Object.assign(row, JSON.parse(init.body));
    stateWrites += 1;
    return jsonResponse([{ ...row }]);
  }
  if (method === 'POST') {
    stateWrites += 1;
    Object.assign(row, JSON.parse(init.body));
    return jsonResponse(null);
  }
  throw new Error(`unexpected ${method} ${url}`);
};

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 15)) {
  throw new Error(`lease engine driver requires Node.js >=22.15.0; found ${process.versions.node}`);
}
if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run lease engine driver with --experimental-strip-types');
}

const apiUrlPrefix = new URL('../api/', import.meta.url).href;
const hooks = nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && specifier.endsWith('.js') && context.parentURL?.startsWith(apiUrlPrefix)) {
      const target = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (target.href.startsWith(apiUrlPrefix)) {
        try { return nextResolve(target.href, context); } catch {}
      }
    }
    return nextResolve(specifier, context);
  },
});
let engine;
try {
  engine = await import('../api/_sync-engine.ts');
} finally {
  hooks.deregister();
}
const startedBefore = row.last_sync_started_at;
const outcome = await engine.syncSource('moves', 'synthetic-notion-secret');

assert.equal(outcome.deferred, true);
assert.equal(outcome.changed, 0);
assert.equal(outcome.version, 3);
assert.equal(outcome.count, 0);
assert.equal(notionCalls, 0);
assert.equal(stateWrites, 0);
assert.equal(row.last_sync_started_at, startedBefore);
assert.equal(row.lease_owner, 'other-run');
assert.equal(row.lease_epoch, 7);

console.log('PASS syncSource defers under a held lease (no Notion read, no state write)');
