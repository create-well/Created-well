// GET /api/snapshot — the one dashboard snapshot route for live-sync.
//
// Serves the snapshot from the Supabase mirror plus a freshness block
// computed at read time from delivery state (Monny's call, 2026-10-22:
// freshness lives with delivery state in Supabase; the Sheets workbook
// is the human mirror and is never read here). This route never calls
// Notion. Auth is the Phase 1 user session (api/_auth.ts): createdwell
// has no SYNC_SECRET and no shared-secret readers. Until the reader
// decision in the Phase 2 plan is taken, /api/dashboard keeps serving
// the live merge; this route is additive.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getDeliveryState,
  listSnapshot,
  supabaseConfigured,
  type DeliveryState,
} from "./_supabase.js";
import { computeFreshness, SOURCES } from "./_sync-engine.js";
import { type SourceName } from "./_notion-sources.js";
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

  const now = Date.now();
  const sources: Record<string, { count: number; rows: unknown[] }> = {};
  const freshness: Record<
    string,
    {
      state: string;
      lastEventAt: string | null;
      lastSyncOkAt: string | null;
      syncVersion: number;
    }
  > = {};

  if (!supabaseConfigured()) {
    for (const name of SOURCES) {
      // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist in _sync-engine.
      sources[name] = { count: 0, rows: [] };
      // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist in _sync-engine.
      freshness[name] = {
        state: "unknown",
        lastEventAt: null,
        lastSyncOkAt: null,
        syncVersion: 0,
      };
    }
    return res.status(200).json({
      generatedAt: new Date(now).toISOString(),
      store: "unconfigured",
      sources,
      freshness,
    });
  }

  await Promise.all(
    SOURCES.map(async (name: SourceName) => {
      const [state, rows] = await Promise.all([
        getDeliveryState(name) as Promise<DeliveryState | null>,
        listSnapshot(name),
      ]);
      // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist in _sync-engine.
      sources[name] = {
        count: rows.length,
        rows: rows.map((entry) => entry.row),
      };
      // eslint-disable-next-line security/detect-object-injection -- name comes from the closed SOURCES allowlist in _sync-engine.
      freshness[name] = {
        state: computeFreshness(state, now),
        lastEventAt: state?.last_event_at ?? null,
        lastSyncOkAt: state?.last_sync_ok_at ?? null,
        syncVersion: state?.sync_version ?? 0,
      };
    }),
  );

  return res.status(200).json({
    generatedAt: new Date(now).toISOString(),
    store: "supabase",
    sources,
    freshness,
  });
}
