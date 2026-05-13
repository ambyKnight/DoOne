-- Phase 6 — jobs + sessions tables.
-- Required by JobsPage + AI breakdown route. Run AFTER phases 01–05.
-- Idempotent.

set lock_timeout = '6s';
set statement_timeout = '60s';

drop publication if exists supabase_realtime;
create publication supabase_realtime;

-- Jobs: a unit of work the user wants to do over multiple sessions.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  total_time int not null default 60,            -- minutes
  priority int not null default 3,               -- 1..5
  deadline timestamptz,
  status text not null default 'active',         -- active | completed | archived
  created_at timestamptz default now()
);
create index if not exists jobs_user_idx on public.jobs (user_id, created_at desc);

-- Sessions: breakdown of a job into focused work blocks.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null,
  duration int not null default 30,              -- minutes
  order_index int not null default 0,
  status text not null default 'pending',        -- pending | in_progress | completed
  scheduled_for timestamptz,
  created_at timestamptz default now()
);
create index if not exists sessions_job_idx on public.sessions (job_id, order_index);
create index if not exists sessions_user_idx on public.sessions (user_id, created_at desc);

alter table public.jobs enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "jobs owner-rw" on public.jobs;
create policy "jobs owner-rw" on public.jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sessions owner-rw" on public.sessions;
create policy "sessions owner-rw" on public.sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Restore publication
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.user_preferences;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.journal_entries;
alter publication supabase_realtime add table public.ai_runs;
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.sessions;
