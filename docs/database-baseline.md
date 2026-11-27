# Baseline canonica CalcioLab

## Percorso per un database nuovo

Il percorso candidato parte da un Supabase vuoto con gli schemi e i ruoli gestiti già inizializzati. La CLI esegue i file in `supabase/migrations/` in ordine di versione.

1. `20261126090000_calciolab_baseline.sql` riproduce gli oggetti applicativi dello snapshot `public`. Crea tutte le tabelle prima delle funzioni, dichiara `uuid-ossp` in `extensions` e interrompe l'esecuzione se `public` contiene tabelle. La FK da `player_matches.match_id` a `matches.id` è assente nello snapshot e non è stata aggiunta.
2. `20261126091000_calciolab_platform_objects.sql` ricrea gli oggetti applicativi fuori da `public` usando le definizioni già in Git. Richiede Auth, Storage e la publication Supabase Realtime inizializzati dalla piattaforma.
3. `supabase/seed.sql` aggiunge due squadre, due stagioni, due giocatori con roster stagionali, due partite e due allenamenti fittizi. La configurazione disabilita il seed automatico. Il seed si carica soltanto nel collaudo locale esplicito.

Le 35 migration originali sono in `supabase/migrations_legacy/`, con gli stessi nomi e byte. La CLI non le esegue dal percorso attivo. L'archivio conserva anche le trasformazioni dati e i job storici per consultazione. Il dump locale resta fuori da Git e il file originale non fa parte del bootstrap.

## Parità e decisioni da revisionare

Lo snapshot `public` contiene 29 tabelle, 14 funzioni, 6 trigger, 96 policy e 146 istruzioni ACL. La baseline conserva le loro definizioni, le PK, le FK, i vincoli e i 26 indici espliciti. Le istruzioni della sessione di restore e i metacomandi di pg_dump sono rimossi. I prerequisiti e il controllo sullo schema vuoto sono aggiunte di bootstrap.

Le 13 funzioni SECURITY DEFINER, il loro `search_path`, le otto policy legacy, i grant nominativi e i default privileges restano quelli dello snapshot. In revisione verificare in particolare l'effetto congiunto delle policy legacy e per area, e i grant a `anon` e `authenticated` su `increment_vip_points`, `redeem_promo_code` e `touch_player_portal_activity`. Gli eventuali cambi di sicurezza richiedono una migration successiva separata.

Il percorso attivo esclude `team_billing_test`, `team_billing_test_events`, le relative RPC e policy, la deduplica storica, il seed promo e i job con destinazione production. Gli `INSERT`, `UPDATE` e `DELETE` che fanno parte del corpo delle funzioni sono logica applicativa dello snapshot.

| Dipendenza | Provenienza e perimetro |
|---|---|
| Auth | Supabase fornisce `auth.users`, `auth.uid()` e `auth.role()`. Il trigger applicativo `on_auth_user_created` viene da `20260522_profiles_fix.sql`. |
| Storage | Il secondo file crea il bucket `team-attachments` con il flag pubblico e le tre policy del file storico `20260518124500_team_attachments_bucket.sql`. Nessun oggetto caricato. Verificare la parità del bucket prima di distribuire dati o allegati. |
| Realtime | La publication `supabase_realtime` deve esistere. Il secondo file vi registra `public.staff_messages` e `public.player_portal_activity`, come nello storico Git. Il dump `public` non attesta la configurazione live della publication. |
| Estensioni | `uuid-ossp` serve per i default legacy ed è installata nello schema `extensions`. `pg_cron` e `pg_net` riguardano i job archiviati, esclusi dal bootstrap. |
| Edge Functions | Sorgenti in `supabase/functions`. Provisioning e collaudo delle funzioni sono separati dal restore del database. |
| Segreti e configurazione | Valori per ambiente da predisporre a parte con l'amministratore. Il bootstrap e il seed non richiedono credenziali production, token o segreti di provider. |

## Collaudo locale e utenti Auth fittizi

Il progetto locale `calciolab-baseline-local` usa il database shadow su `56020`, l'API su `56021`, PostgreSQL su `56022`, Studio su `56023`, Mailpit su `56024` e Analytics su `56027`. Il pooler è disabilitato e ha come porta configurata `56029`. SMTP e POP3 restano disabilitati con le porte `56025` e `56026` riportate nei commenti. Il blocco precedente `55420–55429` era compreso nell'intervallo `55392–55491` riservato da Windows. Usare soltanto l'istanza locale dedicata e sacrificabile.

```sh
supabase start
supabase db reset --local --no-seed
supabase db reset --local --sql-paths ./seed.sql
```

Il reset cancella il database locale del progetto. Prima del collaudo verificare che il target sia il container dedicato. Confrontare il catalogo dopo il primo reset con lo snapshot, poi verificare i numeri delle fixture dopo il secondo e dopo una seconda ricostruzione.

Il seed non scrive in `auth.users`. Per provare il login/RLS, creare due account di test nello Studio **locale** con indirizzi riservati, ad esempio `coach-a@example.invalid` e `coach-b@example.invalid`. Confermarli nel sistema locale. Associare gli UUID creati da Auth rispettivamente a TEST A e TEST B tramite `public.team_members`, assegnando il ruolo `owner` e impostando il corrispondente `public.teams.owner_id`. Verificare che `on_auth_user_created` crei il profilo e che l'utente A non possa leggere o scrivere le sedute di B. Identificativi e credenziali di test restano nell'istanza locale.

## Condizione prima di integrare il branch

Questo è un candidato di bootstrap per istanze nuove. Prima di collegarlo a un runner remoto, concordare come mantenere separata la migration history di production già operativa. Il check sullo schema vuoto è una barriera aggiuntiva. Il collaudo locale e la review diff degli ACL devono precedere qualsiasi scelta di adozione su staging. La baseline non richiede cambi a production per essere costruita o testata.
