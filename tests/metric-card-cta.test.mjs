// Register 1403 (audit #6 Q2, UX-ruled under the standing 1319
// classification) — a metric card's drill-down is its primary
// next step: it takes button treatment (44px target, primaryText
// pairing), the metric value stays non-interactive text, and the
// card does NOT become one big button. Before: two of the three
// Geyser metric cards were whole-card <button>s and the third a
// whole-card link, with the action rendered as a 60%-opacity
// span in the graphic primary. Now each card is a plain div and
// its single exit is a real button (or, for the external Drive
// folder, a button-treatment anchor). One button-weight action
// per card — the boundary the ruling names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/app/components/GeyserView.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');

test('no metric card is itself a button or a link', () => {
  assert.ok(!view.includes('<button className="geyser-stat-card"'));
  assert.ok(!view.includes('<button className="geyser-stat-card urgent"'));
  assert.ok(!view.includes('rel="noopener noreferrer" className="geyser-stat-card"'));
  assert.equal((view.match(/<div className="geyser-stat-card/g) || []).length, 3);
});

test('each drill-down is a real control carrying the navigation', () => {
  assert.ok(view.includes('<button type="button" className="geyser-stat-action" onClick={() => setActiveTab(\'stations\')}>View Stations →</button>'));
  assert.ok(view.includes('<button type="button" className="geyser-stat-action" onClick={() => setActiveTab(\'tasks\')}>View Moves →</button>'));
  assert.ok(view.includes('className="geyser-stat-action">CW Drive ↗</a>'));
  assert.equal((view.match(/geyser-stat-action/g) || []).length, 3);
});

test('the action class carries the button treatment of record', () => {
  const rule = css.match(/\.geyser-stat-action \{[^}]+\}/)?.[0] ?? '';
  assert.ok(rule.includes('min-height: 44px'));
  assert.ok(rule.includes('color: var(--cr8w-primary-text)'));
  assert.ok(rule.includes('border: 1.5px solid var(--cr8w-primary-text)'));
  assert.ok(!rule.includes('opacity'));
});
