// Audit-4 (register 1339) — /flows small controls under the 44px hit
// standard, measured by QA: member filter pills ~23px, tab buttons
// ~36px. Same discipline as the audit-3 set: boxes grow where the
// layout honestly allows (the tab strips), the hit area expands
// invisibly where it does not (the pills — growing their box would
// change the filter-row proportions QA cleared at size). No
// geometry invariant moves; the clearance guards are untouched.
// The pill COLORS are a separate UI-lane leg (contrast) and are not
// in this packet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/app/components/CommunityEventsView.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');

test('the tab strips carry a 44px box height', () => {
  const hits = view.match(/minHeight: 44,/g) || [];
  assert.ok(hits.length >= 2, 'main tabs and workshops sub-tabs');
});

test('the member filter pills take the hit layer, box unchanged', () => {
  assert.ok(view.includes('className="cr-hit44"'));
  assert.ok(view.includes("padding: '4px 10px',"));
});

test('the hit layer is a vertical-only 44px expansion', () => {
  assert.ok(css.includes('.cr-hit44 { position: relative; }'));
  assert.ok(css.includes('.cr-hit44::after'));
  assert.ok(css.includes('height: 44px'));
});
