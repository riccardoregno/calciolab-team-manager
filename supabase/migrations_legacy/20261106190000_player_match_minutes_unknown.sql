alter table public.player_matches
  alter column minutes_played drop not null,
  alter column minutes_played drop default,
  add column minutes_cleared boolean not null default false,
  add constraint player_matches_cleared_minutes_are_unknown
    check (not minutes_cleared or minutes_played is null);

comment on column public.player_matches.minutes_cleared is
  'An explicit clear prevents fallback to the legacy match attendance minutes.';
