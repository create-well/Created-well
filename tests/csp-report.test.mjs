// CSP violation collector (2026-11-13): the pure ring core, the KV
// store shape, and the route's named posture — both report shapes
// accepted, wrong content types rejected, oversize refused, dedupe
// increments, the cap holds, and nothing is ever reflected.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';

// The api modules import their siblings as `.js` (the Vercel
// convention); a narrow resolver maps those to the `.ts` sources, as
// the dashboard-fanout test does. Requires --experimental-strip-types.
if (!process.execArgv.includes('--experimental-strip-types')) {
  throw new Error('run csp-report test with --experimental-strip-types');
}
nodeModule.registerHooks({
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

const {
  CSP_RING_CAP,
  extractLegacyReport,
  extractReportingApiReports,
  extractReports,
  mergeSamples,
  validateRing,
} = await import('../api/_csp-reports.ts');
const { createSupabaseCspReportStore, CSP_REPORTS_KEY } = await import('../api/_csp-report-store.ts');
const { handleCspReport, MAX_BODY_BYTES } = await import('../api/csp-report.ts');

const T1 = '2026-11-13T16:00:00.000Z';
const T2 = '2026-11-13T16:05:00.000Z';

const legacyPayload = {
  'csp-report': {
    'document-uri': 'https://dash.cr8w.com/money?token=secret',
    'blocked-uri': 'https://evil.example.com/x.png?sig=abc#frag',
    'effective-directive': 'img-src',
    'violated-directive': "img-src 'self'",
    disposition: 'report',
    'status-code': 200,
    referrer: 'https://dash.cr8w.com/',
  },
};

test('legacy extraction keeps the minimum set and strips query + fragment', () => {
  const [sample] = extractLegacyReport(legacyPayload);
  assert.equal(sample.directive, 'img-src');
  assert.equal(sample.blockedUri, 'https://evil.example.com/x.png');
  assert.equal(sample.blockedHost, 'evil.example.com');
  assert.equal(sample.documentUri, 'https://dash.cr8w.com/money');
  assert.equal(sample.disposition, 'report');
  assert.equal(sample.statusCode, 200);
});

test('legacy extraction falls back to the violated directive first token; missing wrapper yields nothing', () => {
  const [sample] = extractLegacyReport({
    'csp-report': { 'violated-directive': "script-src 'self'", 'blocked-uri': 'inline' },
  });
  assert.equal(sample.directive, 'script-src');
  assert.equal(sample.blockedHost, 'inline');
  assert.equal(sample.statusCode, 0);
  assert.deepEqual(extractLegacyReport({ nope: true }), []);
  assert.deepEqual(extractLegacyReport(null), []);
});

test('reporting api extraction maps camelCase, skips other report types, tolerates a bare object', () => {
  const samples = extractReportingApiReports([
    {
      type: 'csp-violation',
      url: 'https://dash.cr8w.com/',
      body: {
        blockedURL: 'https://cdn.other.net/a.js',
        effectiveDirective: 'script-src',
        disposition: 'report',
        statusCode: 200,
      },
    },
    { type: 'network-error', body: { blockedURL: 'https://x.example/' } },
  ]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].directive, 'script-src');
  assert.equal(samples[0].blockedHost, 'cdn.other.net');
  assert.equal(samples[0].documentUri, 'https://dash.cr8w.com/');
  const [bare] = extractReportingApiReports({
    body: { blockedURL: 'data:text/plain;base64,AAAA', effectiveDirective: 'font-src' },
  });
  assert.equal(bare.blockedHost, 'data');
  assert.deepEqual(extractReports(legacyPayload).length, 1);
  assert.deepEqual(extractReports('a string'), []);
});

test('merge dedupes by directive + blocked host: hits increment, firstSeen holds, sample refreshes', () => {
  const [a] = extractLegacyReport(legacyPayload);
  const [b] = extractLegacyReport({
    'csp-report': {
      'document-uri': 'https://dash.cr8w.com/flows',
      'blocked-uri': 'https://evil.example.com/y.png',
      'effective-directive': 'img-src',
      'status-code': 200,
    },
  });
  let ring = mergeSamples({ entries: [] }, [a], T1);
  ring = mergeSamples(ring, [b], T2);
  assert.equal(ring.entries.length, 1);
  assert.equal(ring.entries[0].hits, 2);
  assert.equal(ring.entries[0].firstSeen, T1);
  assert.equal(ring.entries[0].lastSeen, T2);
  assert.equal(ring.entries[0].blockedUri, 'https://evil.example.com/y.png');
  const [other] = extractLegacyReport({
    'csp-report': { 'blocked-uri': 'https://else.example.net/z.png', 'effective-directive': 'img-src' },
  });
  ring = mergeSamples(ring, [other], T2);
  assert.equal(ring.entries.length, 2);
});

test('the cap holds: a flood of distinct pairs evicts the least-recently-seen', () => {
  let ring = { entries: [] };
  for (let i = 0; i < CSP_RING_CAP + 5; i += 1) {
    const [sample] = extractLegacyReport({
      'csp-report': {
        'blocked-uri': `https://h${i}.example.com/x`,
        'effective-directive': 'img-src',
      },
    });
    ring = mergeSamples(ring, [sample], `2026-11-13T16:${String(i % 60).padStart(2, '0')}:00.000Z`);
  }
  assert.equal(ring.entries.length, CSP_RING_CAP);
});

test('validateRing is tolerant: garbage decodes empty, a stored ring round-trips', () => {
  assert.deepEqual(validateRing('not json'), { entries: [] });
  assert.deepEqual(validateRing(42), { entries: [] });
  const [sample] = extractLegacyReport(legacyPayload);
  const ring = mergeSamples({ entries: [] }, [sample], T1);
  const back = validateRing(JSON.parse(JSON.stringify(ring)));
  assert.equal(back.entries.length, 1);
  assert.equal(back.entries[0].hits, 1);
  assert.equal(back.entries[0].blockedHost, 'evil.example.com');
});

test('the store reads an absent key as an empty ring and upserts under cr8w_csp_reports', async () => {
  let captured = null;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: async (row) => {
        captured = row;
        return { error: null };
      },
    }),
  };
  const store = createSupabaseCspReportStore(() => client);
  assert.deepEqual(await store.read(), { entries: [] });
  await store.write({ entries: [] });
  assert.equal(captured.key, CSP_REPORTS_KEY);
  assert.equal(CSP_REPORTS_KEY, 'cr8w_csp_reports');
});

