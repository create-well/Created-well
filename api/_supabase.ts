// Supabase delivery-state + snapshot store for live-sync.
//
// The standing architecture (Monny's decision, 2026-10-22): Notion is the
// source of truth, Supabase holds ONLY delivery state and the normalized
// snapshot mirror, Vercel is the API boundary. This module is a thin
// PostgREST client over fetch (no SDK dependency): three tables,
//   sync_delivery_state (one row per source: versions, freshness clocks,
//                        dirty flag, pending entities, last error)
//   sync_snapshots      (one row per synced page: the normalized row)
//   sync_setup          (one-time setup values, e.g. the webhook
//                        verification token stash; operator-read, then
//                        cleared by hand)
// DDL lives in docs/live-sync-supabase.sql. Access is service-role only;
// RLS stays enabled with no public policies, so the anon key cannot read
// or write any of it.

// Pending work for a source (live-sync rev3 item 7): (entity_id, op)
// pairs, not bare ids. A page.deleted event must tombstone at claim
// time without a re-read, so the op travels with the id. The stored
// JSONB predates the op: legacy string entries decode as op "upsert"
// (decodePending below), so rows written by older code stay readable.
export type PendingOp = "upsert" | "delete";

export interface PendingEntry {
  entity_id: string;
  op: PendingOp;
}

export function decodePendingEntry(raw: unknown): PendingEntry | null {
  if (typeof raw === "string") {
    return raw ? { entity_id: raw, op: "upsert" } : null;
  }
  if (
    isRecord(raw) &&
    typeof raw.entity_id === "string" &&
    raw.entity_id
  ) {
    return {
      entity_id: raw.entity_id,
      op: raw.op === "delete" ? "delete" : "upsert",
    };
  }
  return null;
}

// Decode a stored pending array: malformed entries drop, duplicates
// collapse by entity_id with delete winning over upsert (the same
// rule the writer applies, so a stored duplicate can never resurrect
// a deleted page).
export function decodePending(raw: unknown): PendingEntry[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, PendingEntry>();
  for (const item of raw) {
    const entry = decodePendingEntry(item);
    if (!entry) continue;
    const prior = byId.get(entry.entity_id);
    if (!prior || entry.op === "delete") byId.set(entry.entity_id, entry);
  }
  return [...byId.values()];
}

// The claim boundary (rev3.1 item 1; columns land via the SQL v3
// gated sitting — code reading them must not deploy before it).
// Decoding is tolerant: a row read before the sitting has neither
// key, and decodes to the safe defaults (idle, never populated).
export type ClaimState = "idle" | "running";

export interface DeliveryState {
  source: string;
  sync_version: number;
  last_event_at: string | null;
  last_event_id: string | null;
  last_sync_started_at: string | null;
  last_sync_ok_at: string | null;
  dirty: boolean;
  pending_entity_ids: PendingEntry[];
  last_error: string | null;
  claim_state: ClaimState;
  mirror_populated_at: string | null;
  // The row's own last-write time (every store write stamps it). The
  // freshness ladder ages dirty-only work from it (Leg D).
  updated_at: string | null;
}

export interface SnapshotRow {
  page_id: string;
  row: Record<string, unknown>;
  last_edited: string | null;
  sync_version: number;
}

// Why the store cannot be used, in stable value-free language, or null
// when it is usable. Reasons name the variable and the defect class; they
// never echo the configured value. (A malformed SUPABASE_URL used to pass
// a truthiness check and then explode inside fetch as a raw "Failed to
// parse URL from /rest/v1/..." per source — the 2026-10-23 06:00 UTC
// ledger receipt — which read as seven source failures instead of one
// configuration gap.)
export function supabaseConfigProblem(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return "SUPABASE_URL is not set";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "SUPABASE_URL is not a valid absolute URL";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "SUPABASE_URL must use http or https";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is not set";
  }
  return null;
}

export function supabaseConfigured(): boolean {
  return supabaseConfigProblem() === null;
}

