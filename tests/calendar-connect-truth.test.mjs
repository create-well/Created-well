// Phase 6 (packet OO §2–§3): calendar-connect truth at the handler.
// - POST /calendar-ical-sync refuses a personal access_token with a
//   truthful 400 (the route is feed-only; it never reads the token).
// - The two writers of cr8w_calendar_events merge by id namespace:
//   feed syncs preserve 'gcal-' rows, personal writes preserve feed
//   rows (QA amendment A2, exercised end to end here).
// Handler-level against api/server.ts with a stateful KV stub.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit: true, url: moduleURL(`
    export function createClient(){return {from(){return {
      select(){return {eq(_,key){return {async maybeSingle(){const v = globalThis.__kvStore.get(key); return {data: v === undefined ? null : {value: v}, error: null}}}}}},
      async upsert(row){globalThis.__kvStore.set(row.key, row.value); return {error:null}}
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

const savedFetch = globalThis.fetch;
const savedEnv = Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CR8W_ICAL_URL', 'GCAL_CREATEWELL_ICS_URL'].map(k => [k, process.env[k]]));
after(() => { hooks.deregister(); globalThis.fetch = savedFetch;
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
process.env.SUPABASE_URL = 'https://fixture.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
delete process.env.CR8W_ICAL_URL;
delete process.env.GCAL_CREATEWELL_ICS_URL;

const ICS_V1 = ['BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:feed-1@google.com', 'SUMMARY:Feed one', 'DTSTART:20261121T180000Z', 'DTEND:20261121T200000Z', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:feed-2@google.com', 'SUMMARY:Feed two', 'DTSTART:20261122T180000Z', 'DTEND:20261122T200000Z', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
const ICS_V2 = ['BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:feed-3@google.com', 'SUMMARY:Feed three', 'DTSTART:20261123T180000Z', 'DTEND:20261123T200000Z', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
let icsText = ICS_V1;
globalThis.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => icsText, json: async () => ({}) });

function invoke({ method = 'POST', path, body } = {}) {
  const res = { code: 200, body: null, setHeader() { return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  const req = { method, url: `/api/server/${path}`, query: { path }, headers: {}, body,
    on(event, cb) { if (event === 'end') cb(); return this; } };
  return handler(req, res).then(() => ({ code: res.code, body: res.body }));
}
const storedIds = () => JSON.parse(globalThis.__kvStore.get('cr8w_calendar_events') ?? '[]').map((e) => e.id).sort();

test('guard: an access_token body is refused 400, feed-only named, nothing written', async () => {
  globalThis.__kvStore = new Map();
  const r = await invoke({ path: 'calendar-ical-sync', body: { access_token: 'ya29.fixture' } });
  assert.equal(r.code, 400);
  assert.match(r.body.error, /feed-only/);
  assert.match(r.body.error, /\/calendar-events/);
  assert.equal(globalThis.__kvStore.has('cr8w_calendar_events'), false);
});

test('A2 at the handler: feed → personal → feed keeps both sets intact', async () => {
  globalThis.__kvStore = new Map();
  icsText = ICS_V1;

  // Personal row pre-exists (an earlier card sync).
  globalThis.__kvStore.set('cr8w_calendar_events', JSON.stringify([{ id: 'gcal-aaa', title: 'Personal one', start: '', end: '', location: '', description: '', creator: '', synced_at: 'x' }]));

  // Feed sync: brings feed-1 + feed-2, preserves gcal-aaa.
  let r = await invoke({ path: 'calendar-ical-sync', body: { url: 'https://feed.invalid/cal.ics' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.count, 2);
  assert.deepEqual(storedIds(), ['feed-1@google.com', 'feed-2@google.com', 'gcal-aaa']);

  // Personal sync: replaces the personal namespace (gcal-aaa is
  // stale and drops), feed rows untouched.
  r = await invoke({ path: 'calendar-events', body: { events: [{ id: 'gcal-bbb', title: 'Personal two', start: '2026-11-24T18:00:00-08:00', end: '2026-11-24T20:00:00-08:00' }] } });
  assert.equal(r.code, 200);
  assert.deepEqual(storedIds(), ['feed-1@google.com', 'feed-2@google.com', 'gcal-bbb']);

  // Second feed sync with a refreshed feed: gcal-bbb survives.
  icsText = ICS_V2;
  r = await invoke({ path: 'calendar-ical-sync', body: { url: 'https://feed.invalid/cal.ics' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.count, 1);
  assert.deepEqual(storedIds(), ['feed-3@google.com', 'gcal-bbb']);
});

test('source pins: the hook never POSTs a token to the feed route again', () => {
  const hook = readFileSync(new URL('../src/lib/useCalendarSync.ts', import.meta.url), 'utf8');
  // The route may be NAMED in the explanatory comment; it must never
  // be ADDRESSED — no fetch URL may point at it from this hook.
  assert.ok(!/\$\{BASE\}\/calendar-ical-sync/.test(hook), 'useCalendarSync must not fetch calendar-ical-sync');
  assert.ok(!/fetch\([^)]*calendar-ical-sync/.test(hook), 'useCalendarSync must not fetch calendar-ical-sync');
  assert.ok(hook.includes('calendar-events'));
  assert.ok(hook.includes('googleEventsUrl'));
  const server = readFileSync(new URL('../api/server.ts', import.meta.url), 'utf8');
  assert.ok(server.includes('a personal access_token is not accepted here'));
  assert.ok(server.includes('mergeFeedWrite') && server.includes('mergePersonalWrite'));
});
