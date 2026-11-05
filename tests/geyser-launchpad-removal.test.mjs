// F4 — execute the parking (Monny's standing call, register lines 1171
// + 1170 item 12): Geyser is an event, not a launchpad. The Overview
// launchpad cluster (Key Dates, Monthly Rhythm, Confirmed Guests stat,
// Launch Milestones, Invite Pipeline, Team) is removed, with its
// now-dead state and fetches. NOT touched: the Geyser view itself, its
// tabs, the FLOWS Type value, the Dictionary price band.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const view = await readFile(new URL('../src/app/components/GeyserView.tsx', import.meta.url), 'utf8');

test('the launchpad cluster sections are gone from the Overview', () => {
  for (const gone of ['Key Dates', 'Monthly Rhythm', 'Launch Milestones', 'Invite Pipeline', 'Confirmed<br />Guests', 'the launchpad', '👥 Team']) {
    assert.doesNotMatch(view, new RegExp(gone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), gone);
  }
});

test('the cluster\'s dead state, fetches, and imports are gone', () => {
  assert.doesNotMatch(view, /inviteCounts|getInviteCounts|InviteCounts/);
  assert.doesNotMatch(view, /kvCalEvents|getCalendarEvents/);
  assert.doesNotMatch(view, /MILESTONES/);
});

test('what stays, stays: tabs, working stats, notes, announcements', () => {
  for (const kept of ['Overview', 'Journey', 'Stations', 'Moves', 'Forum', 'Notes from the Well', 'Stations<br />Confirmed', 'High Priority<br />Open Moves', 'Top Priority Right Now', 'HowWeFlowReference']) {
    assert.match(view, new RegExp(kept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), kept);
  }
});
