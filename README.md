# CalcioLab Team Manager

Gestionale React/Vite per rosa, esercizi, sedute, partite, calendario,
presenze e statistiche.

## Avvio

```bash
npm install
npm run dev
```

## Persistenza dati

L'app funziona subito in locale usando `localStorage`. Se configuri Supabase,
abilita login, team workspace e sincronizzazione su tabelle separate. Se
l'utente non e loggato, o Supabase non risponde, resta attivo il fallback
locale.

Variabili `.env`:

```bash
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

## Test fisici

La pagina `Test fisici` usa Gacon o Yo-Yo per stimare una MAS operativa e
proporre gruppi di lavoro. I metri sono calcolati come:

```txt
metri = MAS(km/h) * 1000 / 3600 * secondi * percentuale
```

Esempio: Gacon 22 -> MAS stimata 19 km/h -> 15 secondi al 95% = circa 75m.
Sono riferimenti pratici per categorie senza preparatore: vanno adattati a
eta, categoria, periodo della stagione e stato fisico del giocatore.

Schema Supabase richiesto:

```sql
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text,
  category text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists players (
  id text not null,
  team_id uuid not null references teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, id)
);

create table if not exists exercises (
  id text not null,
  team_id uuid not null references teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, id)
);

create table if not exists sessions (
  id text not null,
  team_id uuid not null references teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, id)
);

create table if not exists matches (
  id text not null,
  team_id uuid not null references teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, id)
);

create table if not exists physical_tests (
  id text not null,
  team_id uuid not null references teams(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, id)
);
```

Policy Row Level Security di base:

```sql
alter table teams enable row level security;
alter table team_members enable row level security;
alter table players enable row level security;
alter table exercises enable row level security;
alter table sessions enable row level security;
alter table matches enable row level security;
alter table physical_tests enable row level security;

create policy "team members can read teams"
on teams for select
using (
  exists (
    select 1 from team_members tm
    where tm.team_id = id and tm.user_id = auth.uid()
  )
);

create policy "users can create owned teams"
on teams for insert
with check (owner_id = auth.uid());

create policy "team members can read memberships"
on team_members for select
using (user_id = auth.uid());

create policy "owners can create their membership"
on team_members for insert
with check (user_id = auth.uid());

create policy "team members can manage players"
on players for all
using (
  exists (
    select 1 from team_members tm
    where tm.team_id = players.team_id and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from team_members tm
    where tm.team_id = players.team_id and tm.user_id = auth.uid()
  )
);

create policy "team members can manage exercises"
on exercises for all
using (
  exists (
    select 1 from team_members tm
    where tm.team_id = exercises.team_id and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from team_members tm
    where tm.team_id = exercises.team_id and tm.user_id = auth.uid()
  )
);

create policy "team members can manage sessions"
on sessions for all
using (
  exists (
    select 1 from team_members tm
    where tm.team_id = sessions.team_id and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from team_members tm
    where tm.team_id = sessions.team_id and tm.user_id = auth.uid()
  )
);

create policy "team members can manage matches"
on matches for all
using (
  exists (
    select 1 from team_members tm
    where tm.team_id = matches.team_id and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from team_members tm
    where tm.team_id = matches.team_id and tm.user_id = auth.uid()
  )
);

create policy "team members can manage physical tests"
on physical_tests for all
using (
  exists (
    select 1 from team_members tm
    where tm.team_id = physical_tests.team_id and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from team_members tm
    where tm.team_id = physical_tests.team_id and tm.user_id = auth.uid()
  )
);
```
