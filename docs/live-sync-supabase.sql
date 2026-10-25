-- Live-sync storage for create-well/Created-well (createdwell).
-- PROPOSAL v2.1, createdwell adaptation of the cr8w-dashboard v2 line.
-- Carried in the Phase 2 PR as review data. NOT executed anywhere.
-- Production schema and authorization changes are high-priority gated;
-- this file runs only when the schema gate opens it, by hand.
--
-- Architecture (Monny's decision, 2026-10-22): Notion is the source of
-- truth. These tables hold ONLY delivery state and the normalized
-- snapshot mirror. There is deliberately no event-receipts table:
-- durable receipts arrive only if replay/audit requirements appear.
--
-- Why v2 exists (metadata finding, 2026-10-23): on the target
-- Supabase project, pg_default_acl grants anon and authenticated broad
-- table privileges (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER/MAINTAIN) by default for new public-schema tables. "No GRANT
-- statements" therefore does NOT mean those roles hold nothing. RLS with
-- no policies restricts row access through the API, but it is not a
-- substitute for explicit least-privilege grants. v2 therefore revokes
-- explicitly and grants the server role only what the code performs.
-- This script changes NO global default ACLs and touches NO existing
-- table (the bound project already holds this app's kv_store table; it
-- is out of scope and untouched).
--
-- Access model after this script: the API routes use the service-role
-- key only, with exactly the privileges granted below. PUBLIC, anon, and
-- authenticated hold nothing on these three tables. RLS stays enabled
-- with no policies as a second layer.
--
-- The whole proposal runs in ONE transaction: definition guard, table
-- creation, RLS, revocations (including any default-ACL excess held by
-- service_role on these new tables, revoked then re-granted minimally),
-- and grants land
-- atomically or not at all.

begin;

-- 0) Existing-definition guard. If any of the three tables already
-- exists with a different column shape, fail closed with a clear
-- message instead of letting CREATE IF NOT EXISTS silently keep a
-- mismatched table. A matching existing table passes (safe re-run).
do $$
declare
  actual text;
begin
  if to_regclass('public.sync_delivery_state') is not null then
    select string_agg(column_name || ':' || data_type, ',' order by ordinal_position)
      into actual
      from information_schema.columns
     where table_schema = 'public' and table_name = 'sync_delivery_state';
    if actual is distinct from 'source:text,sync_version:bigint,last_event_at:timestamp with time zone,last_event_id:text,last_sync_started_at:timestamp with time zone,last_sync_ok_at:timestamp with time zone,dirty:boolean,pending_entity_ids:jsonb,last_error:text,updated_at:timestamp with time zone' then
      raise exception 'live-sync guard: existing sync_delivery_state definition does not match the proposal; stop and review';
    end if;
  end if;

  if to_regclass('public.sync_snapshots') is not null then
    select string_agg(column_name || ':' || data_type, ',' order by ordinal_position)
      into actual
      from information_schema.columns
     where table_schema = 'public' and table_name = 'sync_snapshots';
    if actual is distinct from 'source:text,page_id:text,row:jsonb,last_edited:text,sync_version:bigint,updated_at:timestamp with time zone' then
      raise exception 'live-sync guard: existing sync_snapshots definition does not match the proposal; stop and review';
    end if;
  end if;

  if to_regclass('public.sync_setup') is not null then
    select string_agg(column_name || ':' || data_type, ',' order by ordinal_position)
      into actual
      from information_schema.columns
     where table_schema = 'public' and table_name = 'sync_setup';
    if actual is distinct from 'key:text,value:jsonb,updated_at:timestamp with time zone' then
      raise exception 'live-sync guard: existing sync_setup definition does not match the proposal; stop and review';
    end if;
  end if;

  -- A column-matching pre-existing table must also carry the proposal's
  -- CHECK constraints; if-not-exists creates would otherwise skip them
  -- silently. Missing checks fail closed: recreate while empty, or
  -- review by hand.
  if to_regclass('public.sync_delivery_state') is not null then
    if (select count(*) from pg_constraint where conname in
        ('sync_delivery_state_source_chk','sync_delivery_state_version_chk','sync_delivery_state_pending_chk')) < 3 then
      raise exception 'live-sync guard: existing sync_delivery_state lacks the proposal check constraints; stop and review';
    end if;
  end if;
  if to_regclass('public.sync_snapshots') is not null then
    if (select count(*) from pg_constraint where conname in
        ('sync_snapshots_source_chk','sync_snapshots_row_chk','sync_snapshots_version_chk')) < 3 then
      raise exception 'live-sync guard: existing sync_snapshots lacks the proposal check constraints; stop and review';
    end if;
  end if;
  if to_regclass('public.sync_setup') is not null then
    if not exists (select 1 from pg_constraint where conname = 'sync_setup_value_chk') then
      raise exception 'live-sync guard: existing sync_setup lacks the proposal check constraint; stop and review';
    end if;
  end if;
