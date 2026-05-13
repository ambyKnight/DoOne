-- Phase 5 — ai_runs memory table.
-- Logs every AI interaction. Foundation for tool-call audit + memory browsing.
-- Run AFTER phases 01–04. Idempotent.

set lock_timeout = '6s';
set statement_timeout = '60s';

-- Pause realtime publication so DDL doesn't deadlock with realtime worker.
drop publication if exists supabase_realtime;
create publication supabase_realtime;

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null default 'manual',
  prompt text not null,
  context_text text,
  response_text text,
  model text,
  usage jsonb,
  tools_called jsonb default '[]'::jsonb,
  duration_ms int,
  error text,
  created_at timestamptz default now()
);

create index if not exists ai_runs_user_created_idx
  on public.ai_runs (user_id, created_at desc);

alter table public.ai_runs enable row level security;

drop policy if exists "ai_runs owner-rw" on public.ai_runs;
create policy "ai_runs owner-rw" on public.ai_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Re-add every realtime-enabled table.
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.user_preferences;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.journal_entries;
alter publication supabase_realtime add table public.ai_runs;
