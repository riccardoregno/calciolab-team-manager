-- Push notification tokens
-- Memorizza i token FCM/APNs per ogni utente+team.
-- Un utente può avere token diversi per team diversi (es. staff su più squadre).

create table if not exists push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  token       text not null,
  platform    text not null default 'unknown', -- 'ios' | 'android' | 'web'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Un solo token attivo per utente+team (upsert on conflict)
  unique (user_id, team_id)
);

-- Indice per invio notifiche a tutti i membri di un team
create index if not exists push_tokens_team_id_idx on push_tokens(team_id);

-- RLS: ogni utente vede e gestisce solo i propri token
alter table push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on push_tokens;
create policy "push_tokens_select_own"
  on push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on push_tokens;
create policy "push_tokens_insert_own"
  on push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on push_tokens;
create policy "push_tokens_update_own"
  on push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on push_tokens;
create policy "push_tokens_delete_own"
  on push_tokens for delete
  using (auth.uid() = user_id);

-- Service role bypass (per Edge Functions che inviano notifiche)
drop policy if exists "push_tokens_service_role" on push_tokens;
create policy "push_tokens_service_role"
  on push_tokens for all
  using (auth.role() = 'service_role');
