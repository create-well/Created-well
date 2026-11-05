// ── Password-recovery entry decisions (AuthGate) ─────────────────────────────
// A recovery arrival carries a VALID session: the recovery link signs the
// user in so updateUser can persist the new password. The mount-time
// session check must therefore not treat a recovery arrival as a normal
// signed-in return — when it did, the gate auto-entered the app on the
// recovery session and the set-new-password form, though fully built,
// never presented (the rotation failed twice on exactly this). These
// pure decisions are the gate's entry contract:
//   no session            → stay at the gate
//   session, no recovery  → enter the app (the normal return)
//   session, recovery     → hold at the gate, set-new-password form

export function isRecoveryHash(hash: string): boolean {
  return typeof hash === 'string' && hash.includes('type=recovery');
}

export type SessionEntry = 'enter' | 'set-new-password' | 'gate';

export function sessionEntry(hasSession: boolean, recoveryPending: boolean): SessionEntry {
  if (!hasSession) return 'gate';
  return recoveryPending ? 'set-new-password' : 'enter';
}
