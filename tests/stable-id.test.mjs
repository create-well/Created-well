// stableId uniqueness (fix/stable-id-collision): MOVES rows created in
// the same batch share long Notion UUID prefixes. The old stableId
// parsed only the first 7 hex characters, so 11 of the 15 live rows
// shared an id — and every list keyed by task.id (React.Fragment in the
// Moves list) reconciled against duplicate keys: filter round-trips
// accumulated duplicate rows in-session (15 → 24 → 33 in production).
// Fixtures mirror the live shape: UUIDs differing only AFTER the shared
// prefix. Titles are fixture labels, not real records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stableId, normalizeMove } from '../src/lib/notionNormalizer.ts';

// 15 page ids in the live collision shape: three prefix families whose
// members differ only in later segments.
const FAMILY_A = '3f4a1b2c-0000-4000-8000-0000000000';
const FAMILY_B = '3ee1c4d4-0000-4000-8000-0000000000';
const FAMILY_C = '404d3e14-0000-4000-8000-0000000000';
const pageIds = [
  `${FAMILY_C}01`, `${FAMILY_B}07`, `${FAMILY_B}03`,
  `${FAMILY_A}01`, `${FAMILY_A}02`, `${FAMILY_A}03`,
  `${FAMILY_B}11`, `${FAMILY_B}21`, `${FAMILY_B}22`,
  `${FAMILY_B}23`, `${FAMILY_B}24`, `${FAMILY_B}25`,
  `${FAMILY_B}26`, `${FAMILY_B}27`, `${FAMILY_B}28`,
];

test('stableId: page ids sharing a long prefix still hash distinctly', () => {
  const ids = pageIds.map(stableId);
  assert.equal(new Set(ids).size, pageIds.length, `collisions in ${ids}`);
});

test('stableId: deterministic and sensitive to the tail segment', () => {
  assert.equal(stableId(pageIds[0]), stableId(pageIds[0]));
  assert.notEqual(stableId(`${FAMILY_B}07`), stableId(`${FAMILY_B}08`));
  assert.equal(stableId(''), 0);
});

const movePage = (id, title, person) => ({
  id,
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: title }] },
    Status: { type: 'select', select: { name: 'Next' } },
    Person: { type: 'select', select: { name: person } },
  },
});

test('filter round-trip: away and back returns exactly the baseline set', () => {
  const persons = ['Sunshine', 'Monny', 'Bingle', 'Monny', 'Monny', 'Sunshine',
    'Monny', 'Monny', 'Monny', 'Monny', 'Monny', 'Monny', 'Bingle', 'Sunshine', 'Sunshine'];
  const tasks = pageIds.map((id, i) => normalizeMove(movePage(id, `Fixture Move ${i + 1}`, persons[i])));
  // Baseline: unique ids are the precondition for keyed reconciliation.
  assert.equal(new Set(tasks.map(t => t.id)).size, tasks.length, 'task ids must be unique');
  // The component's own derivation (GeyserView renderTasks): filter, then back.
  const byPerson = (list, f) => (f === 'all' ? list : list.filter(t => t.person === f));
  const monny = byPerson(tasks, 'monny');
  assert.equal(monny.length, 9);
  assert.equal(new Set(monny.map(t => t.id)).size, monny.length);
  const backToAll = byPerson(tasks, 'all');
  assert.deepEqual(backToAll.map(t => t.id), tasks.map(t => t.id), 'round-trip returns the baseline set, no duplicates');
});
