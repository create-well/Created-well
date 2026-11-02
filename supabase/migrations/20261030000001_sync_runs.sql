-- BASELINE MIGRATION 3 — durable run history (G-54 / STACK-02 baseline).
--
-- Baseline capture of public.sync_runs, the G-35 / Q-42 Option B table
-- (decision YES, Monny, 2026-10-30). Source of record:
-- docs/sync-runs-supabase.sql (PR #66). Executed 2026-10-30 in the A-16
-- arc (hand-run DDL with a grant deviation found and corrected); this
-- file carries the CORRECTED grants of record: service_role
-- INSERT/SELECT/DELETE only (DELETE exercised solely by the 90-day
-- retention prune inside api/reconcile.ts), usage/select on the id
-- sequence, zero anon/authenticated/public grants, RLS on, no
-- policies. QA's read-only grant comparison (the STACK-03 probe) is
-- the live-state verification leg for this baseline; on the live store
-- this file is history, never to be re-applied (see supabase/README.md).
--
-- Rollback of the table itself: drop table public.sync_runs; (the
-- writer fails soft without it and the [sync-ledger] log line remains
-- the record either way).

begin;

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  trigger text not null,
  status text not null,
  sources jsonb not null,
  total_rows int not null,
  duration_ms int not null,
  deferred_sources text[] not null default '{}'
);

alter table public.sync_runs enable row level security;

-- No policies: service_role bypasses RLS; anon/authenticated/public get
-- no grants at all (the posture of the existing three sync tables).
-- Explicit revoke first, mirroring migration 1: a fresh rebuild must not
-- inherit the project's default grants (the A-16 deviation).
revoke all privileges on table public.sync_runs from public, anon, authenticated, service_role;
grant insert, select, delete on table public.sync_runs to service_role;
grant usage, select on sequence public.sync_runs_id_seq to service_role;

create index if not exists sync_runs_started_at_idx
  on public.sync_runs (started_at desc);

commit;

-- Post-run verification (read-only, run after the gate pass):
--   select column_name, data_type from information_schema.columns
--     where table_schema = 'public' and table_name = 'sync_runs'
--     order by ordinal_position;            -- expect the 9 columns above
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema = 'public' and table_name = 'sync_runs'
--     order by grantee, privilege_type;     -- expect service_role I/S/D only
--   select relrowsecurity from pg_class
--     where relname = 'sync_runs';          -- expect true
