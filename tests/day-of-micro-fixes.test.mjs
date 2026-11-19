// Day-of micro-packet — the two read-path follow-ups recorded when
// Phase 2b landed (Checkpoint 2, 2026-11-15: "Carried observations
// for follow-up micro-packets"):
//   (1) FLOWS-only day-of headers drop the Date end — the payload's
//       date read was start-only while the linked EVENTS path
//       carries start+end. The FLOWS-only header must carry the
//       Date's own end.
//   (2) The day-of Flow Keeper line renders the raw PEOPLE page id
//       — normalizeFlow carries the lowercased Flow Keeper relation
//       id in `host`, which the slug-keyed PERSONS map cannot
//       resolve. The keeper's name projects at payload assembly the
//       way the A3a Craft Lead projection does; a raw id never
//       renders.
// Pins: normalizeFlow's dateEnd, buildFlowKeepers, dayOfTimes'
// FLOWS-only branch, the payload wiring, and the day-of surface's
// two lines. Negative cases: start-only Date, undated row, an EVENTS
// link (EVENTS time still governs), an unresolved keeper id, a
// keeper with no filed name, and a flow with no keeper relation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeFlow,
  buildFlowKeepers,
} from '../src/lib/notionNormalizer.ts';
import { dayOfTimes } from '../src/lib/flows.ts';

const title = (text) => ({ type: 'title', title: [{ plain_text: text, href: null }] });
const rel = (ids) => ({ type: 'relation', relation: ids.map((id) => ({ id })) });
const sel = (name) => ({ type: 'select', select: { id: 'x', name, color: 'default' } });
const dateProp = (start, end = null) => ({ type: 'date', date: { start, end, time_zone: null } });

const page = (props, id) => ({
  id,
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    Name: title('A flow'),
    Date: dateProp('2026-11-18'),
    Status: sel('Upcoming'),
    ...props,
  },
});

const flow = (over) => ({
  id: 1, date: '2026-11-18', timeRange: '', location: '', rsvp: {},
  agendaItems: [], notes: '', vibeCheck: '', status: 'scheduled',
  ...over,
});

// ── Follow-up 1: the FLOWS-only Date end ─────────────────────────────────────

test('follow-up 1: normalizeFlow carries the Date end next to the start', () => {
  const f = normalizeFlow(page({
    Date: dateProp('2026-11-18T17:30:00.000-08:00', '2026-11-18T20:30:00.000-08:00'),
  }, 'flow-1'));
  assert.equal(f.date, '2026-11-18T17:30:00.000-08:00');
  assert.equal(f.dateEnd, '2026-11-18T20:30:00.000-08:00');
});

test('follow-up 1: a start-only Date leaves dateEnd unset — no end is invented', () => {
  const f = normalizeFlow(page({}, 'flow-1'));
  assert.equal(f.date, '2026-11-18');
  assert.equal(f.dateEnd, undefined);
  const undated = normalizeFlow(page({ Date: dateProp(null) }, 'flow-2'));
  assert.equal(undated.date, '');
  assert.equal(undated.dateEnd, undefined);
});

test('follow-up 1: the FLOWS-only day-of time carries the Date end', () => {
  const t = dayOfTimes(flow({
    date: '2026-11-18T17:30:00.000-08:00',
    dateEnd: '2026-11-18T20:30:00.000-08:00',
  }));
  assert.equal(t.source, 'flows');
  assert.equal(t.start, '2026-11-18T17:30:00.000-08:00');
  assert.equal(t.end, '2026-11-18T20:30:00.000-08:00');
  assert.equal(t.conflict, false);
});

test('follow-up 1: a FLOWS-only row without a Date end has no end, and the EVENTS path is untouched', () => {
  assert.equal(dayOfTimes(flow({ date: '2026-11-18' })).end, undefined);
  const linked = dayOfTimes(flow({
    date: '2026-11-18T17:30:00.000-08:00',
    dateEnd: '2026-11-18T20:30:00.000-08:00',
    eventStart: '2026-11-18T17:30:00.000-08:00',
    eventEnd: '2026-11-18T21:00:00.000-08:00',
  }));
  assert.equal(linked.source, 'events');
  assert.equal(linked.end, '2026-11-18T21:00:00.000-08:00');
});

// ── Follow-up 2: the Flow Keeper name ────────────────────────────────────────

test('follow-up 2: the Flow Keeper relation resolves to the PEOPLE name at assembly', () => {
  const people = [page({ Name: title('Sunshine Santos') }, 'person-sunshine')];
  const flows = [page({ 'Flow Keeper': rel(['person-sunshine']) }, 'flow-1')];
  assert.equal(buildFlowKeepers(flows, people).get('flow-1'), 'Sunshine Santos');
});

test('follow-up 2: an unresolved keeper id is dropped — never rendered as a name', () => {
  const people = [page({ Name: title('Sunshine Santos') }, 'person-sunshine')];
  const orphan = [page({ 'Flow Keeper': rel(['person-ghost']) }, 'flow-2')];
  assert.equal(buildFlowKeepers(orphan, people).has('flow-2'), false);
});

test('follow-up 2: a keeper with no filed name resolves to nothing', () => {
  // The PEOPLE page exists but carries an empty Name title — the
  // day-of surface must fall through to its Unfilled state, not to
  // a raw id and not to an empty string.
  const unnamed = [page({ Name: title('') }, 'person-blank')];
  const flows = [page({ 'Flow Keeper': rel(['person-blank']) }, 'flow-3')];
  assert.equal(buildFlowKeepers(flows, unnamed).has('flow-3'), false);
  // No keeper relation at all: absent from the map as well.
  const bare = [page({}, 'flow-4')];
  assert.equal(buildFlowKeepers(bare, unnamed).has('flow-4'), false);
});

// ── Wiring and surface ───────────────────────────────────────────────────────

test('wiring: the payload assembly projects keeperName, and CoFlowDate carries both fields', () => {
  const dash = readFileSync(new URL('../api/dashboard.ts', import.meta.url), 'utf8');
  assert.match(dash, /buildFlowKeepers/);
  assert.match(dash, /keeperName \? \{ keeperName \} : \{\}/);
  const api = readFileSync(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  assert.match(api, /dateEnd\?: string;/);
  assert.match(api, /keeperName\?: string;/);
});

test('surface: the day-of header carries the end in the FLOWS-only case', () => {
  const dayOf = readFileSync(new URL('../src/app/pages/GatheringDayOfPage.tsx', import.meta.url), 'utf8');
  assert.match(dayOf, /flow\.timeRange \|\| \(times\.end/);
  assert.match(dayOf, /\$\{formatTime\(times\.start\)\} – \$\{formatTime\(times\.end\)\}/);
});

test('surface: the Flow Keeper line renders the projected name, never the raw host id', () => {
  const dayOf = readFileSync(new URL('../src/app/pages/GatheringDayOfPage.tsx', import.meta.url), 'utf8');
  assert.match(dayOf, /Flow Keeper — \{flow\.keeperName \|\| hostPerson\?\.name \|\| 'Unfilled'\}/);
  assert.doesNotMatch(dayOf, /: flow\.host \|\| 'Unfilled'/);
});
