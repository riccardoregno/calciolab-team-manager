-- CalcioLab — RSVP reminder tracking + hourly cron

ALTER TABLE public.rsvp_tokens
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS rsvp_tokens_pending_reminder_idx
  ON public.rsvp_tokens(response, created_at)
  WHERE response = 'pending' AND reminder_sent_at IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

SELECT cron.schedule(
  'rsvp-reminder-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://sglevvqhlzpllrjrgbod.supabase.co/functions/v1/rsvp-reminder',
    headers := json_build_object(
                 'Content-Type',      'application/json',
                 'x-internal-secret', current_setting('app.rsvp_reminder_secret', true)
               )::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
