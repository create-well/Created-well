// OPT-1 + OPT-2 (2026-11-04): the CMS manifest's durable tier.
// Packet: cms-manifest-kv-persistence-packet-2026-11-04.md, QA legs
// Q-1..Q-4 + the OPT-2 header assertion (Q-5's wire probe is a
// post-deploy leg, not a unit leg).
//   Q-1 validateManifest shapes + store round-trip via a fake client
//   Q-2 cold start + stored manifest + Notion down serves last-good,
//       never a 503; cold + empty store + Notion down stays 503
//   Q-3 store throwing on read and write degrades to Phase 1 behavior
//   Q-4 a successful revalidation writes exactly the served manifest;
//       a truncated revalidation writes nothing
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

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

const RealDate = globalThis.Date;
let clockOffsetMs = 0;
class FakeDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [RealDate.now() + clockOffsetMs])); }
  static now() { return RealDate.now() + clockOffsetMs; }
}
globalThis.Date = FakeDate;

const { validateManifest, createManifestCache } = await import('../api/_cms-projection.ts');
const { createSupabaseManifestStore, CMS_MANIFEST_KEY } = await import('../api/_cms-manifest-store.ts');
const { createPublicContentHandler } = await import('../api/public-content.ts');

const savedFetch = globalThis.fetch, savedError = console.error;
const envKeys = ['NOTION_SECRET', 'NOTION_DB_CONTENT', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const savedEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
after(() => { hooks.deregister(); globalThis.Date = RealDate; globalThis.fetch = savedFetch; console.error = savedError;
  for (const k of envKeys) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; } });
console.error = () => {}; // the failure-path logs are behavior, not test output

const item = { name: 'Ep', link: 'https://example.invalid/x', contentType: 'Episode', publishDate: '2026-10-01', where: 'Spotify', tag: 'reflection' };
const manifestAt = (ageMs) => ({ releaseId: 'stored-1', generatedAt: new Date(Date.now() - ageMs).toISOString(), items: [item] });

test('Q-1 validateManifest accepts exactly manifest-shaped values', () => {
  const good = manifestAt(0);
  assert.deepEqual(validateManifest(good), good);
  assert.equal(validateManifest(null), null);
  assert.equal(validateManifest([]), null);
  assert.equal(validateManifest('x'), null);
  assert.equal(validateManifest({ ...good, releaseId: '' }), null);
  assert.equal(validateManifest({ ...good, releaseId: 7 }), null);
  assert.equal(validateManifest({ ...good, generatedAt: 'not-a-date' }), null);
  assert.equal(validateManifest({ ...good, items: {} }), null);
  assert.equal(validateManifest({ ...good, items: [{ ...item, extra: 'no' }] }), null);
  const missing = { ...item }; delete missing.tag;
  assert.equal(validateManifest({ ...good, items: [missing] }), null);
  assert.equal(validateManifest({ ...good, items: [{ ...item, name: 3 }] }), null);
  assert.equal(validateManifest({ ...good, items: [{ ...item, tag: 3 }] }), null);
  assert.deepEqual(validateManifest({ ...good, items: [{ ...item, tag: null }] }).items[0].tag, null);
});

test('Q-1 cache hydrate installs a stored manifest once, single-flight', async () => {
  let reads = 0;
  const store = { read: async () => { reads += 1; return manifestAt(0); }, write: async () => {} };
  const cache = createManifestCache(60_000, store);
  const [a, b] = await Promise.all([cache.hydrate(), cache.hydrate()]);
  assert.equal(a, true); assert.equal(b, true); assert.equal(reads, 1);
  assert.equal(cache.current()?.releaseId, 'stored-1');
  cache.replace([item], new Date());
  assert.equal(await cache.hydrate(), false); // non-empty caches never re-hydrate
  assert.equal(reads, 1);
});

