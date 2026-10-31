create table if not exists public.well_notes (
  id bigint primary key,
  content text not null,
  landed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'dashboard',
  source_hash text not null
);

create index if not exists well_notes_created_at_idx on public.well_notes (created_at desc);
alter table public.well_notes enable row level security;

create table if not exists public.care_loop_checkins (
  id bigint primary key,
  week_of date,
  author text not null,
  confirm_time boolean not null default false,
  location_suggestion text not null default '',
  agenda_items jsonb not null default '[]'::jsonb,
  mood text,
  time_preference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'dashboard',
  source_hash text not null
);

create index if not exists care_loop_checkins_week_of_idx on public.care_loop_checkins (week_of desc, created_at desc);
alter table public.care_loop_checkins enable row level security;

create table if not exists public.workspace_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'completed', 'failed', 'conflict')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes_inserted integer not null default 0,
  notes_updated integer not null default 0,
  checkins_inserted integer not null default 0,
  checkins_updated integer not null default 0,
  conflicts_count integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists workspace_sync_runs_started_at_idx on public.workspace_sync_runs (started_at desc);
alter table public.workspace_sync_runs enable row level security;

create table if not exists public.workspace_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('well_note', 'care_loop_checkin')),
  entity_id bigint not null,
  spreadsheet_id text not null,
  sheet_name text not null,
  row_number integer not null,
  local_hash text not null,
  remote_hash text not null,
  remote_values jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists workspace_sync_conflicts_open_unique
  on public.workspace_sync_conflicts (entity_type, entity_id, spreadsheet_id, sheet_name, row_number)
  where status = 'open';
alter table public.workspace_sync_conflicts enable row level security;

create table if not exists public.workspace_exports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('history', 'well_notes', 'care_loop_checkins', 'summary')),
  format text not null check (format in ('csv', 'json', 'google_sheets', 'google_doc')),
  status text not null check (status in ('started', 'completed', 'failed')),
  spreadsheet_id text,
  document_id text,
  from_date date,
  to_date date,
  row_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.workspace_exports enable row level security;

-- Backfill the existing KV JSON-string payloads without making the KV table a second write surface.
insert into public.well_notes (id, content, landed, created_at, updated_at, source, source_hash)
select
  (item->>'id')::bigint,
  coalesce(item->>'content', ''),
  coalesce((item->>'landed')::integer, 0),
  coalesce((item->>'created_at')::timestamptz, now()),
  coalesce((item->>'updated_at')::timestamptz, (item->>'created_at')::timestamptz, now()),
  'legacy_kv',
  md5(item::text)
from public.kv_store_dabe1c74 kv
cross join lateral jsonb_array_elements((kv.value #>> '{}')::jsonb) item
where kv.key = 'cr8w_well_notes'
  and jsonb_typeof((kv.value #>> '{}')::jsonb) = 'array'
on conflict (id) do nothing;

insert into public.care_loop_checkins (id, week_of, author, confirm_time, location_suggestion, agenda_items, mood, time_preference, notes, created_at, updated_at, source, source_hash)
select
  (item->>'id')::bigint,
  nullif(item->>'weekOf', '')::date,
  coalesce(item->>'author', 'unknown'),
  coalesce((item->>'confirmTime')::boolean, false),
  coalesce(item->>'locationSuggestion', ''),
  coalesce(item->'agendaItems', '[]'::jsonb),
  nullif(item->>'mood', ''),
  nullif(item->>'timePreference', ''),
  nullif(item->>'notes', ''),
  coalesce((item->>'created_at')::timestamptz, now()),
  coalesce((item->>'updated_at')::timestamptz, (item->>'created_at')::timestamptz, now()),
  'legacy_kv',
  md5(item::text)
from public.kv_store_dabe1c74 kv
cross join lateral jsonb_array_elements((kv.value #>> '{}')::jsonb) item
where kv.key = 'cr8w_coflow_checkins'
  and jsonb_typeof((kv.value #>> '{}')::jsonb) = 'array'
on conflict (id) do nothing;

create or replace view public.well_history_summary with (security_invoker = true) as
select
  date_trunc('week', created_at)::date as week_of,
  count(*)::integer as note_count,
  coalesce(sum(landed), 0)::integer as landed_count,
  round(avg(length(content))::numeric, 1) as average_note_length
from public.well_notes
group by 1
order by 1 desc;

alter view public.well_history_summary set (security_invoker = true);
revoke all on public.well_history_summary from anon, authenticated;

create or replace function public.touch_well_history_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists well_notes_touch_updated_at on public.well_notes;
create trigger well_notes_touch_updated_at before update on public.well_notes
for each row execute function public.touch_well_history_updated_at();

drop trigger if exists care_loop_checkins_touch_updated_at on public.care_loop_checkins;
create trigger care_loop_checkins_touch_updated_at before update on public.care_loop_checkins
for each row execute function public.touch_well_history_updated_at();

revoke all on public.well_notes, public.care_loop_checkins, public.workspace_sync_runs, public.workspace_sync_conflicts, public.workspace_exports from anon, authenticated;
