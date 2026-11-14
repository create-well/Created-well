// Phase 2a (packet K, as amended A1–A5): series-keyed Gatherings
// board and detail. Pins, in order: §2 FlowType unification
// (Surprise-ment round trip, the Podcast alias, the three
// definition sites agreeing), §1 normalizer projections (Series,
// Stage, attendance, Pleasure rollups, the MOVES Flow link,
// attended-names assembly), §1.3/§3 the seriesOf fallback chain
// and board grouping, the field-first workshops exclusion, the
// A3 population diff (base predicate vs head predicate over a
// census-shaped fixture: zero losses; gains are the Podcast
// class §2 corrects plus the series leg A6 adds, with an
// absolute membership pin for the live SLO rows), §4 detail resolution gated on
// settle (A2), the money slice's honest states, and the work
// list join. Source-shape pins close the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeFlow,
  normalizeMove,
  buildFlowAttendedNames,
} from '../src/lib/notionNormalizer.ts';
import {
  isPodyap,
  isWorkshop,
  isCommunityFlow,
  isSloCreateSeries,
  seriesOf,
  boardPopulation,
  groupFlowsBySeries,
  resolveGathering,
  moneySliceState,
  gatheringWorkList,
  NO_SERIES_LABEL,
} from '../src/lib/flows.ts';

const sel = (name) => ({ type: 'select', select: { id: 'x', name, color: 'default' } });
const rel = (ids) => ({ type: 'relation', relation: ids.map((id) => ({ id })) });
const num = (number) => ({ type: 'number', number });
const rollupNum = (number) => ({ type: 'rollup', rollup: { type: 'number', number } });
const title = (text) => ({ type: 'title', title: [{ plain_text: text, href: null }] });
const rich = (text) => ({ type: 'rich_text', rich_text: [{ plain_text: text, href: null }] });

const page = (props, id = '3f024acf-799d-81fb-92c8-d733da89cb22') => ({
  id,
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    Name: title('A flow'),
    Date: { type: 'date', date: { start: '2026-11-05', end: null, time_zone: null } },
    Status: sel('Upcoming'),
    ...props,
  },
});

const flow = (over) => ({
  id: 1, date: '2026-11-05', timeRange: '', location: '', rsvp: {},
  agendaItems: [], notes: '', vibeCheck: '', status: 'scheduled',
  ...over,
});

// ── §2: FlowType unification ─────────────────────────────────────────────────

test('§2 pin (a): a Surprise-ment row carries its flowType end to end', () => {
  const f = normalizeFlow(page({ Type: sel('Surprise-ment') }));
  assert.equal(f.flowType, 'Surprise-ment');
  // Caught via flowType, not only via the theme fallback: strip
  // the theme and the classification still holds.
  assert.equal(isCommunityFlow({ ...f, theme: undefined }), true);
});

test('§2 pin (b): Podcast normalizes to Podyap and classifies as one', () => {
  const f = normalizeFlow(page({ Type: sel('Podcast') }));
  assert.equal(f.flowType, 'Podyap');
  assert.equal(isPodyap(f), true);
  assert.equal(isCommunityFlow(f), true);
});

test('§2: no-canonical source values stay theme-only (named in K §2)', () => {
  for (const raw of ['Drop-in', 'Off-site']) {
    const f = normalizeFlow(page({ Type: sel(raw) }));
    assert.equal(f.flowType, undefined, raw);
    assert.equal(f.theme, raw, raw);
  }
  const sloTyped = normalizeFlow(page({ Type: sel('SLO Create') }));
  assert.equal(sloTyped.flowType, undefined);
});

test('§2 pin (c): the three definition sites name the same 8 values', () => {
  const api = readFileSync(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  const flowsSrc = readFileSync(new URL('../src/lib/flows.ts', import.meta.url), 'utf8');
  const normalizer = readFileSync(new URL('../src/lib/notionNormalizer.ts', import.meta.url), 'utf8');

  const unionMatch = api.match(/export type FlowType = ([^;]+);/);
  assert.ok(unionMatch, 'api.ts carries the FlowType union');
  const unionValues = [...unionMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(unionValues, [
    'Book Club', 'Geyser', 'Internal', 'Open Studio', 'Podyap', 'Pop-Up', 'Surprise-ment', 'Workshop',
  ]);

  // flows.ts defines nothing locally; it imports and re-exports.
  assert.match(flowsSrc, /import type \{[^}]*FlowType[^}]*\} from '\.\.\/app\/components\/api'/);
  assert.match(flowsSrc, /export type \{ FlowType \}/);
  assert.doesNotMatch(flowsSrc, /export type FlowType =/);

  const listMatch = normalizer.match(/const FLOW_TYPES: FlowType\[\] = \[([^\]]+)\]/);
  assert.ok(listMatch, 'the normalizer carries its lookup list');
  const listValues = [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(listValues, unionValues);
  assert.match(normalizer, /FLOW_TYPE_ALIASES: Record<string, FlowType> = \{ podcast: 'Podyap' \}/);
});

