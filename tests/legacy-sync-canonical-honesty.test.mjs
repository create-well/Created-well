// Legacy GET /sync honesty (2026-11-05).
// Tasks, stations, forum, and coflow dates are Notion-canonical.
// Their KV rows are only write mirrors and can go stale when Notion
// is edited directly, so the legacy fallback must not serve them as
// if they were the source. It serves KV-owned collections only and
// names the canonical slices it cannot honestly provide.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const moduleURL = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@supabase/supabase-js') return { shortCircuit: true, url: moduleURL(`
      export function createClient() {
        return { from() { return {
          select() { return { async in(_, keys) {
            globalThis.__syncFixture.keys = keys;
            return { data: globalThis.__syncFixture.rows.filter((row) => keys.includes(row.key)), error: null };
          } }; }
        }; } };
      }
    `) };
    if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_auth.js') return {
      shortCircuit: true,
      url: moduleURL('export function applyCors(){}; export async function requireSession(){return true}; export async function requireSessionOrCron(){return true};'),
    };
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && specifier.endsWith('.js')) {
      try { return next(specifier.replace(/\.js$/, '.ts'), context); } catch {}
    }
    return next(specifier, context);
  },
});

const { default: handler } = await import('../api/server.ts');
const savedEnv = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
after(() => {
  hooks.deregister();
  delete globalThis.__syncFixture;
  if (savedEnv.u === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = savedEnv.u;
  if (savedEnv.k === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.k;
});

test('GET /sync serves KV-owned slices only and names unavailable canonical slices', async () => {
  process.env.SUPABASE_URL = 'https://fixture.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
  globalThis.__syncFixture = {
    keys: [],
    rows: [
      { key: 'cr8w_tasks', value: JSON.stringify([{ id: 1, title: 'stale mirror task' }]) },
      { key: 'cr8w_stations', value: JSON.stringify([{ id: 2, name: 'stale mirror station' }]) },
      { key: 'cr8w_forum', value: JSON.stringify([{ id: 3, content: 'stale mirror post' }]) },
      { key: 'cr8w_coflow_dates', value: JSON.stringify([{ id: 4, theme: 'stale mirror flow' }]) },
      { key: 'cr8w_messages', value: JSON.stringify([{ id: 5, author: 'monny', content: 'KV-owned message' }]) },
      { key: 'cr8w_calendar_events', value: JSON.stringify([{ id: 'evt-1', title: 'KV-owned event' }]) },
    ],
  };
  const res = {
    code: 200, body: null,
    setHeader() { return this; },
    status(n) { this.code = n; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
  const req = {
    method: 'GET', url: '/api/server/sync', query: { path: 'sync' }, headers: {},
    on(event, cb) { if (event === 'end') cb(); return this; },
  };
  await handler(req, res);
  assert.equal(res.code, 200);
  for (const key of ['cr8w_tasks', 'cr8w_stations', 'cr8w_forum', 'cr8w_coflow_dates']) {
    assert.ok(!globalThis.__syncFixture.keys.includes(key), `${key} must not be queried`);
  }
  for (const field of ['tasks', 'stations', 'forum', 'coflowDates']) {
    assert.ok(!(field in res.body), `${field} must not be served from the KV mirror`);
  }
  assert.deepEqual(res.body.canonicalSlicesUnavailable, ['tasks', 'stations', 'forum', 'coflowDates']);
  assert.equal(res.body.messages[0].content, 'KV-owned message');
  assert.equal(res.body.calendarEvents[0].title, 'KV-owned event');
});
