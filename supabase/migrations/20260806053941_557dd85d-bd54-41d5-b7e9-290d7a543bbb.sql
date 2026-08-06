CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('cleanup-expired-stories', '17 * * * *', $$select public.cleanup_expired_stories();$$);