function baseUrl(): string {
  return (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
}

async function rest(
  path: string,
  init: RequestInit & { expectObject?: boolean } = {},
): Promise<unknown> {
  const problem = supabaseConfigProblem();
  if (problem) {
    // Fail with the configuration truth, before any network call, so no
    // caller can surface a raw URL-parse error as a per-source failure.
    throw new Error(`Supabase store unavailable: ${problem}`);
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const { expectObject, ...restInit } = init;
  const response = await fetch(`${baseUrl()}/rest/v1/${path}`, {
    ...restInit,
    headers: {
      apikey: key,
      // Header name built via concatenation so this file never carries
      // the literal header name (codebase convention).
      ["Author" + "ization"]: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(expectObject
        ? { Accept: "application/vnd.pgrst.object+json" }
        : {}),
      ...(restInit.headers ?? {}),
    },
  });
  if (expectObject && response.status === 406) return null;
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status})`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDeliveryState(raw: Record<string, unknown>): DeliveryState {
  return {
    source: String(raw.source),
    sync_version: typeof raw.sync_version === "number" ? raw.sync_version : 0,
    last_event_at:
      typeof raw.last_event_at === "string" ? raw.last_event_at : null,
    last_event_id:
      typeof raw.last_event_id === "string" ? raw.last_event_id : null,
    last_sync_started_at:
      typeof raw.last_sync_started_at === "string"
        ? raw.last_sync_started_at
        : null,
    last_sync_ok_at:
      typeof raw.last_sync_ok_at === "string" ? raw.last_sync_ok_at : null,
    dirty: raw.dirty === true,
    pending_entity_ids: decodePending(raw.pending_entity_ids),
    last_error: typeof raw.last_error === "string" ? raw.last_error : null,
    claim_state: raw.claim_state === "running" ? "running" : "idle",
    mirror_populated_at:
      typeof raw.mirror_populated_at === "string"
        ? raw.mirror_populated_at
        : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export function emptyDeliveryState(source: string): DeliveryState {
  return {
    source,
    sync_version: 0,
    last_event_at: null,
    last_event_id: null,
    last_sync_started_at: null,
    last_sync_ok_at: null,
    dirty: false,
    pending_entity_ids: [],
    last_error: null,
    claim_state: "idle",
    mirror_populated_at: null,
    updated_at: null,
  };
}

export async function getDeliveryState(
  source: string,
): Promise<DeliveryState | null> {
  const raw = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&select=*`,
    { expectObject: true },
  );
  return isRecord(raw) ? toDeliveryState(raw) : null;
}

export async function upsertDeliveryState(
  state: DeliveryState,
): Promise<void> {
  await rest("sync_delivery_state?on_conflict=source", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      ...state,
      updated_at: new Date().toISOString(),
    }),
  });
}

// Column-scoped PATCH of one delivery-state row: only the named fields
// are written, so a writer never overwrites columns it did not mean to
// touch (pending_entity_ids above all — RR-001 Leg A). Returns the
// number of rows the PATCH matched.
export async function patchDeliveryState(
  source: string,
  fields: Partial<DeliveryState>,
): Promise<number> {
  const result = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...fields,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return Array.isArray(result) ? result.length : 0;
}

// A delivery-state write fenced by the lease itself (RR-001 Leg A):
// the PATCH lands only while the row still names this owner + epoch
// AND the lease is unexpired at write time, evaluated inside the one
// statement. A takeover or an expiry between any earlier check and
// this write makes it match zero rows instead of committing — the
// check and the write are the same act, so there is no window between
// them. True when the write landed (exactly one row).
export async function fencedPatchDeliveryState(
  source: string,
  fields: Partial<DeliveryState>,
  owner: string,
  epoch: number,
  nowMs: number,
): Promise<boolean> {
  const nowIso = new Date(nowMs).toISOString();
  const result = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&lease_owner=eq.${encodeURIComponent(owner)}&lease_epoch=eq.${epoch}&lease_expires_at=gt.${encodeURIComponent(nowIso)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...fields,
        updated_at: nowIso,
      }),
    },
  );
  return Array.isArray(result) && result.length === 1;
}

