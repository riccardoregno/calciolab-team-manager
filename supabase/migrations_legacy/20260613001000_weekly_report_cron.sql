-- CalcioLab — weekly director report cron

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

SELECT cron.schedule(
  'weekly-report-monday',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://sglevvqhlzpllrjrgbod.supabase.co/functions/v1/weekly-report',
    headers := json_build_object(
                 'Content-Type',      'application/json',
                 'x-internal-secret', current_setting('app.weekly_report_secret', true)
               )::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
