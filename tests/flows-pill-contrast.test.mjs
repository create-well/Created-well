// /flows pill contrast (UI design call 2026-11-05; registers 1339 +
// 1342) — the Moves badges and the Flow pill failed AA as small
// text (1.90-3.08:1) in iOS system hexes that are not CR8W colors,
// and Next/Dropped shared one fallback. Treatment: a deep-shade
// set held as --status-* custom properties (one home, cr8w.css),
// tints derived from each shade via color-mix at the existing
// alphas, the task row's left border in the shade. Blocked alone
// renders SOLID (rust-deep fill, cream text — the verified 5.76
// pairing): louder in kind, not in volume (register 1342).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/app/components/CommunityEventsView.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');

test('the shade set lives in one place with the called values', () => {
  for (const [name, hex] of [
    ['--status-blocked', '#964226'], ['--status-now', '#7F5008'],
    ['--status-done', '#295E53'], ['--status-next', '#6E5B3E'],
    ['--status-dropped', '#635672'], ['--status-archived', '#6E5546'],
  ]) {
    assert.ok(new RegExp(name + ':\\s+' + hex + ';').test(css), name);
  }
});

test('the iOS system hexes are gone from the component', () => {
  assert.ok(!view.includes('#FF9F0A'));
  assert.ok(!view.includes('#30D158'));
  assert.ok(!view.includes('#FF453A'));
});

// The Moves-tab row legs retired with the tab (packet CC leg C3):
// the solid-blocked treatment and the statusColor tint derivation
// lived in MovesTab's row markup. The shade set, the iOS-hex
// absence, and the surviving FlowCard pill stay pinned.

test('the flow pill keys text and tint to the done/archived shades', () => {
  assert.ok(view.includes("'var(--status-archived)' : 'var(--status-done)'"));
  assert.ok(view.includes('color-mix(in srgb, ${shade} 12%, transparent)'));
});
