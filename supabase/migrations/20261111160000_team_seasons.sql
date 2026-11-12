-- Additive schema only. No automatic assignment or rewrite of legacy data.
create table if not exists public.team_seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  source_season_id uuid,
  request_id uuid not null,
  request_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (team_id,id),
  unique (team_id,request_id),
  foreign key (team_id,source_season_id) references public.team_seasons(team_id,id)
);
create unique index if not exists team_seasons_name_unique on public.team_seasons(team_id,lower(name));
create unique index if not exists players_team_identity_unique on public.players(team_id,id);

create table if not exists public.team_season_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  data jsonb not null,
  season_id uuid generated always as ((data->>'seasonId')::uuid) stored not null,
  player_id uuid generated always as ((data->>'playerId')::uuid) stored not null,
  updated_at timestamptz not null default now(),
  check (data ? 'profile' and jsonb_typeof(data->'profile') = 'object'),
  unique (team_id,season_id,player_id),
  foreign key (team_id,season_id) references public.team_seasons(team_id,id),
  foreign key (team_id,player_id) references public.players(team_id,id) on delete restrict
);
alter table public.team_seasons enable row level security;
alter table public.team_season_players enable row level security;
revoke all on public.team_seasons,public.team_season_players from public,anon,authenticated;
grant select on public.team_seasons to authenticated;
grant select,insert,update,delete on public.team_season_players to authenticated;
grant all on public.team_seasons,public.team_season_players to service_role;

