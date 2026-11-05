// D-1b (2026-11-04): the decisions queue resource.
// 'decisions' is a settled-family KV resource (cr8w_decisions) with two
// lane guards: status is server-owned on create ('pending' whatever
// the body claims), and the enum fields the queue sorts by (urgency,
// status) refuse out-of-enum values rather than storing them. Decide
// and defer are plain Partial PUTs; defer is urgency-only, so the
// record stays pending. Handler-level against api/server.ts with the
// kv-corrupt stub pattern (synthetic auth + KV fixture, real writer).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit: true, url: moduleURL(`
    export function createClient(){return {from(){return {
      select(){return {eq(_,key){return {async maybeSingle(){return {data:{value:globalThis.__kvFixture.store[key]},error:null}}}}}},
      async upsert(row){globalThis.__kvFixture.store[row.key]=row.value;globalThis.__kvFixture.writes++;return {error:null}}
    }}}}
  `)};
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_auth.js') return {
    shortCircuit: true, url: moduleURL('export function applyCors(){}; export async function requireSession(){return true}; export async function requireSessionOrCron(){return true};'),
  };
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  if (isRelative && specifier.endsWith('.js')) {
    try { return next(specifier.replace(/\.js$/, '.ts'), context); } catch {}
  }
  return next(specifier, context);
}});

const { default: handler } = await import('../api/server.ts');
const savedEnv = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
after(() => { hooks.deregister(); delete globalThis.__kvFixture;
  if (savedEnv.u === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = savedEnv.u;
  if (savedEnv.k === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.k; });

const KEY = 'cr8w_decisions';
function invoke({ method, path = 'decisions', body, seed = [] }) {
  process.env.SUPABASE_URL = 'https://fixture.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
  const f = globalThis.__kvFixture = { store: { [KEY]: JSON.stringify(seed) }, writes: 0 };
  const res = { code: 200, body: null, setHeader() { return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  const req = { method, url: `/api/server/${path}`, query: { path }, headers: {}, body,
    on(event, cb) { if (event === 'end') cb(); return this; } };
  return handler(req, res).then(() => ({ ...f, code: res.code, body: res.body, stored: JSON.parse(globalThis.__kvFixture.store[KEY] || '[]') }));
}

const create = { question: 'Ship the SLO Create page?', context: 'Prototype is live', urgency: 'now' };

test('POST creates pending: server assigns id, created_at, and status', async () => {
  const r = await invoke({ method: 'POST', body: create });
  assert.equal(r.code, 201);
  assert.equal(r.body.status, 'pending');
  assert.equal(r.body.question, create.question);
  assert.equal(r.body.context, create.context);
  assert.equal(r.body.urgency, 'now');
  assert.equal(typeof r.body.id, 'number');
  assert.ok(r.body.created_at);
  assert.equal(r.stored.length, 1);
  assert.equal(r.stored[0].status, 'pending');
});

test('POST forces pending even when the body claims decided', async () => {
  const r = await invoke({ method: 'POST', body: { ...create, status: 'decided', answer: 'pre-baked' } });
  assert.equal(r.code, 201);
  assert.equal(r.stored[0].status, 'pending');
});

test('POST validation: empty question or out-of-enum urgency refuses, zero writes', async () => {
  for (const body of [
    { ...create, question: '' }, { ...create, question: '   ' }, { ...create, question: undefined },
    { ...create, urgency: 'someday' }, { ...create, urgency: undefined },
  ]) {
    const r = await invoke({ method: 'POST', body });
    assert.equal(r.code, 400, JSON.stringify(body));
    assert.equal(r.writes, 0, JSON.stringify(body));
    assert.equal(r.stored.length, 0);
  }
  const noContext = await invoke({ method: 'POST', body: { question: 'Q?', urgency: 'this-week' } });
  assert.equal(noContext.code, 201);
  assert.equal(noContext.body.context, '');
});

test('PUT decide merges status, answer, decided_at and persists', async () => {
  const seed = [{ id: 42, question: 'Q?', context: '', urgency: 'now', status: 'pending', created_at: '2026-11-04T00:00:00.000Z' }];
  const r = await invoke({ method: 'PUT', path: 'decisions/42', seed,
    body: { status: 'decided', answer: 'Yes, ship it', decided_at: '2026-11-04T12:00:00.000Z' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.status, 'decided');
  assert.equal(r.body.answer, 'Yes, ship it');
  assert.equal(r.body.decided_at, '2026-11-04T12:00:00.000Z');
  assert.equal(r.body.question, 'Q?');
  assert.equal(r.stored[0].status, 'decided');
});

test('PUT defer drops urgency to when-clear and the record stays pending', async () => {
  const seed = [{ id: 7, question: 'Q?', context: '', urgency: 'now', status: 'pending', created_at: '2026-11-04T00:00:00.000Z' }];
  const r = await invoke({ method: 'PUT', path: 'decisions/7', seed, body: { urgency: 'when-clear' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.urgency, 'when-clear');
  assert.equal(r.body.status, 'pending');
  assert.equal(r.stored[0].urgency, 'when-clear');
  assert.equal(r.stored[0].status, 'pending');
});

test('PUT enum guard refuses out-of-enum urgency/status and stores nothing new', async () => {
  const seed = [{ id: 7, question: 'Q?', context: '', urgency: 'now', status: 'pending', created_at: '2026-11-04T00:00:00.000Z' }];
  for (const body of [{ urgency: 'later' }, { status: 'archived' }]) {
    const r = await invoke({ method: 'PUT', path: 'decisions/7', seed, body });
    assert.equal(r.code, 400, JSON.stringify(body));
    assert.equal(r.stored[0].urgency, 'now');
    assert.equal(r.stored[0].status, 'pending');
  }
});

test('PUT unknown id is the family 404; GET returns the stored queue', async () => {
  const missing = await invoke({ method: 'PUT', path: 'decisions/999', body: { urgency: 'when-clear' } });
  assert.equal(missing.code, 404);
  const seed = [{ id: 1, question: 'Q?', context: '', urgency: 'now', status: 'pending', created_at: '2026-11-04T00:00:00.000Z' }];
  const g = await invoke({ method: 'GET', seed });
  assert.equal(g.code, 200);
  assert.equal(g.body.length, 1);
  assert.equal(g.body[0].question, 'Q?');
});
