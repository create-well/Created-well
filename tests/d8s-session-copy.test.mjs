// Register 1378 residual (QA's Leg B verdict) — CoFlowD8sView's
// session copy still named the whole class 'BHD' in three
// rendered strings: the RSVP banner, the check-in form's
// availability label, and the agenda lock banner. Each surface
// holds a specific session record, so each now names THAT
// record (coFlowTitle: its Name, else theme, else type). When
// the record is the BHD session, the copy reads as it did —
// from the record's own name, not a class hardcode. The banner's
// no-session fallback takes the class's generic word, 'session'.
//
// Phase 3 (packet M §4.1): CoFlowD8sView retired. The check-in
// copy's successor is the Team board (sessionTitle is the same
// rule under the rehouse name); the RSVP banner and agenda lock
// banner were dates-tab surfaces and retired with the view, so
// their assertions retire with them, named here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/app/components/people/TeamBoard.tsx'), 'utf8');

test('no rendered copy names the class BHD anymore', () => {
  assert.ok(!view.includes("'s BHD."));
  assert.ok(!view.includes('Availability for next BHD'));
  assert.ok(!view.includes('upcoming BHD'));
  assert.ok(!view.includes('before the next behind h0es doors'));
});

test('the rehoused check-in surfaces name their own session record', () => {
  assert.ok(view.includes('before the next {sessionTitle(nextD8)}'));
  assert.ok(view.includes('Availability for the next {sessionTitle(nextD8)}'));
  assert.ok(view.includes("if (!d8) return 'session'"));
});