test('Q-3 cache hydrate and persist never throw on store failure', async () => {
  const store = { read: async () => { throw new Error('kv down'); }, write: async () => { throw new Error('kv down'); } };
  const cache = createManifestCache(60_000, store);
  assert.equal(await cache.hydrate(), false);
  assert.equal(cache.current(), null);
  cache.replace([item], new Date());
  await cache.persist(); // resolves despite the throwing write
});

test('Q-1 hydrate timeout degrades to absent instead of hanging', async () => {
  const store = { read: () => new Promise(() => {}), write: async () => {} };
  const cache = createManifestCache(60_000, store, 25);
  assert.equal(await cache.hydrate(), false);
});

test('retry-once: a store read that throws once hydrates on the retry', async () => {
  let reads = 0;
  const store = { read: async () => { reads += 1; if (reads === 1) throw new Error('kv down'); return manifestAt(0); }, write: async () => {} };
  const cache = createManifestCache(60_000, store, 25);
  assert.equal(await cache.hydrate(), true);
  assert.equal(reads, 2);
  assert.equal(cache.current()?.releaseId, 'stored-1');
});

test('retry-once: a persistently throwing store is read exactly twice, then degrades', async () => {
  let reads = 0;
  const store = { read: async () => { reads += 1; throw new Error('kv down'); }, write: async () => {} };
  const cache = createManifestCache(60_000, store, 25);
  assert.equal(await cache.hydrate(), false);
  assert.equal(reads, 2);
  assert.equal(cache.current(), null);
});

test('retry-once: an empty store is a definitive answer and is never retried', async () => {
  let reads = 0;
  const store = { read: async () => { reads += 1; return null; }, write: async () => {} };
  const cache = createManifestCache(60_000, store, 25);
  assert.equal(await cache.hydrate(), false);
  assert.equal(reads, 1);
});

test('retry-once: a timed-out read is retried and can still hydrate', async () => {
  let reads = 0;
  const store = { read: () => { reads += 1; return reads === 1 ? new Promise(() => {}) : Promise.resolve(manifestAt(0)); }, write: async () => {} };
  const cache = createManifestCache(60_000, store, 25);
  assert.equal(await cache.hydrate(), true);
  assert.equal(reads, 2);
});

test('retry-once: two timed-out reads degrade after exactly two reads', async () => {
  let reads = 0;
  const store = { read: () => { reads += 1; return new Promise(() => {}); }, write: async () => {} };
  const cache = createManifestCache(60_000, store, 25);
  assert.equal(await cache.hydrate(), false);
  assert.equal(reads, 2);
});

test('Q-1 supabase store: round-trip, corrupt reads as absent, no-env degrades', async () => {
  let row = null;
  const fakeClient = () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      upsert: async (r) => { row = { value: r.value }; return { error: null }; },
    }),
  });
  const store = createSupabaseManifestStore(fakeClient);
  const m = manifestAt(0);
  await store.write(m);
  assert.deepEqual(await store.read(), m);
  row = { value: JSON.stringify(m) }; // text-stored JSON reads the same
  assert.deepEqual(await store.read(), m);
  row = { value: '{corrupt' };
  assert.equal(await store.read(), null);
  row = { value: { releaseId: 'x', generatedAt: 'nope', items: [] } };
  assert.equal(await store.read(), null);
  const noEnv = createSupabaseManifestStore(() => null);
  assert.equal(await noEnv.read(), null);
  await noEnv.write(m); // no-op, resolves
  const errStore = createSupabaseManifestStore(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'boom' } }) }) }),
      upsert: async () => ({ error: { message: 'boom' } }),
    }),
  }));
  await assert.rejects(() => errStore.read(), /boom/);
  await assert.rejects(() => errStore.write(m), /boom/);
  assert.equal(CMS_MANIFEST_KEY, 'cms_manifest');
});

