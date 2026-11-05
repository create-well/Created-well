// FIX 4 sweep, Class 1 A — realtime copy claims.
// Chat is KV-backed on a 60s poll floor (5m backoff): no realtime
// transport exists, so the onboarding card cannot claim "Real-time",
// and the flow reference cannot claim a 15-second autosync or
// automatic cross-device persistence. The copy now says what the
// system does: the page refreshes about every minute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const welcome = readFileSync(join(root, 'src/app/components/WelcomeModal.tsx'), 'utf8');
const flow = readFileSync(join(root, 'src/app/components/HowWeFlowReference.tsx'), 'utf8');

test('welcome modal makes no realtime claim for chat', () => {
  assert.ok(!welcome.includes('Real-time team messages'));
  assert.ok(welcome.includes('Team messages, system notifications, and well drops.'));
});

test('flow reference states the real refresh cadence', () => {
  assert.ok(!flow.includes('autosync runs every 15 s'));
  assert.ok(!flow.includes('persist across devices automatically'));
  assert.ok(flow.includes('refreshes about every minute'));
});
