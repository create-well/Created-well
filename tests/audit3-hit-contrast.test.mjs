// Audit-3 confirmed set (register 1317), three legs:
// 1. The sync timestamp label (.notion-sync-time) rendered the muted
//    token at opacity 0.7 — an effective 2.90-3.10:1, under AA. The
//    muted token passes at full strength (5.26-5.93:1); the opacity
//    is removed.
// 2. The OPEN link beside Sync Calendar (.hub-gcal-open) stood ~20px
//    tall. It now carries the 44px hit standard via min-height with
//    inline-flex centering; its type, color, and border are kept.
// 3. The Decomprocess cluster's History mini-button was a 26x26
//    target. Its box cannot grow — the landed F1b/Audit-2 clearance
//    geometry leaves a 12px gap to the scroll-top box, and the
//    clearance guard derives the cluster top from this button's
//    height. Instead an invisible in-button layer expands the
//    clickable area to exactly 44x44 (-12 top / -6 bottom / -9
//    sides), bounded so it crosses neither the scroll-top's bottom
//    edge nor the main FAB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');
const fab = readFileSync(join(root, 'src/app/components/DecomprocessFAB.tsx'), 'utf8');

test('the sync timestamp label carries no opacity discount', () => {
  const rule = css.match(/\.notion-sync-time \{[^}]*\}/)[0];
  assert.ok(!rule.includes('opacity'));
  assert.ok(rule.includes('color: var(--text-muted)'));
});

test('the OPEN link meets the 44px hit standard', () => {
  const rule = css.match(/\.hub-gcal-open \{[^}]*\}/)[0];
  assert.ok(rule.includes('min-height: 44px'));
  assert.ok(rule.includes('display: inline-flex'));
  assert.ok(rule.includes('align-items: center'));
});

test('the history button expands its hit area to 44x44 and keeps its 26px box', () => {
  assert.ok(fab.includes('top: -12, bottom: -6, left: -9, right: -9'));
  const i = fab.indexOf('title="decomprocess history"');
  const block = fab.slice(i, i + 400);
  assert.ok(/height:\s*26/.test(block));
});
