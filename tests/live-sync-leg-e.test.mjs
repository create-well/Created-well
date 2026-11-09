// Leg E (live-sync rev3 correction packet) — in-memory canonical
// hash compare for drift detection (rev3 item 9). Front-door default
// 2026-11-09: in-memory only; no stored hash column, no RPC, no SQL.
//
// Unit legs prove key-order stability of the canonical hash;
// integration legs run the real engine against the filter-evaluating
// fake PostgREST + stubbed Notion harness (rr001 / Leg C shape).
// Nothing here touches the network.
//
// Requires Node.js >=22.15.0 and --experimental-strip-types.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run live-sync-leg-e test with --experimental-strip-types');
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
process.env.NOTION_DB_MOVES = 'synthetic-moves-db';

let engine;
try {
  engine = await import('../api/_sync-engine.ts');
} finally {
  hooks.deregister();
}
const { canonicalRowHash, syncSource } = engine;

// ── Hash units ──────────────────────────────────────────────────────

test('canonicalRowHash is key-order stable at every depth', () => {
  const a = { _id: 'p1', properties: { Name: { type: 'title', title: [{ plain_text: 'x' }] }, Count: { number: 2 } }, _last_edited: 't' };
  const b = { _last_edited: 't', properties: { Count: { number: 2 }, Name: { title: [{ plain_text: 'x' }], type: 'title' } }, _id: 'p1' };
  assert.equal(canonicalRowHash(a), canonicalRowHash(b));
});

test('canonicalRowHash changes when any nested value changes (rollup-style drift)', () => {
  const a = { _id: 'p1', properties: { Rollup: { number: 3 } } };
  const b = { _id: 'p1', properties: { Rollup: { number: 4 } } };
  assert.notEqual(canonicalRowHash(a), canonicalRowHash(b));
});

test('canonicalRowHash keeps array order significant and handles nulls', () => {
  assert.notEqual(
    canonicalRowHash({ v: [1, 2] }),
    canonicalRowHash({ v: [2, 1] }),
  );
  assert.equal(
    canonicalRowHash({ v: null, w: [null, { x: null }] }),
    canonicalRowHash({ w: [null, { x: null }], v: null }),
  );
});

// ── Fake store (rr001 / Leg C harness shape) ────────────────────────

const OK_AT = '2026-10-27T00:00:00.000Z';
let row;
let snapshots;
let notionResponder;

function resetStore() {
  row = {
    source: 'moves', sync_version: 3, last_event_at: null, last_event_id: null,
    last_sync_started_at: OK_AT, last_sync_ok_at: OK_AT, dirty: true,
    pending_entity_ids: [], last_error: null, updated_at: OK_AT,
    claim_state: 'idle', mirror_populated_at: null,
    lease_owner: null, lease_epoch: 0, lease_expires_at: null,
  };
  snapshots = [];
  notionResponder = () => ({ results: [], has_more: false, next_cursor: null });
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => (value === null || value === undefined ? '' : JSON.stringify(value)),
    json: async () => value,
    body: null,
  };
}

