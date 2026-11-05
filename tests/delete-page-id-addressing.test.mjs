// Closing-battery finding (rank B): deleting a payload-loaded Move
// after a reload always failed with "Delete not confirmed." The
// RR-004 client leg deliberately left deletes numeric because the
// server then covered PUT only; the server's page-id DELETE branch
// has since landed (archives a Notion-sourced record addressed by
// its page id), but the client never addressed deletes that way —
// it sent the stableId, which is not page-shaped, so tasks hit the
// server's standing 409. The fix routes all four dual-write deletes
// through the same writeAddress discipline as the updates and widens
// the API delete signatures to number | string. KV-only deletes
// (forum replies, coflow checkins) are untouched: they have no
// Notion page to address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAddress } from '../src/lib/pageIdAddressing.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = readFileSync(join(root, 'src/contexts/DashboardContext.tsx'), 'utf8');
const api = readFileSync(join(root, 'src/app/components/api.ts'), 'utf8');

test('a delete of a Notion-sourced record addresses its page id', () => {
  assert.equal(writeAddress({ id: 7, notionPageId: '2f3e8d70-aaaa' }, 7), '2f3e8d70-aaaa');
  assert.equal(writeAddress({ id: 7 }, 7), 7);
  assert.equal(writeAddress(undefined, 7), 7);
});

test('all four context deletes route through writeAddress', () => {
  assert.ok(ctx.includes('api.deleteTask(writeAddress(prior, id))'));
  assert.ok(ctx.includes('api.deleteStation(writeAddress('));
  assert.ok(ctx.includes('api.deleteForumPost(writeAddress('));
  assert.ok(ctx.includes('api.deleteCoFlowDate(writeAddress(d8, id))'));
});

test('the four API delete signatures accept string ids', () => {
  for (const fn of ['deleteTask', 'deleteStation', 'deleteForumPost', 'deleteCoFlowDate']) {
    assert.ok(api.includes(`export const ${fn} = (id: number | string)`), fn);
  }
});
