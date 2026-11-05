// Partiful RSVP links, Leg 2 (register 1484): event surfaces render the
// projected CoFlowDate.partifulLink as the RSVP door. Leg 1 (PR #89)
// carries the field; this leg renders it in exactly two seats and
// nowhere else — the D8s session view's internal team RSVP is not a
// Partiful surface and stays untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const events = readFileSync(new URL('../src/app/components/CommunityEventsView.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../src/app/components/HubView.tsx', import.meta.url), 'utf8');
const d8s = readFileSync(new URL('../src/app/components/CoFlowD8sView.tsx', import.meta.url), 'utf8');

test('the flow card offers the Partiful door when its record carries a link, upcoming only', () => {
  assert.match(events, /const showRsvp = !!flow\.partifulLink && \(!flow\.date \|\| flow\.date >= localDateString\(new Date\(\)\)\)/);
  assert.match(events, /href=\{flow\.partifulLink\}/);
  assert.match(events, /RSVP on Partiful ↗/);
});

test('the card action is an honest outbound link', () => {
  const seat = events.slice(events.indexOf('showRsvp &&'));
  assert.match(seat.slice(0, 600), /target="_blank"/);
  assert.match(seat.slice(0, 600), /rel="noopener noreferrer"/);
});

test('the Next Up expanded row offers the same door beside its sibling actions', () => {
  assert.match(hub, /ev\.coFlowDate\?\.partifulLink && \(/);
  assert.match(hub, /href=\{ev\.coFlowDate\.partifulLink\}/);
  assert.match(hub, /🎉 RSVP on Partiful ↗/);
});

test('the D8s session view carries no Partiful reference', () => {
  assert.doesNotMatch(d8s, /partiful/i);
});

test('no other component renders the projected link', async () => {
  const { execSync } = await import('node:child_process');
  const hits = execSync('grep -rl "partifulLink" src/app/components src/app/pages || true', { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).sort();
  assert.deepEqual(hits, [
    'src/app/components/CommunityEventsView.tsx',
    'src/app/components/HubView.tsx',
    'src/app/components/api.ts',
  ]);
});