// ── Per-source sync leases (G-02 Option A; DDL: docs/live-sync-lease-supabase.sql) ──
//
// The lease columns live on the delivery-state row itself. Acquire is a
// compare-and-swap: one PATCH whose filters pin the epoch the caller read
// AND require the prior lease to be absent or expired. The statement is
// atomic, so exactly one contender's PATCH lands; the returned row count
// is the verdict (1 = won, 0 = lost). The epoch is the fencing token:
// every successful acquire increments it, and renew / release / verify
// all match on owner + epoch, so a stale owner can never renew, release,
// or pass verification against a lease that has been taken over.

export const LEASE_TTL_MS = 120_000;

interface LeaseRow {
  lease_owner: string | null;
  lease_epoch: number;
  lease_expires_at: string | null;
}

async function getLeaseRow(source: string): Promise<LeaseRow | null> {
  const raw = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&select=lease_owner,lease_epoch,lease_expires_at`,
    { expectObject: true },
  );
  if (!isRecord(raw)) return null;
  return {
    lease_owner:
      typeof raw.lease_owner === "string" ? raw.lease_owner : null,
    lease_epoch:
      typeof raw.lease_epoch === "number"
        ? raw.lease_epoch
        : Number(raw.lease_epoch ?? 0) || 0,
    lease_expires_at:
      typeof raw.lease_expires_at === "string" ? raw.lease_expires_at : null,
  };
}

// Win the source's lease, or return null when another run holds it (or
// the source has no delivery-state row to lease yet). On a win, returns
// the new epoch — the fencing token for renew / verify / release.
export async function acquireLease(
  source: string,
  owner: string,
  nowMs: number,
  ttlMs: number,
): Promise<number | null> {
  const row = await getLeaseRow(source);
  if (!row) return null;
  const nowIso = new Date(nowMs).toISOString();
  const expiryFilter = encodeURIComponent(
    `(lease_expires_at.is.null,lease_expires_at.lt.${nowIso})`,
  );
  const result = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&lease_epoch=eq.${row.lease_epoch}&or=${expiryFilter}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        lease_owner: owner,
        lease_epoch: row.lease_epoch + 1,
        lease_expires_at: new Date(nowMs + ttlMs).toISOString(),
        updated_at: nowIso,
      }),
    },
  );
  return Array.isArray(result) && result.length === 1
    ? row.lease_epoch + 1
    : null;
}

// Extend a held lease. False when the lease is no longer the caller's
// (taken over or released) — the caller treats that as lease-lost.
export async function renewLease(
  source: string,
  owner: string,
  epoch: number,
  nowMs: number,
  ttlMs: number,
): Promise<boolean> {
  const result = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&lease_owner=eq.${encodeURIComponent(owner)}&lease_epoch=eq.${epoch}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        lease_expires_at: new Date(nowMs + ttlMs).toISOString(),
        updated_at: new Date(nowMs).toISOString(),
      }),
    },
  );
  return Array.isArray(result) && result.length === 1;
}

// True when owner + epoch still hold the source's lease. Retained for
// compatibility; the sync engine no longer fences with it — a separate
// check-then-write pair leaves a takeover window between the two acts,
// so the engine commits through fencedPatchDeliveryState instead,
// whose predicates (owner + epoch + unexpired, inside the write) are
// the fencing of record (RR-001 Leg A).
export async function verifyLease(
  source: string,
  owner: string,
  epoch: number,
): Promise<boolean> {
  const row = await getLeaseRow(source);
  return row !== null && row.lease_owner === owner && row.lease_epoch === epoch;
}

// Clear the lease, only if it is still the caller's own (owner + epoch).
// Best-effort by design: a failed release never masks the run's outcome,
// and the TTL reclaims the lease on its own.
export async function releaseLease(
  source: string,
  owner: string,
  epoch: number,
): Promise<void> {
  try {
    await rest(
      `sync_delivery_state?source=eq.${encodeURIComponent(source)}&lease_owner=eq.${encodeURIComponent(owner)}&lease_epoch=eq.${epoch}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          lease_owner: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        }),
      },
    );
  } catch {
    // Expiry is the backstop; nothing to do.
  }
}

