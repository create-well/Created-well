// F-SWEEP2-3 + F-SWEEP2-4: CMS revalidation failures leave a log trace
// naming the failure class (behavior unchanged: last-good or 503), and
// a query that hits the 10-page cap refuses its partial result instead
// of installing it as the release. Handler-level against
// api/public-content.ts with a stubbed Notion fetch; cold-cache cases
// run first, before any success warms the module-level cache.
// listSnapshot (api/_supabase.ts) pages by offset and refuses loudly
// past its safety cap instead of truncating at a silent ceiling.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

// .js -> .ts resolver hook, the dashboard-fanout test pattern: the api
// modules import each other with .js specifiers (Vercel convention).
const hooks = nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && specifier.endsWith('.js')) {
      const target = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      try { return nextResolve(target.href, context); } catch {}
    }
    return nextResolve(specifier, context);
  },
});

// Controllable clock: the handler serves its 60s cache without
// revalidating while fresh, so the warm-failure cases advance the
// clock past the TTL to reach the revalidation path at all.
const RealDate = globalThis.Date;
let clockOffsetMs = 0;
class FakeDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [RealDate.now() + clockOffsetMs])); }
  static now() { return RealDate.now() + clockOffsetMs; }
}
globalThis.Date = FakeDate;

const { default: handler } = await import('../api/public-content.ts');
const { listSnapshot } = await import('../api/_supabase.ts');
const savedFetch = globalThis.fetch, savedError = console.error;
const envKeys = ['NOTION_SECRET', 'NOTION_DB_CONTENT', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const savedEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
after(() => { hooks.deregister(); globalThis.Date = RealDate; globalThis.fetch = savedFetch; console.error = savedError;
  for (const k of envKeys) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; } });

function page(id, name) {
  return { id, properties: {
    Name: { title: [{ plain_text: name }] },
    Link: { url: 'https://example.invalid/x' },
    'Content Type': { select: { name: 'Episode' } },
    'Publish Date': { date: { start: '2026-10-01' } },
    Where: { select: { name: 'Spotify' } },
    Tag: { select: { name: 'reflection' } },
    Status: { select: { name: 'Published' } },
    Audience: { select: { name: 'Public' } },
    'Final?': { checkbox: true },
  } };
}
function notionResponse(results, hasMore, cursor) {
  return { ok: true, status: 200, json: async () => ({ results, has_more: hasMore, next_cursor: cursor }), text: async () => '' };
}
async function invoke() {
  process.env.NOTION_SECRET = 'synthetic'; process.env.NOTION_DB_CONTENT = 'db-fixture';
  const logs = [];
  console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  const res = { code: 200, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; return this; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: 'GET', headers: {} }, res);
  return { code: res.code, body: res.body, logs };
}

test('cold cache + provider failure: 503, and the failure class is logged (F-SWEEP2-3)', async () => {
  globalThis.fetch = async () => { throw new Error('notion unreachable (fixture)'); };
  const r = await invoke();
  assert.equal(r.code, 503);
  assert.ok(r.logs.some(l => l.includes('[cms] revalidation failed') && l.includes('notion unreachable')), 'log names the failure class');
});

test('cold cache + endless has_more: the truncated partial is refused, 503, truncation logged (F-SWEEP2-4)', async () => {
  globalThis.fetch = async () => notionResponse([page('p1', '[ ] fixture one')], true, 'cursor-x');
  const r = await invoke();
  assert.equal(r.code, 503);
  assert.ok(r.logs.some(l => l.includes('truncated at the 10-page cap')), 'log names the truncation class');
});

test('success warms the cache: 200 from notion with the projected items', async () => {
  globalThis.fetch = async () => notionResponse([page('p1', '[ ] fixture one'), page('p2', '[ ] fixture two')], false, null);
  const r = await invoke();
  assert.equal(r.code, 200);
  assert.equal(r.body.source, 'notion');
  assert.equal(r.body.count, 2);
  globalThis.__releaseId = r.body.releaseId;
});

test('warm cache + provider failure: last-good serves (behavior unchanged) and the failure is logged', async () => {
  clockOffsetMs = 61_000; // past the 60s TTL: the next reads revalidate
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' });
  const r = await invoke();
  assert.equal(r.code, 200);
  assert.equal(r.body.source, 'last-good');
  assert.equal(r.body.releaseId, globalThis.__releaseId);
  assert.ok(r.logs.some(l => l.includes('[cms] revalidation failed') && l.includes('Notion query failed: 500')));
});

test('warm cache + truncation attempt: the partial never replaces last-good', async () => {
  globalThis.fetch = async () => notionResponse([page('p9', '[ ] partial row')], true, 'cursor-y');
  const r = await invoke();
  assert.equal(r.code, 200);
  assert.equal(r.body.source, 'last-good');
  assert.equal(r.body.releaseId, globalThis.__releaseId);
  assert.equal(r.body.count, 2);
  assert.ok(r.logs.some(l => l.includes('truncated at the 10-page cap')));
});

// ── listSnapshot pagination (F-SWEEP2-4) ─────────────────────────────
function supaStub(pages) {
  process.env.SUPABASE_URL = 'https://fixture.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const offset = Number(new URL(String(url)).searchParams.get('offset') ?? 0);
    const rows = pages[offset / 1000] ?? [];
    return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
  };
  return calls;
}
const snapRow = i => ({ page_id: `pg-${String(i).padStart(5, '0')}`, row: { Name: `[ ] row ${i}` }, last_edited: null, sync_version: 1 });

test('listSnapshot pages by offset until a short page, returning every row', async () => {
  const full = Array.from({ length: 1000 }, (_, i) => snapRow(i));
  const tail = [snapRow(1000), snapRow(1001), snapRow(1002)];
  const calls = supaStub([full, tail]);
  const rows = await listSnapshot('PEOPLE');
  assert.equal(rows.length, 1003);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('offset=1000'));
});

test('listSnapshot refuses loudly past the safety cap instead of truncating silently', async () => {
  const full = Array.from({ length: 1000 }, (_, i) => snapRow(i));
  supaStub(Array.from({ length: 60 }, () => full));
  await assert.rejects(() => listSnapshot('PEOPLE'), /exceeded the 50000-row safety cap/);
});
