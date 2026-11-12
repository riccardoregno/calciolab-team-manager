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

## Prova locale per lo staff

Dalla cartella del repository, dopo aver installato le dipendenze:

```powershell
node scripts/staff-rehearsal.mjs
```

Apri [la prova locale](http://127.0.0.1:4177/login) e accedi con
`staff@example.test` / `prova-staff`. Per un telefono sulla stessa rete privata,
avvia lo script con `--lan` e apri `http://<IP-del-PC>:4177/login`.
Lo script usa un servizio simulato, senza collegarsi a Supabase. I dati fittizi
sopravvivono al ricaricamento della pagina; riavviare lo script ripristina la
situazione iniziale. Usalo soltanto con dati di prova.

1. Registra la presenza mancante nella **Seduta prova C** della **Squadra B**.
2. Completa il minutaggio mancante in **Avversaria D · Squadra B** e salva.
3. Prima della seduta successiva, dalla **Dashboard** apri il **Quadro settimanale della rosa**,
   seleziona **CalcioLab Prova Staff B** e controlla la settimana precedente.
   Verifica che presenza e minuti siano aggiornati anche dopo la ricarica.

L’account `staff@example.test` vede entrambe le squadre. Usa
`collaboratore@example.test` / `prova-staff` per registrare le presenze nella
squadra B come assistente. Apri il Quadro con l’account dello staff in un altro
profilo del browser per verificare il passaggio tra i due account.

## Prova tra due account su Supabase di test

Serve un progetto Supabase dedicato, con lo schema CalcioLab e le migrazioni
applicate. Il repository contiene migrazioni incrementali. Su un progetto
vuoto va prima applicato uno schema base CalcioLab, senza importare righe
applicative, account o segreti della produzione. Non collegare la CLI di
questa cartella al progetto di produzione per eseguire questa prova.

Prima del seed, apri il SQL Editor **del progetto di test** e controlla le
policy effettive delle sedute, comprese eventuali policy permissive aggiuntive.

```sql
select c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'sessions';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'sessions'
order by cmd, policyname;
```

Da PowerShell, nella cartella del progetto, imposta queste variabili per la
sola sessione del terminale. Tieni la chiave admin fuori da Git, dal browser
e dalle variabili con prefisso VITE.

```powershell
$env:CALCIOLAB_TEST_REF = '<ref-progetto-di-test>'
$env:CALCIOLAB_TEST_PUBLIC_KEY = '<chiave-pubblica-di-test>'
$env:CALCIOLAB_TEST_PASSWORD = '<password-scelta-per-i-due-account-fittizi>'
$env:CALCIOLAB_TEST_ADMIN_KEY = '<chiave-server-del-progetto-di-test>'
node scripts/staff-supabase-pilot.mjs seed
Remove-Item Env:CALCIOLAB_TEST_ADMIN_KEY
node scripts/staff-supabase-pilot.mjs verify
```

Il seed crea le fixture per la settimana precedente. Rieseguirlo ripristina
le presenze fittizie. La verifica usa la chiave pubblica e le sessioni Auth
utente: il mister vede A e B, l’assistente legge e aggiorna B, la lettura e
l’aggiornamento diretti di A come assistente non restituiscono righe. Il
mister deve poi rileggere A intatta e vedere tre presenze in B. Lo script
ripristina la presenza mancante di B per il passaggio sui telefoni.

Dopo la verifica, avvia l’app collegata esclusivamente al progetto di test.

```powershell
$env:VITE_SUPABASE_URL = 'https://' + $env:CALCIOLAB_TEST_REF + '.supabase.co'
$env:VITE_SUPABASE_ANON_KEY = $env:CALCIOLAB_TEST_PUBLIC_KEY
$env:VITE_SENTRY_DSN = ''
npm run dev -- --host 0.0.0.0 --port 4180 --strictPort
```

Apri `http://<IP-del-PC>:4180/login` sui due telefoni sulla stessa rete privata,
usando l’indirizzo Network mostrato da Vite. Usa la password impostata per il seed.

1. Sul telefono del mister entra come `calciolab-pilot-mister@example.com`.
   Apri **Dashboard → Quadro settimanale della rosa → CalcioLab Pilot B → Precedente**.
   Lascia il quadro aperto su **2 presenti · 1 da registrare**.
2. Sul telefono del collaboratore entra come
   `calciolab-pilot-assistente@example.com`. Apri il Quadro della settimana
   precedente, poi **Giocatore Prova B → Dettaglio eventi → Seduta prova B3**.
   Seleziona **Presente** e attendi la conferma del salvataggio online.
   L’account deve vedere solo la squadra B.
3. Sul telefono del mister osserva il quadro aperto e annota quando compare
   **3 presenti**. Prova a riportare l’app in primo piano dopo almeno un minuto.
   Se resta invariato, lascia la pagina visibile per un ciclo di aggiornamento
   di cinque minuti o ricaricala. Ricaricando deve comparire **3 presenti**.
   Passa quindi a **CalcioLab Pilot A** nella stessa settimana. Il risultato
   atteso è **2 presenti · 1 assenza**.
