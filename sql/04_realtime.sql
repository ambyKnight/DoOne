-- Phase 3 — Re-add tables to realtime publication.
-- Run LAST, after Phase 2.

set lock_timeout = '6s';
set statement_timeout = '30s';

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.user_preferences;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.journal_entries;
