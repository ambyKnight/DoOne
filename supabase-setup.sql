-- DoOne — full schema with auth, profiles, per-user RLS, avatar storage.
-- Run in Supabase SQL Editor. Idempotent where possible; destructive where noted.

-- =========================================================
-- 0. Wipe existing demo data (one-time migration)
-- =========================================================
-- These were created without owner columns. Per the auth migration decision,
-- we start fresh. Skip this block if running on an empty database.
drop policy if exists "Allow all select" on public.events;
drop policy if exists "Allow all insert" on public.events;
drop policy if exists "Allow all update" on public.events;
drop policy if exists "Allow all delete" on public.events;
drop policy if exists "Allow all tasks" on public.tasks;
drop policy if exists "allow all journal" on public.journal_entries;
drop policy if exists "allow all prefs" on public.user_preferences;

truncate public.events, public.tasks, public.journal_entries, public.user_preferences
  restart identity cascade;

-- =========================================================
-- 1. Profiles — public-readable, references auth.users
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

-- Auto-create profile row when a new auth.users row appears.
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
-- 2. Add user_id to owned tables
-- =========================================================
alter table public.events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.journal_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_preferences
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.events          alter column user_id set not null;
alter table public.tasks           alter column user_id set not null;
alter table public.journal_entries alter column user_id set not null;
alter table public.user_preferences alter column user_id set not null;

-- Replace the single-row UNIQUE(date) on journal_entries with per-user uniqueness.
alter table public.journal_entries drop constraint if exists journal_entries_date_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_user_date_key') then
    alter table public.journal_entries
      add constraint journal_entries_user_date_key unique (user_id, date);
  end if;
end $$;

create index if not exists events_user_id_idx          on public.events(user_id);
create index if not exists tasks_user_id_idx           on public.tasks(user_id);
create index if not exists journal_user_id_idx         on public.journal_entries(user_id);
create unique index if not exists user_preferences_user_idx on public.user_preferences(user_id);

-- Onboarding columns on user_preferences (additive)
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
  add column if not exists cal_view           text default 'dayGridMonth';

-- =========================================================
-- 3. Per-user RLS policies
-- =========================================================
do $$
declare t text;
begin
  for t in select unnest(array['events','tasks','journal_entries','user_preferences']) loop
    execute format('drop policy if exists "owner-rw" on public.%I', t);
    execute format(
      'create policy "owner-rw" on public.%I for all
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- =========================================================
-- 4. Avatar storage bucket + policies
-- =========================================================
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars owner write" on storage.objects;
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
-- 5. Delete-account RPC (cascades through FKs)
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
-- 6. Realtime publication (idempotent)
-- =========================================================
do $$ begin
  begin alter publication supabase_realtime add table public.events;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tasks;           exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.journal_entries; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.user_preferences; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles;        exception when duplicate_object then null; end;
end $$;
