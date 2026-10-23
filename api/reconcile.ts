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
import { supabaseConfigProblem } from "./_supabase.js";
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
    await recordEngineRun(startedAtMs, [
      {
        source: "reconcile",
        rows: 0,
        cached: false,
        error: `Supabase store unavailable: ${storeProblem}`,
      },
    ]);
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

  for (const source of SOURCES) {
    try {
      const outcome = await syncSource(source, notionSecret);
      entries.push({ source, rows: outcome.count, cached: false });
      // eslint-disable-next-line security/detect-object-injection -- source comes from the closed SOURCES allowlist in _sync-engine.
      summary[source] = { rows: outcome.count, changed: outcome.changed };
    } catch (error) {
      entries.push({
        source,
        rows: 0,
        cached: false,
        error: error instanceof Error ? error.message : "sync failed",
      });
    }
  }

  await recordEngineRun(startedAtMs, entries);
  const failed = entries.filter((entry) => entry.error).length;
  return res.status(200).json({
    ok: failed === 0,
    partial: failed > 0 && failed < entries.length,
    sources: summary,
    failedSources: entries
      .filter((entry) => entry.error)
      .map((entry) => entry.source),
  });
}
