// CONTENT gate projections (Phase 4, packet T): normalizeContent
// surfaces the raw Status/Audience/Final?/gate fields alongside the
// legacy ForumPost shape. Fixture pages are synthetic; names carry the
// [ ] placeholder marker per the program's placeholder standard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContent } from '../src/lib/notionNormalizer.ts';

const page = (id, props) => ({ id, created_time: '2026-01-01T00:00:00Z', last_edited_time: '2026-01-01T00:00:00Z', properties: props });
const title = t => ({ type: 'title', title: [{ plain_text: t, href: null }] });
const rich = t => ({ type: 'rich_text', rich_text: [{ plain_text: t, href: null }] });
const select = name => ({ type: 'select', select: name ? { id: 'opt', name, color: 'default' } : null });
const checkbox = b => ({ type: 'checkbox', checkbox: b });
const date = start => ({ type: 'date', date: start ? { start, end: null, time_zone: null } : null });
const url = u => ({ type: 'url', url: u });
const relation = ids => ({ type: 'relation', relation: ids.map(id => ({ id })) });
const formulaBool = b => ({ type: 'formula', formula: { type: 'boolean', boolean: b } });

test('a fully filed episode row: every gate field reads its fixture value', () => {
  const post = normalizeContent(page('11111111-1111-4111-8111-111111111111', {
    Name: title('[ ] fixture episode'),
    Status: select('Published'),
    Audience: select('Public'),
    'Final?': checkbox(true),
    'Current Gate': select('Gate 4'),
    'Topic Stage': select('Outlined'),
    'Clip Status': select('Clipped'),
    'Publish Date': date('2026-11-01'),
    Link: url('https://example.invalid/ep'),
    Where: select('Spotify'),
    'Ready to Release?': formulaBool(true),
    'Parent Episode': relation(['22222222-2222-4222-8222-222222222222']),
  }));
  assert.equal(post.status, 'Published');
  assert.equal(post.audience, 'Public');
  assert.equal(post.isFinal, true);
  assert.equal(post.currentGate, 'Gate 4');
  assert.equal(post.topicStage, 'Outlined');
  assert.equal(post.clipStatus, 'Clipped');
  assert.equal(post.publishDate, '2026-11-01');
  assert.equal(post.link, 'https://example.invalid/ep');
  assert.equal(post.where, 'Spotify');
  assert.equal(post.readyToRelease, true);
  assert.equal(post.parentEpisodeId, '22222222-2222-4222-8222-222222222222');
});

test('a row with no URL: content has no status suffix, status still reads', () => {
  const post = normalizeContent(page('33333333-3333-4333-8333-333333333333', {
    Name: title('[ ] fixture draft'),
    Status: select('Ready'),
  }));
  assert.equal(post.content, '[ ] fixture draft');
  assert.equal(post.status, 'Ready');
});

test('a row with a URL: content keeps the [Published] suffix exactly', () => {
  const post = normalizeContent(page('44444444-4444-4444-8444-444444444444', {
    Name: title('[ ] fixture episode'),
    Status: select('Published'),
    URL: url('https://example.invalid/ep1'),
  }));
  assert.equal(post.content, '[ ] fixture episode [Published]');
  // link falls back to URL when Link itself is absent
  assert.equal(post.link, 'https://example.invalid/ep1');
});

test('a registry-mirror row: flagged, and the gate fields still ride', () => {
  const post = normalizeContent(page('55555555-5555-4555-8555-555555555555', {
    Name: title('[ ] fixture template'),
    'Registry Details': rich('registry-mirror · registry status: verified'),
    Status: select('Draft'),
    'Topic Stage': select('Idea'),
    'Ready to Release?': formulaBool(false),
  }));
  assert.equal(post.registryMirror, true);
  assert.equal(post.status, 'Draft');
  assert.equal(post.topicStage, 'Idea');
  assert.equal(post.readyToRelease, false);
});

test('readyToRelease: formula true reads true; non-formula or false shapes read false', () => {
  const base = { Name: title('[ ] fixture row') };
  assert.equal(normalizeContent(page('66666666-6666-4666-8666-666666666666', {
    ...base,
    'Ready to Release?': formulaBool(true),
  })).readyToRelease, true);
  assert.equal(normalizeContent(page('77777777-7777-4777-8777-777777777777', {
    ...base,
    'Ready to Release?': formulaBool(false),
  })).readyToRelease, false);
  // Same name as a checkbox — not the formula shape, so false.
  assert.equal(normalizeContent(page('88888888-8888-4888-8888-888888888888', {
    ...base,
    'Ready to Release?': checkbox(true),
  })).readyToRelease, false);
  // A formula evaluating to a non-boolean is also false.
  assert.equal(normalizeContent(page('99999999-9999-4999-8999-999999999999', {
    ...base,
    'Ready to Release?': { type: 'formula', formula: { type: 'string', string: 'yes' } },
  })).readyToRelease, false);
  assert.equal(normalizeContent(page('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', base)).readyToRelease, false);
});

test('unfiled selects/dates/urls/relations read null, not empty string', () => {
  const post = normalizeContent(page('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
    Name: title('[ ] fixture unfiled'),
    Status: select(null),
    Audience: select(null),
    'Final?': checkbox(false),
    'Current Gate': select(null),
    'Topic Stage': select(null),
    'Clip Status': select(null),
    'Publish Date': date(null),
    'Ready to Release?': formulaBool(false),
    'Parent Episode': relation([]),
  }));
  assert.equal(post.status, null);
  assert.equal(post.audience, null);
  assert.equal(post.isFinal, false);
  assert.equal(post.currentGate, null);
  assert.equal(post.topicStage, null);
  assert.equal(post.clipStatus, null);
  assert.equal(post.publishDate, null);
  assert.equal(post.link, null);
  assert.equal(post.where, null);
  assert.equal(post.readyToRelease, false);
  assert.equal(post.parentEpisodeId, null);
});
