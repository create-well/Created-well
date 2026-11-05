// RR-004 client leg (shape A): Notion-sourced records of the four
// dual-write resources are written by page id, not by their numeric
// stableId hash (which the server cannot resolve and 404s silently);
// and no DashboardContext write failure is swallowed — every write
// handler's catch surfaces it, and optimistic applies roll back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writeAddress } from '../src/lib/pageIdAddressing.ts';

test('writeAddress prefers the page id, falls back to the numeric id', () => {
  const pageId = '12345678-1234-1234-1234-123456789abc';
  assert.equal(writeAddress({ id: 42, notionPageId: pageId }, 42), pageId);
  assert.equal(writeAddress({ id: 42 }, 42), 42);
  assert.equal(writeAddress(undefined, 42), 42);
});

test('the four dual-write update handlers address by page id', async () => {
  const ctx = await readFile(new URL('../src/contexts/DashboardContext.tsx', import.meta.url), 'utf8');
  assert.match(ctx, /api\.updateTask\(writeAddress\(prior, id\), updates\)/);
  assert.match(ctx, /api\.updateTask\(writeAddress\(prior, id\), \{ status \}\)/);
  assert.match(ctx, /api\.updateStation\(writeAddress\(prior, id\), \{ status \}\)/);
  assert.match(ctx, /api\.updateStation\(writeAddress\(prior, id\), \{ owner \}\)/);
  assert.match(ctx, /api\.updateStation\(writeAddress\(prior, id\), updates\)/);
  assert.match(ctx, /api\.updateForumPost\(writeAddress\(prior, id\), updates\)/);
  assert.match(ctx, /api\.updateCoFlowDate\(writeAddress\(prev, id\), updates\)/);
  // A page-addressed forum response must not overwrite the local numeric id.
  assert.match(ctx, /\{ \.\.\.updated, id \}/);
});

test('the api update functions accept a string (page id) address', async () => {
  const api = await readFile(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  for (const fn of ['updateTask', 'updateStation', 'updateForumPost', 'updateCoFlowDate']) {
    assert.match(api, new RegExp(`export const ${fn} = \\(id: number \\| string,`), fn);
  }
});

test('no write handler swallows its failure: every catch surfaces or rethrows', async () => {
  const ctx = await readFile(new URL('../src/contexts/DashboardContext.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ctx, /catch \(e\) \{ console\.error\('/, 'no single-line swallow catches remain');
  // The surfacing helper exists and carries the house copy.
  assert.match(ctx, /function saveFailed\(e: unknown, label: string\)/);
  assert.match(ctx, /showToast\('That did not save\. Try again\.', 'alert'\)/);
  // The messages write path (the FIX 3 residual shape) rolls back and surfaces.
  assert.match(ctx, /async updateMessageFields[\s\S]{0,420}?if \(prior\) setMessages/);
  assert.match(ctx, /async updateMessageFields[\s\S]{0,520}?saveFailed\(e, 'Update message fields error:'\)/);
});
