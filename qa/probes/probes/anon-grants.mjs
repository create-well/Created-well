// Probe: anon-grant comparison across the sync store tables.
//
// The store posture of record (live-sync-sql-v2, executed 2026-10-25, and
// the A-16 ruling, 2026-10-30): RLS on, zero policies, anon and
// authenticated hold NO table grants; service_role holds exactly what the
// code performs. With the publishable anon key, a table that follows the
// posture answers the PostgREST read with HTTP 401 and Postgres error
// 42501 (permission denied). A table still carrying the project default
// grants answers 200 with an empty list: the grant is present and RLS is
// the only thing holding the line. That 200 is the deviation this probe
// exists to catch (it is how sync_runs deviated at its creation, A-16).
//
// Read-only. Env: CW_SUPABASE_URL, CW_SUPABASE_ANON_KEY.

import { leg, envGate } from "../lib.mjs";

const TABLES = ["sync_runs", "sync_delivery_state", "sync_snapshots", "sync_setup"];

export async function run() {
  const missing = envGate(["CW_SUPABASE_URL", "CW_SUPABASE_ANON_KEY"]);
  if (missing) {
    return [leg("NOT VERIFIED", "anon-grants", `env not set: ${missing.join(", ")}`)];
  }
  const base = process.env.CW_SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.CW_SUPABASE_ANON_KEY;
  const legs = [];
  for (const table of TABLES) {
    try {
      const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const body = await res.text();
      let code = null;
      try {
        code = JSON.parse(body)?.code ?? null;
      } catch {
        /* non-JSON body: reported raw below */
      }
      if (res.status === 401 && code === "42501") {
        legs.push(leg("PASS", `anon-grants/${table}`, "HTTP 401, 42501 permission denied (no anon grant)"));
      } else if (res.status === 200 && body.trim() === "[]") {
        legs.push(
          leg("FAIL", `anon-grants/${table}`, "HTTP 200 empty list: an anon grant is present and RLS alone admits zero rows"),
        );
      } else {
        legs.push(leg("FAIL", `anon-grants/${table}`, `HTTP ${res.status}, code ${code ?? "none"}: ${body.slice(0, 100)}`));
      }
    } catch (e) {
      legs.push(leg("FAIL", `anon-grants/${table}`, `request failed: ${String(e.message || e)}`));
    }
  }
  return legs;
}
