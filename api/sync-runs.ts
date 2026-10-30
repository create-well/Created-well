// GET /api/sync-runs — the session-gated read of the durable sync
// run-history store (G-35 / Q-42 Option B, public.sync_runs).
//
// Serves the most recent recorded engine runs, newest first, for the
// SystemPage run-history read. Auth is the Phase 1 user session
// (api/_auth.ts), the same gate as /api/snapshot. The store table lands
// by schema escalation (docs/sync-runs-supabase.sql); until it exists —
// and whenever the store cannot be read — the route answers 200 with an
// empty list and a store marker, so the display renders its honest
// empty state instead of an error.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listSyncRuns, supabaseConfigured } from "./_supabase.js";
import { clampSyncRunLimit } from "./_sync-ledger.js";
import { applyCors, requireSession } from "./_auth.js";

interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(
    req as unknown as VercelRequest,
    res as unknown as VercelResponse,
  );
  res.setHeader?.("X-Content-Type-Options", "nosniff");
  res.setHeader?.("Referrer-Policy", "no-referrer");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !(await requireSession(
      req as unknown as VercelRequest,
      res as unknown as VercelResponse,
    ))
  ) {
    return;
  }

  if (!supabaseConfigured()) {
    return res.status(200).json({ runs: [], store: "unconfigured" });
  }

  const limit = clampSyncRunLimit(req.query?.limit);
  try {
    const runs = await listSyncRuns(limit);
    return res.status(200).json({ runs, store: "sync_runs" });
  } catch (error) {
    console.log(
      `[sync-runs] read failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return res.status(200).json({ runs: [], store: "unavailable" });
  }
}
