// Leg D (live-sync rev3 correction packet) — the mirror_populated_at
// commit write (rev3.1 item 5a) that the freshness ladder reads.
// HELD LEG: stacks on Leg B; never merged before the SQL v3 sitting.
//
// Cases run the real engine against the filter-evaluating fake
// PostgREST + stubbed Notion harness (rr001 / Leg C shape). Nothing
// here touches the network.
//
// Requires Node.js >=22.15.0 and --experimental-strip-types.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run live-sync-leg-d test with --experimental-strip-types');
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
const { syncSource, markEvent } = engine;

const iso = (ms) => new Date(ms).toISOString();
let row;
let snapshots;
let notionResponder;
let notionCalls;
let patchBodies;

function resetStore(overrides = {}) {
  const now = Date.now();
  row = {
    source: 'moves',
    sync_version: 3,
    last_event_at: null,
    last_event_id: null,
    last_sync_started_at: iso(now - 60_000),
    last_sync_ok_at: iso(now - 60_000),
    dirty: true,
    pending_entity_ids: [{ entity_id: 'p1', op: 'upsert' }],
    last_error: null,
    claim_state: 'idle',
    mirror_populated_at: iso(now - 60_000),
    updated_at: iso(now - 60_000),
    lease_owner: null,
    lease_epoch: 0,
    lease_expires_at: null,
    ...overrides,
  };
  snapshots = [];
  notionCalls = 0;
  patchBodies = [];
  notionResponder = () => ({
    results: [{ id: 'page-1', last_edited_time: iso(Date.now()), properties: { Name: { type: 'title', title: [] } } }],
    has_more: false,
    next_cursor: null,
  });
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
    notionCalls += 1;
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
      if (select.includes('claim_state')) {
        return jsonResponse({ claim_state: row.claim_state, last_sync_started_at: row.last_sync_started_at });
      }
      return jsonResponse({ ...row });
    }
    if (method === 'PATCH') {
      patchBodies.push(body);
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

test('the first successful population stamps mirror_populated_at in the commit update', async () => {
  resetStore({ mirror_populated_at: null });
  const outcome = await syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.deferred, false);
  assert.equal(typeof row.mirror_populated_at, 'string');
  assert.ok(Math.abs(Date.parse(row.mirror_populated_at) - Date.now()) < 60_000);
});

test('a later successful sync leaves mirror_populated_at untouched', async () => {
  const populated = iso(Date.now() - 86_400_000);
  resetStore({ mirror_populated_at: populated });
  const outcome = await syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.deferred, false);
  assert.equal(row.mirror_populated_at, populated);
});

test('a failed first sync does not stamp mirror_populated_at', async () => {
  resetStore({ mirror_populated_at: null });
  notionResponder = () => ({
    results: [{ id: 'page-1', last_edited_time: iso(Date.now()), properties: null }],
    has_more: false,
    next_cursor: null,
  });
  await assert.rejects(syncSource('moves', 'synthetic-secret'), /invalid properties/);
  assert.equal(row.mirror_populated_at, null);
});
