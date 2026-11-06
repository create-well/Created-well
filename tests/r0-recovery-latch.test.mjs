// R-0 structural recovery hold: the Nov 5 hold decided entry from the URL
// hash at gate-mount time plus the PASSWORD_RECOVERY event — two races the
// Supabase client can win by consuming the hash during initialization or
// processing the recovery session before the gate subscribes. On
// 2026-11-06 it won: a fresh recovery link signed straight into the
// dashboard with no set-password form. The structural fix latches the
// marker at module-evaluation time into sessionStorage; pending is the
// union of latch, hash, and event; only a completed password set or an
// explicit sign-out clears the latch; and App refuses to enter while it
// is latched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  captureRecoveryMarker,
  recoveryLatched,
  clearRecoveryLatch,
  sessionEntry,
} from '../src/lib/recoveryEntry.ts';

const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../src/app/components/AuthGate.tsx', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../src/app/components/TopNav.tsx', import.meta.url), 'utf8');

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

test('capture latches only on a recovery arrival hash', () => {
  const s = memoryStorage();
  assert.equal(captureRecoveryMarker('#access_token=x&expires_in=3600&type=recovery', s), true);
  assert.equal(recoveryLatched(s), true);
  const s2 = memoryStorage();
  assert.equal(captureRecoveryMarker('#/moves', s2), false);
  assert.equal(captureRecoveryMarker('', s2), false);
  assert.equal(recoveryLatched(s2), false);
});

test('the latch holds after the client strips the hash and the event is missed', () => {
  const s = memoryStorage();
  captureRecoveryMarker('#access_token=x&type=recovery', s);
  // The losing-race world: the hash is gone by gate-mount time and no
  // PASSWORD_RECOVERY event ever reaches the gate. The latch still holds
  // the session at the form.
  assert.equal(sessionEntry(true, recoveryLatched(s)), 'set-new-password');
  // A non-recovery navigation afterwards never clears it.
  assert.equal(captureRecoveryMarker('#/care', s), false);
  assert.equal(recoveryLatched(s), true);
});

test('only a completed set or an explicit sign-out clears the latch', () => {
  const s = memoryStorage();
  captureRecoveryMarker('#type=recovery', s);
  clearRecoveryLatch(s);
  assert.equal(recoveryLatched(s), false);
  assert.equal(sessionEntry(true, recoveryLatched(s)), 'enter');
});

test('App captures the marker at module evaluation and refuses entry while latched', () => {
  assert.match(app, /captureRecoveryMarker\(window\.location\.hash, sessionStorage\)/);
  assert.match(app, /captureRecoveryArrival\(\)/);
  assert.match(app, /!recoveryLatched\(sessionStorage\)/);
});

test('the gate unions latch, hash, and event, and clears only at the two endings', () => {
  assert.match(gate, /recoveryLatched\(sessionStorage\)/);
  assert.match(gate, /isRecoveryHash\(window\.location\.hash\)/);
  assert.match(gate, /let recoveryPending = isRecoveryArrival/);
  const clears = gate.match(/clearRecoveryLatch\(sessionStorage\)/g) ?? [];
  // Set-complete, sign-out, and the stale-latch sweep on a normal enter.
  assert.ok(clears.length >= 3, `expected >= 3 latch clears, got ${clears.length}`);
});

test('the top bar carries an always-visible sign out beside the existing entries', () => {
  const visible = nav.indexOf('aria-label="Sign out"');
  assert.ok(visible > -1, 'top-bar sign out button exists');
  assert.ok(
    visible < nav.indexOf('mobile-menu-overlay'),
    'the visible sign out sits in the top bar, not the mobile menu',
  );
  const entries = nav.match(/sign out/g) ?? [];
  assert.ok(entries.length >= 3, 'account-menu and mobile-menu entries remain');
});
