// OPEN ASKS care aggregate (fix/open-asks-source): counts only,
// never values. Fixture pages are literal [ ] slots per the
// placeholder standard — no realistic asks anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openAsksCareCounts } from '../src/lib/notionNormalizer.ts';

const page = (status) => ({
  id: '[ ] fixture page',
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Ask: { type: 'title', title: [{ plain_text: '[ ] fixture ask' }] },
    Status: { type: 'select', select: status ? { name: status } : null },
  },
});

test('openAsksCareCounts: empty source is 0 of 0', () => {
  assert.deepEqual(openAsksCareCounts([]), { total: 0, unanswered: 0 });
});

test('openAsksCareCounts: Open and Waiting count as unanswered', () => {
  assert.deepEqual(openAsksCareCounts([page('Open'), page('Waiting')]), { total: 2, unanswered: 2 });
});

test('openAsksCareCounts: Held is a deliberate hold, not unanswered', () => {
  assert.deepEqual(openAsksCareCounts([page('Held')]), { total: 1, unanswered: 0 });
});

test('openAsksCareCounts: settled states never count', () => {
  const pages = [page('Parked'), page('Answered'), page('Done'), page('Closed')];
  assert.deepEqual(openAsksCareCounts(pages), { total: 4, unanswered: 0 });
});

test('openAsksCareCounts: missing or empty Status is not unanswered', () => {
  assert.deepEqual(openAsksCareCounts([page(null), page(undefined)]), { total: 2, unanswered: 0 });
});

test('openAsksCareCounts: live-shaped distribution counts Open + Waiting only', () => {
  const pages = [
    ...Array.from({ length: 9 }, () => page('Open')),
    ...Array.from({ length: 3 }, () => page('Held')),
    ...Array.from({ length: 48 }, () => page('Parked')),
    ...Array.from({ length: 2 }, () => page('Answered')),
    ...Array.from({ length: 2 }, () => page('Done')),
    ...Array.from({ length: 1 }, () => page('Closed')),
  ];
  assert.deepEqual(openAsksCareCounts(pages), { total: 65, unanswered: 9 });
});
