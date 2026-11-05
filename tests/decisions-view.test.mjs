// D-1 (Decisions persistence): the queue orders pending by urgency
// with a newest-first tiebreak, the decided archive holds only decided
// items newest first, defer keeps its settled meaning (urgency only,
// status stays pending), and the page itself carries no local decision
// state — the facade shape this build removes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  sortPendingDecisions, decidedDecisions,
  buildDecisionCreate, buildDecideUpdate, buildDeferUpdate,
} from '../src/lib/decisionsView.ts';

const rec = (id, urgency, status, created_at, decided_at) => ({
  id, question: `q${id}`, context: '', urgency, status,
  created_at, decided_at,
});

test('pending sorts by urgency band, newest first inside a band, decided excluded', () => {
  const rows = [
    rec(1, 'when-clear', 'pending', '2026-11-01T00:00:00Z'),
    rec(2, 'now', 'pending', '2026-11-02T00:00:00Z'),
    rec(3, 'this-week', 'pending', '2026-11-03T00:00:00Z'),
    rec(4, 'now', 'pending', '2026-11-04T00:00:00Z'),
    rec(5, 'now', 'decided', '2026-11-04T00:00:00Z', '2026-11-04T01:00:00Z'),
  ];
  assert.deepEqual(sortPendingDecisions(rows).map(d => d.id), [4, 2, 3, 1]);
});

test('decided archive holds decided only, most recently decided first', () => {
  const rows = [
    rec(1, 'now', 'decided', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'),
    rec(2, 'now', 'pending', '2026-11-03T00:00:00Z'),
    rec(3, 'now', 'decided', '2026-11-01T00:00:00Z', '2026-11-04T00:00:00Z'),
  ];
  assert.deepEqual(decidedDecisions(rows).map(d => d.id), [3, 1]);
});

test('write shapes: create carries the form fields; decide stamps the answer; defer touches urgency only', () => {
  assert.deepEqual(
    buildDecisionCreate({ question: 'Book the venue?', context: 'Terms differ', urgency: 'now' }),
    { question: 'Book the venue?', context: 'Terms differ', urgency: 'now' },
  );
  assert.deepEqual(
    buildDecideUpdate('Yes, book it', '2026-11-04T12:00:00.000Z'),
    { status: 'decided', answer: 'Yes, book it', decided_at: '2026-11-04T12:00:00.000Z' },
  );
  const defer = buildDeferUpdate();
  assert.deepEqual(defer, { urgency: 'when-clear' });
  assert.equal('status' in defer, false);
});

test('the page reads the payload slice and holds no local decision state', async () => {
  const page = await readFile(new URL('../src/app/pages/DecisionsPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /data\.decisions/);
  assert.doesNotMatch(page, /useState<DecisionRecord\[\]>/);
  assert.doesNotMatch(page, /useState<Decision\[\]>/);
  // Adopted layout fixes pinned: 96px bottom clearance; principle card present.
  assert.match(page, /padding: '24px 16px 96px'/);
  assert.match(page, /How Monica decides/);
});

test('the record type admits no deferred status (defer is an urgency, never a status)', async () => {
  const api = await readFile(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  assert.match(api, /status: 'pending' \| 'decided';/);
  assert.doesNotMatch(api, /'pending' \| 'decided' \| 'deferred'/);
});