// ── §1: normalizer projections ───────────────────────────────────────────────

test('§1: Series and Stage project verbatim; absent stays absent', () => {
  const f = normalizeFlow(page({ Series: sel('SLO Create'), Stage: sel('In the water') }));
  assert.equal(f.series, 'SLO Create');
  assert.equal(f.stage, 'In the water');
  const bare = normalizeFlow(page({}));
  assert.equal(bare.series, undefined);
  assert.equal(bare.stage, undefined);
});

test('§1.4: attendance and Pleasure projections carry only filed numbers', () => {
  const f = normalizeFlow(page({
    'Attendees Actual': num(14),
    'Pleasure In': rollupNum(0),
    'Pleasure Out': rollupNum(25),
  }));
  assert.equal(f.attendeesActual, 14);
  assert.equal(f.pleasureIn, 0, 'a filed 0 is a number the source carries');
  assert.equal(f.pleasureOut, 25);
  const bare = normalizeFlow(page({}));
  assert.equal(bare.attendeesActual, undefined);
  assert.equal(bare.pleasureIn, undefined);
  assert.equal(bare.pleasureOut, undefined);
});

test('§1.4: normalizeMove projects the Flow relation as flowPageId', () => {
  const linked = normalizeMove(page({ Flow: rel(['flow-page-1']) }));
  assert.equal(linked.flowPageId, 'flow-page-1');
  const unlinked = normalizeMove(page({}));
  assert.equal(unlinked.flowPageId, undefined);
});

test('§1.4: attended names resolve at assembly; unresolved ids drop', () => {
  const people = [
    page({ Name: title('Pia Santos') }, 'person-1'),
    page({ Name: title('Omar Reyes') }, 'person-2'),
  ];
  const flows = [
    page({ Attended: rel(['person-1', 'person-ghost', 'person-2']) }, 'flow-1'),
    page({}, 'flow-2'),
  ];
  const names = buildFlowAttendedNames(flows, people);
  assert.deepEqual(names.get('flow-1'), ['Pia Santos', 'Omar Reyes']);
  assert.equal(names.has('flow-2'), false);
});

// ── §1.3 / §3: seriesOf and grouping ─────────────────────────────────────────

test('§1.3: seriesOf — field first, name guard as fallback, else undefined', () => {
  assert.equal(seriesOf(flow({ series: 'Book Club', title: 'SLO Create (11/18)' })), 'Book Club',
    'the field wins even over an SLO name');
  assert.equal(seriesOf(flow({ title: 'SLO Create (11/18)' })), 'SLO Create',
    'a pre-projection payload shape (no series field) falls back to the name guard');
  assert.equal(seriesOf(flow({ title: 'A workshop night' })), undefined);
  assert.equal(isSloCreateSeries(flow({ title: 'SLO Create (11/18)' })), true,
    'the landed name guard itself is untouched');
});

test('§3: the board groups by series — SLO first, unfiled last, every row exactly once', () => {
  const rows = [
    flow({ id: 1, series: 'Podyap', title: 'Episode night' }),
    flow({ id: 2, series: 'SLO Create', title: 'SLO Create (11/18)', stage: 'In the water', date: '2026-11-18' }),
    flow({ id: 3, series: 'Book Club', title: 'Book Club Vol 002' }),
    flow({ id: 4, title: 'SLO Create night' }),
    flow({ id: 5, title: 'Readiness sync' }),
    flow({ id: 6, series: 'Workshop', title: 'Posing Workshop' }),
  ];
  const groups = groupFlowsBySeries(rows);
  assert.deepEqual(groups.map((g) => g.series), ['SLO Create', 'Book Club', 'Workshop', 'Podyap', NO_SERIES_LABEL]);
  assert.deepEqual(groups[0].flows.map((f) => f.id), [2, 4],
    'the field-keyed row and the name-fallback row share the flagship group');
  assert.deepEqual(groups.at(-1).flows.map((f) => f.id), [5]);
  const allIds = groups.flatMap((g) => g.flows.map((f) => f.id)).sort((a, b) => a - b);
  assert.deepEqual(allIds, [1, 2, 3, 4, 5, 6], 'no row dropped, none duplicated');
});

