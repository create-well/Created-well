// FIX 4 sweep, Class 4 — dead surface removal.
// Four components had zero importers anywhere in src (their only
// textual mentions live in the sealed src/imports snapshot and, for
// ContentFlowPanel, in two tests asserting its old wiring is ABSENT
// — those tests keep passing). COMMUNITY_EVENT_TYPES and its derived
// type were referenced only by their own definitions. The App.tsx
// leg renames a garbled identifier (isFiisFirstPstPartyrty) to what
// it checks: first-party hosts.
// NOT in this packet: the MILESTONES export. The sweep called it
// dead; it is not — PersonView imports and renders it. That is a
// separate finding, filed with its own evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the four unimported components are gone', () => {
  for (const f of ['WorkshopsView.tsx', 'PlaygroundView.tsx', 'LoginGate.tsx', 'ContentFlowPanel.tsx']) {
    assert.equal(existsSync(join(root, 'src/app/components', f)), false, f);
  }
});

test('the unused event-types export and type are gone', () => {
  const data = readFileSync(join(root, 'src/app/components/data.ts'), 'utf8');
  assert.ok(!data.includes('COMMUNITY_EVENT_TYPES'));
  assert.ok(!data.includes('CommunityEventType'));
});

test('the garbled identifier is renamed', () => {
  const app = readFileSync(join(root, 'src/app/App.tsx'), 'utf8');
  assert.ok(!app.includes('isFiisFirstPstPartyrty'));
  assert.ok(app.includes('isFirstPartyHost'));
});
