// Phase 3 L2 pins (packet M §2.1/§2.2): resolvePerson's settle gate
// and the attendedIds join, in the resolveGathering contract's shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePerson, gatheringsFor, lastGatheringFor } from '../src/lib/people.ts';

const people = [
  { id: 11, name: 'Ana', notionPageId: 'page-ana' },
  { id: 22, name: 'Ben', notionPageId: 'page-ben' },
  { id: 33, name: 'Cyd' }, // cached record: no page id
];
const flows = [
  { id: 1, date: '2026-10-01', attendedIds: ['page-ana'] },
  { id: 2, date: '2026-11-05', attendedIds: ['page-ana', 'page-ben'] },
  { id: 3, date: '2026-11-12', attendedIds: ['page-ben'] },
  { id: 4, attendedIds: ['page-ana'] }, // dateless sorts last
];

test('unsettled payloads resolve loading, never not-found', () => {
  assert.equal(resolvePerson(people, 'loading', 11).state, 'loading');
  assert.equal(resolvePerson(people, 'failed', 11).state, 'loading');
  assert.equal(resolvePerson(undefined, 'loading', 11).state, 'loading');
});

test('settled payloads resolve by station id and by page id', () => {
  assert.equal(resolvePerson(people, 'fresh', 22).person.name, 'Ben');
  assert.equal(resolvePerson(people, 'stale', 'page-ana').person.name, 'Ana');
  assert.equal(resolvePerson(people, 'fresh', '22').person.name, 'Ben');
});

test('settled misses are honest not-found, including a slice-less payload', () => {
  assert.equal(resolvePerson(people, 'fresh', 99).state, 'not-found');
  assert.equal(resolvePerson(undefined, 'fresh', 11).state, 'not-found');
});

test('gatherings join on attendedIds against the page id, newest first, dateless last', () => {
  const gs = gatheringsFor('page-ana', flows);
  assert.deepEqual(gs.map(g => g.id), [2, 1, 4]);
  assert.equal(lastGatheringFor('page-ana', flows).id, 2);
  assert.equal(lastGatheringFor('page-ben', flows).id, 3);
});

test('a person with no page id matches nothing — honest absence, never a guess', () => {
  assert.deepEqual(gatheringsFor(undefined, flows), []);
  assert.equal(lastGatheringFor(undefined, flows), undefined);
});
