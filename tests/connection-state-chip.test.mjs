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

// ---------------------------------------------------------------------------
// PR #129 fix leg (contrast and casing, 2026-11-26): QA scored two defects
// at head 06f5be8 — three tone pairings under WCAG AA 4.5:1 at the chip's
// 12px label size (cream on rust at 3.69:1, darkrust at 62% over cream at
// 2.52:1, darkrust on camel 30% in cream at 4.14:1), and the shared span's
// textTransform: 'uppercase' rendering the freshness family as FRESH /
// AGING / STALE against its settled casing. The fix re-pairs live and
// current to cream on var(--darkrust) (4.92:1), pending and aging to camel
// 12% in cream (4.59:1), readonly to solid var(--darkrust) text (4.92:1),
// and deletes the transform; the connection family renders byte-identically
// because its labels are uppercase literals in CONNECTION_STATE_LABELS.

// The record's token hexes (design-tokens-v1.1.json), bound here so the
// pairings are computed, never assumed.
const TOKEN_HEXES = {
  rust: [0xC2, 0x5B, 0x38],     // #C25B38
  darkrust: [0xA3, 0x4C, 0x2F], // #A34C2F
  camel: [0xD4, 0xA7, 0x71],    // #D4A771
  clay: [0xE8, 0xAF, 0x93],     // #E8AF93
  peach: [0xFF, 0xDE, 0xC2],    // #FFDEC2
  sand: [0xEA, 0xE3, 0xDB],     // #EAE3DB
  cream: [0xF6, 0xEB, 0xDF],    // #F6EBDF
};

function relativeLuminance([r, g, b]) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Channel-wise sRGB interpolation, mirroring color-mix(in srgb, A p%, B):
// A contributes p%, B contributes the rest.
function colorMix(tokenA, percentA, tokenB) {
  return tokenA.map((channel, i) =>
    Math.round(channel * (percentA / 100) + tokenB[i] * (1 - percentA / 100)),
  );
}

// The eight fixed TONE_STYLES pairings, text against chip ground. The
// readonly chip ground is transparent, so its text is measured over the
// cream page. Grounds: a solid token, or a mix entry [token, percent,
// baseToken]. The three re-paired tones also pin the brief's stated
// ratios within 0.01.
const PAIRINGS = [
  { tone: 'idle', states: 'NOT CONNECTED', text: 'darkrust', ground: { solid: 'sand' } },
  {
    tone: 'pending',
    states: 'VERIFYING',
    text: 'darkrust',
    ground: { mix: ['camel', 12, 'cream'] },
    expected: 4.59,
  },
  {
    tone: 'live',
    states: 'LIVE',
    text: 'cream',
    ground: { solid: 'darkrust' },
    expected: 4.92,
  },
  {
    tone: 'unreachable',
    states: 'UNREACHABLE',
    text: 'darkrust',
    ground: { mix: ['peach', 65, 'cream'] },
  },
  { tone: 'readonly', states: 'WRITES DISABLED', text: 'darkrust', ground: { solid: 'cream' }, expected: 4.92 },
  {
    tone: 'current',
    states: 'Fresh',
    text: 'cream',
    ground: { solid: 'darkrust' },
    expected: 4.92,
  },
  {
    tone: 'aging',
    states: 'Aging',
    text: 'darkrust',
    ground: { mix: ['camel', 12, 'cream'] },
    expected: 4.59,
  },
  { tone: 'stale', states: 'Stale', text: 'darkrust', ground: { solid: 'sand' } },
];

function groundRgb(ground) {
  if (ground.solid) return TOKEN_HEXES[ground.solid];
  const [token, percent, base] = ground.mix;
  return colorMix(TOKEN_HEXES[token], percent, TOKEN_HEXES[base]);
}

test('fix (contrast): every tone pairing computes at or above WCAG AA 4.5:1', () => {
  for (const { tone, states, text, ground, expected } of PAIRINGS) {
    const ratio = contrastRatio(TOKEN_HEXES[text], groundRgb(ground));
    assert.ok(
      ratio >= 4.5,
      `${tone} (${states}): ${text} on ${JSON.stringify(ground)} computes ${ratio.toFixed(2)}:1, below 4.5:1`,
    );
    if (expected !== undefined) {
      assert.ok(
        Math.abs(ratio - expected) < 0.01,
        `${tone} (${states}): computed ${ratio.toFixed(3)}:1 should match the record ${expected}:1 within 0.01`,
      );
    }
  }
});

test('fix (source): the re-pairing is in the component — darkrust grounds, camel 12%, solid readonly text', () => {
  const src = componentSource();
  const darkrustGrounds = src.match(/background: 'var\(--darkrust\)', color: 'var\(--cream\)'/g) ?? [];
  assert.equal(darkrustGrounds.length, 2, 'live and current entries pair cream text on a darkrust ground');
  const camelMixes = src.match(/color-mix\(in srgb, var\(--camel\) 12%, var\(--cream\)\)/g) ?? [];
  assert.equal(camelMixes.length, 2, 'pending and aging entries mix camel at 12%');
  assert.match(src, /readonly:[\s\S]*?color: 'var\(--darkrust\)'/);
});

test('fix (source): the failed pairings are gone — no camel 30%, no darkrust 62%, no cream-on-rust entry', () => {
  const src = componentSource();
  assert.ok(!src.includes('var(--camel) 30%'), 'camel 30% mix still present');
  assert.ok(!src.includes('var(--darkrust) 62%'), 'darkrust 62% text still present');
  assert.doesNotMatch(
    src,
    /background: 'var\(--rust\)', color: 'var\(--cream\)'/,
    'the old cream-on-rust live pairing is still present',
  );
});

test('fix (casing): no textTransform anywhere in the component', () => {
  const src = componentSource();
  assert.ok(!src.includes('textTransform'), 'textTransform still present in the component');
});

test('fix (casing): connection labels are uppercase literals, so removing the transform changes nothing for that family', () => {
  for (const [state, label] of Object.entries(CONNECTION_STATE_LABELS)) {
    assert.equal(label, label.toUpperCase(), `${state} label is not an uppercase literal`);
  }
});

test('fix (casing): freshness labels are not all-uppercase, so the render-casing fix has a model-side anchor', () => {
  for (const band of FRESHNESS_BANDS) {
    assert.notEqual(band, band.toUpperCase(), `${band} would render identically under a transform`);
  }
});
