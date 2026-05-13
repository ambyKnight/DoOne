-- DoOne — full schema. Single-file, idempotent, deadlock-safe.
--
-- Strategy: drop hot tables from supabase_realtime publication FIRST so the
-- realtime worker stops polling them, then run all DDL, then add them back.
-- Without this, the realtime worker's AccessShareLock fights every ALTER
-- TABLE and deadlocks on busy projects.
--
-- Run the entire file as ONE batch in Supabase SQL Editor.

set lock_timeout = '6s';
set statement_timeout = '120s';

-- =========================================================
-- 0. Unsubscribe hot tables from realtime so DDL won't fight worker locks
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['events','tasks','user_preferences','profiles','journal_entries','journal_pointers'] loop
    begin
      execute format('alter publication supabase_realtime drop table public.%I', t);
    exception when others then null;  -- table or membership absent → ignore
    end;
  end loop;
end $$;

-- =========================================================
-- 1. Base tables (create if missing — no-op when present)
-- =========================================================
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  start_time  timestamptz,
  end_time    timestamptz,
  all_day     boolean default false,
  created_at  timestamptz default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  done        boolean default false,
  created_at  timestamptz default now()
);

create table if not exists public.user_preferences (
  id              uuid primary key default gen_random_uuid(),
  font            text,
  vibe            text,
  surface         text,
  density         text,
  vibe_dials      jsonb,
  surface_dials   jsonb,
  accent_boost    numeric,
  blur_amount     int,
  surface_alpha   numeric,
  panel_gap       int,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- =========================================================
-- 2. Drop legacy permissive policies (no-op if missing)
-- =========================================================
drop policy if exists "Allow all select" on public.events;
drop policy if exists "Allow all insert" on public.events;
drop policy if exists "Allow all update" on public.events;
drop policy if exists "Allow all delete" on public.events;
drop policy if exists "Allow all tasks"  on public.tasks;
drop policy if exists "allow all prefs"  on public.user_preferences;

-- Legacy storage-pointer journal table from prior design.
drop table if exists public.journal_pointers cascade;

-- =========================================================
-- 3. Profiles — public-readable, references auth.users
-- =========================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null check (username ~ '^[a-z0-9_.-]{3,30}$'),
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles owner write" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles owner write" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id,
          new.raw_user_meta_data ->> 'username',
          new.raw_user_meta_data ->> 'username');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 4. Owner column + indexes on owned tables
-- =========================================================
alter table public.events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_preferences
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Set NOT NULL only when no orphan rows.
do $$
begin
  if not exists (select 1 from public.events           where user_id is null) then
    execute 'alter table public.events           alter column user_id set not null';
  end if;
  if not exists (select 1 from public.tasks            where user_id is null) then
    execute 'alter table public.tasks            alter column user_id set not null';
  end if;
  if not exists (select 1 from public.user_preferences where user_id is null) then
    execute 'alter table public.user_preferences alter column user_id set not null';
  end if;
end $$;

create index if not exists events_user_id_idx               on public.events(user_id);
create index if not exists tasks_user_id_idx                on public.tasks(user_id);
create unique index if not exists user_preferences_user_idx on public.user_preferences(user_id);

-- =========================================================
-- 5. Journal entries — content in Postgres for cross-device realtime
-- =========================================================
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

-- =========================================================
-- 6. Onboarding + UX columns on user_preferences (additive)
-- =========================================================
alter table public.user_preferences
  add column if not exists display_name       text,
  add column if not exists timezone           text,
  add column if not exists day_start_hour     int     default 7,
  add column if not exists day_end_hour       int     default 22,
  add column if not exists week_starts_monday boolean default true,
  add column if not exists notify_digest      boolean default false,
  add column if not exists notify_reminders   boolean default false,
  add column if not exists notify_journal     boolean default false,
  add column if not exists onboarded_at       timestamptz,
  add column if not exists cal_view           text default 'dayGridMonth',
  add column if not exists wallpaper_url      text,
  add column if not exists wallpaper_disabled boolean default false,
  add column if not exists last_device_type   text;

-- Strip deprecated `tint` key from surface_dials (Glass-tint slider removed).
update public.user_preferences
   set surface_dials = surface_dials - 'tint'
 where surface_dials ? 'tint';

-- =========================================================
-- 7. Per-user RLS policies for owned tables
-- =========================================================
alter table public.events           enable row level security;
alter table public.tasks            enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "owner-rw" on public.events;
create policy "owner-rw" on public.events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner-rw" on public.tasks;
create policy "owner-rw" on public.tasks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner-rw" on public.user_preferences;
create policy "owner-rw" on public.user_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 8. Avatar storage bucket + policies
-- =========================================================
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatars public read"  on storage.objects;
drop policy if exists "avatars owner write"  on storage.objects;
drop policy if exists "avatars owner update" on storage.objects;
drop policy if exists "avatars owner delete" on storage.objects;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars owner delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =========================================================
-- 9. Wallpapers storage bucket — PUBLIC, folder per user
-- =========================================================
insert into storage.buckets (id, name, public)
  values ('wallpapers', 'wallpapers', true)
  on conflict (id) do nothing;

drop policy if exists "wallpapers public read"   on storage.objects;
drop policy if exists "wallpapers owner write"   on storage.objects;
drop policy if exists "wallpapers owner update"  on storage.objects;
drop policy if exists "wallpapers owner delete"  on storage.objects;

create policy "wallpapers public read" on storage.objects
  for select using (bucket_id = 'wallpapers');
create policy "wallpapers owner write" on storage.objects
  for insert with check (
    bucket_id = 'wallpapers' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "wallpapers owner update" on storage.objects
  for update using (
    bucket_id = 'wallpapers' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "wallpapers owner delete" on storage.objects
  for delete using (
    bucket_id = 'wallpapers' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =========================================================
-- 10. Delete-account RPC (cascades through FKs)
-- =========================================================
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- =========================================================
-- 11. Re-add tables to realtime publication (after all DDL is done)
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['events','tasks','user_preferences','profiles','journal_entries'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
