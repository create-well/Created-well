// SA-1 (small-change half): the four simple security headers ride one
// vercel.json entry scoped to the shell (the SPA source pattern, API
// routes excluded). SA-1 remainder part 1 adds Content-Security-Policy-
// Report-Only to that same shell entry — report-only, never enforcing
// in this packet; the policy value is the build census of record (see
// sa1-csp-report-only-prep-2026-11-13). The split of record still
// holds for the rest: enforcing CSP and COOP/COEP join only on their
// own scored changes, so none of those keys may appear here.
// The CSP violation collector packet (2026-11-13) adds the reporting
// wiring to that same shell entry (Reporting-Endpoints header plus the
// report-to / report-uri directives on the policy) and carves the
// collector route out of the /api CORS entry's source, so the route
// carries no CORS grant; every other /api route's headers are
// unchanged in effect. Live header verification rides the landing
// audit (curl the shell).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cfg = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

const CSP_REPORT_ONLY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; media-src 'self' blob:; connect-src 'self' https://irtqcygriedvdijppntz.supabase.co wss://irtqcygriedvdijppntz.supabase.co https://www.googleapis.com https://oauth2.googleapis.com; frame-src https://calendar.google.com; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; report-to csp-endpoint; report-uri /api/csp-report";

test('the shell headers entry carries exactly the four SA-1 headers plus CSP report-only and its reporting wiring', () => {
  const entry = cfg.headers.find(h => h.source === '/((?!api/).*)');
  assert.ok(entry, 'shell headers entry exists');
  const map = Object.fromEntries(entry.headers.map(h => [h.key, h.value]));
  assert.deepEqual(map, {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy-Report-Only': CSP_REPORT_ONLY,
    'Reporting-Endpoints': 'csp-endpoint="/api/csp-report"',
  });
});

test('enforcing CSP and COOP/COEP are absent everywhere; CSP report-only rides the shell entry only', () => {
  const keys = cfg.headers.flatMap(e => e.headers.map(h => h.key));
  for (const banned of ['Content-Security-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy']) {
    assert.ok(!keys.includes(banned), `${banned} must not ride this change`);
  }
  const shell = cfg.headers.find(h => h.source === '/((?!api/).*)');
  assert.ok(
    shell.headers.some(h => h.key === 'Content-Security-Policy-Report-Only'),
    'CSP report-only must ride the shell entry',
  );
  const api = cfg.headers.find(h => h.source === '/api/((?!csp-report).*)');
  assert.ok(
    !api.headers.some(h => h.key === 'Content-Security-Policy-Report-Only'),
    'CSP report-only must not ride the /api entry',
  );
  assert.ok(
    !api.headers.some(h => h.key === 'Reporting-Endpoints'),
    'Reporting-Endpoints must not ride the /api entry',
  );
});

test('the /api CORS entry keeps its exact map, with the collector route carved out of its source', () => {
  const api = cfg.headers.find(h => h.source === '/api/((?!csp-report).*)');
  assert.ok(api, 'api headers entry exists with the carve-out source');
  assert.deepEqual(Object.fromEntries(api.headers.map(h => [h.key, h.value])), {
    'Access-Control-Allow-Origin': 'https://createdwell.vercel.app',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  // No headers entry of any kind may target the collector route.
  assert.ok(
    !cfg.headers.some(h => h.source === '/api/csp-report'),
    'no headers entry targets /api/csp-report',
  );
});

test('header source matching: the collector route matches no headers entry; other routes keep theirs', () => {
  const matches = (source, path) => new RegExp(`^${source}$`).test(path);
  const shell = cfg.headers.find(h => h.source === '/((?!api/).*)');
  const api = cfg.headers.find(h => h.source === '/api/((?!csp-report).*)');
  assert.equal(matches(shell.source, '/api/csp-report'), false, 'shell entry excludes /api');
  assert.equal(matches(api.source, '/api/csp-report'), false, 'collector route is carved out of the CORS entry');
  assert.equal(matches(api.source, '/api/public-content'), true, 'other /api routes keep the CORS entry');
  assert.equal(matches(api.source, '/api/server/money'), true, 'rewritten /api/server routes keep the CORS entry');
  assert.equal(matches(shell.source, '/'), true, 'shell entry still covers the shell');
  assert.equal(matches(shell.source, '/money'), true, 'shell entry still covers app routes');
});
