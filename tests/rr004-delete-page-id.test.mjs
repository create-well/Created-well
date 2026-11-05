// RR-004 DELETE follow-on (2026-11-05): page-id addressing for deletes
// of Notion-sourced records, the delete twin of the update leg
// (tests/rr004-page-id-addressing.test.mjs). Contract:
//   - DELETE /api/server/<dual-write resource>/<page id> with no KV
//     shadow archives the Notion page directly; 200 + notion_sync 'ok'.
//   - A Notion failure is a truthful 502; nothing is reported deleted.
//   - Every non-page-id path is unchanged: a tasks miss keeps its 409
//     (move_target_not_found), an unlinked tasks shadow keeps its 409
//     (notion_link_required), a KV hit still archives via its shadow.
// Handler-level against api/server.ts (same stub pattern as the
// update-leg suite: synthetic auth, stateful in-memory KV, stubbed
// Notion fetch).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const kvStore = new Map();
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit: true, url: moduleURL(`
    const store = globalThis.__rr004del_kv;
    export function createClient(){return {from(){return {
      select(){return {eq(_,key){return {async maybeSingle(){const v = store.get(key); return {data: v===undefined?null:{value:v}, error:null}}}}}},
      async upsert(row){ store.set(row.key, row.value); return {error:null}; }
    }}}}
  `)};
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_auth.js') return {
    shortCircuit: true, url: moduleURL('export function applyCors(){}; export async function requireSession(){return true}; export async function requireSessionOrCron(){return true};'),
  };
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  if (isRelative && specifier.endsWith('.js')) {
    const target = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
    try { return next(specifier.replace(/\.js$/, '.ts'), context); } catch {}
    try { return next(target.href, context); } catch {}
  }
  return next(specifier, context);
}});
globalThis.__rr004del_kv = kvStore;

const { default: handler } = await import('../api/server.ts');

const savedFetch = globalThis.fetch;
const savedEnv = Object.fromEntries(['NOTION_SECRET', 'NOTION_DB_MOVES', 'NOTION_DB_PEOPLE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(k => [k, process.env[k]]));
after(() => { hooks.deregister(); globalThis.fetch = savedFetch;
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
process.env.NOTION_SECRET = 'synthetic';
process.env.NOTION_DB_MOVES = 'db-moves-fixture';
process.env.NOTION_DB_PEOPLE = 'db-people-fixture';
process.env.SUPABASE_URL = 'https://fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';

let notionCalls = [];
let notionShouldFail = false;
globalThis.fetch = async (url, init) => {
  notionCalls.push({ url: String(url), init });
  if (notionShouldFail) return { ok: false, status: 500, text: async () => 'upstream boom', json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};

function invoke({ method = 'DELETE', path } = {}) {
  notionCalls = [];
  const res = { code: 200, body: null, setHeader() { return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  const req = { method, url: `/api/server/${path}`, query: { path }, headers: {}, body: undefined,
    on(event, cb) { if (event === 'end') cb(); return this; } };
  return handler(req, res).then(() => ({ code: res.code, body: res.body, notionCalls }));
}

const PAGE = '3f824acf-799d-810b-afea-e29af2bf264e';
const PAGE2 = '40f24acf-799d-8160-9c05-e40d50671342';

test('page-id tasks delete with no shadow archives the page directly', async () => {
  const r = await invoke({ path: `tasks/${PAGE}` });
  assert.equal(r.code, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.notion_sync, 'ok');
  assert.equal(r.body.notionPageId, PAGE);
  assert.equal(r.notionCalls.length, 1);
  assert.equal(r.notionCalls[0].init.method, 'PATCH');
  assert.ok(r.notionCalls[0].url.endsWith(`/pages/${PAGE}`));
  assert.deepEqual(JSON.parse(r.notionCalls[0].init.body), { archived: true });
});

test('page-id stations delete with no shadow archives the page directly', async () => {
  const r = await invoke({ path: `stations/${PAGE}` });
  assert.equal(r.code, 200);
  assert.equal(r.notionCalls.length, 1);
  assert.deepEqual(JSON.parse(r.notionCalls[0].init.body), { archived: true });
});

test('page-id delete: a Notion failure is a truthful 502, nothing reported deleted', async () => {
  notionShouldFail = true;
  const r = await invoke({ path: `tasks/${PAGE}` });
  notionShouldFail = false;
  assert.equal(r.code, 502);
  assert.equal(r.body.notion_error, 'notion_write_failed');
  assert.notEqual(r.body.ok, true);
});

test('numeric tasks miss keeps the 409 move_target_not_found, zero Notion calls', async () => {
  const r = await invoke({ path: 'tasks/123456' });
  assert.equal(r.code, 409);
  assert.equal(r.body.code, 'move_target_not_found');
  assert.equal(r.notionCalls.length, 0);
});

test('page-id shape on a non-dual-write resource: no archive call is made', async () => {
  const r = await invoke({ path: `messages/${PAGE}` });
  assert.equal(r.notionCalls.length, 0);
  assert.equal(r.code, 200); // the pre-existing fallthrough shape, unchanged
});

test('KV-shadow path unchanged: a linked shadow archives via its page and leaves the list', async () => {
  kvStore.set('cr8w_tasks', JSON.stringify([{ id: 777, title: 'Seeded move', status: 'todo', notionPageId: PAGE2 }]));
  const r = await invoke({ path: 'tasks/777' });
  assert.equal(r.code, 200);
  assert.equal(r.notionCalls.length, 1);
  assert.ok(r.notionCalls[0].url.endsWith(`/pages/${PAGE2}`));
  assert.deepEqual(JSON.parse(kvStore.get('cr8w_tasks')), []);
  kvStore.clear();
});

test('KV-shadow path unchanged: an unlinked tasks shadow keeps the 409 notion_link_required', async () => {
  kvStore.set('cr8w_tasks', JSON.stringify([{ id: 778, title: 'Unlinked', status: 'todo' }]));
  const r = await invoke({ path: 'tasks/778' });
  assert.equal(r.code, 409);
  assert.equal(r.body.code, 'notion_link_required');
  assert.equal(r.notionCalls.length, 0);
  kvStore.clear();
});
