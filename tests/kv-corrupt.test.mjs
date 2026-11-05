// F-SWEEP2-1: corrupt KV list values refuse loudly instead of silently
// parsing to []. Handler-level against api/server.ts with the same
// stub pattern as the moves-delete tests: a read-modify-write POST on
// a corrupt stored value must fail WITHOUT writing, and a plain read
// must surface the error rather than an empty list. The dashboard.ts
// half of the fix shares the contract (throw naming the collection);
// its integration is the fan-out settle wrapper, covered there.
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
    shortCircuit: true, url: moduleURL('export function applyCors(){}; export async function requireSession(){return true}; export async function requireSessionOrCron(){return true};')
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_notionWriter.js') return {
    shortCircuit: true, url: new URL('../api/_notionWriter.ts', import.meta.url).href
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === '../src/lib/notionNormalizer.js') return {
    shortCircuit: true, url: new URL('../src/lib/notionNormalizer.ts', import.meta.url).href
  };
  return next(specifier, context);
}});
const { default: handler } = await import('../api/server.ts');
const savedEnv = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
const savedError = console.error;
after(() => { hooks.deregister(); console.error = savedError; delete globalThis.__kvFixture;
  if (savedEnv.u === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = savedEnv.u;
  if (savedEnv.k === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.k; });

function invoke({ method, value, body }) {
  process.env.SUPABASE_URL = 'https://fixture.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
  const key = 'cr8w_announcements';
  const f = globalThis.__kvFixture = { store: { [key]: value }, writes: 0 };
  const logs = [];
  console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  const res = { code: 200, body: null, setHeader() { return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  return handler({ method, url: '/api/server/announcements', query: { path: 'announcements' }, headers: {}, body }, res)
    .then(() => ({ ...f, code: res.code, body: res.body, logs, stored: globalThis.__kvFixture.store[key] }));
}

test('read-modify-write POST on a corrupt stored list refuses: error, zero writes, value untouched', async () => {
  const corrupt = '{"broken": ';
  const r = await invoke({ method: 'POST', value: corrupt, body: { title: '[ ] new item' } });
  assert.equal(r.code, 500);
  assert.equal(r.writes, 0);
  assert.equal(r.stored, corrupt);
  assert.ok(r.logs.some(l => l.includes('cr8w_announcements') && l.includes('corrupt')), 'log names the collection and the failure class');
});

test('plain GET read on a corrupt stored list surfaces the error, not an empty list', async () => {
  const r = await invoke({ method: 'GET', value: 'not json at all' });
  assert.equal(r.code, 500);
  assert.equal(r.writes, 0);
});

test('control: a valid stored list still reads and writes normally', async () => {
  const r = await invoke({ method: 'POST', value: JSON.stringify([{ id: 1, title: '[ ] existing' }]), body: { title: '[ ] new item' } });
  assert.equal(r.code, 201);
  assert.equal(r.writes, 1);
  assert.equal(JSON.parse(r.stored).length, 2);
});

test('a stored JSON string that parses to a non-list is corrupt too', async () => {
  const r = await invoke({ method: 'GET', value: '{"a":1}' });
  assert.equal(r.code, 500);
  assert.equal(r.writes, 0);
});
