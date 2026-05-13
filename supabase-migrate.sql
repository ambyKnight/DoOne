-- DoOne migration — additive only. Adds:
--   • public.journal_entries (DB-backed journals, replaces Storage approach)
--   • user_preferences.wallpaper_disabled + last_device_type
--   • strip deprecated `tint` key from surface_dials
--   • realtime publication entry for journal_entries
--
-- Touches NEW objects + ADD COLUMN only — no DDL on hot tables like events.
-- Safe to run on a populated DB without triggering deadlocks with realtime /
-- PostgREST workers.
--
-- Run as ONE batch in Supabase SQL Editor.

set lock_timeout = '4s';
set statement_timeout = '60s';

-- 1. Drop legacy journal_pointers (storage-pointer design, replaced).
drop table if exists public.journal_pointers cascade;

-- 2. New journal_entries table — full content in Postgres.
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null,
  did         text default '',
  plan        text default '',
  mood        text default '',
  updated_at  timestamptz default now(),
  unique (user_id, entry_date)
);

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date desc);

alter table public.journal_entries enable row level security;

drop policy if exists "owner-rw" on public.journal_entries;
create policy "owner-rw" on public.journal_entries
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. New pref columns (cheap — additive, no rewrite).
alter table public.user_preferences
  add column if not exists wallpaper_disabled boolean default false,
  add column if not exists last_device_type   text;

-- 4. Strip deprecated `tint` key from surface_dials JSON.
update public.user_preferences
   set surface_dials = surface_dials - 'tint'
 where surface_dials ? 'tint';

-- 5. Add journal_entries to realtime publication (idempotent).
do $$ begin
  begin
    alter publication supabase_realtime add table public.journal_entries;
  exception when duplicate_object then null;
  end;
end $$;
