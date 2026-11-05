// Blocked Move status round trip (2026-11-05).
// The client has a first-class `blocked` state, and MOVES now carries
// a first-class `Blocked` Status value. These cases pin the full
// client -> Notion writer -> Notion page -> normalizer path for every
// Move status, especially blocked: before the fix, blocked wrote as
// `Now` and therefore read back as `in_progress`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { taskToProperties } from '../api/_notionWriter.ts';
import { normalizeMove } from '../src/lib/notionNormalizer.ts';

const baseTask = {
  person: 'monny',
  title: 'A move',
  priority: 'medium',
};

function pageFromProperties(properties) {
  return {
    id: '40c24acf-799d-8100-8000-0000000000aa',
    created_time: '2026-01-01T00:00:00.000Z',
    last_edited_time: '2026-01-01T00:00:00.000Z',
    properties: {
      Name: properties.Name,
      Status: { type: 'select', select: properties.Status.select },
      // The writer emits rich_text as { text: { content } }; a Notion
      // read returns the same items with plain_text populated.
      'Blocked By': properties['Blocked By']
        ? { type: 'rich_text', rich_text: properties['Blocked By'].rich_text.map((item) => ({ plain_text: item.text.content })) }
        : { type: 'rich_text', rich_text: [] },
    },
  };
}

const ROUND_TRIPS = [
  ['todo', 'Next'],
  ['in_progress', 'Now'],
  ['done', 'Done'],
  ['blocked', 'Blocked'],
  ['dropped', 'Dropped'],
];

for (const [clientStatus, notionStatus] of ROUND_TRIPS) {
  test(`${clientStatus} writes as ${notionStatus} and reads back as ${clientStatus}`, () => {
    const properties = taskToProperties({ ...baseTask, status: clientStatus });
    assert.equal(properties.Status.select.name, notionStatus);
    assert.equal(normalizeMove(pageFromProperties(properties)).status, clientStatus);
  });
}

test('a blocked Move keeps its Blocked By reason separate from its status', () => {
  const properties = taskToProperties({
    ...baseTask,
    status: 'blocked',
    source: 'Waiting on the venue contract',
  });
  assert.equal(properties.Status.select.name, 'Blocked');
  const move = normalizeMove(pageFromProperties(properties));
  assert.equal(move.status, 'blocked');
  assert.equal(move.source, 'Waiting on the venue contract');
});
