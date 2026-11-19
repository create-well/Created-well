// System "Last sync" derivation (honesty remainder, 2026-11-19): the
// row names the last time any source sync actually completed OK, read
// from the payload's syncFreshness ledger (sync_delivery_state) — never
// the dashboard's own payload-load time, which is a transport fact, not
// a sync fact. Returns null when the ledger carries no OK timestamp, so
// the surface can say "Not reported" instead of inventing a time.
import type { SyncFreshnessBlock } from './syncFreshnessLine';

export function latestSyncOkAt(block: SyncFreshnessBlock | null | undefined): Date | null {
  if (!block || !block.sources) return null;
  let latest: Date | null = null;
  for (const source of Object.values(block.sources)) {
    if (!source.lastSyncOkAt) continue;
    const d = new Date(source.lastSyncOkAt);
    if (!Number.isFinite(d.getTime())) continue;
    if (!latest || d.getTime() > latest.getTime()) latest = d;
  }
  return latest;
}
