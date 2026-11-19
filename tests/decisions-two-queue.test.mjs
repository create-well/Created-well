// Two-queue split (packets C/F, adopted by the owner 2026-11-19):
// /decisions gains the owner field, the two queues (Waiting For
// Monny / Waiting For Bingle), and a Made list that is visible
// without a toggle. Owner is an app-native KV field — decisions have
// no Notion counterpart — and unowned records derive to 'monny',
// the program's owner of record, never a hidden third queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decisionOwner, waitingForOwner, buildDecisionCreate, sortPendingDecisions,
} from '../src/lib/decisionsView.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src/app/pages/DecisionsPage.tsx'), 'utf8');
const api = readFileSync(join(root, 'src/app/components/api.ts'), 'utf8');
const server = readFileSync(join(root, 'api/server.ts'), 'utf8');

const rec = (id, over = {}) => ({
  id, question: `q${id}`, context: '', urgency: 'this-week', status: 'pending',
  created_at: '2026-11-01T00:00:00Z', ...over,
});

test('owner derivation: bingle only when explicitly filed, never a third value', () => {
  assert.equal(decisionOwner(rec(1)), 'monny');
  assert.equal(decisionOwner(rec(2, { owner: 'monny' })), 'monny');
  assert.equal(decisionOwner(rec(3, { owner: 'bingle' })), 'bingle');
  // Garbage or legacy values do not mint a new queue.
  assert.equal(decisionOwner(rec(4, { owner: 'sunshine' })), 'monny');
  assert.equal(decisionOwner(rec(5, { owner: '' })), 'monny');
});

test('waitingForOwner partitions pending by owner, urgency order kept', () => {
  const rows = [
    rec(1, { owner: 'bingle', urgency: 'now' }),
    rec(2, { owner: 'monny', urgency: 'when-clear' }),
    rec(3, { urgency: 'now' }),
    rec(4, { owner: 'bingle', urgency: 'now', status: 'decided', decided_at: '2026-11-02T00:00:00Z' }),
  ];
  assert.deepEqual(waitingForOwner(rows, 'monny').map(d => d.id), [3, 2]);
  assert.deepEqual(waitingForOwner(rows, 'bingle').map(d => d.id), [1]);
});

test('create shape: owner rides when filed, absent stays absent', () => {
  assert.deepEqual(
    buildDecisionCreate({ question: 'q', context: '', urgency: 'now' }),
    { question: 'q', context: '', urgency: 'now' },
  );
  assert.deepEqual(
    buildDecisionCreate({ question: 'q', context: '', urgency: 'now', owner: 'bingle' }),
    { question: 'q', context: '', urgency: 'now', owner: 'bingle' },
  );
});

test('DecisionRecord carries the optional owner field', () => {
  assert.match(api, /owner\?: 'monny' \| 'bingle';/);
});

test('the page renders both queues and the Made list without a toggle', () => {
  assert.ok(page.includes('Waiting For Monny'));
  assert.ok(page.includes('Waiting For Bingle'));
  assert.ok(page.includes("waitingForOwner(records, 'monny')"));
  assert.ok(page.includes("waitingForOwner(records, 'bingle')"));
  assert.ok(page.includes('Made · {decided.length}'));
  assert.ok(!page.includes('showDecided'));
  // The add form files the owner with the decision.
  assert.ok(page.includes("const [owner, setOwner] = useState<DecisionOwner>('monny')"));
  assert.match(page, /await onAdd\(\{ question: question\.trim\(\), context: context\.trim\(\), urgency, owner \}\);/);
});

test('the server refuses an out-of-enum owner on create and patch', () => {
  assert.ok(server.includes("const DECISION_OWNERS = ['monny', 'bingle'];"));
  assert.ok(server.includes("if (b.owner !== undefined && !DECISION_OWNERS.includes(b.owner))"));
  assert.ok(server.includes("if ('owner' in b && !DECISION_OWNERS.includes(b.owner))"));
});
