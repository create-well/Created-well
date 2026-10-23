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

export interface DeliveryState {
  source: string;
  sync_version: number;
  last_event_at: string | null;
  last_event_id: string | null;
  last_sync_started_at: string | null;
  last_sync_ok_at: string | null;
  dirty: boolean;
  pending_entity_ids: string[];
  last_error: string | null;
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
    pending_entity_ids: Array.isArray(raw.pending_entity_ids)
      ? raw.pending_entity_ids.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    last_error: typeof raw.last_error === "string" ? raw.last_error : null,
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

export async function listSnapshot(source: string): Promise<SnapshotRow[]> {
  const raw = await rest(
    `sync_snapshots?source=eq.${encodeURIComponent(source)}&select=page_id,row,last_edited,sync_version&limit=2000`,
  );
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((entry) => ({
    page_id: String(entry.page_id),
    row: isRecord(entry.row) ? entry.row : {},
    last_edited:
      typeof entry.last_edited === "string" ? entry.last_edited : null,
    sync_version:
      typeof entry.sync_version === "number" ? entry.sync_version : 0,
  }));
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