// ── The claim boundary (rev3.1 item 1) ─────────────────────────────
//
// claim_state is the ONE claim mechanism for a source, taken by the
// webhook and the cron alike through the sync engine. The TTL is the
// only reclaim boundary: a claim is the conditional update that sets
// claim_state='running' + last_sync_started_at=now, allowed only
// where the row is idle, or running with a start at least
// CLAIM_TTL_MS old. PostgREST filters cannot express the age
// comparison, so the reclaim branch pins the exact stale
// last_sync_started_at the caller just read (eq.<value>): a claim
// that landed in between moved that value, this PATCH matches zero
// rows, and exactly one contender wins. The lease epoch stays UNDER
// the claim as the write fence (a stale writer whose claim was
// reclaimed must not be able to commit or clear the new claim).

export const CLAIM_TTL_MS = 120_000;

export type ClaimOutcome = "claimed" | "busy" | "no-row";

export async function claimDeliveryState(
  source: string,
  nowMs: number,
): Promise<ClaimOutcome> {
  const raw = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&select=claim_state,last_sync_started_at`,
    { expectObject: true },
  );
  if (!isRecord(raw)) return "no-row";
  const nowIso = new Date(nowMs).toISOString();
  const body = JSON.stringify({
    claim_state: "running",
    last_sync_started_at: nowIso,
    updated_at: nowIso,
  });
  const headers = { Prefer: "return=representation" };
  if (raw.claim_state === "running") {
    const startedAt =
      typeof raw.last_sync_started_at === "string"
        ? raw.last_sync_started_at
        : null;
    // A running claim with no readable start cannot be aged; fail
    // closed and treat it as busy rather than stealing it blind.
    if (!startedAt || nowMs - Date.parse(startedAt) < CLAIM_TTL_MS) {
      return "busy";
    }
    const result = await rest(
      `sync_delivery_state?source=eq.${encodeURIComponent(source)}&claim_state=eq.running&last_sync_started_at=eq.${encodeURIComponent(startedAt)}`,
      { method: "PATCH", headers, body },
    );
    return Array.isArray(result) && result.length === 1
      ? "claimed"
      : "busy";
  }
  const result = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&claim_state=eq.idle`,
    { method: "PATCH", headers, body },
  );
  return Array.isArray(result) && result.length === 1 ? "claimed" : "busy";
}

// A delivery-state write fenced by BOTH the claim and the lease: the
// PATCH lands only while the row still carries claim_state='running'
// AND this owner + epoch. A reclaim (claim taken over) or a lease
// takeover (epoch moved) makes it match zero rows. True when the
// write landed (exactly one row).
export async function fencedClaimPatchDeliveryState(
  source: string,
  fields: Partial<DeliveryState>,
  owner: string,
  epoch: number,
): Promise<boolean> {
  const result = await rest(
    `sync_delivery_state?source=eq.${encodeURIComponent(source)}&claim_state=eq.running&lease_owner=eq.${encodeURIComponent(owner)}&lease_epoch=eq.${epoch}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...fields,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return Array.isArray(result) && result.length === 1;
}

export async function listSnapshot(source: string): Promise<SnapshotRow[]> {
  // F-SWEEP2-4: this read previously stopped at a silent limit=2000
  // ceiling, so a source past 2000 rows would assemble from a partial
  // snapshot without any trace. Page by offset in page_id order; a
  // page failure or the safety cap refuses loudly instead of
  // truncating silently.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50;
  const rows: SnapshotRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const raw = await rest(
      `sync_snapshots?source=eq.${encodeURIComponent(source)}&select=page_id,row,last_edited,sync_version&order=page_id&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    );
    if (!Array.isArray(raw)) {
      if (page === 0) return [];
      throw new Error(
        `listSnapshot(${source}) page ${page} returned a non-array response; refusing a partial snapshot`,
      );
    }
    rows.push(
      ...raw.filter(isRecord).map((entry) => ({
        page_id: String(entry.page_id),
        row: isRecord(entry.row) ? entry.row : {},
        last_edited:
          typeof entry.last_edited === "string" ? entry.last_edited : null,
        sync_version:
          typeof entry.sync_version === "number" ? entry.sync_version : 0,
      })),
    );
    if (raw.length < PAGE_SIZE) return rows;
  }
  throw new Error(
    `listSnapshot(${source}) exceeded the ${MAX_PAGES * PAGE_SIZE}-row safety cap; refusing a partial snapshot`,
  );
}

