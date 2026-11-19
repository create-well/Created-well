// Phase 3 alias-cut pin (packet M §4.6): 'playdate' no longer
// classifies a flow as a podyap. The live census carries zero rows
// on the alias (0 of 38, grounded 2026-11-15), so the cut's expected
// population delta is empty; this pin holds the classifier side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFlowType, isPodyap } from '../src/lib/flows.ts';

const flow = (theme) => ({ id: 1, theme, flowType: '' });

test("'playdate' theme no longer matches Podyap", () => {
  assert.equal(matchesFlowType(flow('playdate'), 'Podyap'), false);
  assert.equal(isPodyap(flow('Playdate')), false);
});

test("the surviving podyap aliases still match", () => {
  assert.equal(isPodyap(flow('podyap')), true);
  assert.equal(isPodyap(flow('yapcast')), true);
  assert.equal(isPodyap(flow('Yapcast')), true);
});

test("a structured flowType still wins over theme", () => {
  const f = { id: 2, theme: 'playdate', flowType: 'Podyap' };
  assert.equal(isPodyap(f), true);
});