// ── Handler level (Q-2, Q-3, Q-4, OPT-2 header) ─────────────────────
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
function notionOk(results) {
  return { ok: true, status: 200, json: async () => ({ results, has_more: false, next_cursor: null, data_sources: [{ id: 'ds-1' }] }), text: async () => '' };
}
function resStub() {
  return { code: null, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; },
    setHeader(k, v) { this.headers[k] = v; } };
}
function makeHandler(store) {
  return createPublicContentHandler(createManifestCache(60_000, store));
}
process.env.NOTION_SECRET = 'test-secret';
process.env.NOTION_DB_CONTENT = 'db-content';
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;

test('Q-2 cold start + stored manifest + Notion down serves last-good, not 503', async () => {
  globalThis.fetch = async () => { throw new Error('notion down'); };
  const staleStore = { read: async () => manifestAt(3_600_000), write: async () => {} };
  const res1 = resStub();
  await makeHandler(staleStore)({ method: 'GET' }, res1);
  assert.equal(res1.code, 200);
  assert.equal(res1.body.source, 'last-good');
  assert.equal(res1.body.freshness, 'Stale');
  assert.equal(res1.body.releaseId, 'stored-1');
  const freshStore = { read: async () => manifestAt(0), write: async () => {} };
  const res2 = resStub();
  await makeHandler(freshStore)({ method: 'GET' }, res2);
  assert.equal(res2.code, 200);
  assert.equal(res2.body.source, 'cache');
  assert.equal(res2.body.freshness, 'Fresh');
});

test('Q-2 cold start + empty store + Notion down stays the exact 503', async () => {
  globalThis.fetch = async () => { throw new Error('notion down'); };
  const emptyStore = { read: async () => null, write: async () => {} };
  const res = resStub();
  await makeHandler(emptyStore)({ method: 'GET' }, res);
  assert.equal(res.code, 503);
  assert.deepEqual(res.body, { error: 'projection unavailable' });
});

test('Q-4 revalidation writes exactly the served manifest; OPT-2 header asserted', async () => {
  const writes = [];
  const store = { read: async () => null, write: async (m) => { writes.push(m); } };
  globalThis.fetch = async () => notionOk([page('p1', 'Ep One')]);
  const res = resStub();
  await makeHandler(store)({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.source, 'notion');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].releaseId, res.body.releaseId);
  assert.equal(writes[0].generatedAt, res.body.generatedAt);
  assert.deepEqual(writes[0].items, res.body.items);
  assert.match(res.headers['Cache-Control'], /s-maxage=60/);
  assert.match(res.headers['Cache-Control'], /stale-while-revalidate=300/);
  assert.match(res.headers['Cache-Control'], /max-age=60/);
});

test('Q-4 truncated revalidation writes nothing and stays 503 when cold', async () => {
  const writes = [];
  const store = { read: async () => null, write: async (m) => { writes.push(m); } };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ results: [page('p', 'x')], has_more: true, next_cursor: 'c', data_sources: [{ id: 'ds-1' }] }), text: async () => '' });
  const res = resStub();
  await makeHandler(store)({ method: 'GET' }, res);
  assert.equal(res.code, 503);
  assert.equal(writes.length, 0);
});

test('Q-3 store throwing on read and write: full cycle matches Phase 1 behavior', async () => {
  const store = { read: async () => { throw new Error('kv down'); }, write: async () => { throw new Error('kv down'); } };
  const handler = makeHandler(store);
  globalThis.fetch = async () => notionOk([page('p1', 'Ep One')]);
  const res1 = resStub();
  await handler({ method: 'GET' }, res1);
  assert.equal(res1.code, 200); assert.equal(res1.body.source, 'notion');
  clockOffsetMs += 120_000; // past the TTL: next request revalidates
  globalThis.fetch = async () => { throw new Error('notion down'); };
  const res2 = resStub();
  await handler({ method: 'GET' }, res2);
  assert.equal(res2.code, 200); assert.equal(res2.body.source, 'last-good');
  clockOffsetMs = 0;
});
