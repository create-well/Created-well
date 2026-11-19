// Phase 4 (packets S/T) board derivations: gate grouping, status
// dispositions, queue membership, the detail gate verdict, and the
// A1 name-collision case. Fixture rows are literal [ ] slots per the
// placeholder standard — no realistic pieces anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GATE_ORDER,
  boardGroups,
  tasteQueue,
  releaseCallQueue,
  gateVerdict,
  readinessLegs,
  gateHolder,
  appearsInRelease,
} from '../src/lib/making.ts';

const post = (overrides = {}) => ({
  id: 1,
  author: 'team',
  content: '[ ] fixture piece',
  tag: 'Episode',
  status: null,
  audience: null,
  isFinal: false,
  currentGate: null,
  topicStage: null,
  clipStatus: null,
  publishDate: null,
  link: null,
  where: null,
  readyToRelease: false,
  parentEpisodeId: null,
  registryMirror: false,
  ...overrides,
});

test('episodes group by gate in ops order, No gate filed first', () => {
  const board = boardGroups([
    post({ content: '[ ] at taste', currentGate: 'Taste' }),
    post({ content: '[ ] ungated' }),
    post({ content: '[ ] at lock', currentGate: 'Topic lock' }),
  ]);
  assert.equal(board.episodeGroups[0].label, 'No gate filed');
  assert.deepEqual(board.episodeGroups[0].posts.map((p) => p.content), ['[ ] ungated']);
  assert.deepEqual(
    board.episodeGroups.slice(1).map((g) => g.label),
    [...GATE_ORDER],
  );
  const taste = board.episodeGroups.find((g) => g.label === 'Taste');
  assert.equal(taste.posts.length, 1);
});

test('mirrors are excluded everywhere and counted; archived counted and excluded', () => {
  const board = boardGroups([
    post({ content: '[ ] mirror', registryMirror: true }),
    post({ content: '[ ] archived ep', status: 'Archived' }),
    post({ content: '[ ] live', status: 'Draft' }),
  ]);
  assert.equal(board.mirrorCount, 1);
  assert.equal(board.archivedCount, 1);
  const all = [...board.episodeGroups, ...board.pieceGroups].flatMap((g) => g.posts);
  assert.deepEqual(all.map((p) => p.content), ['[ ] live']);
});

test('pieces group by status with named dispositions', () => {
  const board = boardGroups([
    post({ tag: 'Clip', content: '[ ] draft piece', status: 'Draft' }),
    post({ tag: 'Promo', content: '[ ] out piece', status: 'Published' }),
    post({ tag: 'Copy', content: '[ ] inbox piece', status: 'Inbox' }),
    post({ tag: 'Asset', content: '[ ] bare piece' }),
  ]);
  const byLabel = Object.fromEntries(board.pieceGroups.map((g) => [g.label, g.posts.map((p) => p.content)]));
  assert.deepEqual(byLabel['Draft'], ['[ ] draft piece']);
  assert.deepEqual(byLabel['Released'], ['[ ] out piece']);
  assert.deepEqual(byLabel['Inbox — untriaged'], ['[ ] inbox piece']);
  assert.deepEqual(byLabel['No status filed'], ['[ ] bare piece']);
});

test('groups sort by publish date, undated last, then name', () => {
  const board = boardGroups([
    post({ content: '[ ] later', currentGate: 'Record', publishDate: '2026-02-01' }),
    post({ content: '[ ] sooner', currentGate: 'Record', publishDate: '2026-01-01' }),
    post({ content: '[ ] undated', currentGate: 'Record' }),
  ]);
  const rec = board.episodeGroups.find((g) => g.label === 'Record');
  assert.deepEqual(rec.posts.map((p) => p.content), ['[ ] sooner', '[ ] later', '[ ] undated']);
});

test('taste queue: gate membership, dated split, archived and mirrors out', () => {
  const q = tasteQueue([
    post({ content: '[ ] waiting dated', currentGate: 'Taste', publishDate: '2026-01-05' }),
    post({ content: '[ ] waiting undated', currentGate: 'Taste' }),
    post({ content: '[ ] elsewhere', currentGate: 'Record', publishDate: '2026-01-05' }),
    post({ content: '[ ] archived taste', currentGate: 'Taste', status: 'Archived', publishDate: '2026-01-05' }),
  ]);
  assert.deepEqual(q.dated.map((p) => p.content), ['[ ] waiting dated']);
  assert.equal(q.undatedCount, 1);
});

test('release call queue: formula true and not Published', () => {
  const q = releaseCallQueue([
    post({ content: '[ ] ready piece', status: 'Ready', readyToRelease: true, publishDate: '2026-01-05' }),
    post({ content: '[ ] already out', status: 'Published', readyToRelease: true, publishDate: '2026-01-05' }),
    post({ content: '[ ] not ready', status: 'Ready', readyToRelease: false, publishDate: '2026-01-05' }),
  ]);
  assert.deepEqual(q.dated.map((p) => p.content), ['[ ] ready piece']);
  assert.equal(q.undatedCount, 0);
});

test('gate verdict: each leg failing alone names that leg', () => {
  const base = { status: 'Published', audience: 'Public', isFinal: true };
  assert.equal(gateVerdict(post(base)).passes, true);
  assert.deepEqual(gateVerdict(post({ ...base, status: 'Draft' })).missing, ['Published']);
  assert.deepEqual(gateVerdict(post({ ...base, audience: 'Team' })).missing, ['Public']);
  assert.deepEqual(gateVerdict(post({ ...base, isFinal: false })).missing, ['Final']);
  const bare = gateVerdict(post({}));
  assert.equal(bare.passes, false);
  assert.deepEqual(bare.missing, ['Published', 'Public', 'Final']);
  assert.deepEqual(bare.legs.map((l) => l.actual), ['Not filed', 'Not filed', 'Not checked']);
});

test('A1: a gate-failing row sharing a public name still fails its verdict', () => {
  const failing = post({ content: '[ ] shared name [Published]', status: 'Published', audience: 'Public', isFinal: false });
  assert.equal(appearsInRelease(failing, [{ name: '[ ] shared name' }]), true);
  const verdict = gateVerdict(failing);
  assert.equal(verdict.passes, false);
  assert.deepEqual(verdict.missing, ['Final']);
});

test('readiness legs read the four formula legs independently', () => {
  const legs = readinessLegs(post({ isFinal: true, status: 'Ready', link: null, publishDate: '2026-01-05' }));
  assert.deepEqual(legs.map((l) => l.met), [true, true, false, true]);
});

test('gate holders come from the ops flow; taste is by invitation', () => {
  assert.equal(gateHolder('Taste'), 'Bingle — by invitation');
  assert.equal(gateHolder('Rough cut'), 'Omar');
  assert.equal(gateHolder('Promo'), 'Named per run');
  assert.equal(gateHolder(null), null);
  assert.equal(gateHolder('Not a gate'), null);
});