end $$;

-- 1) Tables. Check constraints encode the store semantics the code
-- already assumes: the closed five-source set (this app's registry in api/_notion-sources.ts), non-negative versions,
-- and JSON shapes (array for pending ids, objects for rows/values).
create table if not exists public.sync_delivery_state (
  source text primary key
    constraint sync_delivery_state_source_chk check (source in ('moves','people','flows','content','money')),
  sync_version bigint not null default 0 constraint sync_delivery_state_version_chk check (sync_version >= 0),
  last_event_at timestamptz,
  last_event_id text,
  last_sync_started_at timestamptz,
  last_sync_ok_at timestamptz,
  dirty boolean not null default false,
  pending_entity_ids jsonb not null default '[]'::jsonb
    constraint sync_delivery_state_pending_chk check (jsonb_typeof(pending_entity_ids) = 'array'),
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_snapshots (
  source text not null
    constraint sync_snapshots_source_chk check (source in ('moves','people','flows','content','money')),
  page_id text not null,
  row jsonb not null constraint sync_snapshots_row_chk check (jsonb_typeof(row) = 'object'),
  last_edited text,
  sync_version bigint not null default 0 constraint sync_snapshots_version_chk check (sync_version >= 0),
  updated_at timestamptz not null default now(),
  primary key (source, page_id)
);

create index if not exists sync_snapshots_source_idx
  on public.sync_snapshots (source);

-- One-time setup values (the webhook verification token stash). The
-- operator reads the token once, pastes it into Vercel as
-- NOTION_WEBHOOK_SECRET and back into the Notion connection settings,
-- then deletes the row.
create table if not exists public.sync_setup (
  key text primary key,
  value jsonb not null constraint sync_setup_value_chk check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now()
);

-- 2) Row level security on, in the same transaction.
alter table public.sync_delivery_state enable row level security;
alter table public.sync_snapshots enable row level security;
alter table public.sync_setup enable row level security;

-- 3) Explicit least privilege. Revoke everything the project's default
-- ACLs would otherwise hand to PUBLIC, anon, and authenticated on these
-- tables, then grant the service role exactly the operations the code
-- performs (api/_supabase.ts):
--   sync_delivery_state: read one row, upsert one row.
--   sync_snapshots:      list rows, upsert rows, delete one row.
--   sync_setup:          upsert the one-time stash (the operator clears
--                        it from the dashboard as owner, not via the API).
--                        SELECT is granted because the upsert's
--                        ON CONFLICT arbiter must read the conflicting
--                        row; without it the stash write fails with a
--                        permission error (activation punch list,
--                        Copilot finding on PR #30, 2026-10-24).
revoke all privileges on table public.sync_delivery_state from public, anon, authenticated, service_role;
revoke all privileges on table public.sync_snapshots from public, anon, authenticated, service_role;
revoke all privileges on table public.sync_setup from public, anon, authenticated, service_role;

grant select, insert, update on table public.sync_delivery_state to service_role;
grant select, insert, update, delete on table public.sync_snapshots to service_role;
grant select, insert, update on table public.sync_setup to service_role;

commit;

-- 4) Operator verification (run after, read-only). Expected: the three
-- tables listed with relrowsecurity = true, and grants showing ONLY the
-- service_role rows granted above for these tables.
--   select relname, relrowsecurity from pg_class
--    where relname in ('sync_delivery_state','sync_snapshots','sync_setup');
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and table_name in ('sync_delivery_state','sync_snapshots','sync_setup')
--    order by table_name, grantee, privilege_type;
