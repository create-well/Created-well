// RR-004 (shape A, 2026-11-05): page-id addressing for the dual-write
// resources. The dashboard payload presents Notion-sourced records
// under their Notion page; before this fix a PUT addressed by page id
// looked the id up in the KV shadow list, missed, and 404'd silently,
// so every edit of a Notion-sourced record was lost. Contract:
//   - PUT /api/server/<dual-write resource>/<page id> with a partial
//     body writes through to Notion with the partial property builders
//     (present keys only — a status-only edit must not rewrite Name),
//     no KV shadow required; 200 + notion_sync 'ok'.
//   - A Notion failure is a truthful 502; nothing is stored.
//   - A KV id that misses keeps the plain 404 with zero Notion calls.
//   - Non-dual-write resources keep the plain 404 for page-id shapes.
//   - The KV-shadow path is unchanged (full builder, KV merged).
// Handler-level against api/server.ts (money-create stub pattern:
// synthetic auth, stateful in-memory KV, stubbed Notion fetch).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const kvStore = new Map();
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit: true, url: moduleURL(`
    const store = globalThis.__rr004_kv;
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
globalThis.__rr004_kv = kvStore;

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

function invoke({ method = 'PUT', path, body } = {}) {
  notionCalls = [];
  const res = { code: 200, body: null, setHeader() { return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  const req = { method, url: `/api/server/${path}`, query: { path }, headers: {}, body,
    on(event, cb) { if (event === 'end') cb(); return this; } };
  return handler(req, res).then(() => ({ code: res.code, body: res.body, notionCalls }));
}

const PAGE = '3f824acf-799d-810b-afea-e29af2bf264e';
const PAGE2 = '40f24acf-799d-8160-9c05-e40d50671342';

test('page-id task update: blocked + reason write through, present keys only (no Name clobber)', async () => {
  const r = await invoke({ path: `tasks/${PAGE}`, body: { status: 'blocked', source: 'QA probe reason' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.notion_sync, 'ok');
  assert.equal(r.body.notionPageId, PAGE);
  assert.equal(r.notionCalls.length, 1);
  assert.equal(r.notionCalls[0].init.method, 'PATCH');
  assert.ok(r.notionCalls[0].url.endsWith(`/pages/${PAGE}`));
  const props = JSON.parse(r.notionCalls[0].init.body).properties;
  assert.deepEqual(Object.keys(props).sort(), ['Blocked By', 'Status']);
  assert.equal(props.Status.select.name, 'Blocked');
  assert.equal(props['Blocked By'].rich_text[0].text.content, 'QA probe reason');
});

test('page-id task update: status-only body maps the one field', async () => {
  const r = await invoke({ path: `tasks/${PAGE}`, body: { status: 'todo' } });
  assert.equal(r.code, 200);
  const props = JSON.parse(r.notionCalls[0].init.body).properties;
  assert.deepEqual(Object.keys(props), ['Status']);
  assert.equal(props.Status.select.name, 'Next');
});

test('page-id task update: unhyphenated 32-hex page id is accepted', async () => {
  const hex = PAGE.replaceAll('-', '');
  const r = await invoke({ path: `tasks/${hex}`, body: { status: 'done' } });
  assert.equal(r.code, 200);
  assert.ok(r.notionCalls[0].url.endsWith(`/pages/${hex}`));
  assert.equal(JSON.parse(r.notionCalls[0].init.body).properties.Status.select.name, 'Done');
});

test('page-id task update: a Notion failure is a truthful 502', async () => {
  notionShouldFail = true;
  const r = await invoke({ path: `tasks/${PAGE}`, body: { status: 'blocked' } });
  notionShouldFail = false;
  assert.equal(r.code, 502);
  assert.equal(r.body.notion_error, 'notion_write_failed');
});

test('page-id stations update: description-only body writes only Description', async () => {
  const r = await invoke({ path: `stations/${PAGE}`, body: { description: 'new desc' } });
  assert.equal(r.code, 200);
  const props = JSON.parse(r.notionCalls[0].init.body).properties;
  assert.deepEqual(Object.keys(props), ['Description']);
});

test('numeric KV miss keeps the plain 404 with zero Notion calls', async () => {
  const r = await invoke({ path: 'tasks/123456', body: { status: 'done' } });
  assert.equal(r.code, 404);
  assert.equal(r.notionCalls.length, 0);
});

test('page-id shape on a non-dual-write resource keeps the plain 404', async () => {
  const r = await invoke({ path: `messages/${PAGE}`, body: { text: 'hi' } });
  assert.equal(r.code, 404);
  assert.equal(r.notionCalls.length, 0);
});

test('KV-shadow path unchanged: a KV hit still dual-writes with the full builder and merges KV', async () => {
  kvStore.set('cr8w_tasks', JSON.stringify([{ id: 777, title: 'Seeded move', status: 'todo', notionPageId: PAGE2 }]));
  const r = await invoke({ path: 'tasks/777', body: { status: 'done' } });
  assert.equal(r.code, 200);
  assert.equal(r.notionCalls.length, 1);
  assert.ok(r.notionCalls[0].url.endsWith(`/pages/${PAGE2}`));
  const props = JSON.parse(r.notionCalls[0].init.body).properties;
  assert.equal(props.Name.title[0].text.content, 'Seeded move');
  assert.equal(props.Status.select.name, 'Done');
  const stored = JSON.parse(kvStore.get('cr8w_tasks'));
  assert.equal(stored[0].status, 'done');
  kvStore.clear();
});
