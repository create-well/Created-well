// Register 1381 (QA ruling on the 1380 observation) — the armed
// "Confirm delete" state colored its label and border #FF453A at
// 0.72rem: 3.41:1 on white, 2.39:1 on the darkest theme card —
// under the small-text bar on every theme. A control's label is
// text, not an accent; this page's error lines were charged and
// fixed on the same numbers (register 1343). The armed state now
// takes the same AA red, #B3261E (4.59:1 worst-theme), label and
// border together so the treatment stays coherent. The urgency
// 'now' accent keeps #FF453A — it is an accent, and it stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src/app/pages/DecisionsPage.tsx'), 'utf8');

test('the armed confirm state uses the AA red for label and border', () => {
  assert.ok(page.includes("color: confirmingDelete ? '#B3261E' : 'var(--text-muted)'"));
  assert.ok(page.includes("border: confirmingDelete ? '1px solid #B3261E' : '1px solid transparent'"));
  assert.ok(!page.includes("confirmingDelete ? '#FF453A'"));
  assert.ok(!page.includes("'1px solid #FF453A'"));
});

test('the urgency accent keeps its red (accent, not text)', () => {
  assert.ok(page.includes("'now': '#FF453A'"));
});
