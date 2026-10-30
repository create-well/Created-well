// EVENTS + FEEDBACK normalizers (Amendment 2 wiring): display fields
// only, relations never projected. Fixture pages are literal [ ]
// slots per the placeholder standard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, normalizeFeedback } from '../src/lib/notionNormalizer.ts';

const eventPage = (over = {}) => ({
  id: '[ ] fixture event page',
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Event: { type: 'title', title: [{ plain_text: '[ ] fixture event' }] },
    Date: { type: 'date', date: { start: '2026-11-05' } },
    Location: { type: 'rich_text', rich_text: [{ plain_text: '[ ] fixture place' }] },
    Status: { type: 'select', select: { name: 'Scheduled' } },
    Visibility: { type: 'select', select: { name: 'Public' } },
    Source: { type: 'select', select: { name: 'Partiful' } },
    'Partiful link': { type: 'url', url: 'https://example.invalid/[ ]' },
    Flow: { type: 'relation', relation: [{ id: '[ ] fixture flow' }] },
    ...over,
  },
});

test('normalizeEvent: projects the display fields', () => {
  const e = normalizeEvent(eventPage());
  assert.equal(e.name, '[ ] fixture event');
  assert.equal(e.date, '2026-11-05');
  assert.equal(e.location, '[ ] fixture place');
  assert.equal(e.status, 'Scheduled');
  assert.equal(e.visibility, 'Public');
  assert.equal(e.source, 'Partiful');
  assert.equal(e.link, 'https://example.invalid/[ ]');
  assert.equal(e.notionPageId, '[ ] fixture event page');
});

test('normalizeEvent: relations never project (no flow or people keys)', () => {
  const e = normalizeEvent(eventPage());
  assert.deepEqual(Object.keys(e).sort(), ['created_at', 'date', 'id', 'link', 'location', 'name', 'notionPageId', 'source', 'status', 'visibility']);
});

test('normalizeEvent: empty properties degrade to Untitled + empty strings', () => {
  const e = normalizeEvent({ id: '[ ] bare page', created_time: '2026-01-01T00:00:00.000Z', properties: {} });
  assert.equal(e.name, 'Untitled');
  assert.equal(e.date, '');
  assert.equal(e.status, '');
});

const feedbackPage = (over = {}) => ({
  id: '[ ] fixture feedback page',
  created_time: '2026-01-01T00:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: '[ ] fixture feedback' }] },
    Date: { type: 'date', date: { start: '2026-10-20' } },
    Type: { type: 'select', select: { name: 'Survey' } },
    Status: { type: 'select', select: { name: 'New' } },
    Source: { type: 'select', select: { name: 'Form' } },
    Body: { type: 'rich_text', rich_text: [{ plain_text: '[ ] fixture body' }] },
    Person: { type: 'relation', relation: [{ id: '[ ] fixture person' }] },
    ...over,
  },
});

test('normalizeFeedback: projects the display fields incl. body', () => {
  const f = normalizeFeedback(feedbackPage());
  assert.equal(f.name, '[ ] fixture feedback');
  assert.equal(f.date, '2026-10-20');
  assert.equal(f.type, 'Survey');
  assert.equal(f.status, 'New');
  assert.equal(f.source, 'Form');
  assert.equal(f.body, '[ ] fixture body');
});

test('normalizeFeedback: relations never project (no person or flow keys)', () => {
  const f = normalizeFeedback(feedbackPage());
  assert.deepEqual(Object.keys(f).sort(), ['body', 'created_at', 'date', 'id', 'name', 'notionPageId', 'source', 'status', 'type']);
});

test('normalizeFeedback: empty properties degrade to Untitled + empty strings', () => {
  const f = normalizeFeedback({ id: '[ ] bare page', created_time: '2026-01-01T00:00:00.000Z', properties: {} });
  assert.equal(f.name, 'Untitled');
  assert.equal(f.body, '');
});
