// PEOPLE care aggregate (fix/people-care-slice): counts only, never
// values. Fixture pages are literal [ ] slots per the placeholder
// standard — no realistic people anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleCareCounts } from '../src/lib/notionNormalizer.ts';

const page = (consentOptions, capturedStart) => ({
  id: '[ ] fixture page',
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: '[ ] fixture person' }] },
    Consent: { type: 'multi_select', multi_select: consentOptions },
    'Consent Captured': { type: 'date', date: capturedStart ? { start: capturedStart } : null },
  },
});

test('peopleCareCounts: empty source is 0 of 0', () => {
  assert.deepEqual(peopleCareCounts([]), { total: 0, consentGaps: 0 });
});

test('peopleCareCounts: no consent signal on a row is a gap', () => {
  assert.deepEqual(peopleCareCounts([page([], null)]), { total: 1, consentGaps: 1 });
});

test('peopleCareCounts: a Consent option counts as captured', () => {
  assert.deepEqual(
    peopleCareCounts([page([{ name: '[ ] fixture consent option' }], null)]),
    { total: 1, consentGaps: 0 },
  );
});

test('peopleCareCounts: a Consent Captured date counts as captured', () => {
  assert.deepEqual(peopleCareCounts([page([], '2026-01-01')]), { total: 1, consentGaps: 0 });
});

test('peopleCareCounts: mixed rows count gaps only', () => {
  const pages = [
    page([], null),
    page([{ name: '[ ] fixture consent option' }], null),
    page([], '2026-01-01'),
    page([], null),
  ];
  assert.deepEqual(peopleCareCounts(pages), { total: 4, consentGaps: 2 });
});
