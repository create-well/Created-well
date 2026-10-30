// GET /api/reconcile — the 15-minute reconciliation fallback.
//
// Vercel Cron calls this on the schedule in vercel.json, sending the
// CRON_SECRET as a bearer token (Vercel's native cron auth). Each run
// re-reads every source from Notion, diffs against the Supabase
// snapshot, and corrects drift: it is the safety net for the webhook
// path, not the primary path. On a healthy webhook day it corrects
// ~zero drift; its per-source drift count lands in the sync ledger and
// is the stability metric for ever revisiting Realtime.
//
// Fail-closed: without CRON_SECRET configured, or with a mismatched
// bearer, the route 401s and syncs nothing.

import { createHash, timingSafeEqual } from "node:crypto";
import { recordEngineRun, SOURCES, syncSource } from "./_sync-engine.js";
import {
  getSetupValue,
  pruneSyncRuns,
  setSetupValue,
  supabaseConfigProblem,
} from "./_supabase.js";
import type { LedgerSourceEntry } from "./_sync-ledger.js";

interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

function headerValue(
  headers: ApiRequest["headers"],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  // eslint-disable-next-line security/detect-object-injection -- Read-only header lookup keyed by an internal literal.
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function cronAuthorized(req: ApiRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authorization = headerValue(req.headers, "authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = createHash("sha256")
    .update(authorization.slice("Bearer ".length))
    .digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(received, wanted);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader?.("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!cronAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const notionSecret = process.env.NOTION_SECRET;
  if (!notionSecret) {
    return res.status(500).json({ error: "NOTION_SECRET is not configured" });
  }

  const startedAtMs = Date.now();

  // Store guard: with the Supabase store missing or malformed, no source
  // can sync. Record ONE run-level failure saying so, instead of seven
  // per-source errors that read as source failures (the 2026-10-23
  // 06:00 UTC receipt, where raw URL-parse errors landed per source
  // because this route never checked the store configuration).
  const storeProblem = supabaseConfigProblem();
  if (storeProblem) {
    await recordEngineRun(
      startedAtMs,
      [
        {
          source: "reconcile",
          rows: 0,
          cached: false,
          error: `Supabase store unavailable: ${storeProblem}`,
        },
      ],
      { trigger: "reconcile" },
    );
    return res.status(200).json({
      ok: false,
      partial: false,
      storeNotConfigured: true,
      error: `Supabase store unavailable: ${storeProblem}`,
      sources: {},
      failedSources: [],
    });
  }
  const entries: LedgerSourceEntry[] = [];
  const summary: Record<string, { rows: number; changed: number }> = {};
  const deferredSources: string[] = [];

  for (const source of SOURCES) {
    try {
      const outcome = await syncSource(source, notionSecret);
      // eslint-disable-next-line security/detect-object-injection -- source comes from the closed SOURCES allowlist in _sync-engine.
      summary[source] = { rows: outcome.count, changed: outcome.changed };
      if (outcome.deferred) {
        // Another run holds this source's lease. A deferral is not a
        // sync: it writes no ledger entry (the entry would read as an
        // ordinary ok run carrying the mirrored row count — QA
        // ledger-leg finding, 2026-10-27). The source stays dirty in
        // delivery state; the holder's run or the next tick carries it.
        deferredSources.push(source);
        console.log(`[reconcile] deferred source=${source} (lease held)`);
        continue;
      }
      entries.push({ source, rows: outcome.count, cached: false });
    } catch (error) {
      entries.push({
        source,
        rows: 0,
        cached: false,
        error: error instanceof Error ? error.message : "sync failed",
      });
    }
  }

  // No entries means every source deferred: no run record at all, for
  // the same reason a single deferral writes none.
  if (entries.length > 0) {
    await recordEngineRun(startedAtMs, entries, {
      trigger: "reconcile",
      deferredSources,
    });
  }

  // Run-history retention (G-35): prune sync_runs rows older than 90
  // days, guarded to once a day by a sync_setup watermark. Fail-soft:
  // pruning never fails a reconcile, and until the table exists the
  // attempts simply error and are swallowed here.
  try {
    const watermark = await getSetupValue("sync_runs_pruned_at");
    const lastPrunedMs =
      watermark && typeof watermark.at === "string"
        ? Date.parse(watermark.at)
        : NaN;
    if (!Number.isFinite(lastPrunedMs) || Date.now() - lastPrunedMs > 86_400_000) {
      const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
      await pruneSyncRuns(cutoff);
      await setSetupValue("sync_runs_pruned_at", {
        at: new Date().toISOString(),
      });
    }
  } catch {
    // Retention is bookkeeping; a failed prune retries on a later tick.
  }
  const failed = entries.filter((entry) => entry.error).length;
  return res.status(200).json({
    ok: failed === 0,
    partial: failed > 0 && failed < entries.length,
    sources: summary,
    failedSources: entries
      .filter((entry) => entry.error)
      .map((entry) => entry.source),
    deferredSources,
  });
}
