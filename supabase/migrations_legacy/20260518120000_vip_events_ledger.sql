create table if not exists public.vip_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  type text not null,
  source text not null,
  external_id text not null,
  points integer not null default 0,
  reward_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vip_events_source_external_id_key'
  ) then
    alter table public.vip_events
      add constraint vip_events_source_external_id_key unique (source, external_id);
  end if;
end $$;

create unique index if not exists vip_events_team_reward_code_key
  on public.vip_events(team_id, reward_code)
  where reward_code is not null;

create index if not exists vip_events_team_id_created_at_idx
  on public.vip_events(team_id, created_at desc);

alter table public.vip_events enable row level security;

drop policy if exists "Team members can read vip events" on public.vip_events;
create policy "Team members can read vip events"
  on public.vip_events
  for select
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = vip_events.team_id
        and tm.user_id = auth.uid()
    )
  );
