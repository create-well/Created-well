// Password-recovery entry (register 1517): a recovery arrival carries a
// valid session, and the gate must hold at the set-new-password form
// instead of auto-entering on it. The form and the updateUser call are
// long-standing; the defect was the mount-time session check winning
// the race against the recovery hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRecoveryHash, sessionEntry } from '../src/lib/recoveryEntry.ts';

const gate = readFileSync(new URL('../src/app/components/AuthGate.tsx', import.meta.url), 'utf8');

test('a recovery hash is recognized in its real arrival shapes', () => {
  assert.equal(isRecoveryHash('#access_token=x&type=recovery&expires_in=3600'), true);
  assert.equal(isRecoveryHash('#type=recovery'), true);
  assert.equal(isRecoveryHash('#access_token=x&type=signup'), false);
  assert.equal(isRecoveryHash(''), false);
  assert.equal(isRecoveryHash('#/moves'), false);
});

test('the entry decision holds a recovery session at the form', () => {
  assert.equal(sessionEntry(true, true), 'set-new-password');
  assert.equal(sessionEntry(true, false), 'enter');
  assert.equal(sessionEntry(false, true), 'gate');
  assert.equal(sessionEntry(false, false), 'gate');
});

test('the gate decides entry through the shared decision, keyed on the hash and the event', () => {
  assert.match(gate, /isRecoveryHash\(window\.location\.hash\)/);
  assert.match(gate, /let recoveryPending = isRecoveryArrival/);
  assert.match(gate, /recoveryPending = true/);
  assert.match(gate, /sessionEntry\(!!session, recoveryPending\)/);
});

test('the recovery form and its updateUser call stand as built', () => {
  assert.match(gate, /event === 'PASSWORD_RECOVERY'/);
  assert.match(gate, /setMode\('newpassword'\)/);
  assert.match(gate, /auth\.updateUser\(\{ password: newPw \}\)/);
  assert.match(gate, /id="cr8w-new-password"/);
  assert.match(gate, /id="cr8w-confirm-password"/);
});

test('no password routes were introduced; the gate state carries the flow', () => {
  assert.doesNotMatch(gate, /['"`]\/(update-password|reset-password)['"`]/);
});
