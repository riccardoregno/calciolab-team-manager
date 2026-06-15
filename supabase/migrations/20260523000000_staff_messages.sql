-- ============================================================
-- staff_messages — chat interna staff
-- ============================================================

create table if not exists staff_messages (
  id          uuid        primary key default gen_random_uuid(),
  team_id     uuid        not null references teams(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  author_name text        not null default '',
  author_role text        not null default 'headCoach',
  content     text        not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at  timestamptz not null default now()
);

-- Index per query per team ordinate per data
create index if not exists staff_messages_team_created
  on staff_messages (team_id, created_at desc);

-- Row Level Security
alter table staff_messages enable row level security;

-- Solo i membri del team possono leggere
drop policy if exists "staff_messages_select" on staff_messages;
create policy "staff_messages_select"
  on staff_messages for select
  using (
    team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Solo i membri del team possono inserire (user_id deve essere il proprio)
drop policy if exists "staff_messages_insert" on staff_messages;
create policy "staff_messages_insert"
  on staff_messages for insert
  with check (
    user_id = auth.uid()
    and team_id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Ogni utente può cancellare solo i propri messaggi
drop policy if exists "staff_messages_delete_own" on staff_messages;
create policy "staff_messages_delete_own"
  on staff_messages for delete
  using (user_id = auth.uid());

-- Abilita realtime per questa tabella
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'staff_messages'
  ) then
    alter publication supabase_realtime add table staff_messages;
  end if;
end $$;
