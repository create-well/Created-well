-- Live-sync per-source lease columns (G-02 Option A).
--
-- EXECUTED 2026-10-27 at Monny's schema gate (her pass on this exact SQL,
-- main chat 2026-10-27 03:06 PDT) via the Supabase SQL editor on project
-- "createdwell" (ref irtqcygriedvdijppntz). Verified in the executing
-- session: 13 columns on sync_delivery_state (the original ten plus the
-- three below), all five source rows at lease_epoch 0 / lease_owner NULL /
-- lease_expires_at NULL, grants census unchanged (service_role
-- INSERT/SELECT/UPDATE only; no anon/authenticated/public rows).
--
-- This file is the successor of record for sync_delivery_state:
-- docs/live-sync-supabase.sql asserts that table's original column list
-- in a fail-closed definition guard, so re-running it after this
-- migration raises by its own design. Grants/RLS delta: none — the
-- table's existing service_role grants cover the new columns, and RLS
-- stays enabled with no policies.
--
-- Semantics: lease_owner = the acquiring run's token (NULL when
-- unleased); lease_epoch = monotonic fencing counter, incremented on
-- every successful acquire; lease_expires_at = the lease's death time
-- (NULL when unleased). Rollback (before the lease code deploys):
--   alter table public.sync_delivery_state
--     drop column if exists lease_owner,
--     drop column if exists lease_epoch,
--     drop column if exists lease_expires_at;

begin;

alter table public.sync_delivery_state
  add column if not exists lease_owner text,
  add column if not exists lease_epoch bigint not null default 0,
  add column if not exists lease_expires_at timestamptz;

commit;
