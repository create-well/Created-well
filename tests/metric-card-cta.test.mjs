// Register 1403 (audit #6 Q2, UX-ruled under the standing 1319
// classification) — a metric card's drill-down is its primary
// next step: button treatment (44px target, primaryText
// pairing), no opacity-faded action text. The card-shape legs
// read GeyserView and retire with it in the ghost cleanup
// (packet CC). What survives: the action class's button
// treatment of record in cr8w.css, which other surfaces using
// the class still rely on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');

test('the action class carries the button treatment of record', () => {
  const rule = css.match(/\.geyser-stat-action \{[^}]+\}/)?.[0] ?? '';
  assert.ok(rule.includes('min-height: 44px'));
  assert.ok(rule.includes('color: var(--cr8w-primary-text)'));
  assert.ok(rule.includes('border: 1.5px solid var(--cr8w-primary-text)'));
  assert.ok(!rule.includes('opacity'));
});
