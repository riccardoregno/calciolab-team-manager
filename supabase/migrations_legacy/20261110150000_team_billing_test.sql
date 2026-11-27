-- Local Stripe test state. Existing teams and Stripe associations are left intact.
create table if not exists public.team_billing_test (
  team_id uuid primary key references public.teams(id) on delete cascade,
  customer_id text not null unique,
  subscription_id text,
  status text not null default 'free',
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  revision bigint not null default 0
);
alter table public.team_billing_test enable row level security;
revoke all on public.team_billing_test from public, anon, authenticated;
grant select (team_id, status, period_end, cancel_at_period_end, subscription_id) on public.team_billing_test to authenticated;
grant select, insert on public.team_billing_test to service_role;
drop policy if exists team_billing_test_member_read on public.team_billing_test;
create policy team_billing_test_member_read on public.team_billing_test
  for select to authenticated using (
    exists (select 1 from public.team_members m
            where m.team_id = team_billing_test.team_id and m.user_id = (select auth.uid()))
  );

create table if not exists public.team_billing_test_events (
  event_id text primary key,
  team_id uuid not null references public.team_billing_test(team_id) on delete cascade
);
alter table public.team_billing_test_events enable row level security;
revoke all on public.team_billing_test_events from public, anon, authenticated;

create or replace function public.apply_team_billing_test(
  p_event_id text, p_team_id uuid, p_revision bigint, p_subscription_id text,
  p_status text, p_period_end timestamptz, p_cancel_at_period_end boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare current_revision bigint;
begin
  select revision into strict current_revision from public.team_billing_test
    where team_id = p_team_id for update;
  if exists (select 1 from public.team_billing_test_events where event_id = p_event_id) then
    return 'duplicate';
  end if;
  if current_revision <> p_revision then return 'retry'; end if;
  if p_status not in ('free', 'active', 'incomplete', 'past_due', 'canceled') then
    raise exception 'Unexpected Stripe test status';
  end if;

  insert into public.team_billing_test_events values (p_event_id, p_team_id);
  update public.team_billing_test set subscription_id = p_subscription_id,
    status = p_status, period_end = p_period_end,
    cancel_at_period_end = p_cancel_at_period_end, revision = revision + 1
    where team_id = p_team_id;
  return 'applied';
end;
$$;
revoke all on function public.apply_team_billing_test(text, uuid, bigint, text, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_team_billing_test(text, uuid, bigint, text, text, timestamptz, boolean)
  to service_role;

-- Keep existing membership/role policies in force. These additional checks
-- only apply to teams enrolled by the local test checkout.
create or replace function public.team_billing_test_allows_operations(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.team_billing_test
    where team_id = p_team_id
      and (status <> 'active' or period_end is null or period_end <= statement_timestamp())
  );
$$;
revoke all on function public.team_billing_test_allows_operations(uuid) from public, anon, authenticated;
grant execute on function public.team_billing_test_allows_operations(uuid) to authenticated;

drop policy if exists team_billing_test_guard on public.players;
create policy team_billing_test_guard on public.players as restrictive for all to authenticated
  using (public.team_billing_test_allows_operations(team_id))
  with check (public.team_billing_test_allows_operations(team_id));

drop policy if exists team_billing_test_guard on public.sessions;
create policy team_billing_test_guard on public.sessions as restrictive for all to authenticated
  using (public.team_billing_test_allows_operations(team_id))
  with check (public.team_billing_test_allows_operations(team_id));

drop policy if exists team_billing_test_guard on public.matches;
create policy team_billing_test_guard on public.matches as restrictive for all to authenticated
  using (public.team_billing_test_allows_operations(team_id))
  with check (public.team_billing_test_allows_operations(team_id));

