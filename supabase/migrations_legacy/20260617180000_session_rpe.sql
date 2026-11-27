-- Tabella RPE (Borg 1-10) per valutazioni soggettive di allenamenti e partite
create table if not exists session_rpe (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  player_id   text not null,
  event_id    text not null,
  event_type  text not null check (event_type in ('session', 'match')),
  rpe_value   integer not null check (rpe_value between 1 and 10),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(team_id, player_id, event_id)
);

alter table session_rpe enable row level security;

-- Il giocatore può inserire/aggiornare la propria valutazione
create policy "player_manage_own_rpe" on session_rpe
  for all
  using (
    auth.uid() in (
      select auth_user_id from player_accounts
      where team_id = session_rpe.team_id
        and player_id::text = session_rpe.player_id
    )
  )
  with check (
    auth.uid() in (
      select auth_user_id from player_accounts
      where team_id = session_rpe.team_id
        and player_id::text = session_rpe.player_id
    )
  );

-- Lo staff può leggere tutti i RPE del proprio team
create policy "staff_read_rpe" on session_rpe
  for select
  using (
    auth.uid() in (
      select user_id from team_members where team_id = session_rpe.team_id
    )
  );
