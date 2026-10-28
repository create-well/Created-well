import type { SyncStatus } from '../types/dashboard';

/**
 * Render-time freshness family (CMS build packet §4 amendment, applied to
 * dashboard surfaces by the label-consistency packet G-24..G-27): the
 * rendered label derives from the load timestamp's age at render time,
 * never from a stored status string. Fresh ≤ 120s · Aging ≤ 15 min ·
 * Stale beyond. A dashboard load is transport recency only; it never
 * proves source sync, and no label in this family claims "Synced".
 */
export const FRESH_MAX_MS = 120_000;
export const AGING_MAX_MS = 15 * 60 * 1000;

export type FreshnessBand = 'Fresh' | 'Aging' | 'Stale';

export function freshnessBand(loadedAt: Date | null, now = Date.now()): FreshnessBand | null {
  if (!loadedAt || !Number.isFinite(loadedAt.getTime())) return null;
  const age = now - loadedAt.getTime();
  if (age <= FRESH_MAX_MS) return 'Fresh';
  if (age <= AGING_MAX_MS) return 'Aging';
  return 'Stale';
}

function chipTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * FlowCommandCenter provenance chip wording (G-25): the text derives from
 * the sync status at render, in the SyncStatusBar wording family
 * ("Last loaded {time}. Source sync not verified."). The previous chip
 * asserted "Synced from Notion FLOWS" in every state, including beside
 * "never" when nothing had loaded.
 */
export function flowsProvenanceText(syncStatus: SyncStatus, lastSynced: Date | null): string {
  if (!lastSynced) {
    return syncStatus === 'loading'
      ? 'Loading from Notion FLOWS…'
      : 'From Notion FLOWS · No successful load yet';
  }
  switch (syncStatus) {
    case 'fresh':
      return `From Notion FLOWS · Last loaded ${chipTime(lastSynced)} · Source sync not verified`;
    case 'stale':
      return `From Notion FLOWS · Last loaded ${chipTime(lastSynced)} · Not current`;
    case 'failed':
      return 'From Notion FLOWS · Dashboard unavailable';
    case 'loading':
      return `Loading from Notion FLOWS · Last loaded ${chipTime(lastSynced)}`;
  }
}
