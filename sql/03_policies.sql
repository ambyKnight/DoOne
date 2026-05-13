-- Phase 2 — RLS + storage buckets + policies + RPC.
-- Run AFTER Phase 1.

set lock_timeout = '6s';
set statement_timeout = '60s';

-- ---------- drop legacy permissive policies ----------
drop policy if exists "Allow all select" on public.events;
drop policy if exists "Allow all insert" on public.events;
drop policy if exists "Allow all update" on public.events;
drop policy if exists "Allow all delete" on public.events;
drop policy if exists "Allow all tasks"  on public.tasks;
drop policy if exists "allow all prefs"  on public.user_preferences;

-- ---------- enable RLS ----------
alter table public.profiles         enable row level security;
alter table public.events           enable row level security;
alter table public.tasks            enable row level security;
alter table public.user_preferences enable row level security;
alter table public.journal_entries  enable row level security;

-- ---------- profiles policies ----------
drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles owner write" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles owner write" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- owner-rw on owned tables ----------
drop policy if exists "owner-rw" on public.events;
create policy "owner-rw" on public.events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner-rw" on public.tasks;
create policy "owner-rw" on public.tasks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner-rw" on public.user_preferences;
create policy "owner-rw" on public.user_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner-rw" on public.journal_entries;
create policy "owner-rw" on public.journal_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- avatar storage ----------
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

-- ---------- wallpaper storage ----------
insert into storage.buckets (id, name, public)
  values ('wallpapers', 'wallpapers', true)
  on conflict (id) do nothing;

drop policy if exists "wallpapers public read"  on storage.objects;
drop policy if exists "wallpapers owner write"  on storage.objects;
drop policy if exists "wallpapers owner update" on storage.objects;
drop policy if exists "wallpapers owner delete" on storage.objects;

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

-- ---------- delete-account RPC ----------
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
