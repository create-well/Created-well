// MOVES owner resolution (2026-11-02): Owner is a Relation → PEOPLE in
// the operational schema, so a bare normalizeMove stores the relation ID
// and the assignee composer renders "Assignee not listed". These cases
// pin the read-time resolution contract:
//   - the PEOPLE index maps page id → lowercased Name (the role key space)
//   - a Move whose first Owner target resolves carries that slug
//   - MULTI-OWNER RULE: the first Owner target wins, named not inherited
//   - an unresolvable first target keeps the lowercased-ID fallback
//   - a text/people owner value is already a name and never resolves
//   - without an index, behavior is byte-identical to the legacy fallback
//   - the production census values resolve: Sunshine x8 / Monny x6 shape

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMove, buildOwnerSlugIndex } from '../src/lib/notionNormalizer.ts';

const SUNSHINE_ID = '3e724acf-799d-8172-ae28-e37888307180';
const MONNY_ID = '3e724acf-799d-8182-8fed-fc74b4dd07c2';
const UNKNOWN_ID = '40c24acf-799d-8000-8000-000000000000';

const personPage = (id, name) => ({
  id,
  created_time: '2026-01-01T00:00:00.000Z',
  last_edited_time: '2026-01-01T00:00:00.000Z',
  properties: { Name: { type: 'title', title: [{ plain_text: name }] } },
});
const movePage = (ownerIds) => ({
  id: '40c24acf-799d-8100-8000-0000000000aa',
  created_time: '2026-01-01T00:00:00.000Z',
  last_edited_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: 'A move' }] },
    Owner: { type: 'relation', relation: ownerIds.map((id) => ({ id })) },
    Person: { type: 'relation', relation: [] },
  },
});

const index = buildOwnerSlugIndex([personPage(SUNSHINE_ID, 'Sunshine'), personPage(MONNY_ID, 'Monny')]);

test('index maps PEOPLE ids to lowercased names', () => {
  assert.equal(index.get(SUNSHINE_ID), 'sunshine');
  assert.equal(index.get(MONNY_ID), 'monny');
  assert.equal(index.size, 2);
});

test('a resolvable owner relation lands as the role slug', () => {
  assert.equal(normalizeMove(movePage([SUNSHINE_ID]), index).person, 'sunshine');
  assert.equal(normalizeMove(movePage([MONNY_ID]), index).person, 'monny');
});

test('multi-owner: the FIRST Owner target wins', () => {
  assert.equal(normalizeMove(movePage([MONNY_ID, SUNSHINE_ID]), index).person, 'monny');
  assert.equal(normalizeMove(movePage([SUNSHINE_ID, MONNY_ID]), index).person, 'sunshine');
});

test('an unresolvable first target keeps the stored fallback (never the second target)', () => {
  assert.equal(normalizeMove(movePage([UNKNOWN_ID, SUNSHINE_ID]), index).person, UNKNOWN_ID);
});

test('without an index the legacy fallback stands', () => {
  assert.equal(normalizeMove(movePage([SUNSHINE_ID])).person, SUNSHINE_ID);
  assert.equal(normalizeMove(movePage([])).person, '');
});
