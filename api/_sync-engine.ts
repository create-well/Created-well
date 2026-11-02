// Live-sync engine: the one path that turns Notion reads into the
// Supabase snapshot + delivery state. Used by the webhook route (event
// driven, per source) and the reconciliation cron (all sources). The
// reads themselves come from _notion-sources' fetchSourceRows, so the
// snapshot stores exactly what the dashboard reader reads.
//
// Correctness rules (from Monny's blueprint, 2026-10-22):
// - Coalescing is per source, never global. An event inside the window
//   marks its source dirty with the pending entity recorded; it is never
//   silently dropped.
// - sync_version moves only when the snapshot actually changes.
// - A failed sync leaves the source dirty + degraded, with the error in
//   delivery state and in the Notion sync ledger. The 15-minute cron is
//   the guaranteed trailing edge.

import {
  acquireLease,
  deleteSnapshotRow,
  emptyDeliveryState,
  fencedPatchDeliveryState,
  getDeliveryState,
  LEASE_TTL_MS,
  supabaseConfigured,
  listSnapshot,
  patchDeliveryState,
  releaseLease,
  insertSyncRun,
  renewLease,
  upsertDeliveryState,
  upsertSnapshotRows,
  type DeliveryState,
} from "./_supabase.js";
import {
  fetchSourceRows,
  SOURCES,
  type SourceName,
} from "./_notion-sources.js";
import {
  buildSyncRunRow,
  recordSyncRun,
  type LedgerSourceEntry,
  type SyncRunRecord,
} from "./_sync-ledger.js";

export { SOURCES };

// Per-source coalesce window. Events for the same source inside this
// window after a sync starts are carried as dirty + pending instead of
// each starting its own sync.
export const COALESCE_WINDOW_MS = 10_000;

// While a lease is held, its owner renews on this cadence (TTL is
// LEASE_TTL_MS in _supabase). Syncs run in seconds; the renew exists so
// a long reconcile of a large source never outlives its own lease.
export const LEASE_RENEW_MS = 30_000;

export const CRON_INTERVAL_MS = 15 * 60_000;

const PENDING_CAP = 50;

export type FreshnessState =
  | "live"
  | "stale"
  | "degraded"
  | "reconciling"
  | "unknown";

export function computeFreshness(
  state: DeliveryState | null,
  now: number,
): FreshnessState {
  if (!state || (!state.last_sync_ok_at && !state.last_event_at)) {
    return "unknown";
  }
  const startedAt = state.last_sync_started_at
    ? Date.parse(state.last_sync_started_at)
    : NaN;
  const okAt = state.last_sync_ok_at ? Date.parse(state.last_sync_ok_at) : NaN;
  // last_error is cleared by every successful sync, so a non-null value
  // always means the latest completed attempt failed: degraded wins
  // over reconciling (a retry in flight does not erase the failure).
  if (state.last_error) return "degraded";
  if (
    Number.isFinite(startedAt) &&
    now - startedAt < 60_000 &&
    (!Number.isFinite(okAt) || okAt < startedAt)
  ) {
    return "reconciling";
  }
  if (!Number.isFinite(okAt)) return "degraded";
  const age = now - okAt;
  if (age > 2 * CRON_INTERVAL_MS) return "degraded";
  if (age > CRON_INTERVAL_MS) return "stale";
  return "live";
}

export interface FreshnessEntry {
  state: FreshnessState;
  lastEventAt: string | null;
  lastSyncOkAt: string | null;
  syncVersion: number;
}

const UNKNOWN_FRESHNESS: FreshnessEntry = {
  state: "unknown",
  lastEventAt: null,
  lastSyncOkAt: null,
  syncVersion: 0,
};

/**
 * The per-source freshness block, computed from delivery state at read
 * time. One assembly shared by /api/snapshot and /api/dashboard (reader
 * decision, 2026-10-27) so every surface renders freshness from the same
 * shape. Fail-soft per source: a store problem marks that source
 * "unknown" and never fails the block; an unconfigured store marks every
 * source "unknown".
 */
export async function getSyncFreshness(
  now: number,
  readState: (source: SourceName) => Promise<DeliveryState | null> = getDeliveryState,
): Promise<Record<SourceName, FreshnessEntry>> {
  const entries = {} as Record<SourceName, FreshnessEntry>;
  if (!supabaseConfigured()) {
    for (const name of SOURCES) {
      // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist.
      entries[name] = { ...UNKNOWN_FRESHNESS };
    }
    return entries;
  }
  await Promise.all(
    SOURCES.map(async (name) => {
      try {
        const state = await readState(name);
        // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist.
        entries[name] = {
          state: computeFreshness(state, now),
          lastEventAt: state?.last_event_at ?? null,
          lastSyncOkAt: state?.last_sync_ok_at ?? null,
          syncVersion: state?.sync_version ?? 0,
        };
      } catch {
        // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist.
        entries[name] = { ...UNKNOWN_FRESHNESS };
      }
    }),
  );
  return entries;
}