function matchesFilters(u, target) {
  for (const [key, value] of u.searchParams.entries()) {
    if (['select', 'on_conflict', 'order', 'limit', 'offset'].includes(key)) continue;
    if (key === 'or') {
      const inner = value.replace(/^\(|\)$/g, '');
      const ok = inner.split(',').some((part) => {
        if (part === 'lease_expires_at.is.null') return target.lease_expires_at === null;
        if (part.startsWith('lease_expires_at.lt.')) return target.lease_expires_at !== null && target.lease_expires_at < part.slice('lease_expires_at.lt.'.length);
        return false;
      });
      if (!ok) return false;
      continue;
    }
    const dot = value.indexOf('.');
    const op = value.slice(0, dot);
    const raw = value.slice(dot + 1);
    const actual = target[key];
    if (op === 'eq') { if (String(actual) !== raw) return false; }
    else if (op === 'gt') { if (!(typeof actual === 'string' && actual > raw)) return false; }
    else throw new Error(`fake store: unhandled filter ${key}=${value}`);
  }
  return true;
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === 'api.notion.com') {
    if ((init.method ?? 'GET') === 'GET' && u.pathname.startsWith('/v1/databases/')) {
      return jsonResponse({ data_sources: [{ id: 'ds-synthetic' }] });
    }
    const body = init.body ? JSON.parse(String(init.body)) : {};
    return jsonResponse(notionResponder(body));
  }
  assert.equal(u.hostname, 'store.test');
  const method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(String(init.body)) : null;
  if (u.pathname.endsWith('/sync_delivery_state')) {
    if (method === 'GET') {
      if (!matchesFilters(u, row)) return jsonResponse(null, 406);
      const select = u.searchParams.get('select') ?? '*';
      if (select.includes('lease_owner')) {
        return jsonResponse({ lease_owner: row.lease_owner, lease_epoch: row.lease_epoch, lease_expires_at: row.lease_expires_at });
      }
      return jsonResponse({ ...row });
    }
    if (method === 'PATCH') {
      if (!matchesFilters(u, row)) return jsonResponse([]);
      Object.assign(row, body);
      return jsonResponse([{ ...row }]);
    }
    if (method === 'POST') { Object.assign(row, body); return jsonResponse(null); }
  }
  if (u.pathname.endsWith('/sync_snapshots')) {
    if (method === 'GET') return jsonResponse(snapshots.map((e) => ({ ...e })));
    if (method === 'POST') {
      for (const entry of body) {
        const stored = { page_id: entry.page_id, row: entry.row, last_edited: entry.last_edited, sync_version: entry.sync_version };
        const existing = snapshots.findIndex((e) => e.page_id === entry.page_id);
        if (existing >= 0) snapshots[existing] = stored;
        else snapshots.push(stored);
      }
      return jsonResponse(null);
    }
    if (method === 'DELETE') {
      const pageId = u.searchParams.get('page_id')?.slice(3);
      snapshots = snapshots.filter((e) => e.page_id !== pageId);
      return jsonResponse(null);
    }
  }
  if (u.pathname.endsWith('/sync_runs')) return jsonResponse(null);
  throw new Error(`fake store: unhandled ${method} ${u.pathname}`);
};

// ── Diff integration ────────────────────────────────────────────────

test('syncSource: same content in a different key order is not drift (no version bump)', async () => {
  resetStore();
  // Stored row: keys in one order (as a JSONB round trip might return).
  snapshots = [{
    page_id: 'page-1',
    row: { properties: { Count: { number: 2 }, Name: { type: 'title', title: [] } }, _id: 'page-1', _last_edited: OK_AT },
    last_edited: OK_AT,
    sync_version: 3,
  }];
  notionResponder = () => ({
    results: [{ id: 'page-1', last_edited_time: OK_AT, properties: { Name: { type: 'title', title: [] }, Count: { number: 2 } } }],
    has_more: false,
    next_cursor: null,
  });
  const outcome = await syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.changed, 0);
  assert.equal(outcome.version, 3);
});

test('syncSource: a value change under an unmoved last_edited is caught by the hash', async () => {
  resetStore();
  snapshots = [{
    page_id: 'page-1',
    row: { _id: 'page-1', _last_edited: OK_AT, properties: { Rollup: { number: 3 } } },
    last_edited: OK_AT,
    sync_version: 3,
  }];
  notionResponder = () => ({
    results: [{ id: 'page-1', last_edited_time: OK_AT, properties: { Rollup: { number: 4 } } }],
    has_more: false,
    next_cursor: null,
  });
  const outcome = await syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.changed, 1);
  assert.equal(outcome.version, 4);
  assert.equal(snapshots[0].row.properties.Rollup.number, 4);
});
