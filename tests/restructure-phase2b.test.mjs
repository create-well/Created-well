// Phase 2b (packet L, as amended A1–A7): depanty queue and
// day-of. Pins, in order: A3 projections (Craft Lead resolved to
// a name; the linked EVENTS row's start/end + guest list at
// assembly, the partifulLink pattern), A4's attended-ids
// projection, §2 the exit test behind its one named function
// (three legs independently; A7's mechanical numbers test; A2's
// payload-field follow-ups leg with its vacuous pass), §1 queue
// membership computed (happened + exit-fail; A1's depanty-Move
// admission, Vol 003's shape; A5's dateless age and order), the
// first-citizens case (Mosaic Mirrors failing all three legs),
// §5 the day-of time rule, §4.2/A6 the run list, §4.3 the gear
// check. Surface and writer pins close the file in their own
// sections below.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeFlow,
  buildFlowCraftLeads,
  buildFlowEventInfo,
} from '../src/lib/notionNormalizer.ts';
import {
  depantyExitTest,
  depantyQueue,
  gatheringHappened,
  isDepantyMove,
  dayOfTimes,
  dayOfRunList,
  gearCheckState,
  DEPANTY_RULE_LABEL,
} from '../src/lib/flows.ts';

const sel = (name) => ({ type: 'select', select: { id: 'x', name, color: 'default' } });
const rel = (ids) => ({ type: 'relation', relation: ids.map((id) => ({ id })) });
const rollupNum = (number) => ({ type: 'rollup', rollup: { type: 'number', number } });
const title = (text) => ({ type: 'title', title: [{ plain_text: text, href: null }] });
const rich = (text) => ({ type: 'rich_text', rich_text: [{ plain_text: text, href: null }] });
const dateProp = (start, end = null) => ({ type: 'date', date: { start, end, time_zone: null } });

const page = (props, id) => ({
  id,
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    Name: title('A flow'),
    Date: dateProp('2026-11-05'),
    Status: sel('Upcoming'),
    ...props,
  },
});

const flow = (over) => ({
  id: 1, date: '2026-11-05', timeRange: '', location: '', rsvp: {},
  agendaItems: [], notes: '', vibeCheck: '', status: 'scheduled',
  ...over,
});

const task = (over) => ({
  id: 1, person: '', title: 'A move', status: 'todo', priority: 'medium',
  ...over,
});

const TODAY = '2026-11-14';

// ── A3/A4 projections ────────────────────────────────────────────────────────

test('A3a: Craft Lead resolves to the PEOPLE name at assembly', () => {
  const people = [page({ Name: title('Pia Santos') }, 'person-pia')];
  const flows = [page({ 'Craft Lead': rel(['person-pia']) }, 'flow-1')];
  const leads = buildFlowCraftLeads(flows, people);
  assert.equal(leads.get('flow-1'), 'Pia Santos');
  // An unresolved relation id is dropped, never rendered as a name.
  const orphan = [page({ 'Craft Lead': rel(['person-ghost']) }, 'flow-2')];
  assert.equal(buildFlowCraftLeads(orphan, people).has('flow-2'), false);
});

test('A3b/A4: the linked EVENTS row lends start/end and its guest list', () => {
  const people = [
    page({ Name: title('Guest One') }, 'person-g1'),
    page({ Name: title('Guest Two') }, 'person-g2'),
  ];
  const events = [page({
    Event: title('bookish craft night'),
    Date: dateProp('2026-11-19T02:00:00.000Z', '2026-11-19T04:30:00.000Z'),
    'Related to PEOPLE (Events Attended)': rel(['person-g1', 'person-g2', 'person-ghost']),
  }, 'event-1')];
  const flows = [page({ Events: rel(['event-1']) }, 'flow-1')];
  const info = buildFlowEventInfo(flows, events, people);
  const entry = info.get('flow-1');
  assert.equal(entry.start, '2026-11-19T02:00:00.000Z');
  assert.equal(entry.end, '2026-11-19T04:30:00.000Z');
  // Unresolved guest ids are dropped; ids + names travel together.
  assert.deepEqual(entry.guests, [
    { id: 'person-g1', name: 'Guest One' },
    { id: 'person-g2', name: 'Guest Two' },
  ]);
  // No linked event row: absent from the map (A4's distinct state).
  const unlinked = [page({}, 'flow-2')];
  assert.equal(buildFlowEventInfo(unlinked, events, people).has('flow-2'), false);
});

test('A4: a linked EVENTS row with an empty guest relation projects an empty list', () => {
  const events = [page({
    Event: title('bookish craft night'),
    Date: dateProp('2026-11-19T02:00:00.000Z', '2026-11-19T04:30:00.000Z'),
    'Related to PEOPLE (Events Attended)': rel([]),
  }, 'event-1')];
  const flows = [page({ Events: rel(['event-1']) }, 'flow-1')];
  const entry = buildFlowEventInfo(flows, events, []).get('flow-1');
  assert.deepEqual(entry.guests, []);
});

