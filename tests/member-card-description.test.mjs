// Audit-5 N2 display leg (register 1346) — member cards render
// NOTHING from the PEOPLE Description field. The prose is
// provenance (a bulk-import note on 12 of 29 rows) with a live
// consent/pathway to-do in its tail: not a person fact, never a
// card field, no trimmed line, no badge. The card's description
// slot carries the structured Roles string only. The DETAIL view
// (PersonView) carries the prose IN FULL until the data cleanup
// lands, so the to-do stays reachable in product.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePerson } from '../src/lib/notionNormalizer.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const personView = readFileSync(join(root, 'src/app/components/PersonView.tsx'), 'utf8');

const page = (roles, description) => ({
  id: '11111111-2222-3333-4444-555555555555',
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: 'Test Person' }] },
    Roles: { type: 'multi_select', multi_select: roles.map(name => ({ name })) },
    Description: { type: 'rich_text', rich_text: [{ plain_text: description }] },
  },
});

test('without Roles, the card field is empty — the prose never falls through', () => {
  const rec = normalizePerson(page([], 'Imported from the old sheet. TODO: capture consent + pathway.'));
  assert.equal(rec.description, '');
  assert.equal(rec.descriptionFull, 'Imported from the old sheet. TODO: capture consent + pathway.');
});

test('with Roles, the card field is the structured Roles string', () => {
  const rec = normalizePerson(page(['Host', 'Facilitator'], 'Imported from the old sheet.'));
  assert.equal(rec.description, 'Host, Facilitator');
  assert.equal(rec.descriptionFull, 'Imported from the old sheet.');
});

test('the detail view carries the prose in full', () => {
  assert.ok(personView.includes('personRecord?.descriptionFull'));
  assert.ok(personView.includes('{personRecord.descriptionFull}'));
});
