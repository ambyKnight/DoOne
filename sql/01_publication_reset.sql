-- Phase 0 — Reset realtime publication.
-- Drops the publication entirely so the realtime worker has nothing to watch
-- during DDL. Re-created empty here; tables are re-added in Phase 3.
--
-- RUN THIS ALONE. Wait 5–10 seconds before running Phase 1 so the worker
-- notices the publication is empty and releases any in-flight locks.

set lock_timeout = '6s';
set statement_timeout = '60s';

drop publication if exists supabase_realtime;
create publication supabase_realtime;