test('A4: normalizeFlow projects the Attended relation ids', () => {
  const f = normalizeFlow(page({ Attended: rel(['person-g1', 'person-g2']) }, 'flow-1'));
  assert.deepEqual(f.attendedIds, ['person-g1', 'person-g2']);
  const none = normalizeFlow(page({}, 'flow-2'));
  assert.deepEqual(none.attendedIds, []);
});

// ── §2 the exit test (one named function) ────────────────────────────────────

test('exit test: all three legs pass together', () => {
  const f = flow({
    notionPageId: 'flow-1', pleasureIn: 120, pleasureOut: 40,
    sessionNotes: 'Great night.',
  });
  const tasks = [task({ flowPageId: 'flow-1', person: 'monny', due_date: '2026-11-10' })];
  const r = depantyExitTest(f, tasks);
  assert.equal(r.pass, true);
  assert.deepEqual(r.failing, []);
});

test('A7: bare 0/0 with Retro empty fails the numbers leg, named as unrecorded', () => {
  const f = flow({ notionPageId: 'flow-1', pleasureIn: 0, pleasureOut: 0 });
  const r = depantyExitTest(f, []);
  assert.equal(r.numbers.pass, false);
  assert.equal(r.numbers.label, 'numbers unrecorded (0/0 filed, no note)');
});

test('A7: 0/0 with the Retro field filed passes the numbers leg', () => {
  const f = flow({
    notionPageId: 'flow-1', pleasureIn: 0, pleasureOut: 0,
    sessionNotes: 'Free night, no money moved.',
  });
  const r = depantyExitTest(f, []);
  assert.equal(r.numbers.pass, true);
});

test('exit test: absent rollups fail the numbers leg as not recorded', () => {
  const r = depantyExitTest(flow({ notionPageId: 'flow-1' }), []);
  assert.equal(r.numbers.pass, false);
  assert.equal(r.numbers.label, 'numbers not recorded');
});

test('A2: the follow-ups leg reads person + due_date; vacuous pass on zero Moves', () => {
  const f = flow({ notionPageId: 'flow-1', pleasureIn: 5, sessionNotes: 'retro' });
  assert.equal(depantyExitTest(f, []).followUps.pass, true);
  const unowned = [task({ flowPageId: 'flow-1', person: '', due_date: '2026-11-10' })];
  assert.equal(depantyExitTest(f, unowned).followUps.pass, false);
  const undated = [task({ flowPageId: 'flow-1', person: 'omar' })];
  assert.equal(depantyExitTest(f, undated).followUps.pass, false);
  // Done work is not a follow-up: a closed unowned Move cannot fail the leg.
  const closed = [task({ flowPageId: 'flow-1', status: 'done', person: '' })];
  assert.equal(depantyExitTest(f, closed).followUps.pass, true);
  // Moves linked to other gatherings never count here.
  const foreign = [task({ flowPageId: 'flow-9', person: '' })];
  assert.equal(depantyExitTest(f, foreign).followUps.pass, true);
});

test('exit test: the retro leg reads the session-notes field', () => {
  const f = flow({ notionPageId: 'flow-1', pleasureIn: 5 });
  assert.equal(depantyExitTest(f, []).retro.pass, false);
  assert.equal(depantyExitTest({ ...f, sessionNotes: 'Filed.' }, []).retro.pass, true);
});

test('first citizens: Mosaic Mirrors fails all three legs', () => {
  const mosaic = flow({
    id: 7, title: 'SLO Create: Mosaic Mirrors (10/15)', date: '2026-10-15',
    status: 'wrapped', stage: undefined, series: 'SLO Create',
    notionPageId: 'flow-mosaic', pleasureIn: 0, pleasureOut: 0,
  });
  const moves = [task({
    id: 9, title: 'Depanty — SLO Create: Mosaic Mirrors (10/15)',
    flowPageId: 'flow-mosaic', status: 'in_progress', person: '',
  })];
  const r = depantyExitTest(mosaic, moves);
  assert.equal(r.pass, false);
  assert.equal(r.failing.length, 3);
  const queue = depantyQueue([mosaic], moves, TODAY);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].depantyMove.id, 9);
});

// ── §1 membership (computed, A1, A5) ─────────────────────────────────────────

test('membership: happened + exit-fail is in; passing is out; future is never in', () => {
  const stuck = flow({ id: 1, date: '2026-10-01', notionPageId: 'f1' });
  const closedOut = flow({
    id: 2, date: '2026-10-02', notionPageId: 'f2',
    pleasureIn: 10, sessionNotes: 'retro',
  });
  const future = flow({ id: 3, date: '2026-12-01', notionPageId: 'f3' });
  const wrappedStage = flow({ id: 4, date: '', stage: 'Wrapped', notionPageId: 'f4' });
  const queue = depantyQueue([stuck, closedOut, future, wrappedStage], [], TODAY);
  assert.deepEqual(queue.map((r) => r.flow.id), [1, 4]);
});

