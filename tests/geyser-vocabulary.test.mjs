// Register 1378, Leg A — the geyser marker keys on the record's
// actual Geyser marking, nothing else. Before: isEmergenceDay
// fired on a date check alone, so ANY flow dated today (tonight's
// Book Club included) rendered as a "geyser day", while zero of
// the FLOWS rows carry Geyser as Type or Series — every firing
// was a mislabel by construction. Now the marker needs the
// marking (Type via flowType, or the raw label on theme) AND the
// day. With no rows marked, it simply never fires until a real
// Geyser exists; the surface is not removed.
// The rider: HubView's "Open Geyser" button fired for every
// 'cr8w'/'launch' event — which, KV events being blanket-typed
// 'cr8w', meant every calendar event. It now keys on the co-flow
// record's marking or the event's own title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEmergenceDay, isGeyserFlow } from '../src/lib/homePanels.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hub = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');
const now = new Date(2026, 10, 5, 12, 0, 0); // local noon, Nov 5 2026
const today = '2026-11-05';
const tomorrow = '2026-11-06';

test('an unmarked flow dated today is NOT an emergence day', () => {
  assert.equal(isEmergenceDay({ id: 1, date: today, status: 'scheduled', flowType: 'Book Club', theme: 'The Artist\u2019s Way' }, now), false);
  assert.equal(isEmergenceDay({ id: 2, date: today, status: 'scheduled' }, now), false);
});

test('a Geyser-marked flow fires on its day, and only its day', () => {
  assert.equal(isEmergenceDay({ id: 3, date: today, status: 'scheduled', flowType: 'Geyser' }, now), true);
  assert.equal(isEmergenceDay({ id: 4, date: today, status: 'scheduled', theme: 'Geyser' }, now), true);
  assert.equal(isEmergenceDay({ id: 5, date: tomorrow, status: 'scheduled', flowType: 'Geyser' }, now), false);
});

test('isGeyserFlow reads the marking and nothing else', () => {
  assert.equal(isGeyserFlow({ id: 6, date: today, status: 'scheduled', flowType: 'Geyser' }), true);
  assert.equal(isGeyserFlow({ id: 7, date: today, status: 'scheduled', flowType: 'Podyap' }), false);
});

test('the Open Geyser rider keys on Geyser-class events only', () => {
  assert.ok(!hub.includes("(ev.type === 'cr8w' || ev.type === 'launch') && ("));
  assert.ok(hub.includes("ev.coFlowDate.flowType === 'Geyser'"));
  assert.ok(hub.includes('/\\bgeyser\\b/i.test(ev.title)'));
});
