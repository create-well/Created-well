// Leg A (live-sync rev3 correction packet) — webhook hygiene + handshake
// guard tests. Exercises the real handler against an in-memory fake of
// the Supabase REST store and the Notion page retrieve. Nothing here
// touches the network.
//
// Requires Node.js >=22.15.0 and --experimental-strip-types (same
// resolver pattern as tests/sync-freshness.test.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { createHmac } from 'node:crypto';

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 15)) {
  throw new Error(`live-sync-leg-a test requires Node.js >=22.15.0; found ${process.versions.node}`);
}
if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run live-sync-leg-a test with --experimental-strip-types');
}

const apiUrlPrefix = new URL('../api/', import.meta.url).href;
const hooks = nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (
      isRelative &&
      specifier.endsWith('.js') &&
      context.parentURL?.startsWith(apiUrlPrefix)
    ) {
      const target = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (target.href.startsWith(apiUrlPrefix)) {
        try {
          return nextResolve(target.href, context);
        } catch {}
      }
    }
    return nextResolve(specifier, context);
  },
});

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
process.env.NOTION_SECRET = 'synthetic-notion-secret';
process.env.NOTION_DB_PEOPLE = 'people-db-id';
delete process.env.NOTION_WEBHOOK_SECRET;

let handler;
try {
  ({ default: handler } = await import('../api/notion-webhook.ts'));
} finally {
  hooks.deregister();
}

// ── Fake store + Notion ─────────────────────────────────────────────

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (value === null || value === undefined ? '' : JSON.stringify(value)),
    json: async () => value,
  };
}

function makeWorld() {
  const world = {
    setupRow: null, // { value: {...} } | null
    delivery: new Map(), // source -> row object
    setupPosts: [],
    runPosts: [],
    stateWrites: [],
    notionPage: null, // (version) -> response | null(404)
    notionCalls: [],
  };
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.notion.com') {
      world.notionCalls.push({ url: u.pathname, version: init.headers?.['Notion-Version'] });
      const result = world.notionPage?.(init.headers?.['Notion-Version']);
      if (!result) return jsonResponse({ object: 'error' }, 404);
      return jsonResponse(result);
    }
    assert.equal(u.hostname, 'store.test');
    const method = init.method ?? 'GET';
    const prefer = init.headers?.Prefer ?? '';
    if (u.pathname.endsWith('/sync_setup')) {
      if (method === 'GET') {
        return world.setupRow
          ? jsonResponse({ value: world.setupRow.value })
          : jsonResponse(null, 406);
      }
      if (method === 'POST') {
        const body = JSON.parse(init.body);
        world.setupPosts.push({ prefer, body });
        if (prefer.includes('ignore-duplicates')) {
          if (world.setupRow) return jsonResponse([]);
          world.setupRow = { value: body.value };
          return jsonResponse([{ key: body.key }]);
        }
        world.setupRow = { value: body.value };
        return jsonResponse(null);
      }
    }
    if (u.pathname.endsWith('/sync_delivery_state')) {
      const source = (u.searchParams.get('source') ?? '').replace(/^eq\./, '');
      if (method === 'GET') {
        const row = world.delivery.get(source);
        return row ? jsonResponse({ ...row }) : jsonResponse(null, 406);
      }
      if (method === 'POST') {
        const body = JSON.parse(init.body);
        world.stateWrites.push(body);
        world.delivery.set(body.source, { ...body });
        return jsonResponse(null);
      }
      if (method === 'PATCH') {
        const body = JSON.parse(init.body);
        world.stateWrites.push(body);
        const row = world.delivery.get(source);
        if (row) Object.assign(row, body);
        return jsonResponse(row ? [row] : []);
      }
    }
    if (u.pathname.endsWith('/sync_snapshots')) return jsonResponse([]);
    if (u.pathname.endsWith('/sync_runs')) {
      if (method === 'POST') world.runPosts.push(JSON.parse(init.body));
      return jsonResponse(null);
    }
    throw new Error(`unexpected fetch ${method} ${u.pathname}`);
  };
  return world;
}

// ── Request/response helpers ────────────────────────────────────────

function makeReq(body, headers = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  return {
    method: 'POST',
    headers,
    [Symbol.asyncIterator]: async function* () {
      yield buffer;
    },
  };
}

function makeRes() {
  const res = {
    code: 0,
    body: null,
    status(code) {
      res.code = code;
      return res;
    },
    json(body) {
      res.body = body;
    },
    setHeader() {},
  };
  return res;
}

function sign(rawBody, secret) {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

async function captureLogs(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    return { result: await fn(), lines };
  } finally {
    console.log = original;
  }
}

const TOKEN = 'verification-token-synthetic-0001';

function handshakeBody() {
  return JSON.stringify({ verification_token: TOKEN });
}

function coalescedPeopleState() {
  return {
    source: 'people',
    sync_version: 3,
    last_event_at: null,
    last_event_id: null,
    last_sync_started_at: new Date().toISOString(),
    last_sync_ok_at: new Date().toISOString(),
    dirty: true,
    claim_state: 'idle',
    mirror_populated_at: null,
    pending_entity_ids: [],
    last_error: null,
    lease_owner: null,
    lease_epoch: 0,
    lease_expires_at: null,
  };
}

function eventBody(entity, data) {
  return JSON.stringify({
    id: 'evt-1',
    type: 'page.properties_updated',
    timestamp: new Date().toISOString(),
    entity,
    ...(data ? { data } : {}),
  });
}

// ── Hygiene ─────────────────────────────────────────────────────────

