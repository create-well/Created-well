import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowPartifulLinks } from '../src/lib/notionNormalizer.ts';

// Synthetic pages only (register 1484, Leg 1). The projection carries
// ONLY the Partiful link, from a flow's related EVENTS rows onto the
// flow's record, keyed by page id.
const page = (id, props) => ({ id, created_time: '2026-01-01T00:00:00Z', last_edited_time: '2026-01-01T00:00:00Z', properties: props });
const url = u => ({ type: 'url', url: u });
const rel = ids => ({ type: 'relation', relation: ids.map(id => ({ id })), has_more: false });

const EV_A = '11111111-1111-4111-8111-111111111111';
const EV_B = '22222222-2222-4222-8222-222222222222';
const EV_C = '33333333-3333-4333-8333-333333333333';
const FL_A = '44444444-4444-4444-8444-444444444444';
const FL_B = '55555555-5555-4555-8555-555555555555';
const FL_C = '66666666-6666-4666-8666-666666666666';

test('a flow gains the Partiful link of its related event', () => {
  const links = buildFlowPartifulLinks(
    [page(FL_A, { Events: rel([EV_A]) })],
    [page(EV_A, { 'Partiful link': url('https://partiful.com/e/sample') })],
  );
  assert.equal(links.get(FL_A), 'https://partiful.com/e/sample');
  assert.equal(links.size, 1);
});

test('no projection when the related event carries no link', () => {
  const links = buildFlowPartifulLinks(
    [page(FL_A, { Events: rel([EV_A]) })],
    [page(EV_A, { 'Partiful link': url(null) })],
  );
  assert.equal(links.has(FL_A), false);
});

test('first related event carrying a link wins, in relation order', () => {
  const links = buildFlowPartifulLinks(
    [page(FL_A, { Events: rel([EV_B, EV_A, EV_C]) })],
    [
      page(EV_A, { 'Partiful link': url('https://partiful.com/e/first-with-link') }),
      page(EV_B, { 'Partiful link': url(null) }),
      page(EV_C, { 'Partiful link': url('https://partiful.com/e/later') }),
    ],
  );
  assert.equal(links.get(FL_A), 'https://partiful.com/e/first-with-link');
});

test('flows without an Events relation and unrelated events project nothing', () => {
  const links = buildFlowPartifulLinks(
    [page(FL_B, {}), page(FL_C, { Events: rel([]) })],
    [page(EV_A, { 'Partiful link': url('https://partiful.com/e/unrelated') })],
  );
  assert.equal(links.size, 0);
});

test('the Link fallback property projects, matching normalizeEvent', () => {
  const links = buildFlowPartifulLinks(
    [page(FL_A, { Events: rel([EV_A]) })],
    [page(EV_A, { Link: url('https://partiful.com/e/fallback') })],
  );
  assert.equal(links.get(FL_A), 'https://partiful.com/e/fallback');
});
