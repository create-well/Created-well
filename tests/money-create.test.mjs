// M-1b (2026-11-04) quick log, retired by MONEY A (2026-11-13).
// Contract now: POST /api/server/money { name, amount, direction,
// actual, stage } still runs the M-1b validation first (a malformed
// log is a 400 with zero writes, unchanged), then answers a truthful
// 410 naming where quick log moved — the "Create Well — Budget & P&L
// Bookkeeping" workbook, whose Transactions feed the dashboard's money
// slice through KV (cr8w_money). No Notion write is attempted on any
// path; the retired MONEY database stays frozen.
// Handler-level against api/server.ts with the kv-corrupt stub pattern
// (synthetic auth + Supabase client, the REAL _notionWriter) and a
// stubbed Notion fetch that counts every call.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit: true, url: moduleURL(`
    export function createClient(){return {from(){return {
      select(){return {eq(_,key){return {async maybeSingle(){return {data:null,error:null}}}}}},
      async upsert(row){return {error:null}}
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

const { default: handler } = await import('../api/server.ts');
const { validateMoneyCreate, moneyToProperties } = await import('../api/_notionWriter.ts');

const savedFetch = globalThis.fetch;
const savedEnv = Object.fromEntries(['NOTION_SECRET', 'NOTION_DB_MONEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(k => [k, process.env[k]]));
after(() => { hooks.deregister(); globalThis.fetch = savedFetch;
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
process.env.NOTION_SECRET = 'test-secret';
process.env.NOTION_DB_MONEY = 'db-money-fixture';
process.env.SUPABASE_URL = 'https://fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';

let notionCalls = [];
let notionShouldFail = false;
globalThis.fetch = async (url, init) => {
  notionCalls.push({ url: String(url), init });
  if (notionShouldFail) return { ok: false, status: 500, text: async () => 'upstream boom', json: async () => ({}) };
  const sent = JSON.parse(init.body);
  const p = sent.properties;
  const page = {
    id: '3e724acf-799d-81ff-9000-0000000000aa',
    created_time: '2026-11-04T12:00:00.000Z',
    properties: {
      Name:      { type: 'title', title: [{ plain_text: p.Name.title[0].text.content }] },
      Amount:    { type: 'number', number: p.Amount.number },
      Direction: { type: 'select', select: { name: p.Direction.select.name } },
      Actual:    { type: 'date', date: { start: p.Actual.date.start } },
      Stage:     { type: 'select', select: { name: p.Stage.select.name } },
    },
  };
  return { ok: true, status: 200, json: async () => page, text: async () => '' };
};

function invoke({ method = 'POST', path = 'money', body } = {}) {
  notionCalls = [];
  const res = { code: 200, body: null, setHeader() { return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  const req = { method, url: `/api/server/${path}`, query: { path }, headers: {}, body,
    on(event, cb) { if (event === 'end') cb(); return this; } };
  return handler(req, res)
    .then(() => ({ code: res.code, body: res.body, notionCalls }));
}

const validIn = { name: 'Ticket sales — SLO Create', amount: 240, direction: 'In', actual: '2026-11-04', stage: 'Received' };

test('valid In log: 410 naming the workbook move, zero Notion calls', async () => {
  const r = await invoke({ body: validIn });
  assert.equal(r.code, 410);
  assert.equal(r.notionCalls.length, 0);
  assert.equal(r.body.code, 'quick_log_moved_to_workbook');
  assert.match(r.body.error, /Create Well — Budget & P&L Bookkeeping/);
});

test('valid Out log: 410 as well — validation passes, no write attempted', async () => {
  const r = await invoke({ body: { name: 'Venue fee', amount: 75.5, direction: 'Out', actual: '2026-11-01', stage: 'Paid' } });
  assert.equal(r.code, 410);
  assert.equal(r.notionCalls.length, 0);
  assert.equal(r.body.code, 'quick_log_moved_to_workbook');
});

test('stage/direction mismatch refuses 400 before any write', async () => {
  const r = await invoke({ body: { ...validIn, stage: 'Paid' } });
  assert.equal(r.code, 400);
  assert.equal(r.notionCalls.length, 0);
  assert.match(r.body.error, /stage must follow direction/);
});

test('invalid fields refuse 400 with zero writes', async () => {
  const bad = [
    { ...validIn, name: '   ' }, { ...validIn, name: undefined },
    { ...validIn, amount: 0 }, { ...validIn, amount: -5 },
    { ...validIn, amount: '240' }, { ...validIn, amount: Number.NaN },
    { ...validIn, direction: 'in' }, { ...validIn, direction: 'Sideways' },
    { ...validIn, stage: 'Possible' },
    { ...validIn, actual: '11/04/2026' }, { ...validIn, actual: '2026-02-30' }, { ...validIn, actual: undefined },
    null, 'nope', [],
  ];
  for (const body of bad) {
    const r = await invoke({ body });
    assert.equal(r.code, 400, JSON.stringify(body));
    assert.equal(r.notionCalls.length, 0, JSON.stringify(body));
  }
});

test('extra body fields are ignored by validation; still 410, zero writes', async () => {
  const r = await invoke({ body: { ...validIn, type: 'Grant', kind: 'Grant', flowId: 'x', notionPageId: 'spoof' } });
  assert.equal(r.code, 410);
  assert.equal(r.notionCalls.length, 0);
});

test('the 410 does not depend on Notion: a valid log answers 410 with zero calls even when Notion would fail', async () => {
  notionShouldFail = true;
  const r = await invoke({ body: validIn });
  notionShouldFail = false;
  assert.equal(r.code, 410);
  assert.equal(r.notionCalls.length, 0);
});

test('money is POST-only here: GET falls through to 404, POST with an id 404s', async () => {
  const g = await invoke({ method: 'GET', body: undefined });
  assert.equal(g.code, 404);
  const withId = await invoke({ path: 'money/some-id', body: validIn });
  assert.equal(withId.code, 404);
  assert.equal(withId.notionCalls.length, 0);
});

test('validator + property builder units', () => {
  assert.equal(validateMoneyCreate(validIn).ok, true);
  assert.equal(validateMoneyCreate({ ...validIn, name: '  padded  ' }).value.name, 'padded');
  const props = moneyToProperties(validateMoneyCreate(validIn).value);
  assert.deepEqual(props, {
    Name: { title: [{ text: { content: 'Ticket sales — SLO Create' } }] },
    Amount: { number: 240 },
    Direction: { select: { name: 'In' } },
    Actual: { date: { start: '2026-11-04' } },
    Stage: { select: { name: 'Received' } },
  });
});