test('over-cap payload answers 400 before any store call', async () => {
  const world = makeWorld();
  const big = Buffer.alloc(256 * 1024 + 1, 0x61);
  const res = makeRes();
  await handler(makeReq(big), res);
  assert.equal(res.code, 400);
  assert.equal(world.setupPosts.length, 0);
  assert.equal(world.runPosts.length, 0);
  assert.equal(world.stateWrites.length, 0);
});

test('unreadable raw body answers 400, not 401', async () => {
  makeWorld();
  const res = makeRes();
  await handler({ method: 'POST', headers: {}, body: { parsed: true } }, res);
  assert.equal(res.code, 400);
});

test('malformed JSON answers 401 (parse precedes verification)', async () => {
  makeWorld();
  process.env.NOTION_WEBHOOK_SECRET = 'env-secret';
  try {
    const res = makeRes();
    await handler(makeReq('{not json'), res);
    assert.equal(res.code, 401);
  } finally {
    delete process.env.NOTION_WEBHOOK_SECRET;
  }
});

test('invalid signature answers 401 with zero store writes', async () => {
  const world = makeWorld();
  process.env.NOTION_WEBHOOK_SECRET = 'env-secret';
  try {
    const raw = eventBody({ id: 'people-db-id', type: 'database' });
    const res = makeRes();
    await handler(
      makeReq(raw, { 'x-notion-signature': sign(raw, 'wrong-secret') }),
      res,
    );
    assert.equal(res.code, 401);
    assert.equal(world.setupPosts.length, 0);
    assert.equal(world.stateWrites.length, 0);
    assert.equal(world.runPosts.length, 0);
  } finally {
    delete process.env.NOTION_WEBHOOK_SECRET;
  }
});

// ── Handshake guard ─────────────────────────────────────────────────

test('handshake accepted only with env unset and setup row empty; token never logged', async () => {
  const world = makeWorld();
  const res = makeRes();
  const { lines } = await captureLogs(() => handler(makeReq(handshakeBody()), res));
  assert.equal(res.code, 200);
  assert.equal(world.setupPosts.length, 1);
  assert.match(world.setupPosts[0].prefer, /ignore-duplicates/);
  assert.equal(world.setupRow.value.token, TOKEN);
  assert.ok(lines.includes('handshake received'));
  assert.ok(!lines.some((line) => line.includes(TOKEN)), 'token leaked into a log line');
  assert.ok(!JSON.stringify(res.body).includes(TOKEN), 'token leaked into the response');
});

test('handshake rejected when the env var is set: 200, ledger error run, no write', async () => {
  const world = makeWorld();
  process.env.NOTION_WEBHOOK_SECRET = 'env-secret';
  try {
    const res = makeRes();
    const { lines } = await captureLogs(() => handler(makeReq(handshakeBody()), res));
    assert.equal(res.code, 200);
    assert.equal(world.setupPosts.length, 0);
    assert.equal(world.setupRow, null);
    assert.ok(!lines.includes('handshake received'));
    const run = world.runPosts.at(-1);
    assert.ok(run, 'a run record was written');
    assert.match(run.sources[0].error, /handshake rejected/);
  } finally {
    delete process.env.NOTION_WEBHOOK_SECRET;
  }
});

test('handshake rejected when the setup row is already populated: no overwrite attempted', async () => {
  const world = makeWorld();
  world.setupRow = { value: { token: 'first-token', receivedAt: '2026-11-09T00:00:00.000Z' } };
  const res = makeRes();
  await captureLogs(() => handler(makeReq(handshakeBody()), res));
  assert.equal(res.code, 200);
  assert.equal(world.setupPosts.length, 0);
  assert.equal(world.setupRow.value.token, 'first-token');
  assert.match(world.runPosts.at(-1).sources[0].error, /handshake rejected/);
});

// ── Signature fallback + mapping ────────────────────────────────────

test('signature verifies against the setup-row token while the env var is unset', async () => {
  const world = makeWorld();
  world.setupRow = { value: { token: 'setup-token', receivedAt: '2026-11-09T00:00:00.000Z' } };
  world.delivery.set('people', coalescedPeopleState());
  const raw = eventBody({ id: 'people-db-id', type: 'database' });
  const res = makeRes();
  await handler(makeReq(raw, { 'x-notion-signature': sign(raw, 'setup-token') }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.coalesced, true);
  assert.equal(res.body.source, 'people');
});

test('page mapping comes from the re-read parent, not the payload parent', async () => {
  const world = makeWorld();
  world.delivery.set('people', coalescedPeopleState());
  world.notionPage = (version) =>
    version === '2025-09-03' ? { parent: { database_id: 'people-db-id' } } : null;
  process.env.NOTION_WEBHOOK_SECRET = 'env-secret';
  try {
    const raw = eventBody(
      { id: 'page-1', type: 'page' },
      { parent: { database_id: 'unknown-db-id' } },
    );
    const res = makeRes();
    await handler(makeReq(raw, { 'x-notion-signature': sign(raw, 'env-secret') }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.source, 'people');
    assert.ok(world.notionCalls.length >= 1, 'the re-read happened');
  } finally {
    delete process.env.NOTION_WEBHOOK_SECRET;
  }
});

test('payload parent is the fallback when the re-read cannot see the page', async () => {
  const world = makeWorld();
  world.delivery.set('people', coalescedPeopleState());
  world.notionPage = () => null; // 404 under both API versions
  process.env.NOTION_WEBHOOK_SECRET = 'env-secret';
  try {
    const raw = eventBody(
      { id: 'page-gone', type: 'page' },
      { parent: { database_id: 'people-db-id' } },
    );
    const res = makeRes();
    await handler(makeReq(raw, { 'x-notion-signature': sign(raw, 'env-secret') }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.source, 'people');
    assert.equal(world.notionCalls.length, 2, 'both re-read versions were tried first');
  } finally {
    delete process.env.NOTION_WEBHOOK_SECRET;
  }
});
