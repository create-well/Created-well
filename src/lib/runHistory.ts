// Run-history read model for the SystemPage "Run history" row.
//
// The durable store is public.sync_runs (G-35 / Q-42 Option B, landed
// PR #66): GET /api/sync-runs answers { runs, store } newest first, and
// answers 200 with an empty list when the store is unconfigured or
// unreadable, so an empty list here means "no runs recorded yet", never
// an error. This module is the one client-side mapping from that wire
// shape; every field degrades gracefully and nothing throws.

export interface SyncRunSource {
  source: string;
  rows: number;
  cached: boolean;
  error?: string;
}

export interface SyncRunSummary {
  startedAt: string;
  trigger: string;
  status: string;
  totalRows: number;
  durationMs: number | null;
  sources: SyncRunSource[];
  deferredSources: string[];
}

export interface SyncRunsRead {
  runs: SyncRunSummary[];
  store: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSource(value: unknown): SyncRunSource | null {
  if (!isRecord(value)) return null;
  if (typeof value.source !== "string" || value.source === "") return null;
  return {
    source: value.source,
    rows: asFiniteNumber(value.rows) ?? 0,
    cached: value.cached === true,
    ...(typeof value.error === "string" && value.error !== ""
      ? { error: value.error }
      : {}),
  };
}

function parseRun(value: unknown): SyncRunSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.started_at !== "string" || value.started_at === "") {
    return null;
  }
  const sources = Array.isArray(value.sources)
    ? value.sources
        .map(parseSource)
        .filter((s): s is SyncRunSource => s !== null)
    : [];
  return {
    startedAt: value.started_at,
    trigger: typeof value.trigger === "string" ? value.trigger : "unknown",
    status: typeof value.status === "string" ? value.status : "unknown",
    totalRows: asFiniteNumber(value.total_rows) ?? 0,
    durationMs: asFiniteNumber(value.duration_ms),
    sources,
    deferredSources: Array.isArray(value.deferred_sources)
      ? value.deferred_sources.filter(
          (s): s is string => typeof s === "string",
        )
      : [],
  };
}

// Null means the payload is not the route's shape at all (malformed);
// the caller renders its unavailable state. A well-formed payload with
// zero runs is a successful read of an empty store.
export function parseSyncRunsPayload(payload: unknown): SyncRunsRead | null {
  if (!isRecord(payload)) return null;
  if (!Array.isArray(payload.runs)) return null;
  return {
    runs: payload.runs
      .map(parseRun)
      .filter((r): r is SyncRunSummary => r !== null),
    store: typeof payload.store === "string" ? payload.store : "unknown",
  };
}

export function runStatusTone(
  status: string,
): "ok" | "warn" | "error" | "neutral" {
  if (status === "ok") return "ok";
  if (status === "partial") return "warn";
  if (status === "failed") return "error";
  return "neutral";
}

export function runStartedDate(run: SyncRunSummary): Date | null {
  const date = new Date(run.startedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

// One quiet detail line per run: "214 rows · 7 sources · 41s", with the
// deferred and errored sources named when present — the facts a reader
// needs to tell a clean run from a partial one, nothing more.
export function runDetailLine(run: SyncRunSummary): string {
  const parts: string[] = [
    `${run.totalRows} rows`,
    `${run.sources.length} source${run.sources.length === 1 ? "" : "s"}`,
  ];
  const duration = formatDurationMs(run.durationMs);
  if (duration) parts.push(duration);
  if (run.deferredSources.length > 0) {
    parts.push(`deferred: ${run.deferredSources.join(", ")}`);
  }
  const errored = run.sources.filter((s) => s.error).map((s) => s.source);
  if (errored.length > 0) {
    parts.push(`errors: ${errored.join(", ")}`);
  }
  return parts.join(" · ");
}
