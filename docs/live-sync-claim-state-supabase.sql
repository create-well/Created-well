-- Live-sync claim_state + mirror_populated_at (SQL v3) — SITTING-READY PACKET
-- Project: createdwell (Supabase ref irtqcygriedvdijppntz). Table: public.sync_delivery_state.
--
-- WHAT THIS IS: the one gated production schema change holding Live-sync Leg B
-- (PR #102) and Leg D (PR #103). Prepared 2026-11-13 by the swarm coordinator;
-- EXECUTED ONLY BY MONNY at her schema gate (same pattern as
-- docs/live-sync-lease-supabase.sql, executed 2026-10-27 via the Supabase SQL
-- editor on this project). No agent runs this.
--
-- WHY (one paragraph): Leg B makes claim_state the ONE claim mechanism for a
-- source — taken by webhook and cron alike, 120s TTL (CLAIM_TTL_MS in
-- api/_supabase.ts), reclaim by pinning the exact stale last_sync_started_at;
-- the lease epoch stays beneath it as the write fence. Leg D's freshness ladder
-- reads mirror_populated_at (null => "unknown") and ages dirty-only work from
-- the row's updated_at. Without these columns the B/D code cannot run: reads
-- tolerate absence (fail-closed 'idle') but every claim PATCH filters
-- claim_state=eq.idle and would match zero rows on NULL — sync would stall
-- busy. Hence the hard gate.

-- ── 0) PRE-STATE RE-READ (run first; paste results into the execution record) ──
-- Expected today: 13 columns (v1's ten + v2's three lease columns),
-- service_role holds INSERT/SELECT/UPDATE only, anon/authenticated/public hold
-- nothing, RLS enabled with no policies, one row per source (5 sources).
select ordinal_position, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name='sync_delivery_state'
 order by ordinal_position;
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public' and table_name='sync_delivery_state'
 order by grantee, privilege_type;
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
  from pg_class where oid = 'public.sync_delivery_state'::regclass;
select source, claim_state from public.sync_delivery_state order by source;  -- pre-DDL: claim_state must ERROR (column absent) — that absence IS the confirmation

-- ── 1) THE STATEMENTS (exactly these; one transaction) ─────────────────────
begin;

alter table public.sync_delivery_state
  add column if not exists claim_state text not null default 'idle',
  add column if not exists mirror_populated_at timestamp with time zone;

-- Semantics:
--   claim_state          'running' | 'idle'. Default 'idle' backfills the five
--                        existing source rows to unclaimed — the only safe
--                        pre-claim state. The code, not a CHECK, owns the value
--                        set (matches v2's lease style: no CHECK constraints).
--   mirror_populated_at  NULL until a source's mirror is first fully
--                        populated; set once by the engine on completion and
--                        never cleared (ladder input).
-- Grants/RLS delta: NONE. Existing service_role INSERT/SELECT/UPDATE covers
-- the new columns; RLS stays enabled with no policies (identical reasoning to
-- the v2 lease sitting).

commit;

-- ── 2) POST-DDL VERIFICATION LEGS (run before any merge) ──────────────────
-- a) Re-run section 0: expect 15 columns (claim_state:text not null default
--    'idle', mirror_populated_at:timestamp with time zone, nullable); grants
--    census UNCHANGED; RLS unchanged; the section-0 claim_state select now
--    returns 'idle' for all five sources.
-- b) On a checkout of staged Leg B (branch fix/live-sync-leg-b-staged) run the
--    full battery, both timezones:
--      for f in tests/*.test.mjs; do TZ=UTC node --experimental-strip-types --test "$f"; \
--        TZ=America/Los_Angeles node --experimental-strip-types --test "$f"; done
--      node --experimental-strip-types tests/sync-lease-engine.driver.mjs
--      node --experimental-strip-types tests/sync-lease-ledger.driver.mjs
--      npx tsc --noEmit && npm run build
--    (Staged-head evidence from 2026-11-13 pre-staging: 204/204 suite,
--    drivers PASS, tsc PASS, build PASS — legs re-run after DDL is the gate.)
-- c) MERGE ORDER: Leg B first (fix/live-sync-leg-b-staged onto main), verify
--    production READY at the merge SHA on dash.cr8w.com, live route matrix,
--    THEN Leg D (fix/live-sync-leg-d-staged, stacked on B) the same way.
--    Leg D is stacked: do not rebase it onto post-B main independently.

-- ── 3) BLAST RADIUS ─────────────────────────────────────────────────────────
-- Code that reads/writes the two columns after the legs land:
--   api/_supabase.ts    claimDeliveryState, fencedClaimPatchPatch paths,
--                       DeliveryState parse/defaults (claim_state, mirror_populated_at)
--   api/_sync-engine.ts freshness ladder (mirror_populated_at null => unknown;
--                       claim_state 'running' short-circuits the ladder)
--   api/_sync-ledger.ts ledger commit fields incl. claim clear
--   api/_sync-alerts.ts expired-claim alert reads claim_state
--   api/reconcile.ts    cron reconcile claims through claimDeliveryState
--   api/notion-webhook.ts webhook claims through claimDeliveryState
-- Data: 5 rows in sync_delivery_state gain 'idle'/NULL — no row is rewritten
-- beyond the backfill default. sync_snapshots and sync_setup untouched.
-- kv_store_dabe1c74 untouched. Rollback below is safe at any point before
-- the B merge; after B merges, rollback requires reverting B first.

-- ── 4) ROLLBACK ─────────────────────────────────────────────────────────────
-- begin;
-- alter table public.sync_delivery_state
--   drop column if exists claim_state,
--   drop column if exists mirror_populated_at;
-- commit;
-- (PostgREST would then again match zero claim rows — only valid while Leg B
-- is unmerged. Code rollback = revert the staged leg branches.)