test('§3: within a group — stage order, then date, undated last', () => {
  const rows = [
    flow({ id: 1, series: 'Book Club', stage: 'Depanty', date: '2026-10-01' }),
    flow({ id: 2, series: 'Book Club', stage: 'In the water', date: '2026-12-01' }),
    flow({ id: 3, series: 'Book Club', stage: 'In the water', date: '2026-11-01' }),
    flow({ id: 4, series: 'Book Club', date: '' }),
    flow({ id: 5, series: 'Book Club', date: '2026-09-01' }),
  ];
  const [group] = groupFlowsBySeries(rows);
  // In the water by date (3, 2), then Depanty (1) — a filed stage
  // always precedes no stage — then the unstaged by date with the
  // undated last (5, 4).
  assert.deepEqual(group.flows.map((f) => f.id), [3, 2, 1, 5, 4]);
});

// ── §3: the field-first workshops exclusion ──────────────────────────────────

test('§3: a Series = SLO Create row under a non-SLO name is excluded from workshops', () => {
  const disguised = flow({ series: 'SLO Create', title: 'Mosaic Mirrors', flowType: 'Workshop' });
  const shown = [disguised].filter((f) => isWorkshop(f) && seriesOf(f) !== 'SLO Create');
  assert.deepEqual(shown, [], 'the field leg excludes it where the name guard alone could not');
  const nameOnly = flow({ title: 'SLO Create (12/16)', flowType: 'Workshop' });
  const shown2 = [nameOnly].filter((f) => isWorkshop(f) && seriesOf(f) !== 'SLO Create');
  assert.deepEqual(shown2, [], 'the fallback leg still excludes a series-less SLO row');
});

// ── A3: the population diff ──────────────────────────────────────────────────
// The base predicate of record at 89f568b0: the parent's membership
// rule (communityFlows, or all flows when none classify) over rows
// whose flowType came from the BASE normalizer (the 7-value list,
// no Podcast alias). The head predicate is boardPopulation (K §3
// as amended A6): the community slice plus the series leg.
// matchesFlowType / isCommunityFlow themselves did not change in
// this phase, so the diff isolates exactly what §2 and A6 changed.

const BASE_FLOW_TYPES = ['Podyap', 'Workshop', 'Book Club', 'Open Studio', 'Pop-Up', 'Geyser', 'Internal'];
function baseFlowType(typeRaw) {
  return BASE_FLOW_TYPES.find((t) => t.toLowerCase() === (typeRaw || '').toLowerCase()) ?? undefined;
}
function membership(rows) {
  const community = rows.filter(isCommunityFlow);
  return new Set((community.length > 0 ? community : rows).map((f) => f.id));
}

test('A3: population diff — zero losses; gains are the Podcast class and the A6 series leg', () => {
  // Census-shaped fixture: one row per discriminating class in
  // the live corpus (Type census of record, 2026-11-14).
  const fixtures = [
    page({ Type: sel('Podcast'), Series: sel('Podyap') }, 'pod-raw'),
    page({ Type: sel('Podcast'), Theme: rich('Podyap'), Series: sel('Podyap') }, 'pod-themed'),
    page({ Type: sel('Book Club'), Series: sel('Book Club') }, 'club'),
    page({ Type: sel('Internal') }, 'internal'),
    page({ Type: sel('Off-site'), Series: sel('SLO Create'), Name: title('SLO Create night') }, 'slo-wrapped'),
    page({ Type: sel('Workshop'), Series: sel('Workshop') }, 'shop'),
    page({ Series: sel('SLO Create'), Name: title('SLO Create (11/18)') }, 'slo-1118'),
    page({}, 'untyped'),
  ];
  const headRows = fixtures.map((pg) => normalizeFlow(pg));
  const baseRows = fixtures.map((pg) => ({ ...normalizeFlow(pg), flowType: baseFlowType(pg.properties.Type?.select?.name ?? '') }));
  const byPageId = new Map(fixtures.map((pg, i) => [headRows[i].id, pg.id]));
  const baseSet = membership(baseRows);
  const headSet = new Set(boardPopulation(headRows).map((f) => f.id));
  const losses = [...baseSet].filter((id) => !headSet.has(id)).map((id) => byPageId.get(id));
  const gains = [...headSet].filter((id) => !baseSet.has(id)).map((id) => byPageId.get(id));
  assert.deepEqual(losses, []);
  assert.deepEqual(gains, ['pod-raw', 'slo-wrapped', 'slo-1118'],
    'pod-raw is §2\u2019s Podcast correction; slo-wrapped and slo-1118 enter on A6\u2019s series leg');
});

