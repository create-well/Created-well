// Packet CC Map 2 — the five lying doors, fixed destinations.
// Before this packet every one of these controls dumped onto
// Today's task queue ('/#waiting') regardless of its label. One
// pin per door so the class cannot regress silently; the
// destinations are the program's settled calls (packet CC).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const drawer = readFileSync(join(root, 'src/app/components/MessageDrawer.tsx'), 'utf8');
const layout = readFileSync(join(root, 'src/app/RootLayout.tsx'), 'utf8');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');
const thisWeek = readFileSync(join(root, 'src/app/pages/ThisWeekPage.tsx'), 'utf8');
const panels = readFileSync(join(root, 'src/app/components/HomePanels.tsx'), 'utf8');

// Door 1 — the drawer's "Go to Flows" reaches Gatherings, where
// flows live (the Phase 0 redirect maps /flows there too).
test('door 1: "Go to Flows" routes to /gatherings', () => {
  assert.ok(drawer.includes("label: 'Go to Flows \\u2192'"));
  assert.match(layout, /onNavigateToFlows=\{\(\) => \{ navigate\('\/gatherings'\); \}\}/);
  assert.ok(drawer.includes('action: onNavigateToFlows || null'));
});

// Door 2 — the drawer's "Go to Stations" reaches the team surface;
// a Station is a person record.
test('door 2: "Go to Stations" routes to /people?tab=team', () => {
  assert.ok(drawer.includes("label: 'Go to Stations \\u2192'"));
  assert.match(layout, /onNavigateToStations=\{\(\) => \{ navigate\('\/people\?tab=team'\); \}\}/);
  assert.ok(drawer.includes('action: onNavigateToStations || null'));
});

// Door 3 — "Go to The Well" reaches the Well section's own anchor on
// Today, with hash-scroll handling mirroring #waiting.
test('door 3: "Go to The Well" routes to /#well and the anchor + scroll exist', () => {
  assert.ok(drawer.includes("label: 'Go to The Well \\u2192'"));
  assert.match(layout, /onNavigateToWell=\{\(\) => \{ navigate\('\/\#well'\); \}\}/);
  assert.ok(hub.includes('id="well"'));
  assert.match(panels, /location\.hash === '#waiting' \|\| location\.hash === '#well'/);
  assert.match(panels, /document\.getElementById\(anchor\.slice\(1\)\)\?\.scrollIntoView/);
});

// Door 4 — HubView's "Stations" tile reaches the team surface.
test('door 4: the HubView Stations tile routes to /people?tab=team', () => {
  assert.ok(hub.includes('onClick={() => onNavigateStations()}'));
  assert.match(thisWeek, /handleNavigateStations\(\) \{\s+navigate\('\/people\?tab=team'\);/);
});

// Door 5 — "Open Geyser" opens the event's own gathering; a
// title-only qualifier carries no record and renders no button.
test('door 5: "Open Geyser" opens the linked gathering, else no button', () => {
  assert.ok(hub.includes('onOpenGeyserGathering(ev.coFlowDate!.id)'));
  assert.match(thisWeek, /handleOpenGeyserGathering\(id: number\) \{\s+navigate\(`\/gatherings\/\$\{id\}`\);/);
  // The register-1378 qualification is unchanged; the button is
  // gated on a co-flow record existing.
  assert.match(hub, /\(\(ev\.coFlowDate && \(ev\.coFlowDate\.flowType === 'Geyser' \|\| ev\.coFlowDate\.theme === 'Geyser'\)\) \|\| \/\\bgeyser\\b\/i\.test\(ev\.title\)\) && ev\.coFlowDate && \(/);
  assert.ok(!hub.includes("onNavigate('geyser')"));
  assert.ok(!thisWeek.includes("geyser:"));
});