// ── Route posture ─────────────────────────────────────────────────

function makeReq({ method = 'POST', contentType = 'application/csp-report', body = '' } = {}) {
  return {
    method,
    headers: { 'content-type': contentType },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  };
}

function makeRes() {
  return {
    statusCode: null,
    headers: {},
    ended: false,
    reflected: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end() {
      this.ended = true;
    },
    json(body) {
      this.reflected = body;
    },
  };
}

function makeStore() {
  return {
    ring: { entries: [] },
    writes: 0,
    async read() {
      return JSON.parse(JSON.stringify(this.ring));
    },
    async write(ring) {
      this.writes += 1;
      this.ring = ring;
    },
  };
}

test('route: legacy POST folds into the ring at 204; a repeat increments the hit count', async () => {
  const store = makeStore();
  const body = JSON.stringify(legacyPayload);
  let res = makeRes();
  await handleCspReport(makeReq({ body }), res, store);
  assert.equal(res.statusCode, 204);
  assert.equal(res.reflected, null);
  assert.equal(store.ring.entries.length, 1);
  res = makeRes();
  await handleCspReport(makeReq({ body }), res, store);
  assert.equal(res.statusCode, 204);
  assert.equal(store.ring.entries.length, 1);
  assert.equal(store.ring.entries[0].hits, 2);
});

test('route: reporting api POST (and tolerated application/json) fold every report in the array', async () => {
  const store = makeStore();
  const body = JSON.stringify([
    { type: 'csp-violation', body: { blockedURL: 'https://a.example/x.js', effectiveDirective: 'script-src', documentURL: 'https://dash.cr8w.com/' } },
    { type: 'csp-violation', body: { blockedURL: 'https://b.example/y.css', effectiveDirective: 'style-src', documentURL: 'https://dash.cr8w.com/' } },
  ]);
  const res = makeRes();
  await handleCspReport(makeReq({ contentType: 'application/reports+json; charset=utf-8', body }), res, store);
  assert.equal(res.statusCode, 204);
  assert.equal(store.ring.entries.length, 2);
  const res2 = makeRes();
  await handleCspReport(makeReq({ contentType: 'application/json', body }), res2, store);
  assert.equal(res2.statusCode, 204);
  assert.equal(store.ring.entries[0].hits, 2);
});

test('route: non-POST is a 405 with Allow, wrong content type is a 415, neither writes', async () => {
  const store = makeStore();
  const resGet = makeRes();
  await handleCspReport(makeReq({ method: 'GET' }), resGet, store);
  assert.equal(resGet.statusCode, 405);
  assert.equal(resGet.headers.Allow, 'POST');
  const resType = makeRes();
  await handleCspReport(makeReq({ contentType: 'text/plain', body: 'hello' }), resType, store);
  assert.equal(resType.statusCode, 415);
  assert.equal(store.writes, 0);
});

test('route: an over-cap body is a 413 before parsing; a malformed body is a 204 that counts nothing', async () => {
  const store = makeStore();
  const big = 'x'.repeat(MAX_BODY_BYTES + 1);
  const resBig = makeRes();
  await handleCspReport(makeReq({ body: big }), resBig, store);
  assert.equal(resBig.statusCode, 413);
  const resBad = makeRes();
  await handleCspReport(makeReq({ body: '{not json' }), resBad, store);
  assert.equal(resBad.statusCode, 204);
  assert.equal(store.writes, 0);
});

test('route: a store failure still answers 204 and reflects nothing', async () => {
  const store = {
    async read() {
      throw new Error('kv down');
    },
    async write() {
      throw new Error('kv down');
    },
  };
  const res = makeRes();
  await handleCspReport(makeReq({ body: JSON.stringify(legacyPayload) }), res, store);
  assert.equal(res.statusCode, 204);
  assert.equal(res.reflected, null);
});
