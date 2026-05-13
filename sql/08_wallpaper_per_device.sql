-- Phase 8 — per-device wallpaper-disable persistence.
-- Adds wallpaper_disabled_pc + wallpaper_disabled_mobile so PC and mobile
-- can have independent settings that ALSO persist across sessions / devices.
-- Old `wallpaper_disabled` column is left in place (deprecated, unused).
-- Idempotent.

set lock_timeout = '6s';
set statement_timeout = '60s';

drop publication if exists supabase_realtime;
create publication supabase_realtime;

alter table public.user_preferences
  add column if not exists wallpaper_disabled_pc     boolean not null default false,
  add column if not exists wallpaper_disabled_mobile boolean not null default false;

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
