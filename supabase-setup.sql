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
