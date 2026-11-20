// Honesty remainder (2026-11-19, branch feat/honesty-remainder):
// pins the truthful state for the four remainder legs.
//   1. Money — the net figure is labeled "Net to date" (it spans every
//      record in the cr8w_money slice; no packet defines a period), the
//      page maps stale → stale and its Retry is real, and the retired
//      Quick Log form code is gone (the server route still answers 410,
//      pinned by money-create.test.mjs, untouched here).
//   2. System — "Last sync" reads the sync ledger, the Care row reports
//      the consent census instead of dressing it as a permission, the
//      Build card names Vercel + Supabase KV (not "Supabase edge
//      functions"), the route source strings attribute KV slices to the
//      KV store, and the custom-domain row keys on dash.cr8w.com — the
//      domain the Vercel record shows assigned to this project.
//   3. Calendar connect — the two implementations and the ignored OAuth
//      token are documented as a gated finding; no behavior is pinned
//      here because no code changed.
//   4. Podyaps — one home: /podyaps redirects to /making and Making is
//      the PodyapsPage board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestSyncOkAt } from '../src/lib/syncLedger.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const money = read('src/app/pages/MoneyPage.tsx');
const system = read('src/app/pages/SystemPage.tsx');
const routes = read('src/app/routes.ts');

// ── Leg 1: Money honesty ─────────────────────────────────────────────────────

test('the net figure is labeled "Net to date", never "this period"', () => {
  assert.doesNotMatch(money, /Net this period/);
  assert.match(money, /Net to date/);
  assert.match(money, /Across every tracked record/);
});

test('Money maps stale to stale and its Retry is real', () => {
  assert.match(money, /data\.syncStatus === 'stale' \? 'stale' : 'fresh'/);
  assert.match(money, /onRetry=\{\(\) => actions\.retrySync\(\)\}/);
  assert.doesNotMatch(money, /onRetry=\{\(\) => \{\}\}/);
});

test('the retired Quick Log form code is gone from the page', () => {
  for (const dead of [
    'SHOW_QUICK_LOG', 'submitLog', 'Quick log', 'segmentStyle', 'fieldStyle',
    'buildMoneyPayload', 'localDateString', 'useRef', 'Logging…', 'labelRef',
  ]) {
    assert.ok(!money.includes(dead), `${dead} must be gone from MoneyPage`);
  }
});

// ── Leg 2: System contradictions ─────────────────────────────────────────────

test('"Last sync" reads the sync ledger, not the payload load time', () => {
  assert.match(system, /latestSyncOkAt\(data\.syncFreshness\)/);
  assert.match(system, /label="Last sync"/);
  assert.match(system, /'Not reported'/);
  // The load timestamp no longer stands in for a sync observation.
  assert.doesNotMatch(system, /lastSynced\.toLocaleTimeString/);
});

test('the Care row reports the census, never a permission grant', () => {
  assert.match(system, /label="Care consent census"/);
  assert.doesNotMatch(system, /Permissions: Care consent/);
  assert.doesNotMatch(system, /'Granted'/);
  assert.match(system, /consentGaps\} of \$\{data\.peopleCare\.total\} filed/);
});

test('the Build card names the real API surface', () => {
  assert.match(system, /Vercel serverless \(api\/\) \+ Supabase KV store/);
  assert.doesNotMatch(system, /Supabase edge functions/);
});

test('route source strings attribute KV slices to the KV store', () => {
  assert.ok(system.includes('MOVES (tasks) · PEOPLE (stations) · CONTENT (forum) · FLOWS (gatherings) · KV store (brain dumps · well notes · announcements · check-ins)'));
  assert.ok(system.includes('PEOPLE hub (people · stations · consent census) + KV store (check-ins)'));
  assert.ok(system.includes('CONTENT hub (production board · queues) + FLOWS (podyap sessions)'));
  assert.doesNotMatch(system, /Type: Podyap \(Status: Upcoming \/ Active \/ Archived\)/);
  assert.doesNotMatch(system, /API ID Registry/);
});

test('the custom-domain row keys on dash.cr8w.com', () => {
  assert.match(system, /const CUSTOM_DOMAIN = 'dash\.cr8w\.com'/);
  assert.match(system, /window\.location\.hostname === CUSTOM_DOMAIN/);
  assert.doesNotMatch(system, /Setting up — you're viewing via the direct link/);
});

// ── Leg 2 helper: latestSyncOkAt ─────────────────────────────────────────────

test('latestSyncOkAt: latest OK timestamp wins, absent and invalid do not', () => {
  assert.equal(latestSyncOkAt(null), null);
  assert.equal(latestSyncOkAt(undefined), null);
  assert.equal(latestSyncOkAt({ generatedAt: '2026-11-19T00:00:00Z', sources: {} }), null);
  const block = {
    generatedAt: '2026-11-19T12:00:00Z',
    sources: {
      moves:   { state: 'live',     lastEventAt: null, lastSyncOkAt: '2026-11-19T08:00:00Z', syncVersion: 3 },
      people:  { state: 'stale',    lastEventAt: null, lastSyncOkAt: '2026-11-18T22:30:00Z', syncVersion: 7 },
      content: { state: 'degraded', lastEventAt: null, lastSyncOkAt: null,                    syncVersion: 1 },
      events:  { state: 'unknown',  lastEventAt: null, lastSyncOkAt: 'not-a-date',            syncVersion: 0 },
    },
  };
  assert.equal(latestSyncOkAt(block)?.toISOString(), '2026-11-19T08:00:00.000Z');
});

// ── Leg 4: Podyaps has one home ──────────────────────────────────────────────

test('/podyaps redirects to /making and Making is the board page', () => {
  assert.match(routes, /\{ path: 'podyaps',\s+\.\.\.redirect\('\/making'\) \}/);
  assert.match(routes, /\{ path: 'making',\s+\.\.\.page\(\(\) => import\('\.\/pages\/PodyapsPage'\), 'PodyapsPage'\) \}/);
  // No standalone /podyaps page route — the redirect is the only podyaps path.
  const podyapRoutes = [...routes.matchAll(/path: '([^']*podyaps[^']*)'/g)].map(m => m[1]);
  assert.deepEqual(podyapRoutes, ['podyaps']);
});
