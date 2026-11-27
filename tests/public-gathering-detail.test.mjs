// BUILDER-B2 (public gatherings detail, BRIEF 2026-11-26): the
// gatherings-detail template's model layer and component (File B
// "Gatherings Detail" pattern of record). There is no public gatherings
// data leg, so the model takes display strings as supplied and never
// formats or invents: a null, empty, or whitespace-only field is absent
// (facts drop it, coverStory and rsvpByLine become null), the facts
// block carries only present fields in DATE, TIME, LOCATION order, the
// CTA label is the File B wording of record, and an empty title stays
// empty. Source pins on the component: it renders through
// publicGatheringDetailModel, the CTA height is var(--cta-height), the
// submit handler preventDefaults before anything else, no fetch or
// localStorage, no pages or api imports, and no refresh-fork variable
// names. Fixture strings carry the [ ] placeholder marker per the
// program's placeholder standard — they are fixtures, not real data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicGatheringDetailModel } from '../src/lib/publicGatheringDetail.ts';

const componentSource = () => readFileSync(
  new URL('../src/app/components/PublicGatheringDetail.tsx', import.meta.url),
  'utf8',
);

const fullInput = {
  title: '[ ] mirror making night',
  date: 'Dec 10, 2026',
  time: '6:00 pm',
  location: 'San Luis Obispo',
  rsvpBy: 'RSVP by Dec 8',
  coverStory: '[ ] a night of making and listening.',
};

test('model: a full input maps every field, facts in DATE, TIME, LOCATION order', () => {
  const model = publicGatheringDetailModel(fullInput);
  assert.equal(model.title, '[ ] mirror making night');
  assert.equal(model.coverStory, '[ ] a night of making and listening.');
  assert.deepEqual(model.facts, [
    { label: 'DATE', value: 'Dec 10, 2026' },
    { label: 'TIME', value: '6:00 pm' },
    { label: 'LOCATION', value: 'San Luis Obispo' },
  ]);
  assert.equal(model.rsvpByLine, 'RSVP by Dec 8');
  assert.equal(model.ctaLabel, 'Save my spot');
});

test('model: null fields drop out of facts and leave coverStory and rsvpByLine null', () => {
  const model = publicGatheringDetailModel({
    title: '[ ] mirror making night',
    date: null,
    time: null,
    location: null,
    rsvpBy: null,
    coverStory: null,
  });
  assert.deepEqual(model.facts, []);
  assert.equal(model.coverStory, null);
  assert.equal(model.rsvpByLine, null);
});

test('model: empty and whitespace-only strings normalize to absent', () => {
  const model = publicGatheringDetailModel({
    title: '[ ] mirror making night',
    date: '',
    time: '   ',
    location: 'San Luis Obispo',
    rsvpBy: '  ',
    coverStory: '',
  });
  assert.deepEqual(model.facts, [
    { label: 'LOCATION', value: 'San Luis Obispo' },
  ]);
  assert.equal(model.coverStory, null);
  assert.equal(model.rsvpByLine, null);
});

test('model: a partial input (only title and location) yields exactly one fact', () => {
  const model = publicGatheringDetailModel({
    title: '[ ] mirror making night',
    date: null,
    time: null,
    location: 'San Luis Obispo',
    rsvpBy: null,
    coverStory: null,
  });
  assert.equal(model.facts.length, 1);
  assert.deepEqual(model.facts[0], { label: 'LOCATION', value: 'San Luis Obispo' });
});

test('model: ctaLabel is the File B CTA wording of record', () => {
  assert.equal(publicGatheringDetailModel(fullInput).ctaLabel, 'Save my spot');
});

test('model: an empty title stays empty, no placeholder invented', () => {
  const model = publicGatheringDetailModel({
    title: '',
    date: null,
    time: null,
    location: null,
    rsvpBy: null,
    coverStory: null,
  });
  assert.equal(model.title, '');
});

test('source: the component renders through publicGatheringDetailModel', () => {
  const src = componentSource();
  assert.match(src, /import \{ publicGatheringDetailModel \} from '\.\.\/\.\.\/lib\/publicGatheringDetail';/);
  assert.match(src, /publicGatheringDetailModel\(detail\)/);
});

test('source: the email capture row pins the File B field attributes and the CTA height token', () => {
  const src = componentSource();
  assert.match(src, /type="email"/);
  assert.match(src, /name="email"/);
  assert.match(src, /placeholder="Email address"/);
  assert.match(src, /height: 'var\(--cta-height\)'/);
  assert.match(src, /\{model\.ctaLabel\}/);
});

test('source: the submit handler preventDefaults unconditionally', () => {
  const src = componentSource();
  assert.match(src, /event\.preventDefault\(\)/);
  const submit = src.slice(src.indexOf('handleSubmit'));
  assert.ok(
    submit.indexOf('event.preventDefault()') < submit.indexOf('onSaveSpot('),
    'preventDefault comes before any onSaveSpot call',
  );
});

test('source: the component builds no write path of any kind', () => {
  const src = componentSource();
  assert.ok(!src.includes('fetch('), 'fetch call found');
  assert.ok(!src.includes('localStorage'), 'localStorage found');
  assert.doesNotMatch(src, /from '[^']*(pages|api\/)/, 'imports from pages or api found');
});

test('source: no refresh-fork variable names in the component', () => {
  const src = componentSource();
  for (const fork of ['--deep-rust', '--clay-velour', '--peach-haze', '--camel-sun', '--sandstone']) {
    assert.ok(!src.includes(fork), `forbidden fork variable present: ${fork}`);
  }
});
