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

import { createHash } from "node:crypto";
import {
  acquireLease,
  claimDeliveryState,
  deleteSnapshotRow,
  emptyDeliveryState,
  fencedClaimPatchDeliveryState,
  getDeliveryState,
  LEASE_TTL_MS,
  supabaseConfigured,
  listSnapshot,
  patchDeliveryState,
  releaseLease,
  insertSyncRun,
  upsertDeliveryState,
  upsertSnapshotRows,
  type DeliveryState,
  type PendingEntry,
  type PendingOp,
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
// each starting its own sync. W governs start spacing only; the claim
// boundary is claim_state with its 120s TTL (rev3.1 item 1), taken in
// syncSource below. There is no lease renewal anymore: the TTL is the
// only reclaim boundary, so a run that outlives it is reclaimable and
// its fenced commits fail.
export const COALESCE_WINDOW_MS = 10_000;

export const CRON_INTERVAL_MS = 15 * 60_000;

// Pending-set cap (rev3 item 7): 200 (entity_id, op) pairs per
// source. Overflow never drops work silently: the set clears into an
// immediate full-source claim (the engine's only sync shape is a full
// re-read, which supersedes the set) and the caller records the
// overflow in the run record.
export const PENDING_CAP = 200;

// Append one (entity_id, op) pair with dedupe by entity_id, delete
// winning over upsert. Returns the next set plus whether the append
// overflowed the cap (in which case the set is cleared: the caller's
// escalation is the full-source claim, not a truncated set).
export function appendPendingEntry(
  pending: PendingEntry[],
  entityId: string,
  op: PendingOp,
): { pending: PendingEntry[]; overflowed: boolean } {
  const existing = pending.find((entry) => entry.entity_id === entityId);
  if (existing) {
    if (existing.op === op || existing.op === "delete") {
      return { pending, overflowed: false };
    }
    return {
      pending: pending.map((entry) =>
        entry.entity_id === entityId ? { entity_id: entityId, op } : entry,
      ),
      overflowed: false,
    };
  }
  if (pending.length >= PENDING_CAP) {
    return { pending: [], overflowed: true };
  }
  return { pending: [...pending, { entity_id: entityId, op }], overflowed: false };
}

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

export interface MarkEventResult {
  state: DeliveryState;
  // True when appending this event overflowed the pending cap and the
  // set was cleared into an immediate full-source claim (rev3 item 7
  // escalation). The caller owns recording the overflow in the run
  // record and claiming now instead of coalescing.
  overflowed: boolean;
}

export async function markEvent(
  source: SourceName,
  event: {
    id: string | null;
    entityId: string | null;
    at: string;
    op: PendingOp;
  },
): Promise<MarkEventResult> {
  const existing = await getDeliveryState(source);
  const state = existing ?? emptyDeliveryState(source);
  // Ordering discipline (rev3 item 8): last_event_at only ever moves
  // forward; an out-of-order redelivery can never move it backwards.
  if (!state.last_event_at || event.at > state.last_event_at) {
    state.last_event_at = event.at;
  }
  if (event.id) state.last_event_id = event.id;
  state.dirty = true;
  let overflowed = false;
  if (event.entityId) {
    const appended = appendPendingEntry(
      state.pending_entity_ids,
      event.entityId,
      event.op,
    );
    state.pending_entity_ids = appended.pending;
    overflowed = appended.overflowed;
  }
  if (existing) {
    // Column-scoped write (RR-001 discipline, extended by Leg B):
    // markEvent owns exactly these four columns. A whole-row upsert
    // from this read could revert claim_state or last_sync_started_at
    // to their pre-claim values while a claimed run is in flight.
    const fields: Partial<DeliveryState> = {
      last_event_at: state.last_event_at,
      dirty: true,
      pending_entity_ids: state.pending_entity_ids,
    };
    if (event.id) fields.last_event_id = event.id;
    const matched = await patchDeliveryState(source, fields);
    if (matched === 0) await upsertDeliveryState(state);
  } else {
    await upsertDeliveryState(state);
  }
  return { state, overflowed };
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

// Canonical (key-sorted) serialization + hash for the drift compare
// (rev3 item 9, Leg E in-memory half). Raw JSON.stringify made the
// compare depend on key order, so the same content serialized in a
// different order read as drift; the canonical form sorts object
// keys recursively (arrays stay order-sensitive: order is content)
// and the compare runs on SHA-256 digests of it. The stored-hash
// column the spec's full shape wants is a v4 candidate behind the
// front door's gate (front-door default 2026-11-09: in-memory only);
// nothing here adds a column, an RPC, or any SQL.
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function canonicalRowHash(row: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson(row), "utf8").digest("hex");
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

  // The claim boundary (rev3.1 item 1): one run syncs a source at a
  // time, across every instance, taken here by the webhook and the
  // cron alike. W spacing runs first: an idle source whose last sync
  // started inside the coalesce window defers (its events are already
  // recorded; the trailing edge or the cron flushes them). Losing the
  // claim is a deferral, not a failure. The lease epoch is acquired
  // UNDER the claim as the write fence; it is never renewed, so the
  // 120s TTL is the only reclaim boundary for both. A source with no
  // delivery-state row yet has nothing to claim and bootstraps
  // unclaimed, as before.
  const owner = `sync-${source}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const defer = async (): Promise<SyncOutcome> => {
    const existing = await listSnapshot(source);
    return {
      source,
      count: existing.length,
      changed: 0,
      version: state.sync_version,
      deferred: true,
    };
  };
  let epoch: number | null = null;
  if (priorState !== null) {
    if (
      priorState.claim_state === "idle" &&
      priorState.last_sync_started_at &&
      Date.now() - Date.parse(priorState.last_sync_started_at) <
        COALESCE_WINDOW_MS
    ) {
      return defer();
    }
    // The fence is taken first so a held lease defers before any
    // claim write lands (the lease-driver premise); the claim is
    // then the boundary the run holds, and a busy claim hands the
    // fence straight back.
    epoch = await acquireLease(source, owner, Date.now(), LEASE_TTL_MS);
    if (epoch === null) return defer();
    const claim = await claimDeliveryState(source, Date.now());
    if (claim !== "claimed") {
      await releaseLease(source, owner, epoch);
      return defer();
    }
  }

  // The pending pairs this run started with, by entity_id. The commit
  // write clears exactly these; anything markEvent appends while the
  // run works is not this run's to clear (RR-001 Leg A). Claimed
  // delete pairs tombstone directly in the diff below (rev3 item 7).
  const startingPending = new Map(
    state.pending_entity_ids.map((entry) => [entry.entity_id, entry.op]),
  );
  const claimedDeletes = new Set(
    [...startingPending]
      .filter(([, op]) => op === "delete")
      .map(([entityId]) => entityId),
  );
  const startedAtIso = new Date().toISOString();

  try {
    // Started-state write, column-scoped on purpose: pending is never
    // written here. (The pre-Leg-A shape upserted the whole stale
    // state object with pending cleared, erasing events appended
    // after the run's initial read.) Under a claim, the claim PATCH
    // already wrote last_sync_started_at; this write only clears
    // dirty, fenced by claim + lease. The claim takes the pending set
    // as the run's starting set (read above); the set itself is
    // cleared at completion, in the commit below, so an event that
    // lands mid-run is never erased by the claim.
    if (epoch !== null) {
      const landed = await fencedClaimPatchDeliveryState(
        source,
        { dirty: false },
        owner,
        epoch,
      );
      if (!landed) throw new Error(`sync claim lost for ${source}`);
    } else {
      // Bootstrap (no delivery row yet, nothing to claim): create the
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
      // A claimed delete tombstones directly (rev3 item 7): the page
      // is never upserted from this read — delete wins even if the
      // listing still carries it (a delete the source has not yet
      // converged on) — and by staying out of `seen` it lands in the
      // delete set below whenever a snapshot row exists. No per-page
      // re-read of the deleted page happens anywhere in this path.
      if (claimedDeletes.has(pageId)) continue;
      seen.add(pageId);
      const lastEdited =
        typeof row._last_edited === "string" ? row._last_edited : null;
      const prior = existingById.get(pageId);
      if (
        !prior ||
        prior.last_edited !== lastEdited ||
        canonicalRowHash(prior.row) !== canonicalRowHash(row)
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
        // lost its claim during the read + diff stops here, having
        // written nothing outside its own started-state mark.
        const landed = await fencedClaimPatchDeliveryState(
          source,
          {},
          owner,
          epoch,
        );
        if (!landed) throw new Error(`sync claim lost for ${source}`);
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
    // during the run survive. Completion releases the claim in the
    // SAME fenced update as the outcome fields (rev3.1 item 1): the
    // write lands only while this run still holds claim + lease, so
    // a reclaim or takeover since the checkpoint makes it match zero
    // rows and the run reports claim-lost instead of success.
    // Snapshot rows already applied carry the run's sync_version and
    // converge on the next sync; delivery state is never committed
    // by a run that lost its claim.
    const freshest = await getDeliveryState(source);
    const commitFields: Partial<DeliveryState> = {
      sync_version: version,
      last_sync_ok_at: new Date().toISOString(),
      last_error: null,
      claim_state: "idle",
      pending_entity_ids: (freshest?.pending_entity_ids ?? []).filter(
        (entry) => !startingPending.has(entry.entity_id),
      ),
    };
    if (epoch !== null) {
      const landed = await fencedClaimPatchDeliveryState(
        source,
        commitFields,
        owner,
        epoch,
      );
      if (!landed) throw new Error(`sync claim lost for ${source}`);
    } else {
      await upsertDeliveryState({ ...(freshest ?? state), ...commitFields });
    }
    return { source, count: rows.length, changed, version, deferred: false };
  } catch (error) {
    // Failure write: last_error + dirty, pending retained, and the
    // claim released in the same fenced update (rev3 item 3 +
    // rev3.1 item 1). It never writes the version or the ok clock;
    // under a claim it is fenced like every other state write, so a
    // stale owner cannot overwrite the current holder's row with its
    // own stale view. If the fence is already gone the write matches
    // zero rows and the claim stands until its TTL — the expired-
    // claim path, by design. Best-effort: a failed failure-write
    // never masks the run's real error.
    const failureFields: Partial<DeliveryState> = {
      last_error: error instanceof Error ? error.message : "sync failed",
      dirty: true,
      claim_state: "idle",
    };
    if (epoch !== null) {
      await fencedClaimPatchDeliveryState(
        source,
        failureFields,
        owner,
        epoch,
      ).catch(() => undefined);
    } else {
      await patchDeliveryState(source, failureFields).catch(() => undefined);
    }
    throw error;
  } finally {
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
