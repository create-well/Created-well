// Fix 2 (Kimi support pass): SystemPage's architecture notes must match
// the wire vocabulary the API lane published (2026-11-05): the MOVES
// Status set is the five Notion values, stations/forum source labels
// name their real hubs, and /money is not read-only — the quick log
// creates (Received/Paid only). The /decisions line rides the same pass:
// it stopped being "not yet connected" when D-1b landed the KV resource.
// Rider (register 1621, 2026-11-13): MONEY A retired the quick log —
// POST /money returns 410 and money is logged in the "Create Well —
// Budget & P&L Bookkeeping" workbook; the money test below now pins
// that truth instead of the Fix 2 quick-log claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/pages/SystemPage.tsx', import.meta.url), 'utf8');

test('MOVES status set is the published wire set', () => {
  assert.match(page, /Status: Now \/ Next \/ Done \/ Blocked \/ Dropped/);
  assert.doesNotMatch(page, /Not Started \/ In Progress \/ Done \/ Blocked/);
});

test('money line states the workbook-fed truth: read only, quick log retired', () => {
  assert.match(page, /Create Well — Budget & P&L Bookkeeping workbook \(Transactions\) — cr8w_money KV feed; dashboard read only; quick log retired \(POST \/money returns 410, log money in the workbook\)/);
  assert.doesNotMatch(page, /quick-log create/);
});

test('stations and forum name their real source hubs', () => {
  assert.match(page, /label="Stations"[^>]*source="PEOPLE hub"/);
  assert.match(page, /label="Forum posts"[^>]*source="CONTENT hub"/);
});

test('NOTION_DB_LINKS point at the databases of record (API lane verified 2026-11-05)', () => {
  assert.match(page, /tasks:\s+'https:\/\/app\.notion\.com\/p\/0978d7ba16924fee8431bffd28eacce0'/);
  assert.match(page, /stations:\s+'https:\/\/app\.notion\.com\/p\/4b2a211c1dbc4c21af7953dfd6e0ff21'/);
  assert.match(page, /forum:\s+'https:\/\/app\.notion\.com\/p\/b9aa570c4072489e987ec3522a6a2b07'/);
  assert.match(page, /coFlowDates:\s+'https:\/\/app\.notion\.com\/p\/3cd37e7529604bc8b07d76d0c0089fd7'/);
  // The parallel-generation target shared by tasks/stations/forum is gone entirely.
  assert.doesNotMatch(page, /49faf1111bbe43458c3e6a4dcec63b5c/);
});

test('KV-owned collections carry no NOTION_DB_LINKS entry or href (exec decision, register 1168)', () => {
  const block = page.slice(page.indexOf('const NOTION_DB_LINKS'), page.indexOf('};', page.indexOf('const NOTION_DB_LINKS')));
  for (const key of ['messages', 'checkins', 'workshops', 'wellNotes', 'brainDumps', 'announcements']) {
    assert.doesNotMatch(block, new RegExp(`\\b${key}:`), `${key} must not be in the block`);
  }
  assert.doesNotMatch(page, /NOTION_DB_LINKS\.(messages|checkins|workshops|wellNotes|brainDumps|announcements)/);
  // The old parallel-generation targets those rows pointed at are gone from the file.
  assert.doesNotMatch(page, /81fc482da44d43cb9c426952654944ab/);
  assert.doesNotMatch(page, /08a0e011142a4512a3dc8075800db7db/);
  for (const label of ['Messages', 'Workshops', 'Check-ins', 'Well notes', 'Brain dumps', 'Announcements']) {
    assert.match(page, new RegExp(`label="${label}"[^>]*source="KV store"`), `${label} row`);
  }
});

test('decisions line names the KV resource, not a pending connection', () => {
  assert.match(page, /cr8w_decisions KV resource/);
  assert.doesNotMatch(page, /not yet connected to Notion/);
});