export async function upsertSnapshotRows(
  source: string,
  rows: Array<{
    page_id: string;
    row: Record<string, unknown>;
    last_edited: string | null;
    sync_version: number;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  await rest("sync_snapshots?on_conflict=source,page_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(
      rows.map((entry) => ({
        source,
        page_id: entry.page_id,
        row: entry.row,
        last_edited: entry.last_edited,
        sync_version: entry.sync_version,
        updated_at: new Date().toISOString(),
      })),
    ),
  });
}

export async function deleteSnapshotRow(
  source: string,
  pageId: string,
): Promise<void> {
  await rest(
    `sync_snapshots?source=eq.${encodeURIComponent(source)}&page_id=eq.${encodeURIComponent(pageId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
}

// One-time setup stash (webhook verification token). Written by the
// webhook handshake, read once by the operator from the Supabase table
// editor, then cleared by hand. Never logged anywhere.
// Durable run history (G-35 / Q-42 Option B): one row per recorded
// engine run in public.sync_runs. The table lands by schema escalation
// (docs/sync-runs-supabase.sql); every function here fails as an ordinary
// store error and every caller treats history as fail-soft bookkeeping.

export interface SyncRunStoreRow {
  started_at: string;
  finished_at: string;
  trigger: string;
  status: string;
  sources: unknown;
  total_rows: number;
  duration_ms: number;
  deferred_sources: string[];
}

export async function insertSyncRun(row: SyncRunStoreRow): Promise<void> {
  await rest("sync_runs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
}

export async function listSyncRuns(limit: number): Promise<unknown[]> {
  const rows = await rest(
    `sync_runs?select=id,started_at,finished_at,trigger,status,sources,total_rows,duration_ms,deferred_sources&order=started_at.desc&limit=${limit}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function pruneSyncRuns(cutoffIso: string): Promise<void> {
  await rest(`sync_runs?started_at=lt.${encodeURIComponent(cutoffIso)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function getSetupValue(
  key: string,
): Promise<Record<string, unknown> | null> {
  const row = await rest(
    `sync_setup?key=eq.${encodeURIComponent(key)}&select=value`,
    { expectObject: true },
  );
  if (!isRecord(row) || !isRecord(row.value)) return null;
  return row.value;
}

// The setup row itself, value plus its updated_at — the alert leg
// (live-sync Leg F) ages the uncleared verification row from
// updated_at, which getSetupValue does not surface. Null when the row
// does not exist.
export async function getSetupRow(
  key: string,
): Promise<{ value: Record<string, unknown> | null; updated_at: string | null } | null> {
  const row = await rest(
    `sync_setup?key=eq.${encodeURIComponent(key)}&select=value,updated_at`,
    { expectObject: true },
  );
  if (!isRecord(row)) return null;
  return {
    value: isRecord(row.value) ? row.value : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

// The lease snapshot for one source, for readers that only need the
// claim's liveness (Leg F's expired-claim alert reads expiry; the
// fencing fields stay inside this module). Null when the source has
// no delivery-state row.
export async function getLeaseSnapshot(
  source: string,
): Promise<{ owner: string | null; expires_at: string | null } | null> {
  const row = await getLeaseRow(source);
  if (!row) return null;
  return { owner: row.lease_owner, expires_at: row.lease_expires_at };
}

export async function setSetupValue(
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await rest("sync_setup?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  });
}

// First-write-wins insert for one-time setup values (live-sync rev3
// item 6): the insert lands only when the key is absent, so a populated
// setup row can never be overwritten by a later writer. True when this
// call inserted the row; false when a row already existed (the store
// ignored the duplicate) — the caller treats false as "window closed",
// never as a partial success.
export async function insertSetupValue(
  key: string,
  value: Record<string, unknown>,
): Promise<boolean> {
  const result = await rest("sync_setup?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  });
  return Array.isArray(result) && result.length === 1;
}
