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

// ── Structural recovery latch (R-0) ──────────────────────────────────────────
// The hash check and the PASSWORD_RECOVERY event are both races: the
// Supabase client parses the URL hash during initialization and strips it,
// and it can process the recovery session before the gate subscribes — on
// 2026-11-06 a fresh recovery link signed straight into the dashboard with
// no form anywhere, because neither trigger fired for the gate. The latch
// removes the race: App.tsx captures the marker at module-evaluation time
// (before any client can exist or consume the hash) into sessionStorage,
// the gate derives pending from capture ∪ storage ∪ event, and the two
// paths that can end a recovery — a completed password set and an explicit
// sign-out — clear it. Anything else leaves it latched, so a reload
// mid-recovery still holds at the form.

export const RECOVERY_LATCH_KEY = 'cr8w_recovery_pending';

export interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Module-eval capture: latch the marker when the arrival hash carries it. */
export function captureRecoveryMarker(hash: string, storage: RecoveryStorage): boolean {
  if (!isRecoveryHash(hash)) return false;
  try { storage.setItem(RECOVERY_LATCH_KEY, '1'); } catch { /* storage unavailable */ }
  return true;
}

/** The gate's pending read: the latch as persisted at capture time. */
export function recoveryLatched(storage: RecoveryStorage): boolean {
  try { return storage.getItem(RECOVERY_LATCH_KEY) === '1'; } catch { return false; }
}

/** Clear the latch — only a completed set or an explicit sign-out calls this. */
export function clearRecoveryLatch(storage: RecoveryStorage): void {
  try { storage.removeItem(RECOVERY_LATCH_KEY); } catch { /* storage unavailable */ }
}

export type SessionEntry = 'enter' | 'set-new-password' | 'gate';

export function sessionEntry(hasSession: boolean, recoveryPending: boolean): SessionEntry {
  if (!hasSession) return 'gate';
  return recoveryPending ? 'set-new-password' : 'enter';
}