export async function markEvent(
  source: SourceName,
  event: { id: string | null; entityId: string | null; at: string },
): Promise<DeliveryState> {
  const state =
    (await getDeliveryState(source)) ?? emptyDeliveryState(source);
  state.last_event_at = event.at;
  if (event.id) state.last_event_id = event.id;
  state.dirty = true;
  if (
    event.entityId &&
    !state.pending_entity_ids.includes(event.entityId)
  ) {
    state.pending_entity_ids = [
      ...state.pending_entity_ids,
      event.entityId,
    ].slice(-PENDING_CAP);
  }
  await upsertDeliveryState(state);
  return state;
}

// True when a sync for this source started inside the coalesce window:
// the caller should carry the event as pending (markEvent) instead of
// starting another sync.
export function withinCoalesceWindow(
  state: DeliveryState | null,
  now: number,
): boolean {
  if (!state?.last_sync_started_at) return false;
  return now - Date.parse(state.last_sync_started_at) < COALESCE_WINDOW_MS;
}

export interface SyncOutcome {
  source: SourceName;
  count: number;
  changed: number;
  version: number;
  // True when another run held the source's lease and this call synced
  // nothing: count is the current mirrored row count, changed is 0.
  // Callers record a deferral, never a failure and never a sync.
  deferred: boolean;
}

