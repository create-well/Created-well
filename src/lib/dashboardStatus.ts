import type { SyncStatus } from '../types/dashboard';

export const DASHBOARD_STALE_AFTER_MS = 5 * 60 * 1000;

/** Transport recency only. This is not connector/source freshness evidence. */
export function displayedDashboardStatus(
  status: SyncStatus, lastFetched: Date | null, now = Date.now(),
): SyncStatus {
  if (status !== 'fresh') return status;
  if (!lastFetched || !Number.isFinite(lastFetched.getTime())) return 'stale';
  const age = now - lastFetched.getTime();
  return age < 0 || age >= DASHBOARD_STALE_AFTER_MS ? 'stale' : 'fresh';
}
