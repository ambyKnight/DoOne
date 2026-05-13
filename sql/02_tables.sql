-- Phase 1 — Tables + columns + indexes. NO policies.
-- Safe to re-run.
--
-- Prerequisite: Phase 0 ran (publication empty → no realtime locks).

set lock_timeout = '6s';
set statement_timeout = '120s';

-- ---------- base tables ----------
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

-- ---------- legacy cleanup ----------
drop table if exists public.journal_pointers cascade;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null check (username ~ '^[a-z0-9_.-]{3,30}$'),
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now()
);

-- ---------- owner columns ----------
alter table public.events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_preferences
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

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

-- ---------- journal_entries (new DB-backed journal) ----------
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

-- ---------- onboarding + UX columns on user_preferences ----------
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

-- ---------- strip deprecated `tint` key from surface_dials ----------
update public.user_preferences
   set surface_dials = surface_dials - 'tint'
 where surface_dials ? 'tint';

-- ---------- profile auto-create trigger ----------
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
