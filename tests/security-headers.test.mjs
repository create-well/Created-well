// SA-1 (small-change half): the four simple security headers ride one
// vercel.json entry scoped to the shell (the SPA source pattern, API
// routes excluded). The split of record is enforced here in test form:
// CSP ships separately (report-only first or its own scored change)
// and COOP/COEP join only if they verify clean, so none of those keys
// may appear in this change. The /api CORS entry must stay untouched.
// Live header verification rides the landing audit (curl the shell).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cfg = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

test('the shell headers entry carries exactly the four SA-1 headers', () => {
  const entry = cfg.headers.find(h => h.source === '/((?!api/).*)');
  assert.ok(entry, 'shell headers entry exists');
  const map = Object.fromEntries(entry.headers.map(h => [h.key, h.value]));
  assert.deepEqual(map, {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
});

test('CSP and COOP/COEP are absent everywhere in this change (split of record)', () => {
  const keys = cfg.headers.flatMap(e => e.headers.map(h => h.key));
  for (const banned of ['Content-Security-Policy', 'Content-Security-Policy-Report-Only', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy']) {
    assert.ok(!keys.includes(banned), `${banned} must not ride this change`);
  }
});

test('the /api CORS entry is unchanged', () => {
  const api = cfg.headers.find(h => h.source === '/api/(.*)');
  assert.ok(api, 'api headers entry exists');
  assert.deepEqual(Object.fromEntries(api.headers.map(h => [h.key, h.value])), {
    'Access-Control-Allow-Origin': 'https://createdwell.vercel.app',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
});
