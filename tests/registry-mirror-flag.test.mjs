import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContent } from '../src/lib/notionNormalizer.ts';

// Synthetic pages only. The registry-mirror flag (register 1435, Leg 1)
// keys on the literal marker leading the Registry Details value.
const page = (id, props) => ({ id, created_time: '2026-01-01T00:00:00Z', last_edited_time: '2026-01-01T00:00:00Z', properties: props });
const title = t => ({ type: 'title', title: [{ plain_text: t, href: null }] });
const rich = t => ({ type: 'rich_text', rich_text: [{ plain_text: t, href: null }] });

test('a registry-mirror row is flagged', () => {
  const post = normalizeContent(page('11111111-1111-4111-8111-111111111111', {
    Name: title('sample-template'),
    'Registry Details': rich('registry-mirror · registry status: verified · repo binding: none'),
  }));
  assert.equal(post.registryMirror, true);
  assert.equal(post.content, 'sample-template');
});

test('a genuine content row is not flagged', () => {
  const post = normalizeContent(page('22222222-2222-4222-8222-222222222222', {
    Name: title('a genuine post'),
    'Registry Details': rich('shot on location, draft notes'),
  }));
  assert.equal(post.registryMirror, false);
});

test('a row without Registry Details is not flagged', () => {
  const post = normalizeContent(page('33333333-3333-4333-8333-333333333333', {
    Name: title('another genuine post'),
  }));
  assert.equal(post.registryMirror, false);
});

test('the marker only counts at the lead of the value', () => {
  const post = normalizeContent(page('44444444-4444-4444-8444-444444444444', {
    Name: title('mentions the marker mid-text'),
    'Registry Details': rich('see the registry-mirror rows for the pattern'),
  }));
  assert.equal(post.registryMirror, false);
});
