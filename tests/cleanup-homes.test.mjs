// Packet CC — duplicate homes resolved (Monny, "Resolve all",
// 2026-11-19): tasks are homed on Today, and FLOWS is the
// workshops store of record. One pin per settled call so the
// cleanup cannot regress silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cev = readFileSync(join(root, 'src/app/components/CommunityEventsView.tsx'), 'utf8');
const flowsPage = readFileSync(join(root, 'src/app/pages/FlowsPage.tsx'), 'utf8');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');
const thisWeek = readFileSync(join(root, 'src/app/pages/ThisWeekPage.tsx'), 'utf8');

// Pin 1 — the Gatherings Moves tab is gone, and an unknown ?tab=
// arrival falls back to the default tab instead of a blank.
test('the Moves tab is retired and the tab fallback holds', () => {
  assert.ok(!cev.includes("'moves'"));
  assert.ok(!cev.includes("key: 'moves'"));
  assert.ok(!cev.includes("activeTab === 'moves'"));
  assert.ok(!cev.includes('function MovesTab'));
  assert.ok(!cev.includes('MovesTab'));
  // Fallback: FlowsPage admits only ?tab=workshops; every other
  // value (including the retired 'moves') resolves to the default.
  assert.ok(flowsPage.includes("tabParam === 'workshops' ? 'workshops' : undefined"));
  assert.ok(cev.includes("useState<Tab>(defaultTab)"));
});

// Pin 2 — HubView's workshops card reads FLOWS, never the KV menu:
// the workshops prop is gone from the interface, the destructure,
// and ThisWeekPage's pass, and the card derives from coFlowDates
// with the Gatherings rule.
test('HubView no longer consumes the KV workshops prop', () => {
  assert.ok(!hub.includes('workshops?: Workshop[]'));
  assert.ok(!hub.includes('workshops = []'));
  assert.ok(!thisWeek.includes('workshops={data.workshops}'));
  assert.ok(!hub.includes('matchesCategory'));
  assert.ok(hub.includes("import { isWorkshop, seriesOf } from '../../lib/flows'"));
  assert.match(hub, /const upcoming = coFlowDates\s+\.filter\(f => isWorkshop\(f\) && seriesOf\(f\) !== 'SLO Create'\)/);
  // The KV workshop type no longer feeds the file's type import.
  assert.doesNotMatch(hub, /import type \{[^}]*\bWorkshop\b/);
});
