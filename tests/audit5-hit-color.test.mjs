// Audit-5 (register 1343) — two legs on Decisions + Money.
// HEIGHTS: the small-action pattern is standing across the app
// (Decisions card actions ~26px, the Money add controls under
// standard). Same class as the audit-3/4 sets: 44px hit areas,
// geometry invariants unmoved — here by honest box growth
// (minHeight) on form and card actions.
// COLOR: DecisionsPage's error text sat in #FF453A at 0.75rem —
// 2.39-3.41:1 across the four theme card backgrounds; error text
// is text and fails AA as text. It now uses #B3261E: 4.59:1 on the
// darkest theme card (#DDD8CA), 5.20-6.54:1 on the other themes
// and white — AA in all four themes. The urgency accent keeps
// #FF453A (an accent, per QA's disposition, stands). MoneyPage's
// two error lines carried the same hex in the same role via
// EXPENSE_COLOR and take the same shade at the line; EXPENSE_COLOR
// itself, which colors amounts as data, is untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const decisions = readFileSync(join(root, 'src/app/pages/DecisionsPage.tsx'), 'utf8');
const money = readFileSync(join(root, 'src/app/pages/MoneyPage.tsx'), 'utf8');

test('error text on both pages uses the AA shade, accents untouched', () => {
  assert.ok(!decisions.includes("color: '#FF453A', marginTop: 8"));
  assert.ok(!decisions.includes("color: '#FF453A' }}"));
  assert.ok(decisions.includes("'now': '#FF453A'"), 'urgency accent stands');
  assert.ok(!money.includes('color: EXPENSE_COLOR, marginTop: 8'));
  assert.ok(money.includes("const EXPENSE_COLOR = '#FF453A';"), 'data color stands');
});

test('the small actions on both pages carry the 44px box', () => {
  const d = decisions.match(/minHeight: 44/g) || [];
  const m = money.match(/minHeight: 44/g) || [];
  assert.ok(d.length >= 7, `Decisions actions (${d.length})`);
  assert.ok(m.length >= 4, `Money actions (${m.length})`);
});
