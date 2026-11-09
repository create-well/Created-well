// Sync-run recording for createdwell.
//
// Engine runs are recorded in the Supabase sync_runs table — the live
// record, read back through GET /api/sync-runs (90-day retention) —
// and per-source outcomes persist in sync_delivery_state, which is
// the operational record the freshness ladder reads. The historical
// Notion SYNC LEDGER database is frozen and archived; nothing writes
// to it.
//
// recordSyncRun never throws: bookkeeping must not fail a sync.

export interface LedgerSourceEntry {
  source: string;
  rows: number;
  cached: boolean;
  error?: string;
  // Free-form run note for facts that are neither success counts nor
  // errors (live-sync Legs C and F: pending-overflow escalations and
  // alert lines ride the run record through this field).
  note?: string;
}

export interface SyncRunRecord {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "ok" | "partial" | "failed";
  sources: LedgerSourceEntry[];
  totalRows: number;
  trigger: string;
  deferredSources: string[];
}

// The durable store row for public.sync_runs (G-35 / Q-42 Option B; DDL of
// record in docs/sync-runs-supabase.sql). Column names are the table's;
// buildSyncRunRow is the one mapping from the engine's record shape.
export interface SyncRunRow {
  started_at: string;
  finished_at: string;
  trigger: string;
  status: string;
  sources: LedgerSourceEntry[];
  total_rows: number;
  duration_ms: number;
  deferred_sources: string[];
}

export function buildSyncRunRow(record: SyncRunRecord): SyncRunRow {
  return {
    started_at: record.startedAt,
    finished_at: record.finishedAt,
    trigger: record.trigger,
    status: record.status,
    sources: record.sources,
    total_rows: record.totalRows,
    duration_ms: record.durationMs,
    deferred_sources: record.deferredSources,
  };
}

// Read-route limit: default 50, clamped to [1, 200].
export function clampSyncRunLimit(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, parsed));
}

export async function recordSyncRun(record: SyncRunRecord): Promise<void> {
  try {
    console.log(`[sync-ledger] ${JSON.stringify(record)}`);
  } catch {
    // Recording never throws.
  }
}