// One full read + diff + apply cycle for a single source. Throws on
// failure after recording the error into delivery state (dirty stays
// set, so freshness degrades and the cron retries).
export async function syncSource(
  source: SourceName,
  notionSecret: string,
): Promise<SyncOutcome> {
  const priorState = await getDeliveryState(source);
  const state = priorState ?? emptyDeliveryState(source);

  // Per-source lease (G-02 Option A): one run syncs a source at a time,
  // across every instance. Losing the acquire is a deferral, not a
  // failure — the source stays dirty + pending on the webhook path and
  // retries next tick on the cron path. A source with no delivery-state
  // row yet has nothing to lease and bootstraps unleased, as before.
  const owner = `sync-${source}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const epoch = await acquireLease(source, owner, Date.now(), LEASE_TTL_MS);
  if (epoch === null && priorState !== null) {
    const existing = await listSnapshot(source);
    return {
      source,
      count: existing.length,
      changed: 0,
      version: state.sync_version,
      deferred: true,
    };
  }

  const renewTimer =
    epoch !== null
      ? setInterval(() => {
          void renewLease(source, owner, epoch, Date.now(), LEASE_TTL_MS).catch(
            () => undefined,
          );
        }, LEASE_RENEW_MS)
      : null;
  (renewTimer as unknown as { unref?: () => void } | null)?.unref?.();

  // The pending ids this run started with. The commit write clears
  // exactly these; anything markEvent appends while the run works is
  // not this run's to clear (RR-001 Leg A).
  const startingPending = new Set(state.pending_entity_ids);
  const startedAtIso = new Date().toISOString();

  try {
    // Started-state write, column-scoped on purpose: pending is never
    // written here. (The pre-Leg-A shape upserted the whole stale
    // state object with pending cleared, erasing events appended
    // after the run's initial read.)
    if (epoch !== null) {
      const landed = await fencedPatchDeliveryState(
        source,
        { last_sync_started_at: startedAtIso, dirty: false },
        owner,
        epoch,
        Date.now(),
      );
      if (!landed) throw new Error(`sync lease lost for ${source}`);
    } else {
      // Bootstrap (no delivery row yet, nothing to lease): create the
      // row from the state read at run start, pending intact.
      state.last_sync_started_at = startedAtIso;
      state.dirty = false;
      await upsertDeliveryState(state);
    }

    const rows = await fetchSourceRows(source, notionSecret);
    const existing = await listSnapshot(source);
    const existingById = new Map(
      existing.map((entry) => [entry.page_id, entry]),
    );
    const seen = new Set<string>();
    const upserts: Array<{
      page_id: string;
      row: Record<string, unknown>;
      last_edited: string | null;
      sync_version: number;
    }> = [];
    const nextVersion = state.sync_version + 1;

    for (const row of rows) {
      const pageId = typeof row._id === "string" ? row._id : null;
      if (!pageId) continue;
      seen.add(pageId);
      const lastEdited =
        typeof row._last_edited === "string" ? row._last_edited : null;
      const prior = existingById.get(pageId);
      if (
        !prior ||
        prior.last_edited !== lastEdited ||
        JSON.stringify(prior.row) !== JSON.stringify(row)
      ) {
        upserts.push({
          page_id: pageId,
          row,
          last_edited: lastEdited,
          sync_version: nextVersion,
        });
      }
    }
    const deletes = existing.filter((entry) => !seen.has(entry.page_id));
    const changed = upserts.length + deletes.length;
    const version = changed > 0 ? nextVersion : state.sync_version;

    if (changed > 0) {
      if (epoch !== null) {
        // Fenced checkpoint BEFORE any snapshot mutation: a run that
        // lost its lease during the read + diff stops here, having
        // written nothing outside its own started-state mark.
        const landed = await fencedPatchDeliveryState(
          source,
          {},
          owner,
          epoch,
          Date.now(),
        );
        if (!landed) throw new Error(`sync lease lost for ${source}`);
      }
      await upsertSnapshotRows(
        source,
        upserts.map((entry) => ({ ...entry, sync_version: version })),
      );
      for (const entry of deletes) {
        await deleteSnapshotRow(source, entry.page_id);
      }
    }

    // Commit. Pending is recomputed against the freshest row: only
    // the ids this run started with are cleared, so events appended
    // during the run survive. Under a lease the commit write is
    // itself fenced (owner + epoch + unexpired, inside the PATCH):
    // a takeover or expiry since the checkpoint makes it match zero
    // rows, and the run reports lease-lost instead of success.
    // Snapshot rows already applied carry the run's sync_version and
    // converge on the next sync; delivery state is never committed
    // by a run that lost its lease.
    const freshest = await getDeliveryState(source);
    const commitFields: Partial<DeliveryState> = {
      sync_version: version,
      last_sync_ok_at: new Date().toISOString(),
      last_error: null,
      pending_entity_ids: (freshest?.pending_entity_ids ?? []).filter(
        (id) => !startingPending.has(id),
      ),
    };
    if (epoch !== null) {
      const landed = await fencedPatchDeliveryState(
        source,
        commitFields,
        owner,
        epoch,
        Date.now(),
      );
      if (!landed) throw new Error(`sync lease lost for ${source}`);
    } else {
      await upsertDeliveryState({ ...(freshest ?? state), ...commitFields });
    }
    return { source, count: rows.length, changed, version, deferred: false };
  } catch (error) {
    // Failure write: last_error + dirty only. It never writes pending,
    // the version, or the ok clock; under a lease it is fenced like
    // every other state write, so a stale owner cannot overwrite the
    // current holder's row with its own stale view. Best-effort: a
    // failed failure-write never masks the run's real error.
    const failureFields: Partial<DeliveryState> = {
      last_error: error instanceof Error ? error.message : "sync failed",
      dirty: true,
    };
    if (epoch !== null) {
      await fencedPatchDeliveryState(
        source,
        failureFields,
        owner,
        epoch,
        Date.now(),
      ).catch(() => undefined);
    } else {
      await patchDeliveryState(source, failureFields).catch(() => undefined);
    }
    throw error;
  } finally {
    if (renewTimer) clearInterval(renewTimer);
    if (epoch !== null) await releaseLease(source, owner, epoch);
  }
}

// Ledger bookkeeping shared by webhook + cron: one run, per-source
// entries, recorded through _sync-ledger (recording never throws).
export async function recordEngineRun(
  startedAtMs: number,
  entries: LedgerSourceEntry[],
  meta: { trigger: "reconcile" | "webhook"; deferredSources?: string[] },
): Promise<void> {
  const failed = entries.filter((entry) => entry.error).length;
  const status =
    failed === 0 ? "ok" : failed === entries.length ? "failed" : "partial";
  const record: SyncRunRecord = {
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    status,
    sources: entries,
    totalRows: entries.reduce((sum, entry) => sum + entry.rows, 0),
    trigger: meta.trigger,
    deferredSources: meta.deferredSources ?? [],
  };
  await recordSyncRun(record).catch(() => undefined);
  // Durable history (G-35): the same record lands in sync_runs. Fail-soft
  // by design: until the table exists (schema escalation) and whenever
  // the store errors, the log line above remains the record.
  await insertSyncRun(buildSyncRunRow(record)).catch(() => undefined);
}
