-- Migration: canva_oauth_states
-- Stores short-lived PKCE state entries during the Canva OAuth flow.
-- Rows are deleted on successful callback; a cron or scheduled function
-- should periodically purge rows where expires_at < now().

create table if not exists public.canva_oauth_states (
  state          text        primary key,
  code_verifier  text        not null,
  redirect_after text        not null default '/',
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

-- Index for fast expiry cleanup queries
create index if not exists canva_oauth_states_expires_at_idx
  on public.canva_oauth_states (expires_at);

-- Only the service role (server-side) may read/write this table.
-- Deny all access to authenticated and anon roles.
alter table public.canva_oauth_states enable row level security;

create policy "service role only"
  on public.canva_oauth_states
  for all
  using (false)
  with check (false);

-- Automatic cleanup: remove expired rows older than 1 hour
-- (run via pg_cron or Supabase scheduled function separately).
-- Provided here as a convenience function callable from the server.
create or replace function public.purge_expired_canva_states()
returns void
language sql
security definer
as $$
  delete from public.canva_oauth_states
  where expires_at < now() - interval '1 hour';
$$;
