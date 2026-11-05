// Decisions delete affordance (register 1293). The D-1 build shipped
// create + decide + defer but no delete: a probe, or a plain mistake,
// could never be cleaned out of the queue. Decisions are KV-native,
// so the delete rides the resource's own addressing (record id over
// the generic list DELETE). The card's control is two-step (Delete,
// then Confirm delete) in the page's inline-expansion idiom; the
// context action follows the D-1 honesty contract — await, then
// apply, and rethrow so the card owns its error line. Nothing about
// a failed delete is silent and nothing vanishes early.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = readFileSync(join(root, 'src/app/components/api.ts'), 'utf8');
const ctx = readFileSync(join(root, 'src/contexts/DashboardContext.tsx'), 'utf8');
const page = readFileSync(join(root, 'src/app/pages/DecisionsPage.tsx'), 'utf8');

test('the client delete rides the decisions resource by record id', () => {
  assert.ok(api.includes("export const deleteDecision = (id: number) => req<{ ok: boolean }>('DELETE', `/decisions/${id}`);"));
});

test('the context action awaits, then applies, and rethrows', () => {
  const i = ctx.indexOf('async deleteDecision(id: number)');
  const block = ctx.slice(i, i + 340);
  assert.ok(block.includes('await api.deleteDecision(id)'));
  assert.ok(block.includes('setDecisions(prev => prev.filter(d => d.id !== id))'));
  assert.ok(block.includes('throw e'));
});

test('the card carries a two-step delete on both states, with its own error line', () => {
  assert.ok(page.includes("confirmingDelete ? 'Confirm delete' : 'Delete'"));
  assert.ok(page.includes('That did not delete. Check the connection and try again.'));
  assert.equal(page.split('onDelete={removeDecision}').length - 1, 2);
});
