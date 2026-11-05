// Register 1378 residual (QA's Leg B verdict) — CoFlowD8sView's
// session copy still named the whole class 'BHD' in three
// rendered strings: the RSVP banner, the check-in form's
// availability label, and the agenda lock banner. Each surface
// holds a specific session record, so each now names THAT
// record (coFlowTitle: its Name, else theme, else type). When
// the record is the BHD session, the copy reads as it did —
// from the record's own name, not a class hardcode. The banner's
// no-session fallback takes the class's generic word, 'session'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/app/components/CoFlowD8sView.tsx'), 'utf8');

test('no rendered copy names the class BHD anymore', () => {
  assert.ok(!view.includes("'s BHD."));
  assert.ok(!view.includes('Availability for next BHD'));
  assert.ok(!view.includes('upcoming BHD'));
  assert.ok(!view.includes('before the next behind h0es doors'));
});

test('each surface names its own session record', () => {
  assert.ok(view.includes("${coFlowTitle(nextD8)}"));
  assert.ok(view.includes("nextD8 ? coFlowTitle(nextD8) : 'session'"));
  assert.ok(view.includes('Agenda is locked for the upcoming {coFlowTitle(d8)}'));
  assert.ok(view.includes("before the next {nextD8 ? coFlowTitle(nextD8) : 'session'}"));
});
