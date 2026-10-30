// Ledger-leg driver (G-02 QA FAIL fix, 2026-10-27) — NOT a node --test file.
//
// Proves the fix at both call sites: when a source's sync defers because
// another run holds its lease, NO [sync-ledger] run record is written —
// a deferral must not land in the ledger as an ordinary ok run carrying
// the mirrored row count. The honest surfaces remain: the console
// "deferred source=X (lease held)" lines, the { deferred: true } webhook
// response, and reconcile's deferredSources list.
//
// Compiles the real api graph with the repo's tsc (the node --test
// harness cannot resolve the engine's `.js` cross-imports) and drives
// the REAL webhook + reconcile handlers against a fake PostgREST where
// every source's lease is held by another run. Positive-path recording
// (a real sync writes a record) is covered by the engine driver and QA's
// production checks; this driver's scope is the ledger leg only.
//
// Run: node tests/sync-lease-ledger.driver.mjs   (exit 0 = PASS)

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://store.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
process.env.NOTION_SECRET = 'synthetic-notion-secret';
process.env.NOTION_WEBHOOK_SECRET = 'driver-webhook-secret';
process.env.CRON_SECRET = 'driver-cron-secret';
for (const s of ['PEOPLE', 'FLOWS', 'MOVES', 'CONTENT', 'MONEY']) {
  process.env[`NOTION_DB_${s}`] = `db-${s.toLowerCase()}`;
}

const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60_000).toISOString();
const rowFor = (source) => ({
  source,
  sync_version: 5,
  last_event_at: FIVE_MIN_AGO,
  last_event_id: null,
  last_sync_started_at: FIVE_MIN_AGO,
  last_sync_ok_at: FIVE_MIN_AGO,
  dirty: false,
  pending_entity_ids: [],
  last_error: null,
  updated_at: FIVE_MIN_AGO,
  lease_owner: 'other-run',
  lease_epoch: 3,
  lease_expires_at: '2999-01-01T00:00:00.000Z',
});

let notionCalls = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.hostname === 'api.notion.com') {
    notionCalls += 1;
    return new Response('{"object":"error"}', { status: 500 });
  }
  if (u.pathname.endsWith('/sync_delivery_state')) {
    const source = u.searchParams.get('source')?.replace('eq.', '') ?? 'content';
    if (init.method === 'PATCH') {
      // Lease acquire (epoch-pinned CAS): held lease -> no row matches.
      if (u.search.includes('lease_epoch=eq.')) {
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify([rowFor(source)]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (init.method === 'POST') {
      return new Response(JSON.stringify([rowFor(source)]), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify(rowFor(source)), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.pathname.endsWith('/sync_snapshots')) {
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

const lines = [];
const realLog = console.log;
console.log = (...args) => { lines.push(args.join(' ')); };

const outDir = mkdtempSync(join(tmpdir(), 'lease-ledger-'));
execFileSync(
  'npx',
  ['tsc', 'api/notion-webhook.ts', 'api/reconcile.ts',
   '--outDir', outDir, '--rootDir', 'api',
   '--module', 'nodenext', '--target', 'es2022',
   '--moduleResolution', 'nodenext', '--skipLibCheck'],
  { stdio: 'pipe' },
);
const webhook = (await import(join(outDir, 'notion-webhook.js'))).default;
const reconcile = (await import(join(outDir, 'reconcile.js'))).default;

const mockRes = () => ({
  statusCode: 0, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
  setHeader() {},
});

// --- Webhook: signed page event, source's lease held by another run ---
const payload = {
  type: 'page.properties_updated',
  id: 'evt-driver-1',
  entity: { id: 'page-driver-1', type: 'page' },
  timestamp: new Date().toISOString(),
  data: { parent: { database_id: 'db-content' } },
};
const raw = JSON.stringify(payload);
const sig = createHmac('sha256', 'driver-webhook-secret').update(raw).digest('hex');
lines.length = 0;
const wres = mockRes();
await webhook(
  { method: 'POST', headers: { 'x-notion-signature': sig }, body: raw },
  wres,
);
assert.equal(wres.statusCode, 200);
assert.equal(wres.body?.deferred, true, 'webhook answers deferred');
assert.ok(lines.some((l) => l.includes('deferred source=content')), 'deferred console line present');
assert.ok(!lines.some((l) => l.includes('[sync-ledger]')), 'NO ledger record on a webhook deferral');
realLog('PASS webhook: deferral writes no ledger record');

// --- Reconcile: every source's lease held ---
lines.length = 0;
const rres = mockRes();
await reconcile(
  { method: 'GET', headers: { authorization: 'Bearer driver-cron-secret' } },
  rres,
);
assert.equal(rres.statusCode, 200);
assert.equal(rres.body?.ok, true);
assert.deepEqual(
  [...(rres.body?.deferredSources ?? [])].sort(),
  ['content', 'flows', 'money', 'moves', 'openasks', 'people'],
  'all six sources reported deferred',
);
assert.equal(lines.filter((l) => l.includes('[reconcile] deferred source=')).length, 6, 'six deferred console lines');
assert.ok(!lines.some((l) => l.includes('[sync-ledger]')), 'NO ledger record when every source defers');
realLog('PASS reconcile: all-deferred tick writes no ledger record');

assert.equal(notionCalls, 0, 'deferred paths never call Notion');
realLog('PASS: zero Notion calls across both deferred paths');
console.log = realLog;
