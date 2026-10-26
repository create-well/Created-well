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

/**
 * Header badge copy for a displayed status. The badge reports dashboard
 * load state only, mirroring the SyncStatusBar line: source sync is not
 * verified, and the badge must never claim it is (canary finding,
 * 2026-10-25: the fresh badge read "Synced" while the status line
 * honestly reported "Source sync not verified").
 */
export function dashboardBadgeTitle(status: SyncStatus): string {
  switch (status) {
    case 'fresh': return 'Dashboard loaded · Source sync not verified';
    case 'stale': return 'Not current';
    case 'failed': return 'Dashboard unavailable';
    case 'loading': return 'Loading dashboard…';
  }
}
