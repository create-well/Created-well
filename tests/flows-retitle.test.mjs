// Registers 1428/1432 — the flows view carried the top tier's
// name. Monny's definition: Geyser is a TYPE of event, the
// annual culminating tier in the flows ladder; the word names
// that tier only. The general view now names the entity
// (UX ruling 1432): header "Flows", tablist "Flows views",
// drawer "Go to Flows ->". Flow-scoped surfaces would take the
// flow's own Name; no flow-scoped instance of these three
// surfaces exists. TRUE USES STAND, pinned below: the FLOWS
// Type value and the marking gate (Leg A), the gated Open
// Geyser button, HowWeFlowReference's descriptive copy. The
// drawer keyword leg, named: 'flow' joins the triggers; 'task'
// stays (it names what the board holds); 'geyser' stays as a
// trigger only — a message naming a real Geyser-tier flow
// still routes to the board that holds it, and the rendered
// label no longer borrows the tier's name. Component, prop,
// and CSS names are internal and unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/app/components/GeyserView.tsx'), 'utf8');
const drawer = readFileSync(join(root, 'src/app/components/MessageDrawer.tsx'), 'utf8');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');
const panels = readFileSync(join(root, 'src/lib/homePanels.ts'), 'utf8');

test('the view names the entity, not the tier', () => {
  assert.ok(view.includes('<div className="geyser-header-title">Flows</div>'));
  assert.ok(view.includes('aria-label="Flows views"'));
  assert.ok(!view.includes('<div className="geyser-header-title">Geyser</div>'));
  assert.ok(!view.includes('aria-label="Geyser views"'));
});

test('the drawer action follows the same name', () => {
  assert.ok(drawer.includes("label: 'Go to Flows \\u2192'"));
  assert.ok(!drawer.includes('Go to Geyser'));
  assert.ok(drawer.includes("lower.includes('flow')"));
});

test('true uses stand: the tier keeps its name where it is true', () => {
  // The marking gate keys on the FLOWS Type value 'Geyser'.
  assert.ok(panels.includes("flowType === 'Geyser'"));
  // The gated Open Geyser button label stands in HubView.
  assert.ok(hub.includes('Open Geyser'));
});