test('A1: an open depanty Move admits its gathering regardless of date or stage', () => {
  // HD Book Club Vol 003's live shape: no Date, no Stage, Status
  // Upcoming — and a depanty Move due 2026-11-08.
  const vol003 = flow({
    id: 5, title: 'Human Design Book Club — Vol 003', date: '',
    stage: undefined, status: 'scheduled', notionPageId: 'f5',
  });
  const move = task({
    id: 50, title: 'Depanty — Human Design Book Club — Vol 003',
    flowPageId: 'f5', status: 'in_progress', person: 'monny', due_date: '2026-11-08',
  });
  assert.equal(gatheringHappened(vol003, TODAY), false);
  assert.equal(isDepantyMove(move), true);
  const queue = depantyQueue([vol003], [move], TODAY);
  assert.equal(queue.length, 1);
  // A closed depanty Move does not admit.
  const doneMove = { ...move, status: 'done' };
  assert.equal(depantyQueue([vol003], [doneMove], TODAY).length, 0);
});

test('A5: dateless rows carry no age and sort after dated rows', () => {
  const dated = flow({ id: 1, date: '2026-10-01', notionPageId: 'f1' });
  const dateless = flow({ id: 2, date: '', stage: 'Depanty', notionPageId: 'f2' });
  const queue = depantyQueue([dateless, dated], [], TODAY);
  assert.deepEqual(queue.map((r) => r.flow.id), [1, 2]);
  assert.equal(queue[0].ageDays, 44);
  assert.equal(queue[1].ageDays, undefined);
});

test('the queue labels itself draft until adoption', () => {
  assert.match(DEPANTY_RULE_LABEL, /Draft rule/);
});

// ── §5 day-of times, §4.2 run list, §4.3 gear check ──────────────────────────

test('§5: while the sources disagree, day-of shows EVENTS time with the conflict flagged', () => {
  const f = flow({
    date: '2026-11-19T01:30:00.000Z',
    eventStart: '2026-11-19T02:00:00.000Z',
    eventEnd: '2026-11-19T04:30:00.000Z',
  });
  const t = dayOfTimes(f);
  assert.equal(t.source, 'events');
  assert.equal(t.start, '2026-11-19T02:00:00.000Z');
  assert.equal(t.conflict, true);
  assert.equal(t.flowsStart, '2026-11-19T01:30:00.000Z');
});

test('§5: agreeing sources show the time with no flag', () => {
  const f = flow({
    date: '2026-11-19T02:00:00.000Z',
    eventStart: '2026-11-19T02:00:00.000Z',
  });
  const t = dayOfTimes(f);
  assert.equal(t.conflict, false);
  assert.equal(t.source, 'events');
  const flowsOnly = dayOfTimes(flow({ date: '2026-11-18' }));
  assert.equal(flowsOnly.source, 'flows');
  assert.equal(flowsOnly.conflict, false);
});

test('A6: the run list falls back to linked Moves for FLOWS rows; agenda wins when present', () => {
  const f = flow({ notionPageId: 'f1', agendaItems: [] });
  const moves = [
    task({ id: 2, title: 'Set up chairs', flowPageId: 'f1', due_date: '2026-11-18' }),
    task({ id: 1, title: 'Open doors', flowPageId: 'f1', due_date: '2026-11-17' }),
  ];
  const fromMoves = dayOfRunList(f, moves);
  assert.equal(fromMoves.source, 'moves');
  assert.equal(fromMoves.rows.length, 2);
  const withAgenda = flow({
    notionPageId: 'f1',
    agendaItems: [{ id: 1, text: 'Welcome', lead: 'Sunshine', timeEstimate: 5, done: false }],
  });
  const fromAgenda = dayOfRunList(withAgenda, moves);
  assert.equal(fromAgenda.source, 'agenda');
  assert.deepEqual(fromAgenda.rows, [{ text: 'Welcome', detail: 'Sunshine' }]);
  assert.equal(dayOfRunList(flow({ notionPageId: 'fx' }), []).source, 'none');
});

