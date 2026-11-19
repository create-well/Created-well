import type { CoFlowDate, Station } from '../app/components/api';

// ── Phase 3 leg L2: People detail resolution and gathering joins ────────────
// Spec: packet M §2.1–§2.2. resolvePerson mirrors resolveGathering's
// contract exactly (packet K §4, amendment A2): an id resolves to a
// person only on a SETTLED payload — 'fresh' or 'stale'. While the
// payload is loading, or has failed with nothing settled to show, the
// state is 'loading', never not-found, never another person's data. A
// stale payload is settled (it carries last-good rows), so a match
// resolves and a miss is an honest not-found under the stale label
// the page renders.

export type PersonResolution =
  | { state: 'loading' }
  | { state: 'found'; person: Station }
  | { state: 'not-found' };

export function resolvePerson(
  people: Station[] | undefined,
  syncStatus: string,
  id: number | string,
): PersonResolution {
  const settled = syncStatus === 'fresh' || syncStatus === 'stale';
  if (!settled) return { state: 'loading' };
  // A settled payload with no stations slice at all (the legacy
  // fallback omits it) is an honest not-found, not a forever load.
  // Match on the station's id; also accept its PEOPLE page id, the
  // same address space the day-of door and check-in route use.
  const numeric = typeof id === 'number' ? id : Number(id);
  const pageId = String(id);
  const person = (people ?? []).find(
    (p) => (Number.isInteger(numeric) && p.id === numeric) ||
      (p.notionPageId !== undefined && p.notionPageId === pageId),
  );
  return person ? { state: 'found', person } : { state: 'not-found' };
}

/**
 * The person ↔ gathering join (packet M §2.1): a flow's attendedIds —
 * the FLOWS Attended relation's PEOPLE page ids projected by
 * normalizeFlow, the same id space Station.notionPageId lives in. The
 * day-of door reads membership exactly this way (attendedIds against a
 * guest's PEOPLE page id), and check-in posts a PEOPLE page id. A
 * person with no page id (a cached/older payload record) matches
 * nothing — honest absence, never a guess.
 */
function flowIncludesPerson(flow: CoFlowDate, personId: string | undefined): boolean {
  if (!personId) return false;
  return flow.attendedIds !== undefined && flow.attendedIds.includes(personId);
}

// Newest first: date descending with dateless rows last, id the final
// tiebreak — compared, never subtracted (the Phase 1 discipline).
function compareGatheringsNewestFirst(a: CoFlowDate, b: CoFlowDate): number {
  const da = a.date || '', db = b.date || '';
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da > db ? -1 : 1;
  }
  return a.id - b.id;
}

/**
 * Every gathering whose Attended relation includes the person, newest
 * first (packet M §2.2, "Gatherings they came to").
 */
export function gatheringsFor(
  personId: string | undefined,
  coFlowDates: CoFlowDate[] | undefined,
): CoFlowDate[] {
  return (coFlowDates ?? [])
    .filter((f) => flowIncludesPerson(f, personId))
    .sort(compareGatheringsNewestFirst);
}

/**
 * The most recent gathering the person attended, or undefined when
 * none (the Everyone row's "Last gathering" line renders only when one
 * exists).
 */
export function lastGatheringFor(
  personId: string | undefined,
  coFlowDates: CoFlowDate[] | undefined,
): CoFlowDate | undefined {
  return gatheringsFor(personId, coFlowDates)[0];
}
