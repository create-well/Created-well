// Durable CMS manifest store (OPT-1, 2026-11-04): persists the public
// projection's last-good manifest in the Supabase KV table the dashboard
// already runs (kv_store_dabe1c74), under one dedicated key, so a cold
// function instance can serve last-good during a Notion outage instead
// of a 503 (cms-connector-contract-2026-10-26.md sections 3-4, 7).
//
// The stored value is exactly the manifest object the public route
// serves — post-gate, six-field allowlist items only. Readiness holds,
// gate fields, and every other internal shape never reach this module:
// it accepts and returns CmsManifest values, nothing else.
//
// Access rides the dashboard's existing server-side pattern (env-named
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, service role, server-side
// only; api/server.ts lines 24-37 are the same shape). No new env, no
// new table, no schema change. When the env is absent the store
// degrades silently to Phase 1 behavior: reads find nothing, writes
// no-op, and the caller's cache logs nothing spurious.

import { createClient } from "@supabase/supabase-js";
import {
  validateManifest,
  type CmsManifest,
  type ManifestStore,
} from "./_cms-projection.js";

const KV_TABLE = "kv_store_dabe1c74";
export const CMS_MANIFEST_KEY = "cms_manifest";

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

// clientFactory is injectable for tests; production uses the env-named
// default. Read errors throw (the cache logs the class and degrades);
// a missing configuration is not an error, it is Phase 1 behavior.
export function createSupabaseManifestStore(
  clientFactory: () => KvClient | null = defaultClientFactory,
): ManifestStore {
  return {
    read: async (): Promise<CmsManifest | null> => {
      const client = clientFactory();
      if (!client) return null;
      const { data, error } = await client
        .from(KV_TABLE)
        .select("value")
        .eq("key", CMS_MANIFEST_KEY)
        .maybeSingle();
      if (error) throw new Error(`KV read error for "${CMS_MANIFEST_KEY}": ${error.message}`);
      const raw = data?.value;
      if (raw === undefined || raw === null) return null;
      let parsed: unknown = raw;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error("[cms] manifest store: stored value is not JSON; treating as absent");
          return null;
        }
      }
      const manifest = validateManifest(parsed);
      if (!manifest) {
        console.error("[cms] manifest store: stored value failed validation; treating as absent");
        return null;
      }
      return manifest;
    },
    write: async (manifest: CmsManifest): Promise<void> => {
      const client = clientFactory();
      if (!client) return;
      const { error } = await client
        .from(KV_TABLE)
        .upsert({ key: CMS_MANIFEST_KEY, value: manifest });
      if (error) throw new Error(`KV write error for "${CMS_MANIFEST_KEY}": ${error.message}`);
    },
  };
}