test('surface: the depanty queue mounts in Gatherings and reads the computed membership', () => {
  const view = readFileSync(new URL('../src/app/components/CommunityEventsView.tsx', import.meta.url), 'utf8');
  assert.match(view, /key: 'depanty',\s+label: 'Depanty'/);
  assert.match(view, /depantyQueue\(flows, tasks, localDateString/);
  assert.match(view, /DEPANTY_RULE_LABEL/);
  // A5's honest age state and the failing-leg words ride the rows.
  assert.match(view, /'date not filed'/);
  assert.match(view, /exit\.failing\.map/);
  // Rows open the 2a detail page; no second editor exists.
  assert.match(view, /navigate\(`\/gatherings\/\$\{flow\.id\}`\)/);
});

test('surface: the detail checklist reads the one named exit test', () => {
  const detail = readFileSync(new URL('../src/app/pages/GatheringDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(detail, /depantyExitTest\(flow, data\.tasks \?\? \[\]\)/);
  assert.match(detail, /Gatherings → Depanty/);
  // The day-of door is reachable from the detail page.
  assert.match(detail, /\/gatherings\/\$\{flow\.id\}\/day-of/);
});

test('§4.1: the check-in write unions, re-reads first, and is idempotent', async () => {
  process.env.NOTION_SECRET = 'test-secret';
  const { unionRelationIds, checkInFlowGuest } = await import('../api/_notionWriter.ts');
  assert.deepEqual(unionRelationIds(['a', 'b'], 'c'), ['a', 'b', 'c']);
  assert.deepEqual(unionRelationIds(['a', 'b'], 'b'), ['a', 'b']);

  const FLOW = '40f24acf-799d-8158-b9dc-fa9d03123546';
  const GUEST = '30f24acf-799d-8158-b9dc-fa9d03123546';
  let attended = ['person-earlier'];
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body });
    if ((init?.method ?? 'GET') === 'GET') {
      return {
        ok: true,
        json: async () => ({
          properties: { Attended: { type: 'relation', relation: attended.map((id) => ({ id })) } },
        }),
      };
    }
    const parsed = JSON.parse(init.body);
    attended = parsed.properties.Attended.relation.map((r) => r.id);
    return { ok: true, json: async () => ({}) };
  };
  try {
    const first = await checkInFlowGuest(FLOW, GUEST);
    assert.deepEqual(first, ['person-earlier', GUEST]);
    // GET (the re-read) precedes the PATCH, and the PATCH writes
    // the full unioned relation.
    assert.equal(calls[0].method, 'GET');
    const patch = calls.find((c) => c.method === 'PATCH');
    assert.deepEqual(
      JSON.parse(patch.body).properties.Attended.relation,
      [{ id: 'person-earlier' }, { id: GUEST }],
    );
    // Second check-in of the same guest: same set, no new write.
    const patchCount = calls.filter((c) => c.method === 'PATCH').length;
    const second = await checkInFlowGuest(FLOW, GUEST);
    assert.deepEqual(second, ['person-earlier', GUEST]);
    assert.equal(calls.filter((c) => c.method === 'PATCH').length, patchCount);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('§4.1: the route is session-shaped, validates page ids, and sits before generic CRUD', () => {
  const server = readFileSync(new URL('../api/server.ts', import.meta.url), 'utf8');
  const routeAt = server.indexOf("sub === 'check-in'");
  const crudAt = server.indexOf('Generic CRUD for list resources');
  assert.ok(routeAt > 0 && crudAt > 0 && routeAt < crudAt);
  assert.match(server, /checkInFlowGuest\(id, personPageId\)/);
  assert.match(server, /isNotionPageId\(personPageId\)/);
  const api = readFileSync(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  assert.match(api, /`\/coflow-dates\/\$\{flowPageId\}\/check-in`/);
});

test('surface: the day-of route and page carry the specced sections and states', () => {
  const routes = readFileSync(new URL('../src/app/routes.ts', import.meta.url), 'utf8');
  assert.match(routes, /gatherings\/:id\/day-of/);
  const dayOf = readFileSync(new URL('../src/app/pages/GatheringDayOfPage.tsx', import.meta.url), 'utf8');
  for (const section of ['Door check-in', 'Run list', 'Role holders', 'Gear and valve check', 'Capture']) {
    assert.match(dayOf, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  // §5's flag wording and A4's two distinct door states.
  assert.match(dayOf, /FLOWS says \{formatTime\(times\.flowsStart\)\} — unconfirmed/);
  assert.match(dayOf, /No event row linked — door list unavailable/);
  assert.match(dayOf, /Event row linked, no guests filed yet/);
  assert.match(dayOf, /Not today — this gathering is on/);
  // Checked state updates only from the server's returned set.
  assert.match(dayOf, /setAttended\(next\)/);
});

test('§4.3: the gear check derives from a linked Move, else reads not filed', () => {
  const f = flow({ notionPageId: 'f1' });
  assert.deepEqual(gearCheckState(f, []), { state: 'not filed' });
  const gear = task({ id: 3, title: 'Gear and valve check', flowPageId: 'f1', status: 'in_progress' });
  assert.equal(gearCheckState(f, [gear]).state, 'not yet');
  assert.equal(gearCheckState(f, [{ ...gear, status: 'done' }]).state, 'done');
});
