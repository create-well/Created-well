// FE-2 fixture sweep: the guarded date-label lib against the fixture set
// every surface renders from — valid, missing, and malformed source
// values. Acceptance (design packet §4 + UX N7 line): event dates
// degrade to "Date not set yet.", undated tasks to "No date yet.", and
// NO input ever renders the literal "Invalid Date".
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateValue, dateLabel, shortDateLabel, eventDateLabel,
  DATE_NOT_SET, NO_DATE_YET,
} from '../src/lib/dateLabel.ts';
// data.ts's formatDate/formatEventDate are one-line delegations to
// shortDateLabel (verified in code + tsc); the repo's node test loader
// cannot resolve data.ts's extensionless imports, so the sweep binds
// the lib every surface routes through.

const FIXTURES = [
  '2026-10-27', '2026-10-27T18:30:00.000Z', 'Oct 27, 2026',
  '', '  ', null, undefined,
  'TBD', 'not-a-date', '2026-13-40', '2026-02-30', 'NaN', 'undefined',
];

test('parseDateValue: valid parses, missing and malformed return null', () => {
  assert.ok(parseDateValue('2026-10-27') instanceof Date);
  assert.ok(parseDateValue('2026-10-27T18:30:00.000Z') instanceof Date);
  for (const v of ['', '  ', null, undefined, 'TBD', 'not-a-date', '2026-13-40', 'NaN']) {
    assert.equal(parseDateValue(v), null, `expected null for ${JSON.stringify(v)}`);
  }
});

test('labels: no fixture ever renders Invalid Date', () => {
  for (const v of FIXTURES) {
    for (const out of [shortDateLabel(v), eventDateLabel(v), dateLabel(v, { month: 'short', day: 'numeric', year: 'numeric' })]) {
      assert.ok(!out.includes('Invalid Date'), `fixture ${JSON.stringify(v)} rendered ${JSON.stringify(out)}`);
      assert.ok(!out.includes('NaN'), `fixture ${JSON.stringify(v)} rendered ${JSON.stringify(out)}`);
    }
  }
});

test('wordings of record: event dates and undated tasks', () => {
  assert.equal(shortDateLabel(''), DATE_NOT_SET);
  assert.equal(shortDateLabel('TBD'), DATE_NOT_SET);
  assert.equal(eventDateLabel(null), DATE_NOT_SET);
  assert.equal(dateLabel(undefined, { month: 'short', day: 'numeric' }), DATE_NOT_SET);
  // Undated-task surfaces pass the task wording as their fallback.
  assert.equal(shortDateLabel('', NO_DATE_YET), NO_DATE_YET);
  assert.equal(shortDateLabel('not-a-date', NO_DATE_YET), NO_DATE_YET);
  // A blank-preserving surface (secondary metadata) keeps its blank.
  assert.equal(shortDateLabel('', ''), '');
  assert.equal(shortDateLabel('garbage', ''), '');
});

test('valid values format exactly as the surfaces formatted them before', () => {
  const expected = new Date('2026-10-27T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  assert.equal(shortDateLabel('2026-10-27'), expected);
  assert.equal(
    eventDateLabel('2026-10-27'),
    new Date('2026-10-27T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  );
});

// ── G-31 sweep F1.1 / F2.1: calendar-day arithmetic ─────────────
// Constructed from local components, so these hold in any TZ and
// FAIL under TZ=America/Los_Angeles on the old ms-division math.
import { calendarDayDiff, localDateString } from '../src/lib/dateLabel.ts';

test('calendarDayDiff: fall-back span counts calendar days', () => {
  // Oct 30 -> Nov 2 crosses the Nov 1 fall-back (73h span).
  assert.equal(calendarDayDiff(new Date(2026, 9, 30), new Date(2026, 10, 2)), 3);
  assert.equal(calendarDayDiff(new Date(2026, 10, 2), new Date(2026, 9, 30)), -3);
});

test('calendarDayDiff: spring-forward span counts calendar days', () => {
  // Mar 6 -> Mar 9 crosses the Mar 8 spring-forward (71h span).
  assert.equal(calendarDayDiff(new Date(2026, 2, 6), new Date(2026, 2, 9)), 3);
});

test('calendarDayDiff: same day and next day', () => {
  assert.equal(calendarDayDiff(new Date(2026, 9, 30, 23, 59), new Date(2026, 9, 30, 0, 1)), 0);
  assert.equal(calendarDayDiff(new Date(2026, 9, 30, 23, 59), new Date(2026, 9, 31, 0, 1)), 1);
});

test('localDateString: local components, zero-padded', () => {
  assert.equal(localDateString(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.equal(localDateString(new Date(2026, 10, 2, 0, 30)), '2026-11-02');
});
