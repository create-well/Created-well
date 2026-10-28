/**
 * Home freshness line derivation (Track FE-3, on the API lane's
 * reader decision, PR #50): the dashboard payload's syncFreshness
 * block carries per-source DELIVERY state from the sync ledger, so
 * the Home line derives from real sync state at render instead of
 * self-reporting "not verified". There is deliberately NO run-history
 * field: history stays a "[ ]" placeholder until the G-35 store
 * decision lands, and this line never claims history it does not have.
 *
 * Server state vocabulary (api/_sync-engine computeFreshness):
 * "live" | "stale" | "degraded" | "reconciling" | "unknown".
 * "Flowing" counts live + reconciling (a sync in flight is moving).
 */

export interface SyncFreshnessSource {
  state: string;
  lastEventAt: string | null;
  lastSyncOkAt: string | null;
  syncVersion: number;
}

export interface SyncFreshnessBlock {
  generatedAt: string;
  sources: Record<string, SyncFreshnessSource>;
}

const FLOWING = new Set(['live', 'reconciling']);

export function relativeCheckedTime(date: Date, now = Date.now()): string {
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/**
 * The §4 line segment: "Sources checked {relative} · N of M flowing",
 * with non-flowing states named in words when any exist. Returns null
 * when the block cannot support a claim (missing, no sources, or an
 * unparseable generatedAt) — the caller then keeps the transport-only
 * line, which makes no source claim either way.
 */
export function sourcesCheckedSegment(
  block: SyncFreshnessBlock | null | undefined,
  now = Date.now(),
): string | null {
  if (!block || !block.sources) return null;
  const entries = Object.values(block.sources);
  if (entries.length === 0) return null;
  const generated = new Date(block.generatedAt);
  if (!Number.isFinite(generated.getTime())) return null;

  const rel = relativeCheckedTime(generated, now);
  if (entries.every((e) => e.state === 'unknown')) {
    return `Sources checked ${rel} · source state unknown`;
  }
  const flowing = entries.filter((e) => FLOWING.has(e.state)).length;
  const exceptions = new Map<string, number>();
  for (const e of entries) {
    if (!FLOWING.has(e.state)) {
      exceptions.set(e.state, (exceptions.get(e.state) ?? 0) + 1);
    }
  }
  const exceptionText = [...exceptions.entries()]
    .map(([state, count]) => `${count} ${state}`)
    .join(' · ');
  return (
    `Sources checked ${rel} · ${flowing} of ${entries.length} flowing` +
    (exceptionText ? ` · ${exceptionText}` : '')
  );
}
