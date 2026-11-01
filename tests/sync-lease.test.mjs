import test from 'node:test';
import assert from 'node:assert/strict';

// Fixture tests for the per-source lease contract (G-02 Option A).
// A fake PostgREST stands in for the sync store: it keeps ONE
// sync_delivery_state row for "moves" and evaluates the exact filters
// the lease helpers send (source, lease_epoch, lease_owner, and the
// or-group on lease_expires_at), applying PATCH bodies only when every
// filter matches — the same verdicts the real store returns.

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';

const TTL = 120_000;
const T0 = Date.parse('2026-10-27T12:00:00.000Z');

let row;
let notionCalls;
let appliedWrites;

function resetRow() {
  row = {
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
    lease_owner: null,
    lease_epoch: 0,
    lease_expires_at: null,
  };
  notionCalls = 0;
  appliedWrites = 0;
}
resetRow();

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (value === null || value === undefined ? '' : JSON.stringify(value)),
  };
}

function expiryConditionPasses(orValue, nowIsoIgnored) {
  // or=(lease_expires_at.is.null,lease_expires_at.lt.<iso>)
  if (row.lease_expires_at === null) return true;
  const m = /lease_expires_at\.lt\.([^)]+)\)/.exec(orValue ?? '');
  if (!m) return false;
  return row.lease_expires_at < decodeURIComponent(m[1]);
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
    const eq = (name) => (q.get(name) ?? '').replace(/^eq\./, '');
    let pass = true;
    if (q.has('lease_epoch')) pass &&= row.lease_epoch === Number(eq('lease_epoch'));
    if (q.has('lease_owner')) pass &&= row.lease_owner === eq('lease_owner');
    if (q.has('or')) pass &&= expiryConditionPasses(q.get('or'));
    if (!pass) return jsonResponse([]);
    const body = JSON.parse(init.body);
    Object.assign(row, body);
    appliedWrites += 1;
    const prefer = (init.headers?.Prefer ?? '');
    return prefer.includes('minimal') ? jsonResponse(null) : jsonResponse([{ ...row }]);
  }
  throw new Error(`unexpected ${method} ${url}`);
};

// Only the leaf store module is imported here: this repo's node --test
// harness cannot resolve the .js cross-imports of the engine module.
// The engine's deferral wiring is covered by the compiled driver in
// tests/sync-lease-engine.driver.mjs (see the PR body).
const store = await import('../api/_supabase.ts');

test('acquire wins on an unleased row and mints epoch 1', async () => {
  resetRow();
  const epoch = await store.acquireLease('moves', 'run-a', T0, TTL);
  assert.equal(epoch, 1);
  assert.equal(row.lease_owner, 'run-a');
  assert.equal(row.lease_epoch, 1);
  assert.equal(row.lease_expires_at, new Date(T0 + TTL).toISOString());
});

test('a second acquire while the lease is held loses and changes nothing', async () => {
  resetRow();
  await store.acquireLease('moves', 'run-a', T0, TTL);
  const epoch = await store.acquireLease('moves', 'run-b', T0 + 1_000, TTL);
  assert.equal(epoch, null);
  assert.equal(row.lease_owner, 'run-a');
  assert.equal(row.lease_epoch, 1);
});

test('acquire after expiry takes over and increments the epoch', async () => {
  resetRow();
  await store.acquireLease('moves', 'run-a', T0, TTL);
  const epoch = await store.acquireLease('moves', 'run-b', T0 + TTL + 1_000, TTL);
  assert.equal(epoch, 2);
  assert.equal(row.lease_owner, 'run-b');
  assert.equal(row.lease_epoch, 2);
});

test('renew extends only the holder at the current epoch', async () => {
  resetRow();
  const epoch = await store.acquireLease('moves', 'run-a', T0, TTL);
  const renewed = await store.renewLease('moves', 'run-a', epoch, T0 + 30_000, TTL);
  assert.equal(renewed, true);
  assert.equal(row.lease_expires_at, new Date(T0 + 30_000 + TTL).toISOString());
  assert.equal(await store.renewLease('moves', 'run-b', epoch, T0 + 31_000, TTL), false);
  assert.equal(await store.renewLease('moves', 'run-a', epoch + 9, T0 + 31_000, TTL), false);
});

test('verify tracks ownership across a takeover', async () => {
  resetRow();
  const e1 = await store.acquireLease('moves', 'run-a', T0, TTL);
  assert.equal(await store.verifyLease('moves', 'run-a', e1), true);
  const e2 = await store.acquireLease('moves', 'run-b', T0 + TTL + 1_000, TTL);
  assert.equal(await store.verifyLease('moves', 'run-a', e1), false);
  assert.equal(await store.verifyLease('moves', 'run-b', e2), true);
});

test('release clears only the holder\u2019s own lease; the epoch survives', async () => {
  resetRow();
  const e1 = await store.acquireLease('moves', 'run-a', T0, TTL);
  await store.releaseLease('moves', 'run-b', e1);
  assert.equal(row.lease_owner, 'run-a');
  await store.releaseLease('moves', 'run-a', e1);
  assert.equal(row.lease_owner, null);
  assert.equal(row.lease_expires_at, null);
  assert.equal(row.lease_epoch, 1);
});
