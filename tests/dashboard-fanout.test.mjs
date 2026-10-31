// F-FANOUT: one failing source must not 503 the whole dashboard payload.
// Each failed query degrades only its own slice to empty and the failure
// is named in `sourceErrors` on the response. Retries for canonical
// sources already ran inside their query; this is the catch after them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

// The handler imports its siblings as `.js` (the Vercel convention);
// a narrow resolver maps those to the `.ts` sources, as the
// sync-freshness test does. Requires --experimental-strip-types.
if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run dashboard-fanout test with --experimental-strip-types');
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
let handler;
try {
  ({ default: handler } = await import('../api/dashboard.ts'));
} finally {
  hooks.deregister();
}

const DB = {
  moves: 'db-moves', people: 'db-people', flows: 'db-flows',
  content: 'db-content', money: 'db-money', openAsks: 'db-openasks',
  events: 'db-events', feedback: 'db-feedback',
};
const ENV_KEYS = {
  NOTION_SECRET: 'secret-fixture',
  NOTION_DB_MOVES: DB.moves, NOTION_DB_PEOPLE: DB.people,
  NOTION_DB_FLOWS: DB.flows, NOTION_DB_CONTENT: DB.content,
  NOTION_DB_MONEY: DB.money, NOTION_DB_OPEN_ASKS: DB.openAsks,
  NOTION_DB_EVENTS: DB.events, NOTION_DB_FEEDBACK: DB.feedback,
  SUPABASE_URL: 'https://supabase-fixture.invalid',
  SUPABASE_ANON_KEY: 'anon-fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'service-fixture',
};

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
const TOKEN = `${b64url({ alg: 'none' })}.${b64url({ role: 'authenticated', sub: 'user-fixture' })}.sig`;

function resCapture() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

// failing: set of Notion database ids that answer 500; failingKv: KV keys
// whose Supabase read throws. Everything else answers empty pages/rows.
// supabase-js reads the body as text first, so every stub carries text().
function resp(ok, status, body) {
  return {
    ok, status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function installFetch({ failing = new Set(), failingKv = new Set(), movesRow = null } = {}) {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  Object.assign(process.env, ENV_KEYS);
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://api.notion.com/v1/databases/')) {
      const id = u.split('/databases/')[1].split('/')[0];
      if (failing.has(id)) {
        return resp(false, 500, 'upstream boom');
      }
      const results = id === DB.moves && movesRow ? [movesRow] : [];
      return resp(true, 200, { results, has_more: false, next_cursor: null });
    }
    if (u.includes('/auth/v1/user')) {
      return resp(true, 200, { user: { id: 'user-fixture', role: 'authenticated' } });
    }
    if (u.includes('/rest/v1/')) {
      const keyMatch = u.match(/key=eq\.([^&]+)/);
      if (keyMatch && failingKv.has(decodeURIComponent(keyMatch[1]))) throw new Error('kv read boom');
      // maybeSingle expects a single object (or none); an array body errors.
      return resp(true, 200, {});
    }
    throw new Error(`unexpected fetch: ${u}`);
  };
  return () => { globalThis.fetch = originalFetch; process.env = originalEnv; };
}

async function callHandler() {
  const req = { method: 'GET', headers: { authorization: `Bearer ${TOKEN}` } };
  const res = resCapture();
  await handler(req, res);
  return res;
}

test('happy path: 200, all slices present, sourceErrors empty', async () => {
  const restore = installFetch();
  try {
    const res = await callHandler();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.sourceErrors, {});
    for (const key of ['tasks', 'stations', 'forum', 'coflowDates', 'money', 'events', 'feedback']) {
      assert.ok(Array.isArray(res.body[key]), key);
    }
  } finally { restore(); }
});

test('one canonical source failing: 200, only its slice empty, failure named', async () => {
  const movesRow = { id: 'page-fixture-1', created_time: '2026-10-30T00:00:00.000Z', properties: {} };
  const restore = installFetch({ failing: new Set([DB.flows]), movesRow });
  try {
    const res = await callHandler();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.coflowDates, []);
    assert.equal(res.body.tasks.length, 1);
    assert.equal(res.body.tasks[0].title, 'Untitled');
    assert.ok(res.body.sourceErrors.flows, 'flows failure named');
    assert.equal(Object.keys(res.body.sourceErrors).length, 1);
  } finally { restore(); }
});

test('all Notion sources failing: 200, all slices empty, all failures named', async () => {
  const restore = installFetch({ failing: new Set(Object.values(DB)) });
  try {
    const res = await callHandler();
    assert.equal(res.statusCode, 200);
    for (const key of ['tasks', 'stations', 'forum', 'coflowDates', 'money', 'events', 'feedback']) {
      assert.deepEqual(res.body[key], [], key);
    }
    for (const name of ['moves', 'people', 'flows', 'content', 'money', 'openAsks', 'events', 'feedback']) {
      assert.ok(res.body.sourceErrors[name], `${name} named`);
    }
  } finally { restore(); }
});

test('one KV read failing: 200, only its slice empty, failure named', async () => {
  const restore = installFetch({ failingKv: new Set(['cr8w_messages']) });
  try {
    const res = await callHandler();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.messages, []);
    assert.ok(res.body.sourceErrors['kv:cr8w_messages'], 'kv failure named');
    assert.equal(Object.keys(res.body.sourceErrors).length, 1);
  } finally { restore(); }
});
