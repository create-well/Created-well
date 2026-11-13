/** Per-source result of the primary dashboard request, not a freshness proof.
 * Money is not a canonical source (MONEY A): it rides the cr8w_money KV feed
 * and has no sourceErrors entry, so it cannot report a canonical status. */
export const CANONICAL_DASHBOARD_SOURCES = ['moves', 'people', 'flows', 'content'] as const;
export type CanonicalDashboardSource = typeof CANONICAL_DASHBOARD_SOURCES[number];
export type SourceRequestStatus = 'loading' | 'failed' | 'reported-success' | 'unknown';
export type CanonicalSourceStatuses = Readonly<Record<CanonicalDashboardSource, SourceRequestStatus>>;

export function uniformCanonicalStatus(status: SourceRequestStatus): CanonicalSourceStatuses {
  return { moves: status, people: status, flows: status, content: status };
}

/** Error values stay private and are not returned. A reported success does not
 * establish source completeness, freshness, permission scope, or access control. */
export function sourceStatusesFromDashboard(data: unknown, usedFallback: boolean): CanonicalSourceStatuses {
  if (usedFallback || !data || typeof data !== 'object') return uniformCanonicalStatus('unknown');
  const errors = (data as { sourceErrors?: unknown }).sourceErrors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return uniformCanonicalStatus('unknown');
  return Object.fromEntries(CANONICAL_DASHBOARD_SOURCES.map(name => [name,
    Object.prototype.hasOwnProperty.call(errors, name) ? 'failed' : 'reported-success',
  ])) as CanonicalSourceStatuses;
}

export function canonicalFailureOrUnknown(statuses: CanonicalSourceStatuses): boolean {
  return CANONICAL_DASHBOARD_SOURCES.some(name => statuses[name] === 'failed' || statuses[name] === 'unknown');
}

/** Global UI status must not say fresh when a canonical request or CONTENT
 * completeness is unknown. This does not establish source observation time. */
export function dashboardStatusForSnapshot(
  statuses: CanonicalSourceStatuses,
  snapshotStatus: 'loading' | 'error' | 'empty' | 'partial' | 'available',
): 'fresh' | 'stale' {
  return canonicalFailureOrUnknown(statuses) || (snapshotStatus !== 'available' && snapshotStatus !== 'empty')
    ? 'stale' : 'fresh';
}
