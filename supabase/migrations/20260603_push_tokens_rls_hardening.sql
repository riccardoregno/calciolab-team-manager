-- Hardening RLS push_tokens: user must be a member of the team
-- they register a device for.

drop policy if exists "push_tokens_insert_own" on push_tokens;
create policy "push_tokens_insert_own"
  on push_tokens for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = push_tokens.team_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "push_tokens_update_own" on push_tokens;
create policy "push_tokens_update_own"
  on push_tokens for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = push_tokens.team_id
        and tm.user_id = auth.uid()
    )
  );

-- Unique index on inviteToken to prevent token collisions across teams
create unique index if not exists teams_invite_token_unique
  on public.teams ((settings->>'inviteToken'))
  where nullif(settings->>'inviteToken', '') is not null;
