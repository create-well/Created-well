import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const configText = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
const config = JSON.parse(configText);

test('Vercel config declares both cron jobs in one top-level array', () => {
  assert.equal((configText.match(/"crons"\s*:/g) || []).length, 1);
  assert.deepEqual(config.crons, [
    { path: '/api/reconcile', schedule: '*/15 * * * *' },
    { path: '/api/server/workspace-sync', schedule: '0 9 * * *' },
  ]);
});
