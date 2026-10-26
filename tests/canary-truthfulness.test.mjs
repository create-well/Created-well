import test from 'node:test';
import assert from 'node:assert/strict';
import { formatShortDateLabel, milestoneLabel } from '../src/lib/nextUpLabel.ts';
import { dashboardBadgeTitle } from '../src/lib/dashboardStatus.ts';

// Canary finding 1 (2026-10-25): the CREATE WELL RETREAT Next Up card
// rendered the literal "Invalid Date" when the milestone date was
// missing or unparseable. The label must degrade to the title alone.
test('parseable dates render a short label', () => {
  assert.equal(formatShortDateLabel('2026-10-26'), 'Oct 26');
  assert.equal(formatShortDateLabel('2026-01-05'), 'Jan 5');
});

test('missing or unparseable dates produce no date label', () => {
  for (const value of ['', null, undefined, 'not-a-date', '2026-13-45', 'later-2026', 'TBD']) {
    assert.equal(formatShortDateLabel(value), null, `expected null for ${String(value)}`);
  }
});

test('milestone label joins title and date only when the date parses', () => {
  assert.equal(milestoneLabel('Create Well Retreat', '2026-10-26'), 'Create Well Retreat · Oct 26');
  assert.equal(milestoneLabel('Create Well Retreat', 'not-a-date'), 'Create Well Retreat');
  assert.equal(milestoneLabel('Create Well Retreat', ''), 'Create Well Retreat');
  assert.equal(milestoneLabel('Create Well Retreat', undefined), 'Create Well Retreat');
});

test('milestone label never contains the literal Invalid Date', () => {
  for (const value of ['', null, undefined, 'not-a-date', '2026-13-45']) {
    assert.ok(!milestoneLabel('Create Well Retreat', value).includes('Invalid Date'));
  }
});

test('milestone label keeps the existing rocket-strip behavior', () => {
  assert.equal(milestoneLabel('Launch 🚀', '2026-10-26'), 'Launch · Oct 26');
});

// Canary finding 2 (2026-10-25): the header badge read "Synced" while
// the status line honestly reported "Source sync not verified". The
// badge reports dashboard load state only and must say so.
test('fresh badge agrees with the status line instead of claiming Synced', () => {
  const title = dashboardBadgeTitle('fresh');
  assert.notEqual(title, 'Synced');
  assert.ok(title.includes('Source sync not verified'));
});

test('other badge titles match the SyncStatusBar vocabulary exactly', () => {
  assert.equal(dashboardBadgeTitle('stale'), 'Not current');
  assert.equal(dashboardBadgeTitle('failed'), 'Dashboard unavailable');
  assert.equal(dashboardBadgeTitle('loading'), 'Loading dashboard…');
});
