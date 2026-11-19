// Phase 4 (packets S/T) detail page: route, gate-block wording, the
// A1 name-matched appearance line, and the FlowCommandCenter footer
// correction. Source-shape pins plus resolvePost/parentEpisodeOf lib
// pins. Fixture rows are literal [ ] slots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePost, parentEpisodeOf } from '../src/lib/making.ts';

const routes = readFileSync(new URL('../src/app/routes.ts', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/app/pages/MakingDetailPage.tsx', import.meta.url), 'utf8');
const fcc = readFileSync(new URL('../src/app/components/FlowCommandCenter.tsx', import.meta.url), 'utf8');

test('A3: /making/:id is a named route to MakingDetailPage', () => {
  assert.match(routes, /path: 'making\/:id'.*MakingDetailPage/);
});

test('the gate block states the verdict both ways, naming missing legs', () => {
  assert.match(detail, /This piece passes the release gate\./);
  assert.match(detail, /This piece stays inside\. Missing:/);
  assert.match(detail, /Readiness is preparation, not release permission\./);
});

test('A1: the public appearance line is labeled name-matched', () => {
  assert.match(detail, /Listed in the public release \(name-matched\)\./);
});

test('the Promo standing rule rides the detail page', () => {
  assert.match(detail, /No promo without a margin line\. The margin lives in the workbook, not here\./);
});

test('FlowCommandCenter footer names its real source; the false string is gone', () => {
  assert.match(fcc, /Data source · FLOWS \(Notion\) · useDashboard\(\)\.data\.coFlowDates/);
  assert.doesNotMatch(fcc, /cr8w_coflow_dates/);
  assert.doesNotMatch(fcc, /GET \/api\/server\/sync/);
});

const post = (overrides = {}) => ({
  id: 7,
  author: 'team',
  content: '[ ] fixture piece',
  tag: 'Clip',
  notionPageId: 'page-7',
  parentEpisodeId: null,
  registryMirror: false,
  ...overrides,
});

test('resolvePost gates on a settled payload and matches id or page id', () => {
  const rows = [post()];
  assert.deepEqual(resolvePost(rows, 'loading', 7), { state: 'loading' });
  assert.equal(resolvePost(rows, 'fresh', 7).state, 'found');
  assert.equal(resolvePost(rows, 'stale', 'page-7').state, 'found');
  assert.equal(resolvePost(rows, 'fresh', 99).state, 'not-found');
  assert.equal(resolvePost(undefined, 'fresh', 7).state, 'not-found');
});

test('parentEpisodeOf joins on the Notion page id, null when unfiled or absent', () => {
  const episode = post({ id: 3, notionPageId: 'page-3', tag: 'Episode', content: '[ ] fixture episode' });
  const clip = post({ parentEpisodeId: 'page-3' });
  assert.equal(parentEpisodeOf(clip, [episode, clip])?.id, 3);
  assert.equal(parentEpisodeOf(post(), [episode]), null);
  assert.equal(parentEpisodeOf(post({ parentEpisodeId: 'page-x' }), [episode]), null);
});
