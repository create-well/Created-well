// RR-001 Leg A regression tests: fail-closed reads, fenced writes,
// pending-event preservation. These import the REAL engine, store, and
// source modules against a fake PostgREST that evaluates the exact
// filters the code sends, plus a stubbed Notion API. The interleaving
// cases are reviewer 8182's probe map turned into regression cases:
// events and takeovers are injected at named request boundaries, and a
// passing run asserts the unsafe observation does NOT occur.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run rr001-fencing test with --experimental-strip-types');
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
let engine;
let sources;
try {
  engine = await import('../api/_sync-engine.ts');
  sources = await import('../api/_notion-sources.ts');
} finally {
  hooks.deregister();
}

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
process.env.NOTION_DB_MOVES = 'synthetic-moves-db';
process.env.NOTION_DB_EVENTS = 'synthetic-events-db';

const OK_AT = '2026-10-27T00:00:00.000Z';
const EDITED = '2026-11-01T00:00:00.000Z';

let row;
let snapshots;
let snapshotWrites;
let beforeStore;
let notionResponder;

function resetStore() {
  row = {
    source: 'moves',
    sync_version: 3,
    last_event_at: null,
    last_event_id: null,
    last_sync_started_at: OK_AT,
    last_sync_ok_at: OK_AT,
    dirty: true,
    pending_entity_ids: ['p1'],
    last_error: null,
    updated_at: OK_AT,
    lease_owner: null,
    lease_epoch: 0,
    lease_expires_at: null,
  };
  snapshots = [];
  snapshotWrites = 0;
  beforeStore = null;
  notionResponder = () => ({
    results: [{ id: 'page-1', last_edited_time: EDITED, properties: { Name: { type: 'title', title: [] } } }],
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
      // (lease_expires_at.is.null,lease_expires_at.lt.<iso>)
      const inner = value.replace(/^\(|\)$/g, '');
      const parts = inner.split(',');
      const ok = parts.some((part) => {
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
    if (op === 'eq') {
      if (String(actual) !== raw) return false;
    } else if (op === 'gt') {
      if (!(typeof actual === 'string' && actual > raw)) return false;
    } else {
      throw new Error(`fake store: unhandled filter ${key}=${value}`);
    }
  }
  return true;
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === 'api.notion.com') {
    if ((init.method ?? 'GET') === 'GET' && u.pathname.startsWith('/v1/databases/')) {
      // Composed-tree seam (reader migration): data-source resolution
      // (2025-09-03) precedes every query; the stub resolves constantly
      // so the cases below exercise the query behavior they name.
      return jsonResponse({ data_sources: [{ id: 'ds-synthetic' }] });
    }
    const body = init.body ? JSON.parse(String(init.body)) : {};
    return jsonResponse(notionResponder(body));
  }
  assert.equal(u.hostname, 'store.test');
  const method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(String(init.body)) : null;
  if (beforeStore) beforeStore({ method, pathname: u.pathname, body, url: u });

  if (u.pathname.endsWith('/sync_delivery_state')) {
    if (method === 'GET') {
      if (!matchesFilters(u, row)) return jsonResponse(null, 406);
      const select = u.searchParams.get('select') ?? '*';
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
      if (!matchesFilters(u, row)) return jsonResponse([]);
      Object.assign(row, body);
      return jsonResponse([{ ...row }]);
    }
    if (method === 'POST') {
      Object.assign(row, body);
      return jsonResponse(null);
    }
  }
  if (u.pathname.endsWith('/sync_snapshots')) {
    if (method === 'GET') {
      return jsonResponse(snapshots.map((entry) => ({ ...entry })));
    }
    if (method === 'POST') {
      snapshotWrites += 1;
      for (const entry of body) {
        const existing = snapshots.findIndex((e) => e.page_id === entry.page_id);
        const stored = { page_id: entry.page_id, row: entry.row, last_edited: entry.last_edited, sync_version: entry.sync_version };
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
  throw new Error(`fake store: unhandled ${method} ${u.pathname}`);
};

test('an event appended after the run starts survives the commit; the starting pending id is consumed', async () => {
  resetStore();
  let injected = false;
  beforeStore = ({ method, body }) => {
    if (!injected && method === 'PATCH' && body && 'last_sync_started_at' in body) {
      injected = true;
      row.pending_entity_ids = [...row.pending_entity_ids, 'p2'];
      row.last_event_at = EDITED;
    }
  };
  const outcome = await engine.syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.deferred, false);
  assert.equal(outcome.version, 4);
  assert.deepEqual(row.pending_entity_ids, ['p2']);
  assert.equal(row.sync_version, 4);
  assert.equal(row.last_error, null);
});

test('an event appended between the initial read and the started-state write is not erased', async () => {
  resetStore();
  let injected = false;
  beforeStore = ({ method, body }) => {
    // The acquire PATCH is the first write after the initial read.
    if (!injected && method === 'PATCH' && body && 'lease_owner' in body) {
      injected = true;
      row.pending_entity_ids = [...row.pending_entity_ids, 'p2'];
    }
  };
  const outcome = await engine.syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.deferred, false);
  assert.deepEqual(row.pending_entity_ids, ['p2']);
});

test('a lease takeover before the snapshot phase stops the run before any snapshot write', async () => {
  resetStore();
  let flipped = false;
  beforeStore = ({ method, pathname }) => {
    if (!flipped && method === 'GET' && pathname.endsWith('/sync_snapshots')) {
      flipped = true;
      row.lease_owner = 'other-run';
      row.lease_epoch += 1;
      row.lease_expires_at = '2999-01-01T00:00:00.000Z';
    }
  };
  await assert.rejects(engine.syncSource('moves', 'synthetic-secret'), /sync lease lost for moves/);
  assert.equal(snapshotWrites, 0);
  assert.equal(row.sync_version, 3);
});

test('a lease takeover before the commit write reports lease-lost, never success, and commits nothing', async () => {
  resetStore();
  let flipped = false;
  beforeStore = ({ method, body }) => {
    if (!flipped && method === 'PATCH' && body && 'sync_version' in body) {
      flipped = true;
      row.lease_owner = 'other-run';
      row.lease_epoch += 1;
      row.lease_expires_at = '2999-01-01T00:00:00.000Z';
    }
  };
  await assert.rejects(engine.syncSource('moves', 'synthetic-secret'), /sync lease lost for moves/);
  assert.equal(row.sync_version, 3);
  assert.equal(row.last_sync_ok_at, OK_AT);
});

test('a lease that expires before the commit write fails the commit even with owner and epoch intact', async () => {
  resetStore();
  let expired = false;
  beforeStore = ({ method, body }) => {
    if (!expired && method === 'PATCH' && body && 'sync_version' in body) {
      expired = true;
      row.lease_expires_at = '2000-01-01T00:00:00.000Z';
    }
  };
  await assert.rejects(engine.syncSource('moves', 'synthetic-secret'), /sync lease lost for moves/);
  assert.equal(row.sync_version, 3);
});

test('the failure write records the error and preserves pending appended during the run', async () => {
  resetStore();
  notionResponder = () => ({
    results: [{ id: 'page-1', last_edited_time: EDITED, properties: null }],
    has_more: false,
    next_cursor: null,
  });
  let injected = false;
  beforeStore = ({ method, body }) => {
    if (!injected && method === 'PATCH' && body && 'last_sync_started_at' in body) {
      injected = true;
      row.pending_entity_ids = [...row.pending_entity_ids, 'p2'];
    }
  };
  await assert.rejects(engine.syncSource('moves', 'synthetic-secret'), /invalid properties/);
  assert.match(row.last_error, /invalid properties/);
  assert.equal(row.dirty, true);
  assert.deepEqual(row.pending_entity_ids, ['p1', 'p2']);
  assert.equal(row.sync_version, 3);
});

test('fetchSourceRows fails closed on malformed pages and pagination', async () => {
  resetStore();
  const cases = [
    [{ results: [{ last_edited_time: EDITED, properties: {} }], has_more: false, next_cursor: null }, /without a valid id/],
    [{ results: [{ id: 'x', last_edited_time: EDITED, properties: null }], has_more: false, next_cursor: null }, /invalid properties/],
    [{ results: [{ id: 'x', last_edited_time: EDITED, properties: [] }], has_more: false, next_cursor: null }, /invalid properties/],
    [{ results: [], next_cursor: null }, /incomplete pagination/],
    [{ results: [], has_more: true, next_cursor: 'c1' }, /incomplete pagination/], // second page repeats the cursor
  ];
  for (const [payload, pattern] of cases) {
    let calls = 0;
    notionResponder = () => {
      calls += 1;
      if (Array.isArray(payload)) return payload;
      return payload;
    };
    if (pattern.source === 'incomplete pagination' && payload.has_more) {
      notionResponder = () => payload;
    }
    await assert.rejects(sources.fetchSourceRows('moves', 'synthetic-secret'), pattern);
    assert.ok(calls >= 0);
  }
});

test('fetchSourceRows rejects a cursor cycle across pages', async () => {
  resetStore();
  notionResponder = () => ({ results: [], has_more: true, next_cursor: 'same-cursor' });
  await assert.rejects(sources.fetchSourceRows('moves', 'synthetic-secret'), /incomplete pagination/);
});

test('the canonical reader fails closed on an id-less page and on missing has_more', async () => {
  resetStore();
  notionResponder = () => ({
    results: [{ last_edited_time: EDITED, properties: {} }],
    has_more: false,
    next_cursor: null,
  });
  await assert.rejects(
    sources.queryCanonicalNotionDatabase('moves', 'synthetic-moves-db', 'synthetic-secret'),
    /without a valid id/,
  );
  notionResponder = () => ({ results: [], next_cursor: null });
  await assert.rejects(
    sources.queryCanonicalNotionDatabase('moves', 'synthetic-moves-db', 'synthetic-secret'),
    /incomplete pagination/,
  );
});
