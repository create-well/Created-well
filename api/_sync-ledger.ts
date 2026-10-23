// Sync-run recording for createdwell (Phase 2 adaptation).
//
// On cr8w-dashboard, engine runs are recorded into a Notion SYNC LEDGER
// database through sync-ledger-store. No such database is bound on
// createdwell, and creating one is a schema-class decision outside this
// port. Until a ledger binding is configured, runs are recorded as
// structured runtime-log lines (visible in the project's Vercel runtime
// logs) and per-source outcomes persist in sync_delivery_state, which
// is the operational record the freshness ladder reads.
//
// recordSyncRun never throws: bookkeeping must not fail a sync.

export interface LedgerSourceEntry {
  source: string;
  rows: number;
  cached: boolean;
  error?: string;
}

export interface SyncRunRecord {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "ok" | "partial" | "failed";
  sources: LedgerSourceEntry[];
  totalRows: number;
}

export async function recordSyncRun(record: SyncRunRecord): Promise<void> {
  try {
    console.log(`[sync-ledger] ${JSON.stringify(record)}`);
  } catch {
    // Recording never throws.
  }
}
