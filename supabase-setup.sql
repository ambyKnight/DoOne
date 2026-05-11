-- Run this in your Supabase SQL Editor

-- 1. Create the events table
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (optional but recommended)
-- For this simple demo, we will allow all anonymous access.
-- WARNING: In a production app, restrict this to authenticated users!
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.events FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON public.events FOR DELETE USING (true);

-- 3. Enable Realtime sync for the events table
-- Go to Database -> Replication in the Supabase Dashboard, or run:
alter publication supabase_realtime add table public.events;

-- Tasks table
CREATE TABLE public.tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  done       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Add tag/color column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'ev-tag1';

-- Journal entries (one per day)
CREATE TABLE public.journal_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL UNIQUE,
  did        TEXT DEFAULT '',
  plan       TEXT DEFAULT '',
  mood       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all journal" ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;

-- User preferences (single row — upsert by id)
CREATE TABLE public.user_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  font         TEXT DEFAULT 'manrope',
  vibe         TEXT DEFAULT 'calm',
  surface      TEXT DEFAULT 'glass',
  density      TEXT DEFAULT 'cozy',
  vibe_dials   JSONB,
  surface_dials JSONB,
  accent_boost FLOAT DEFAULT 1.0,
  blur_amount  INT DEFAULT 22,
  surface_alpha FLOAT DEFAULT 0.55,
  panel_gap    INT DEFAULT 16,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all prefs" ON public.user_preferences FOR ALL USING (true) WITH CHECK (true);
