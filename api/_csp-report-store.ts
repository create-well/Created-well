// Durable store for the CSP violation ring: the dashboard KV table
// (kv_store_dabe1c74) under one dedicated key, the same surface the
// governed data-ops route already reads, so the lanes can inspect
// collected violations without a new tool or a log dive. Mirrors the
// _cms-manifest-store.ts pattern exactly: env-named SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY, service role, server-side only, an
// injectable client factory for tests, and no new env or table.
//
// Why KV and not the sync ledger: the ledger tables are guarded state
// (one row per source, a fenced write contract), not a log; forcing a
// high-volume untrusted-input stream into them would fight that
// contract. The KV store is the dashboard's general landing place and
// the ring's own cap bounds what this key can ever hold.
//
// When the env is absent the store degrades quietly: reads find an
// empty ring, writes no-op, and the route still answers 204 — report
// delivery is best-effort by design and a missing collector backend
// must never surface to browsers as an error.

import { createClient } from "@supabase/supabase-js";
import { validateRing, type CspReportRing } from "./_csp-reports.js";

const KV_TABLE = "kv_store_dabe1c74";
export const CSP_REPORTS_KEY = "cr8w_csp_reports";

interface KvClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { value?: unknown } | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };
}

function defaultClientFactory(): KvClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key) as unknown as KvClient;
}

export interface CspReportStore {
  read: () => Promise<CspReportRing>;
  write: (ring: CspReportRing) => Promise<void>;
}

export function createSupabaseCspReportStore(
  clientFactory: () => KvClient | null = defaultClientFactory,
): CspReportStore {
  return {
    read: async (): Promise<CspReportRing> => {
      const client = clientFactory();
      if (!client) return { entries: [] };
      const { data, error } = await client
        .from(KV_TABLE)
        .select("value")
        .eq("key", CSP_REPORTS_KEY)
        .maybeSingle();
      if (error) throw new Error(`KV read error for "${CSP_REPORTS_KEY}": ${error.message}`);
      if (data?.value === undefined || data?.value === null) return { entries: [] };
      return validateRing(data.value);
    },
    write: async (ring: CspReportRing): Promise<void> => {
      const client = clientFactory();
      if (!client) return;
      const { error } = await client
        .from(KV_TABLE)
        .upsert({ key: CSP_REPORTS_KEY, value: ring });
      if (error) throw new Error(`KV write error for "${CSP_REPORTS_KEY}": ${error.message}`);
    },
  };
}
