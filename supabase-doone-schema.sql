-- DoOne — extended schema for suggestion engine, jobs, behavior, insights.
-- Run AFTER supabase-setup.sql in Supabase SQL Editor.

-- =========================================================
-- 1. Jobs — large work broken into sessions
-- =========================================================
create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  total_time  int not null default 60,       -- total estimated minutes
  deadline    timestamptz,
  priority    int not null default 2 check (priority between 1 and 5),
  status      text not null default 'active' check (status in ('active','completed','archived')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists jobs_user_id_idx on public.jobs(user_id);
alter table public.jobs enable row level security;
create policy "jobs owner-rw" on public.jobs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- 2. Sessions — time-chunked children of jobs
-- =========================================================
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  title       text not null,
  duration    int not null default 30,        -- planned minutes
  order_index int not null default 0,
  status      text not null default 'pending' check (status in ('pending','in_progress','completed','skipped')),
  actual_time int,                            -- actual minutes spent
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz default now()
);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_job_id_idx on public.sessions(job_id);
alter table public.sessions enable row level security;
create policy "sessions owner-rw" on public.sessions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- 3. Actions — done/skip/delay log for every suggestion
-- =========================================================
create table if not exists public.actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_type   text not null check (item_type in ('task','session')),
  item_id     uuid not null,
  action      text not null check (action in ('done','skip','delay')),
  hour_of_day int,
  day_of_week int,
  estimated_minutes int,
  actual_minutes    int,
  created_at  timestamptz default now()
);
create index if not exists actions_user_id_idx on public.actions(user_id);
alter table public.actions enable row level security;
create policy "actions owner-rw" on public.actions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- 4. Behavior memory — derived patterns + AI summaries
-- =========================================================
create table if not exists public.behavior_memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  pattern_type  text not null,                -- e.g. 'hourly_completion', 'skip_pattern', 'preferred_duration'
  pattern_data  jsonb not null default '{}',
  summary_text  text,                         -- AI-generated human summary
  computed_at   timestamptz default now(),
  updated_at    timestamptz default now()
);
create unique index if not exists behavior_memory_user_type_idx
  on public.behavior_memory(user_id, pattern_type);
alter table public.behavior_memory enable row level security;
create policy "behavior_memory owner-rw" on public.behavior_memory
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- 5. Insights — weekly/on-demand summaries
-- =========================================================
create table if not exists public.insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  summary_text text not null,
  stats        jsonb not null default '{}',   -- { tasks_completed, sessions_completed, best_day, ... }
  created_at   timestamptz default now()
);
create index if not exists insights_user_id_idx on public.insights(user_id);
alter table public.insights enable row level security;
create policy "insights owner-rw" on public.insights
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- 6. Add priority + estimated_minutes to tasks table
-- =========================================================
alter table public.tasks
  add column if not exists priority          int default 2 check (priority between 1 and 5),
  add column if not exists estimated_minutes int default 30,
  add column if not exists deadline          timestamptz;

-- =========================================================
-- 7. Realtime for new tables
-- =========================================================
do $$ begin
  begin alter publication supabase_realtime add table public.jobs;              exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sessions;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.actions;           exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.behavior_memory;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.insights;          exception when duplicate_object then null; end;
end $$;
