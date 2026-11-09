// Leg F (live-sync rev3 correction packet) — alert line construction
// (rev3 item 10 + rev3.1 item 5c). Pure-function tests over fabricated
// inputs; the reconcile wiring rides the existing reconcile tests and
// the lane's full-suite gate. Nothing here touches the network.
//
// Requires Node.js >=22.15.0 and --experimental-strip-types.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run live-sync-leg-f test with --experimental-strip-types');
}
const hooks = nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && specifier.endsWith('.js')) {
      const target = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      try {
        return nextResolve(target.href, context);
      } catch {}
    }
    return nextResolve(specifier, context);
  },
});

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';

let alerts;
try {
  alerts = await import('../api/_sync-alerts.ts');
} finally {
  hooks.deregister();
}
const { computeSyncAlerts } = alerts;

const NOW = Date.parse('2026-11-09T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60_000;
const INTERVAL = 15 * MIN;

function run(startedMs, trigger, status, sources = []) {
  return { started_at: iso(startedMs), status, trigger, sources };
}
function state(overrides = {}) {
  return {
    source: 'people',
    sync_version: 1,
    last_event_at: null,
    last_event_id: null,
    last_sync_started_at: null,
    last_sync_ok_at: null,
    dirty: false,
    pending_entity_ids: [],
    last_error: null,
    ...overrides,
  };
}
function inputs(overrides = {}) {
  return { now: NOW, runs: [], states: [], setupUpdatedAt: null, ...overrides };
}

test('a quiet system produces no alerts', () => {
  const lines = computeSyncAlerts(inputs({
    runs: [run(NOW - INTERVAL, 'reconcile', 'ok')],
    states: [{ source: 'people', state: state({ last_sync_ok_at: iso(NOW - INTERVAL), last_event_at: iso(NOW - INTERVAL) }), leaseExpiresAt: null }],
  }));
  assert.deepEqual(lines, []);
});

test('error runs since the last pass alert once, counted; older ones do not', () => {
  const lines = computeSyncAlerts(inputs({
    runs: [
      run(NOW - 1 * MIN, 'webhook', 'failed', [{ source: 'webhook', error: 'store down' }]),
      run(NOW - 2 * MIN, 'webhook', 'partial', [{ source: 'moves', error: 'boom' }]),
      run(NOW - INTERVAL, 'reconcile', 'ok'),
      run(NOW - 2 * INTERVAL, 'webhook', 'failed', [{ source: 'webhook', error: 'ancient' }]),
    ],
  }));
  assert.deepEqual(lines, ['error runs since last reconcile pass: 2']);
});

test('with no previous pass, the whole history is the window', () => {
  const lines = computeSyncAlerts(inputs({
    runs: [run(NOW - MIN, 'webhook', 'failed', [{ source: 'webhook', error: 'x' }])],
  }));
  assert.deepEqual(lines, ['error runs since last reconcile pass: 1']);
});

test('a single handshake rejection is noise: no alert on either channel', () => {
  const lines = computeSyncAlerts(inputs({
    runs: [
      run(NOW - MIN, 'webhook', 'failed', [{ source: 'webhook', error: 'handshake rejected: setup window closed' }]),
      run(NOW - INTERVAL, 'reconcile', 'ok'),
    ],
  }));
  assert.deepEqual(lines, []);
});

test('repeated handshake rejections alert on their own channel only', () => {
  const lines = computeSyncAlerts(inputs({
    runs: [
      run(NOW - MIN, 'webhook', 'failed', [{ source: 'webhook', error: 'handshake rejected: setup window closed' }]),
      run(NOW - 2 * MIN, 'webhook', 'failed', [{ source: 'webhook', error: 'handshake rejected: setup window closed' }]),
      run(NOW - INTERVAL, 'reconcile', 'ok'),
    ],
  }));
  assert.deepEqual(lines, ['repeated handshake rejections since last reconcile pass: 2']);
});

test('webhook silence past two intervals on a previously delivering source alerts; at exactly two it does not', () => {
  const delivering = (lastEventMs) => ({
    source: 'people',
    state: state({ last_sync_ok_at: iso(NOW - INTERVAL), last_event_at: iso(lastEventMs) }),
    leaseExpiresAt: null,
  });
  const silent = computeSyncAlerts(inputs({ states: [delivering(NOW - 2 * INTERVAL - 1)] }));
  assert.equal(silent.length, 1);
  assert.match(silent[0], /^webhook silence: people last event at /);
  const boundary = computeSyncAlerts(inputs({ states: [delivering(NOW - 2 * INTERVAL)] }));
  assert.deepEqual(boundary, []);
  const neverDelivered = computeSyncAlerts(inputs({
    states: [{ source: 'people', state: state({ last_event_at: iso(NOW - 3 * INTERVAL) }), leaseExpiresAt: null }],
  }));
  assert.deepEqual(neverDelivered, [], 'no prior ok means not previously delivering');
});

test('an expired lease at pass start alerts as an expired claim; a live lease does not', () => {
  const expired = computeSyncAlerts(inputs({
    states: [{ source: 'moves', state: state(), leaseExpiresAt: iso(NOW - MIN) }],
  }));
  assert.deepEqual(expired, [`expired claim: moves (lease expired at ${iso(NOW - MIN)})`]);
  const live = computeSyncAlerts(inputs({
    states: [{ source: 'moves', state: state(), leaseExpiresAt: iso(NOW + MIN) }],
  }));
  assert.deepEqual(live, []);
});

test('an uncleared setup row older than 24h alerts; exactly 24h does not', () => {
  const old = computeSyncAlerts(inputs({ setupUpdatedAt: iso(NOW - 24 * 60 * MIN - 1) }));
  assert.equal(old.length, 1);
  assert.match(old[0], /^uncleared setup row: notion_webhook_verification updated at /);
  const boundary = computeSyncAlerts(inputs({ setupUpdatedAt: iso(NOW - 24 * 60 * MIN) }));
  assert.deepEqual(boundary, []);
});
