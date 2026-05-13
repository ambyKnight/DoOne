-- Phase 7 — legacy AI tables: insights, behavior_memory, actions.
-- These are referenced by existing API routes (/api/insights, /api/behavior,
-- /api/ai/insights, /api/ai/memory) but were never migrated. Adding them now.
-- Idempotent. Run AFTER phases 01–06.

set lock_timeout = '6s';
set statement_timeout = '60s';

drop publication if exists supabase_realtime;
create publication supabase_realtime;

-- Weekly AI-generated summaries.
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary_text text,
  stats jsonb,
  created_at timestamptz default now()
);
create index if not exists insights_user_period_idx on public.insights (user_id, period_end desc);

-- Learned behavior patterns (hourly completion, skip rate, preferred duration).
create table if not exists public.behavior_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_type text not null,
  pattern_data jsonb,
  summary_text text,
  computed_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (user_id, pattern_type)
);
create index if not exists behavior_memory_user_idx on public.behavior_memory (user_id, updated_at desc);

-- Raw action log used to compute behavior_memory.
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,                         -- done | skip | snooze | ...
  target_type text,                             -- task | session | event
  target_id uuid,
  hour_of_day int,
  day_of_week int,
  actual_minutes int,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists actions_user_created_idx on public.actions (user_id, created_at desc);

alter table public.insights enable row level security;
alter table public.behavior_memory enable row level security;
alter table public.actions enable row level security;

drop policy if exists "insights owner-rw" on public.insights;
create policy "insights owner-rw" on public.insights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "behavior_memory owner-rw" on public.behavior_memory;
create policy "behavior_memory owner-rw" on public.behavior_memory
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "actions owner-rw" on public.actions;
create policy "actions owner-rw" on public.actions
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
alter publication supabase_realtime add table public.insights;
alter publication supabase_realtime add table public.behavior_memory;
alter publication supabase_realtime add table public.actions;
