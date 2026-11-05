// Fix 2 (Kimi support pass): SystemPage's architecture notes must match
// the wire vocabulary the API lane published (2026-11-05): the MOVES
// Status set is the five Notion values, stations/forum source labels
// name their real hubs, and /money is not read-only — the quick log
// creates (Received/Paid only). The /decisions line rides the same pass:
// it stopped being "not yet connected" when D-1b landed the KV resource.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/app/pages/SystemPage.tsx', import.meta.url), 'utf8');

test('MOVES status set is the published wire set', () => {
  assert.match(page, /Status: Now \/ Next \/ Done \/ Blocked \/ Dropped/);
  assert.doesNotMatch(page, /Not Started \/ In Progress \/ Done \/ Blocked/);
});

test('money line states the read + quick-log create truth', () => {
  assert.match(page, /dashboard read \+ quick-log create \(POST \/money, Received\/Paid only\)/);
  assert.doesNotMatch(page, /\(read-only\)/);
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

test('decisions line names the KV resource, not a pending connection', () => {
  assert.match(page, /cr8w_decisions KV resource/);
  assert.doesNotMatch(page, /not yet connected to Notion/);
});
