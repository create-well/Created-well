// BUILDER-B3 (connection-state chip, BRIEF 2026-11-26): the
// connection-state-wording template's model layer and component (File B
// "Connection States" page 3:168, sets 3:181 and 3:188). The two
// families stay separate sets in the model, the component, and these
// tests: the kit connection-state family (NOT CONNECTED / VERIFYING /
// LIVE / UNREACHABLE / WRITES DISABLED, never red) and the dashboard
// freshness family (Fresh / Aging / Stale, mirroring
// src/lib/freshnessLabel.ts's render-time band — the band strings are
// already the labels). Model pins: each of the five connection states
// maps to its exact kit label, each of the three freshness bands maps
// to its exact label, no connection state yields a freshness label and
// no freshness band yields a connection label, the model's family field
// echoes the input family, CONNECTION_STATE_LABELS carries exactly five
// entries and the freshness side exactly three, and every state gets
// its own tone with no red or danger tone on the connection family.
// Source pins on the component: it renders through connectionChipModel,
// it carries role="status", no refresh-fork variable names, no fetch or
// localStorage, and no imports from pages or api.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectionChipModel, CONNECTION_STATE_LABELS } from '../src/lib/connectionStateChip.ts';
import { freshnessBand } from '../src/lib/freshnessLabel.ts';

const componentSource = () => readFileSync(
  new URL('../src/app/components/ConnectionStateChip.tsx', import.meta.url),
  'utf8',
);

const CONNECTION_STATES = ['not-connected', 'verifying', 'live', 'unreachable', 'writes-disabled'];
const KIT_LABELS = ['NOT CONNECTED', 'VERIFYING', 'LIVE', 'UNREACHABLE', 'WRITES DISABLED'];
const FRESHNESS_BANDS = ['Fresh', 'Aging', 'Stale'];

test('model: each connection state maps to its exact kit label', () => {
  CONNECTION_STATES.forEach((state, i) => {
    const model = connectionChipModel({ family: 'connection', state });
    assert.equal(model.label, KIT_LABELS[i], `${state} label`);
    assert.equal(model.family, 'connection');
  });
});

test('model: each freshness band maps to its exact label', () => {
  FRESHNESS_BANDS.forEach((band) => {
    const model = connectionChipModel({ family: 'freshness', band });
    assert.equal(model.label, band, `${band} maps to itself`);
    assert.equal(model.family, 'freshness');
  });
});

test('model: the two families stay distinct — no shared labels either way', () => {
  const connectionLabels = CONNECTION_STATES.map(
    (state) => connectionChipModel({ family: 'connection', state }).label,
  );
  const freshnessLabels = FRESHNESS_BANDS.map(
    (band) => connectionChipModel({ family: 'freshness', band }).label,
  );
  for (const label of connectionLabels) {
    assert.ok(!FRESHNESS_BANDS.includes(label), `connection label collides with freshness: ${label}`);
  }
  for (const label of freshnessLabels) {
    assert.ok(!Object.values(CONNECTION_STATE_LABELS).includes(label),
      `freshness label collides with connection: ${label}`);
  }
});

test('model: the family field echoes the input family for all eight states', () => {
  for (const state of CONNECTION_STATES) {
    assert.equal(connectionChipModel({ family: 'connection', state }).family, 'connection');
  }
  for (const band of FRESHNESS_BANDS) {
    assert.equal(connectionChipModel({ family: 'freshness', band }).family, 'freshness');
  }
});

test('model: CONNECTION_STATE_LABELS carries exactly the five kit entries', () => {
  assert.equal(Object.keys(CONNECTION_STATE_LABELS).length, 5);
  assert.deepEqual(
    CONNECTION_STATES.map((state) => CONNECTION_STATE_LABELS[state]),
    KIT_LABELS,
  );
});

test('model: the freshness side carries exactly the three bands', () => {
  const labels = FRESHNESS_BANDS.map(
    (band) => connectionChipModel({ family: 'freshness', band }).label,
  );
  assert.deepEqual(labels, ['Fresh', 'Aging', 'Stale']);
});

test('model: a freshness band derived at render time feeds the chip label', () => {
  // The derivation rule stays in freshnessLabel.ts: the caller derives
  // the band from the load timestamp at render time and the chip only
  // renders the band it is handed.
  const now = Date.parse('2026-11-26T12:00:00Z');
  const loadedAt = (secondsAgo) => new Date(now - secondsAgo * 1000);
  assert.equal(
    connectionChipModel({ family: 'freshness', band: freshnessBand(loadedAt(60), now) }).label,
    'Fresh',
  );
  assert.equal(
    connectionChipModel({ family: 'freshness', band: freshnessBand(loadedAt(600), now) }).label,
    'Aging',
  );
  assert.equal(
    connectionChipModel({ family: 'freshness', band: freshnessBand(loadedAt(1200), now) }).label,
    'Stale',
  );
});

test('model: every state gets its own tone; the connection family holds no red or danger tone', () => {
  const tones = [
    ...CONNECTION_STATES.map((state) => connectionChipModel({ family: 'connection', state }).tone),
    ...FRESHNESS_BANDS.map((band) => connectionChipModel({ family: 'freshness', band }).tone),
  ];
  assert.equal(new Set(tones).size, tones.length, 'one distinct tone per state, none shared');
  const connectionTones = CONNECTION_STATES.map(
    (state) => connectionChipModel({ family: 'connection', state }).tone,
  );
  for (const tone of connectionTones) {
    assert.ok(!/red|danger/i.test(tone), `connection tone trips the never-red rule: ${tone}`);
  }
});

test('source: the component renders through connectionChipModel', () => {
  const src = componentSource();
  assert.match(src, /import \{ connectionChipModel, type ConnectionChipTone \} from '\.\.\/\.\.\/lib\/connectionStateChip';/);
  assert.match(src, /connectionChipModel\(input\)/);
});

test('source: the chip is a status span carrying a dot and the model label', () => {
  const src = componentSource();
  assert.match(src, /role="status"/);
  assert.match(src, /\{model\.label\}/);
  assert.match(src, /borderRadius: 'var\(--r-pill\)'/);
});

test('source: no refresh-fork variable names in the component', () => {
  const src = componentSource();
  for (const fork of ['--deep-rust', '--clay-velour', '--peach-haze', '--camel-sun', '--sandstone']) {
    assert.ok(!src.includes(fork), `forbidden fork variable present: ${fork}`);
  }
});

test('source: the component builds no fetch, storage, or page/api coupling of any kind', () => {
  const src = componentSource();
  assert.ok(!src.includes('fetch('), 'fetch call found');
  assert.ok(!src.includes('localStorage'), 'localStorage found');
  assert.doesNotMatch(src, /from '[^']*(pages|api\/)/, 'imports from pages or api found');
});
