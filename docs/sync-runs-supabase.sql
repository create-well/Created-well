-- Durable sync run-history store (G-35 / Q-42, Option B as answered YES
-- 2026-10-30). DDL OF RECORD for public.sync_runs. Execution runs only
-- through the rev7 schema escalation (Monny passes the exact SQL, as
-- with the lease columns, 2026-10-27). Until then this file is the
-- prepared text QA schema-reviews; the writer code fails soft without
-- the table, so code may land before the DDL executes.
--
-- Target: Supabase project "createdwell" (ref irtqcygriedvdijppntz), the
-- existing sync store beside sync_delivery_state, sync_snapshots,
-- sync_setup. One new table, run history only. No other store or source
-- changes ride along; OPEN ASKS has no sync delivery state and stays out
-- of scope per the settled (b) record.
--
-- Shape per the decision packet (~/workspace/createwell/
-- g35-store-decision-packet-2026-10-27.md): id bigint identity,
-- started_at/finished_at timestamptz, trigger text, status text,
-- sources jsonb (the LedgerSourceEntry array: source, rows, cached,
-- error?), total_rows int, duration_ms int, deferred_sources text[].
-- RLS on, no policies; zero anon/authenticated/public grants.
--
-- ONE REFINEMENT FLAGGED FOR THE GATE: the packet says service_role
-- INSERT/SELECT only, and also scopes a 90-day rolling retention prune
-- (a DELETE of rows older than 90 days, run by the app inside the daily
-- sweep guard). The prune needs the DELETE grant to work. The DDL below
-- grants INSERT/SELECT/DELETE to service_role — DELETE is exercised only
-- by the prune. If the gate prefers strict INSERT/SELECT, the prune moves
-- to a manual/operator step and the DELETE grant line comes out; nothing
-- else changes.
--
-- Rollback: drop table public.sync_runs; (the writer fails soft without
-- the table — recordSyncRun never throws — and the log lines remain the
-- live tail either way).

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
