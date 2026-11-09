// Leg C (live-sync rev3 correction packet) — pending (entity_id, op)
// pairs, delete-wins dedupe, max() ordering, 200-pair cap with
// re-query escalation, and claimed-delete tombstones.
//
// Unit legs exercise the real decoder/append helpers; integration legs
// run the real engine against a filter-evaluating fake PostgREST and a
// stubbed Notion API (the rr001-fencing harness shape). Nothing here
// touches the network.
//
// Requires Node.js >=22.15.0 and --experimental-strip-types.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run live-sync-leg-c test with --experimental-strip-types');
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
let store;
try {
  engine = await import('../api/_sync-engine.ts');
  store = await import('../api/_supabase.ts');
} finally {
  hooks.deregister();
}
const { appendPendingEntry, markEvent, syncSource, PENDING_CAP } = engine;
const { decodePending } = store;

// ── Fake store ──────────────────────────────────────────────────────

const OK_AT = '2026-10-27T00:00:00.000Z';
let row;
let snapshots;
let notionResponder;

function resetStore(pending = []) {
  row = {
    source: 'moves',
    sync_version: 3,
    last_event_at: null,
    last_event_id: null,
    last_sync_started_at: OK_AT,
    last_sync_ok_at: OK_AT,
    dirty: true,
    pending_entity_ids: pending,
    last_error: null,
    updated_at: OK_AT,
    lease_owner: null,
    lease_epoch: 0,
    lease_expires_at: null,
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

// ── Decoder + append units ──────────────────────────────────────────

test('decodePending: legacy strings decode as upsert, junk drops, delete wins on duplicates', () => {
  assert.deepEqual(
    decodePending(['a', { entity_id: 'b', op: 'delete' }, { entity_id: 'c' }, 42, null, '']),
    [
      { entity_id: 'a', op: 'upsert' },
      { entity_id: 'b', op: 'delete' },
      { entity_id: 'c', op: 'upsert' },
    ],
  );
  assert.deepEqual(
    decodePending([{ entity_id: 'x', op: 'upsert' }, { entity_id: 'x', op: 'delete' }]),
    [{ entity_id: 'x', op: 'delete' }],
  );
  assert.deepEqual(
    decodePending([{ entity_id: 'x', op: 'delete' }, { entity_id: 'x', op: 'upsert' }]),
    [{ entity_id: 'x', op: 'delete' }],
  );
  assert.deepEqual(decodePending('nope'), []);
  assert.deepEqual(decodePending(undefined), []);
});

test('appendPendingEntry: dedupe by entity_id, delete wins both directions, cap clears on overflow', () => {
  let r = appendPendingEntry([], 'a', 'upsert');
  assert.deepEqual(r, { pending: [{ entity_id: 'a', op: 'upsert' }], overflowed: false });
  r = appendPendingEntry(r.pending, 'a', 'upsert');
  assert.equal(r.pending.length, 1);
  r = appendPendingEntry(r.pending, 'a', 'delete');
  assert.deepEqual(r.pending, [{ entity_id: 'a', op: 'delete' }]);
  r = appendPendingEntry(r.pending, 'a', 'upsert');
  assert.deepEqual(r.pending, [{ entity_id: 'a', op: 'delete' }], 'delete is sticky');

  const full = Array.from({ length: PENDING_CAP }, (_, i) => ({ entity_id: `p${i}`, op: 'upsert' }));
  const over = appendPendingEntry(full, 'one-more', 'upsert');
  assert.equal(over.overflowed, true);
  assert.deepEqual(over.pending, [], 'overflow clears the set into the escalation');
  const atCapExisting = appendPendingEntry(full, 'p0', 'delete');
  assert.equal(atCapExisting.overflowed, false, 'an in-place upgrade never overflows');
  assert.equal(PENDING_CAP, 200);
});

// ── markEvent integration ───────────────────────────────────────────

test('markEvent: last_event_at is max() and never moves backwards; ops are recorded', async () => {
  resetStore();
  row.last_event_at = '2026-11-09T10:00:00.000Z';
  const older = await markEvent('moves', { id: 'e1', entityId: 'p1', at: '2026-11-09T09:00:00.000Z', op: 'upsert' });
  assert.equal(older.state.last_event_at, '2026-11-09T10:00:00.000Z');
  const newer = await markEvent('moves', { id: 'e2', entityId: 'p2', at: '2026-11-09T11:00:00.000Z', op: 'delete' });
  assert.equal(newer.state.last_event_at, '2026-11-09T11:00:00.000Z');
  assert.deepEqual(row.pending_entity_ids, [
    { entity_id: 'p1', op: 'upsert' },
    { entity_id: 'p2', op: 'delete' },
  ]);
  assert.equal(row.dirty, true);
});

test('markEvent: delete wins when the same entity is re-marked', async () => {
  resetStore();
  await markEvent('moves', { id: 'e1', entityId: 'p1', at: '2026-11-09T09:00:00.000Z', op: 'upsert' });
  await markEvent('moves', { id: 'e2', entityId: 'p1', at: '2026-11-09T09:01:00.000Z', op: 'delete' });
  assert.deepEqual(row.pending_entity_ids, [{ entity_id: 'p1', op: 'delete' }]);
});

test('markEvent: overflow clears the set and reports the escalation', async () => {
  const full = Array.from({ length: PENDING_CAP }, (_, i) => ({ entity_id: `p${i}`, op: 'upsert' }));
  resetStore(full);
  const result = await markEvent('moves', { id: 'eX', entityId: 'new-page', at: '2026-11-09T09:00:00.000Z', op: 'upsert' });
  assert.equal(result.overflowed, true);
  assert.deepEqual(row.pending_entity_ids, []);
  assert.equal(row.dirty, true);
  assert.equal(row.last_event_at, '2026-11-09T09:00:00.000Z');
});

// ── syncSource tombstone ────────────────────────────────────────────

test('syncSource: a claimed delete tombstones directly even while the listing still carries the page', async () => {
  resetStore([{ entity_id: 'page-del', op: 'delete' }]);
  snapshots = [
    { page_id: 'page-del', row: { _id: 'page-del' }, last_edited: OK_AT, sync_version: 3 },
    { page_id: 'page-keep', row: { _id: 'page-keep' }, last_edited: OK_AT, sync_version: 3 },
  ];
  notionResponder = () => ({
    results: [
      { id: 'page-del', last_edited_time: OK_AT, properties: { Name: { type: 'title', title: [] } } },
      { id: 'page-keep', last_edited_time: OK_AT, properties: { Name: { type: 'title', title: [] } } },
    ],
    has_more: false,
    next_cursor: null,
  });
  const outcome = await syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.deferred, false);
  assert.deepEqual(snapshots.map((e) => e.page_id), ['page-keep']);
  assert.equal(outcome.version, 4, 'a tombstone of an existing row bumps the version');
  assert.equal(row.sync_version, 4);
  assert.deepEqual(row.pending_entity_ids, [], 'the claimed set is consumed');
});

test('syncSource: a claimed delete for a page with no snapshot row changes nothing and bumps nothing', async () => {
  resetStore([{ entity_id: 'page-absent', op: 'delete' }]);
  snapshots = [
    { page_id: 'page-keep', row: { _id: 'page-keep', _last_edited: OK_AT, properties: {} }, last_edited: OK_AT, sync_version: 3 },
  ];
  notionResponder = () => ({
    results: [{ id: 'page-keep', last_edited_time: OK_AT, properties: {} }],
    has_more: false,
    next_cursor: null,
  });
  const outcome = await syncSource('moves', 'synthetic-secret');
  assert.equal(outcome.changed, 0);
  assert.equal(outcome.version, 3);
  assert.deepEqual(snapshots.map((e) => e.page_id), ['page-keep']);
});
