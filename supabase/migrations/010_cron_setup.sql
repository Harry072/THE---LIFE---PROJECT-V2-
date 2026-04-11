-- Migration: 010_cron_setup
 
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
 
-- Daily task generation at 4 AM UTC
SELECT cron.schedule(
  'generate_tasks',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-daily-tasks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
 
-- Weekly cleanup
SELECT cron.schedule(
  'cleanup_old_logs',
  '0 2 * * 0',
  $$ DELETE FROM notification_log WHERE sent_at < now() - interval '30 days'; $$
);
