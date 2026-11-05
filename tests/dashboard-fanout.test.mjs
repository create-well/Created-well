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

function installFetch({ failing = new Set(), failingKv = new Set(), movesRow = null, contentPages = null, kvRows = {} } = {}) {
  let contentCall = 0;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  Object.assign(process.env, ENV_KEYS);
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    // Reader migration: a GET on the database resolves its data source;
    // queries arrive on the data_sources route with the ds- prefix.
    if (u.startsWith('https://api.notion.com/v1/databases/') && (!init || !init.method || init.method === 'GET')) {
      const id = u.split('/databases/')[1].split('/')[0];
      if (failing.has(id)) {
        return resp(false, 500, 'upstream boom');
      }
      return resp(true, 200, { data_sources: [{ id: `ds-${id}` }] });
    }
    if (u.startsWith('https://api.notion.com/v1/data_sources/')) {
      const id = u.split('/data_sources/')[1].split('/')[0].replace(/^ds-/, '');
      if (failing.has(id)) {
        return resp(false, 500, 'upstream boom');
      }
      if (id === DB.content && contentPages) {
        const body = contentPages[contentCall++];
        if (!body) throw new Error('unexpected CONTENT page request');
        return resp(true, 200, body);
      }
      const results = id === DB.moves && movesRow ? [movesRow] : [];
      return resp(true, 200, { results, has_more: false, next_cursor: null });
    }
    if (u.includes('/auth/v1/user')) {
      return resp(true, 200, { user: { id: 'user-fixture', role: 'authenticated' } });
    }
    if (u.includes('/rest/v1/')) {
      const keyMatch = u.match(/key=eq\.([^&]+)/);
      const key = keyMatch ? decodeURIComponent(keyMatch[1]) : null;
      if (key && failingKv.has(key)) throw new Error('kv read boom');
      if (key && key in kvRows) return resp(true, 200, { value: JSON.stringify(kvRows[key]) });
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
    assert.equal(res.body.contentQueryComplete, true);
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


test('malformed CONTENT pagination is named failed, not a successful empty source', async () => {
  const restore = installFetch({contentPages:[{results:[],has_more:true,next_cursor:null}]});
  try {
    const res=await callHandler();
    assert.equal(res.statusCode,200); assert.ok(res.body.sourceErrors.content);
    assert.equal(res.body.contentQueryComplete,false); assert.deepEqual(res.body.forum,[]);
    assert.ok(Array.isArray(res.body.tasks));
  } finally {restore();}
});

test('valid paginated CONTENT retains both full IDs and asserts completed query', async () => {
  const flow='11111111-1111-4111-8111-111111111111';
  const page=(id,name)=>({id,created_time:'2026-01-01T00:00:00Z',properties:{Name:{type:'title',title:[{plain_text:name}]},Flow:{type:'relation',relation:[{id:flow}],has_more:false}}});
  const ids=['12345670-0000-4000-8000-000000000001','12345670-0000-4000-8000-000000000002'];
  const restore=installFetch({contentPages:[{results:[page(ids[0],'A')],has_more:true,next_cursor:'synthetic-cursor'},{results:[page(ids[1],'B')],has_more:false,next_cursor:null}]});
  try {
    const res=await callHandler(); assert.equal(res.statusCode,200);
    assert.equal(res.body.contentQueryComplete,true); assert.deepEqual(res.body.sourceErrors,{});
    assert.deepEqual(res.body.forum.map(x=>x.notionPageId),ids);
    assert.deepEqual(res.body.forum.map(x=>x.flowRelation.ids),[[flow],[flow]]);
  } finally {restore();}
});

test('KV boundary validation: malformed rows dropped and named, valid rows served', async () => {
  const restore = installFetch({ kvRows: {
    cr8w_messages: [
      { id: 1, author: 'monny', content: 'valid message' },
      { id: 2, author: 'monny', content: 42 },
      'not a record',
    ],
    cr8w_decisions: [
      { id: 3, question: 'Ship it?', context: '', urgency: 'now', status: 'pending' },
      { id: 4, question: 'Ghost', context: '', urgency: 'now', status: 'deferred' },
    ],
  } });
  try {
    const res = await callHandler();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.messages.map((m) => m.id), [1]);
    assert.match(res.body.sourceErrors['kv:cr8w_messages'], /dropped 2 malformed/);
    assert.deepEqual(res.body.decisions.map((d) => d.id), [3]);
    assert.match(res.body.sourceErrors['kv:cr8w_decisions'], /dropped 1 malformed/);
  } finally { restore(); }
});
