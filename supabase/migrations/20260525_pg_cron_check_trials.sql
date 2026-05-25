-- =============================================================================
-- CalcioLab — pg_cron: daily trial-expiry check
-- 2026-05-25
--
-- PREREQUISITES (one-time, via Supabase Dashboard → Database → Extensions):
--   1. pg_cron  → Enable
--   2. pg_net   → Enable
--
-- This migration is IDEMPOTENT: running it multiple times only updates the
-- existing cron job (upsert via cron.schedule — same name replaces the old one).
--
-- REQUIRED SECRET:
--   Supabase Dashboard → Edge Functions → Secrets
--   CHECK_TRIALS_SECRET = <your-random-secret>   (same value used in .env)
--
-- Replace <PROJECT_REF> below with your Supabase project reference
-- (e.g. sglevvqhlzpllrjrgbod) before running.
-- =============================================================================

-- Enable extensions if not already active.
-- This is a no-op when they are already enabled.
create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Schedule the daily trial check at 08:00 UTC.
-- cron.schedule() is an upsert: same job name → replaces existing schedule.
select cron.schedule(
  'check-trials-daily',        -- job name (unique key for upsert)
  '0 8 * * *',                 -- every day at 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-trials',
    headers := json_build_object(
                 'Content-Type',      'application/json',
                 'x-internal-secret', current_setting('app.check_trials_secret', true)
               )::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

-- Verify the job was registered:
-- select * from cron.job where jobname = 'check-trials-daily';
