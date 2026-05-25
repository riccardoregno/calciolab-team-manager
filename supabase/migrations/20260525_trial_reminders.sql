-- CalcioLab — Trial reminder flags
-- Aggiunge due colonne boolean alla tabella teams per evitare email duplicate.
-- La Edge Function check-trials legge questi flag prima di inviare e li imposta dopo.

alter table public.teams
  add column if not exists trial_reminder_3d_sent boolean not null default false,
  add column if not exists trial_reminder_1d_sent boolean not null default false;

-- Reset automatico dei flag quando un nuovo trial viene avviato
-- (trial_ends_at viene scritto dalla Edge Function start-trial, non dal client)
create or replace function public.reset_trial_reminder_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Se trial_ends_at cambia (nuovo trial), azzera i flag
  if new.trial_ends_at is distinct from old.trial_ends_at
     and new.trial_ends_at is not null then
    new.trial_reminder_3d_sent := false;
    new.trial_reminder_1d_sent := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_trial_reminder_flags on public.teams;
create trigger trg_reset_trial_reminder_flags
  before update of trial_ends_at on public.teams
  for each row
  execute function public.reset_trial_reminder_flags();

comment on column public.teams.trial_reminder_3d_sent is
  'True dopo aver inviato la email di reminder a 3 giorni dalla scadenza del trial';
comment on column public.teams.trial_reminder_1d_sent is
  'True dopo aver inviato la email di reminder a 1 giorno dalla scadenza del trial';
