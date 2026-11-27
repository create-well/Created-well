// BUILDER leg 1 (public-payload card, BRIEF 2026-11-26): the
// gatherings-card template's model layer and component. Model pins:
// the six projection fields map straight through, an empty link
// normalizes to null, the date label is itemDateLabel's (never a
// raw string, never Invalid Date), waitlist adds the Waitlist chip,
// cancelled carries the Cancelled banner and drops the link call to
// action even when a link exists, and the default status is
// published with no banner and no chip. Source pins on the
// component: it renders through publicCardModel, the anchor href is
// the item link, the banner is var(--darkrust), no refresh-fork
// variable names, and no invented capacity row. Fixture item names
// carry the [ ] placeholder marker per the program's placeholder
// standard — they are fixtures, not real data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicCardModel } from '../src/lib/publicContentCard.ts';
import { itemDateLabel } from '../src/lib/publicContent.ts';

const componentSource = () => readFileSync(
  new URL('../src/app/components/PublicContentCard.tsx', import.meta.url),
  'utf8',
);

const fullItem = {
  name: '[ ] mosaic mirrors night',
  link: 'https://example.invalid/rsvp',
  contentType: 'Gathering',
  publishDate: '2026-12-10',
  where: 'San Luis Obispo',
  tag: 'making',
};

test('model: a full item maps every field', () => {
  const model = publicCardModel(fullItem);
  assert.equal(model.title, '[ ] mosaic mirrors night');
  assert.equal(model.dateLabel, itemDateLabel('2026-12-10'));
  assert.equal(model.where, 'San Luis Obispo');
  assert.equal(model.tag, 'making');
  assert.equal(model.contentType, 'Gathering');
  assert.equal(model.link, 'https://example.invalid/rsvp');
  assert.equal(model.status, 'published');
  assert.equal(model.bannerText, null);
  assert.equal(model.chipText, null);
  assert.equal(model.showLink, true);
});

test('model: null and empty fields normalize — empty link becomes null, showLink false', () => {
  const model = publicCardModel({
    name: '',
    link: '',
    contentType: null,
    publishDate: null,
    where: null,
    tag: null,
  });
  assert.equal(model.title, '', 'no placeholder title is invented');
  assert.equal(model.link, null, 'the projection emits a string that may be empty; empty is no link');
  assert.equal(model.showLink, false);
  assert.equal(model.contentType, null);
  assert.equal(model.where, null);
  assert.equal(model.tag, null);
});

test('model: a missing publishDate yields itemDateLabel\'s wording, never Invalid Date', () => {
  assert.equal(publicCardModel({ ...fullItem, publishDate: null }).dateLabel, 'Date not set yet.');
  assert.equal(publicCardModel({ ...fullItem, publishDate: 'garbage' }).dateLabel, 'Date not set yet.');
});

test('model: waitlist carries the Waitlist chip and keeps the link', () => {
  const model = publicCardModel(fullItem, 'waitlist');
  assert.equal(model.status, 'waitlist');
  assert.equal(model.chipText, 'Waitlist');
  assert.equal(model.bannerText, null);
  assert.equal(model.showLink, true);
});

test('model: cancelled carries the Cancelled banner and drops the link even when one exists', () => {
  const model = publicCardModel(fullItem, 'cancelled');
  assert.equal(model.status, 'cancelled');
  assert.equal(model.bannerText, 'Cancelled');
  assert.equal(model.chipText, null);
  assert.equal(model.showLink, false, 'cancelled drops the link call to action');
  assert.equal(model.link, 'https://example.invalid/rsvp', 'the link itself stays on the model');
});

test('model: the default status is published with no banner and no chip', () => {
  const model = publicCardModel(fullItem);
  assert.equal(model.status, 'published');
  assert.equal(model.bannerText, null);
  assert.equal(model.chipText, null);
});

test('source: the component renders through publicCardModel', () => {
  const src = componentSource();
  assert.match(src, /import \{ publicCardModel, type PublicCardStatus \} from '\.\.\/\.\.\/lib\/publicContentCard';/);
  assert.match(src, /publicCardModel\(item, status\)/);
});

test('source: the link row anchors to the item link, new tab, noopener', () => {
  const src = componentSource();
  assert.match(src, /\{model\.showLink && model\.link && \(/);
  assert.match(src, /href=\{model\.link\}/);
  assert.match(src, /target="_blank"/);
  assert.match(src, /rel="noopener noreferrer"/);
  assert.match(src, />\s*RSVP\s*</);
});

test('source: the cancelled banner renders on var(--darkrust) with var(--cream) text', () => {
  const src = componentSource();
  assert.match(src, /\{model\.bannerText && \(/);
  assert.match(src, /background: 'var\(--darkrust\)'/);
  assert.match(src, /color: 'var\(--cream\)'/);
});

test('source: no refresh-fork variable names in the component', () => {
  const src = componentSource();
  for (const fork of ['--deep-rust', '--clay-velour', '--peach-haze', '--camel-sun', '--sandstone']) {
    assert.ok(!src.includes(fork), `forbidden fork variable present: ${fork}`);
  }
});

test('source: no invented capacity row', () => {
  const src = componentSource();
  assert.ok(!src.includes('spots'), 'lowercase capacity wording found');
  assert.ok(!src.includes('Spots'), 'capitalized capacity wording found');
});