create or replace function public.is_latest_team_season(p_team uuid,p_season uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_season = (select id from public.team_seasons where team_id=p_team order by start_date desc limit 1);
$$;
revoke all on function public.is_latest_team_season(uuid,uuid) from public,anon;
grant execute on function public.is_latest_team_season(uuid,uuid) to authenticated;

drop policy if exists team_seasons_read on public.team_seasons;
create policy team_seasons_read on public.team_seasons for select to authenticated
  using (team_id = any(public.get_my_team_ids()));
drop policy if exists team_season_players_read on public.team_season_players;
create policy team_season_players_read on public.team_season_players for select to authenticated using (
  team_id = any(public.get_my_team_ids()) and (
    exists(select 1 from public.team_members m where m.team_id=team_season_players.team_id and m.user_id=(select auth.uid()) and m.role<>'player')
    or exists(select 1 from public.player_accounts a where a.team_id=team_season_players.team_id and a.auth_user_id=(select auth.uid()) and a.player_id=team_season_players.player_id::text)
  )
);
drop policy if exists team_season_players_insert on public.team_season_players;
create policy team_season_players_insert on public.team_season_players for insert to authenticated with check (
  public.can_manage_team_area(team_id,'players') and public.is_latest_team_season(team_id,season_id)
);
drop policy if exists team_season_players_update on public.team_season_players;
create policy team_season_players_update on public.team_season_players for update to authenticated
  using(public.can_manage_team_area(team_id,'players') and public.is_latest_team_season(team_id,season_id))
  with check(public.can_manage_team_area(team_id,'players') and public.is_latest_team_season(team_id,season_id));
drop policy if exists team_season_players_delete on public.team_season_players;
create policy team_season_players_delete on public.team_season_players for delete to authenticated
  using(public.can_manage_team_area(team_id,'players') and public.is_latest_team_season(team_id,season_id));

create or replace function public.guard_season_player_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.team_id is distinct from old.team_id or new.data->>'seasonId' is distinct from old.data->>'seasonId' or new.data->>'playerId' is distinct from old.data->>'playerId' then
    raise exception 'SEASON_MEMBERSHIP_IDENTITY';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_season_player_identity on public.team_season_players;
create trigger guard_season_player_identity before update on public.team_season_players for each row execute function public.guard_season_player_identity();

create or replace function public.create_team_season(
  p_team_id uuid,p_request_id uuid,p_name text,p_start_date date,p_end_date date,
  p_source_season_id uuid,p_player_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_payload jsonb;
  v_previous jsonb;
  v_ids uuid[];
  v_name text := btrim(p_name);
  v_all_ids uuid[];
begin
  if not exists(select 1 from public.team_members where team_id=p_team_id and user_id=auth.uid() and role in ('owner','headCoach')) then
    raise exception 'SEASON_FORBIDDEN' using errcode='42501';
  end if;
  -- Serialize creation for this team, including two different browser sessions.
  perform 1 from public.teams where id=p_team_id for update;
  if p_request_id is null or p_start_date is null or p_end_date is null or p_end_date<p_start_date or length(v_name) not between 1 and 60 then
    raise exception 'SEASON_INVALID';
  end if;
  select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into v_ids from unnest(p_player_ids) x;
  v_payload := jsonb_build_object('name',v_name,'start',p_start_date,'end',p_end_date,'source',p_source_season_id,'players',to_jsonb(v_ids));
  select id,request_payload into v_id,v_previous from public.team_seasons where team_id=p_team_id and request_id=p_request_id;
  if found then
    if v_previous<>v_payload then raise exception 'SEASON_REQUEST_CONFLICT'; end if;
    return v_id;
  end if;
  if exists(select 1 from public.team_seasons where team_id=p_team_id and daterange(start_date,end_date,'[]') && daterange(p_start_date,p_end_date,'[]')) then
    raise exception 'SEASON_OVERLAP';
  end if;
  if p_source_season_id is null then
    if exists(select 1 from public.team_seasons where team_id=p_team_id) then raise exception 'SEASON_SOURCE_REQUIRED'; end if;
    select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_all_ids from public.players where team_id=p_team_id;
    if v_all_ids<>v_ids then raise exception 'SEASON_BOOTSTRAP_ROSTER'; end if;
  else
    if not exists(select 1 from public.team_seasons where team_id=p_team_id and id=p_source_season_id and end_date<p_start_date) then raise exception 'SEASON_SOURCE_INVALID'; end if;
    if exists(select 1 from unnest(v_ids) x where not exists(select 1 from public.team_season_players where team_id=p_team_id and season_id=p_source_season_id and player_id=x)) then raise exception 'SEASON_PLAYER_INVALID'; end if;
  end if;
  insert into public.team_seasons(team_id,name,start_date,end_date,source_season_id,request_id,request_payload)
    values(p_team_id,v_name,p_start_date,p_end_date,p_source_season_id,p_request_id,v_payload) returning id into v_id;
  if p_source_season_id is null then
    insert into public.team_season_players(team_id,data)
      select p_team_id,jsonb_build_object('seasonId',v_id,'playerId',p.id,'profile',p.data)
      from public.players p where p.team_id=p_team_id;
  else
    insert into public.team_season_players(team_id,data)
      select p_team_id,jsonb_build_object('seasonId',v_id,'playerId',s.player_id,'profile',
        (s.data->'profile') || jsonb_build_object('transferDate','','status','Disponibile','ratings','{}'::jsonb))
      from public.team_season_players s where s.team_id=p_team_id and s.season_id=p_source_season_id and s.player_id=any(v_ids);
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_team_season(uuid,uuid,text,date,date,uuid,uuid[]) from public,anon;
grant execute on function public.create_team_season(uuid,uuid,text,date,date,uuid,uuid[]) to authenticated;

-- seasonId stays in the established JSON payload; generated columns enforce team FKs.
alter table public.sessions add column if not exists season_id uuid generated always as (nullif(data->>'seasonId','')::uuid) stored;
alter table public.matches add column if not exists season_id uuid generated always as (nullif(data->>'seasonId','')::uuid) stored;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='sessions_team_season_fk' and conrelid='public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_team_season_fk foreign key(team_id,season_id) references public.team_seasons(team_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='matches_team_season_fk' and conrelid='public.matches'::regclass) then
    alter table public.matches add constraint matches_team_season_fk foreign key(team_id,season_id) references public.team_seasons(team_id,id);
  end if;
end $$;
create index if not exists sessions_team_season_idx on public.sessions(team_id,season_id);
create index if not exists matches_team_season_idx on public.matches(team_id,season_id);

create or replace function public.guard_event_season()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_season public.team_seasons; v_date date;
begin
  if tg_op='UPDATE' and nullif(old.data->>'seasonId','') is not null and (new.data->>'seasonId' is distinct from old.data->>'seasonId' or new.team_id is distinct from old.team_id) then raise exception 'SEASON_EVENT_ID'; end if;
  if nullif(new.data->>'seasonId','') is null then
    if (tg_op='INSERT' or new.data->>'date' is distinct from old.data->>'date') and exists(select 1 from public.team_seasons where team_id=new.team_id) then raise exception 'SEASON_EVENT_REQUIRED'; end if;
    return new;
  end if;
  select * into v_season from public.team_seasons where team_id=new.team_id and id=(new.data->>'seasonId')::uuid;
  if not found then raise exception 'SEASON_EVENT_ID'; end if;
  if coalesce(new.data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'SEASON_EVENT_DATE'; end if;
  v_date := (new.data->>'date')::date;
  if v_date<v_season.start_date or v_date>v_season.end_date then raise exception 'SEASON_EVENT_DATE'; end if;
  return new;
end;
$$;
drop trigger if exists guard_event_season on public.sessions;
create trigger guard_event_season before insert or update on public.sessions for each row execute function public.guard_event_season();
drop trigger if exists guard_event_season on public.matches;
create trigger guard_event_season before insert or update on public.matches for each row execute function public.guard_event_season();

-- Reuse the existing pilot billing restriction when that optional test integration exists.
do $$ begin
  if to_regprocedure('public.team_billing_test_allows_operations(uuid)') is not null then
    execute 'create policy season_billing_test_guard on public.team_season_players as restrictive for all to authenticated using(public.team_billing_test_allows_operations(team_id)) with check(public.team_billing_test_allows_operations(team_id))';
  end if;
exception when duplicate_object then null;
end $$;
notify pgrst, 'reload schema';