test('A6: the live SLO rows are IN the population — an absolute pin, not a diff', () => {
  // The three live rows' property shapes of record (2026-11-14):
  // Series filed, Theme empty, classifying outside the community
  // slice — the exact shapes the frozen population excluded and
  // a set diff could not see. This pin asserts membership
  // absolutely.
  const live = [
    page({ Series: sel('SLO Create'), Name: title('SLO Create (11/18)') }, 'live-1118'),
    page({ Series: sel('SLO Create'), Type: sel('Off-site'), Name: title('SLO Create night') }, 'live-night'),
    page({ Series: sel('SLO Create'), Name: title('SLO Create: Mosaic Mirrors (10/15)') }, 'live-mosaic'),
  ].map((pg) => normalizeFlow(pg));
  for (const f of live) {
    assert.equal(isCommunityFlow(f), false, 'the A6 premise: outside the community slice');
    assert.equal(seriesOf(f), 'SLO Create');
  }
  const population = boardPopulation(live);
  assert.deepEqual(new Set(population.map((f) => f.id)), new Set(live.map((f) => f.id)),
    'all three live SLO rows render on the board');
  const groups = groupFlowsBySeries(population);
  assert.equal(groups[0].series, 'SLO Create');
  assert.deepEqual(new Set(groups[0].flows.map((f) => f.id)), new Set(live.map((f) => f.id)),
    'and they group together in the flagship group');
  // The leg runs on seriesOf, not the field alone (exec's
  // ruling): a name-only SLO row with no Series filed joins too.
  const nameOnly = normalizeFlow(page({ Name: title('SLO Create (12/16)') }, 'live-name-only'));
  assert.equal(nameOnly.series, undefined);
  assert.ok(boardPopulation([nameOnly]).includes(nameOnly),
    'the name-guard fallback leg carries a series-less SLO row onto the board');
});

// ── §4 / A2: detail resolution and the money slice ───────────────────────────

test('A2: not-found is gated on settle', () => {
  const rows = [flow({ id: 7 })];
  assert.equal(resolveGathering(rows, 'loading', 7).state, 'loading');
  assert.equal(resolveGathering(rows, 'failed', 7).state, 'loading');
  assert.equal(resolveGathering(rows, 'fresh', 7).state, 'found');
  assert.equal(resolveGathering(rows, 'stale', 7).state, 'found',
    'a stale payload is settled: its rows resolve under the stale label');
  assert.equal(resolveGathering(rows, 'fresh', 99).state, 'not-found');
  assert.equal(resolveGathering(undefined, 'fresh', 7).state, 'not-found',
    'a settled payload with no flows slice is an honest not-found, not a forever load');
  assert.equal(resolveGathering(undefined, 'loading', 7).state, 'loading');
});

test('§4.5: the money slice renders filed numbers, never invents them', () => {
  assert.deepEqual(moneySliceState(flow({ pleasureIn: 0, pleasureOut: 0 })), { kind: 'numbers', in: 0, out: 0 });
  assert.deepEqual(moneySliceState(flow({ pleasureOut: 40 })), { kind: 'numbers', in: 0, out: 40 });
  assert.deepEqual(moneySliceState(flow({})), { kind: 'absent' });
});

test('§4.4: the work list joins on the Flow relation, open first, Phase 1 order', () => {
  const gathering = flow({ id: 3, notionPageId: 'flow-9' });
  const tasks = [
    { id: 1, person: 'pia', title: 'Later open', status: 'todo', priority: 'low', due_date: '2026-11-20', flowPageId: 'flow-9' },
    { id: 2, person: 'omar', title: 'Earlier open', status: 'todo', priority: 'high', due_date: '2026-11-10', flowPageId: 'flow-9' },
    { id: 3, person: 'pia', title: 'Done thing', status: 'done', priority: 'low', due_date: '2026-11-01', flowPageId: 'flow-9' },
    { id: 4, person: 'pia', title: 'Unlinked', status: 'todo', priority: 'low', due_date: '2026-11-01' },
    { id: 5, person: 'pia', title: 'Other gathering', status: 'todo', priority: 'low', due_date: '2026-11-01', flowPageId: 'flow-2' },
  ];
  assert.deepEqual(gatheringWorkList(tasks, gathering).map((t) => t.id), [2, 1, 3]);
  assert.deepEqual(gatheringWorkList(tasks, flow({ id: 4 })), [],
    'a gathering with no Notion page id joins nothing');
});

// ── Source-shape pins ────────────────────────────────────────────────────────

test('source: the board, the detail route, and the settle gate are wired', () => {
  const community = readFileSync(new URL('../src/app/components/CommunityEventsView.tsx', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../src/app/routes.ts', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/app/pages/GatheringDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(community, /function BoardTab/);
  assert.match(community, /boardPopulation\(allFlows\)/);
  assert.match(community, /groupFlowsBySeries\(flows\)/);
  assert.match(community, /label: 'Board'/);
  assert.match(community, /navigate\(`\/gatherings\/\$\{flow\.id\}`\)/);
  assert.match(routes, /path: 'gatherings\/:id'/);
  assert.match(detail, /resolveGathering\(data\.coFlowDates, data\.syncStatus, numericId\)/);
  assert.match(detail, /gatheringWorkList\(data\.tasks \?\? \[\], flow\)/);
  assert.match(detail, /moneySliceState\(flow\)/);
});
