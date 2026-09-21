-- Migration: canva_connections
-- Stores Canva OAuth tokens per CR8W user.
-- One row per user; upserted on every successful callback.

create table if not exists public.canva_connections (
  id             uuid        primary key default gen_random_uuid(),

  -- FK to auth.users; nullable so a token can be stored before
  -- the user completes CR8W sign-in (linked on next login).
  user_id        uuid        references auth.users(id) on delete cascade,

  canva_user_id  text        unique,            -- Canva's own user identifier
  access_token   text        not null,
  refresh_token  text        not null default '',
  scope          text        not null default '',
  token_type     text        not null default 'Bearer',
  expires_at     timestamptz not null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Fast lookup by CR8W user (most common query pattern)
create unique index if not exists canva_connections_user_id_idx
  on public.canva_connections (user_id)
  where user_id is not null;

-- Row-level security: users may only read/delete their own row.
-- All writes go through the service role (server-side only).
alter table public.canva_connections enable row level security;

-- Authenticated users can see their own connection status
create policy "users read own connection"
  on public.canva_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can delete (disconnect) their own row
create policy "users delete own connection"
  on public.canva_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- All inserts/updates must go through service role (no direct client writes)
create policy "service role insert"
  on public.canva_connections
  for insert
  with check (false);

create policy "service role update"
  on public.canva_connections
  for update
  using (false)
  with check (false);

-- Trigger to keep updated_at current on every row update
create or replace function public.set_canva_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger canva_connections_updated_at
  before update on public.canva_connections
  for each row execute function public.set_canva_connections_updated_at();
