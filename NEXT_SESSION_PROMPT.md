# Prompt per la prossima sessione — CalcioLab Team Manager

## Contesto
Repo: calciolab-team-manager, branch main, deploy calciolab.org.
Stack: React 19 + Vite 8, React Router 7, Supabase JS v2, Edge Functions Deno, Resend, jsPDF.

Regole prima di ogni commit:
```
npx eslint src --max-warnings=0
npx vite build
```

NON toccare/stagiare: android/, public/favicon.svg, public/pwa-192.svg, public/pwa-512.svg,
supabase/.temp/, supabase/migrations/20260618120000_player_wellness.sql, CTempfull_diff.txt.

## Cosa è stato fatto nell'ultima sessione (riepilogo)
- Portale giocatore: tab Calendario (vista mensile) e Profilo (preferenze tattiche dichiarate dal
  giocatore, visibili allo staff in PlayerDetail).
- Dashboard: countdown prossima partita, griglia individuale rosa con stato colorato, widget
  carico settimanale (RPE medio per seduta).
- Trainings: vista settimana alternativa alla lista.
- MatchStats: vista rapida tabellare per inserimento statistiche.
- Sostituiti tutti i window.print() con PDF brandizzati: MatchDay, MatchConvocation, PostMatch,
  Calendar (nuovo generateWeekCalendarPDF.js), SetPlays (nuovo generateSetPlaysPDF.js — incorpora
  solo i diagrammi caricati come immagine, non gli snapshot della lavagna tattica).
- Bug fix verificati a runtime con login reale:
  - wellness.js: isSupabaseConfigured usato come funzione invece di booleano (crash runtime).
  - Auth.jsx: welcome email falliva sempre (401) per mancanza di Authorization Bearer.
  - JoinTeam.jsx: copy "workspace/collaborare" sostituita con testo neutro per inviti player/staff.
  - auth.js: loop infinito di retry su invite_token già fallito (richiesta accept-team-invite
    ripetuta a ogni mount/refresh) — ora il token fallito viene marcato e ignorato.
  - Calendar.jsx: WeekView confrontava `new Date(e.date)` (mezzanotte UTC) con `weekStart/weekEnd`
    che conservavano l'ora corrente invece di essere normalizzati a mezzanotte — gli eventi di
    OGGI venivano scartati dal filtro ogni volta che l'ora locale era passata la mezzanotte
    (sempre). Riprodotto dal vivo con account staff reale: il training veniva salvato in
    localStorage ma non appariva mai nella UI. Fix: confronto a stringhe YYYY-MM-DD invece di
    Date object, applicato anche a isToday/isPast (stesso bug) e al todayKey di MonthView (che
    usava toISOString(), UTC).

## Verifiche fatte con account owner reale (sessione successiva)
- Dashboard rosterStatus → **RosterGrid confermato visivamente** con i 23 giocatori reali del
  team: contatori aggregati + griglia individuale con pallini verdi e nomi, "+11 altri" expand.
  Funziona perfettamente.
- Dashboard weeklyLoad → si nasconde correttamente quando non ci sono sedute con RPE registrato
  (comportamento by design, non un bug — torna visibile non appena esistono dati RPE).
- Dashboard kpis e nextEvent (ramo seduta, non-partita) → confermati funzionanti senza errori.
- Tutti i widget Dashboard erano disattivati nelle impostazioni di questo team (pre-esistente,
  non causato da queste modifiche) — ora riattivati Rosa/KPI/Carico settimanale su richiesta
  dell'utente. Nota tecnica: `dashboardWidgets: settings.dashboardWidgets || {defaults}` in
  helpers.js fa merge "tutto o niente" — un team con `dashboardWidgets` già salvato PRIMA
  dell'aggiunta di `weeklyLoad` non riceve la nuova chiave finché non si modifica almeno un
  widget da UI (che salva l'intero oggetto con merge completo). Comportamento accettabile ma
  da tenere a mente per eventuali futuri nuovi widget.
- NextMatchCard con countdown → NON verificabile, zero partite (`type: "Partita"`) esistenti
  nel team; esiste solo una seduta futura (03/08/2026), che attiva il ramo generico "Prossimo
  evento" (verificato, nessun crash) ma non la card con countdown/RSVP badge.

## Sessione successiva — fix aggiuntivi (tutti verificati live e deployati)
- **NextMatchCard countdown**: confermato funzionante con le partite reali del team (Triangolare
  11-13/08, semifinali, finale) — mostra "N giorni ALLA PARTITA" correttamente.
- **Dashboard alert sempre verso /players**: `getCoachAlerts()` mescola alert di giocatori, partite
  e sedute, ma ogni alert/pulsante "Controlla alert" portava sempre a `/players` a prescindere dal
  tipo. Aggiunto un campo `path` per ogni alert (player→/players, fisico→/physical-tests,
  partita→/match-day/:id, seduta→/trainings); ogni riga alert ora è cliccabile verso la pagina
  giusta. Stessa cosa per `getMatchOperationalAlerts` (checklist pre-gara).
- **Calendario — campo Orario**: aggiunto sia al modal "Modifica evento" sia al form rapido
  "+ Aggiungi" (compatto, accanto al titolo). Mostrato inline nelle card di WeekView e MonthView.
- **Calendario — vista Mese/Settimana non sincronizzate**: passare da Mese a Settimana (e
  viceversa) ora mantiene lo stesso periodo visualizzato invece di tornare sempre a oggi.
  `weekOffset` è stato spostato dal componente `WeekView` al padre `Calendar`, con conversione
  bidirezionale tramite `weekOffsetForDate`/`monthDateForWeekOffset`.
- **AttendanceRegister — assenze pianificate**: `getDefaultStatus()` ora controlla anche
  `player.absences` (ferie/permessi con range di date dalla scheda giocatore), non solo
  `player.status`. Se la data della seduta cade in un'assenza dichiarata, lo stato di default è
  "Permesso" invece di "Presente".
- **AttendanceRegister — RPE auto-dichiarato**: l'RPE che il giocatore inserisce dal portale
  (tabella Supabase `session_rpe`, già usata da `RpeMatrix.jsx`) ora viene pre-compilato
  nell'input del registro presenze (bordo viola = valore del giocatore, modificabile dal mister).
  Le statistiche di carico/media usano lo stesso valore effettivo (manuale se presente, altrimenti
  auto-dichiarato).

## ⚠️ Deploy automatico GitHub → Vercel era rotto
Scoperto che i push su `main` non triggeravano deploy automatici su Vercel (ultimo deploy
"naturale" risalente a 22h prima, nonostante diversi push nel mezzo) — il repo risultava
"connesso" via `vercel git connect` ma il webhook non funzionava. Fix applicato: disconnect +
reconnect (`npx vercel git disconnect` poi `npx vercel git connect`) per forzare Vercel a
ricreare il webhook GitHub da zero. **Da verificare nella prossima sessione**: il prossimo push
su main triggera un deploy automatico senza bisogno di `npx vercel --prod` manuale? Se NO,
controllare dalla dashboard Vercel (Settings → Git) se la "Production Branch" è impostata su
`main` e se ci sono errori nelle "Deployment Webhooks" lato GitHub (repo Settings → Webhooks).
Nota: esiste anche un secondo progetto Vercel separato, `calciolab-team-manager-32xp` — non
collegato al dominio app.calciolab.org, probabilmente da ignorare/pulire ma non investigato.

## Problemi noti NON risolti (richiedono follow-up)

### 1. Account ricky.bologna@hotmail.it non collegato a un giocatore
Verificato via query diretta: `player_accounts` non ha nessuna riga per questo
auth_user_id + team_id nel database di produzione. Non è un bug di codice — va
ricreato l'invito/collegamento lato Supabase (Players → scheda giocatore → invita al portale),
oppure va chiarito a quale team questo account dovrebbe appartenere.

### 2. Bundle PDF non lazy-loaded (Task 5 della review Codex, mai eseguita)
`vendor-pdf` pesa 629 kB e viene scaricato anche da chi non esporta mai un PDF, perché i
generatori (generateMatchDayPDF, generateMatchReportPDF, generateWeekCalendarPDF,
generateSetPlaysPDF, generateDistintaPDF, generateMatchPackagePDF) sono importati staticamente
nei file pagina. Andrebbero convertiti in `import()` dinamico dentro l'handler del click:
```js
async function handleExport() {
  const { generateMatchDayPDF } = await import("../utils/generateMatchDayPDF");
  generateMatchDayPDF({ match, players, appSettings });
}
```
File coinvolti: MatchDay.jsx, MatchConvocation.jsx, PostMatch.jsx, Calendar.jsx, SetPlays.jsx.
Stessa logica si potrebbe applicare a vendor-charts (404 kB, usato solo in pagine statistiche)
e al catalogo FP5 (700 kB) se non già lazy.

### 3. Verifica end-to-end ancora incompleta su alcuni punti
Con l'account owner reale sono stati verificati con successo: Dashboard rosterStatus/kpis/
nextEvent (vedi sezione sopra), il fix del bug Calendar. Restano da verificare quando ci sono
i dati giusti:
- I 5 PDF generator (serve almeno una partita/seduta salvata per generarne uno e controllare
  che il file scaricato sia corretto, non solo che il click non vada in errore)
- Tab Calendario/Profilo del portale giocatore (richiede un account player collegato — vedi punto 1)
- NextMatchCard con countdown/RSVP (serve una partita futura, `type: "Partita"`, salvata)
- Trainings vista settimana, MatchStats vista rapida (non ancora testate con account owner)
Quando ci sono dati reali, rifare un giro live con preview_start + login, cliccando ogni
pulsante "Esporta PDF" e controllando la console.

## Possibili prossimi passi (da discutere con l'utente, non da implementare senza conferma)
- Lazy-loading dei generatori PDF (punto 2 sopra) — quick win, basso rischio.
- Statistiche squadra: la pagina Statistics.jsx esiste già ed è completa (leaderboard, carico
  preparatore, confronto giocatori) — verificare se serve renderla più scopribile (link da
  Dashboard?) prima di aggiungere altro.
- Messaggistica player→staff, calendario visivo per lo staff (idee scartate o non ancora
  implementate, valutare interesse).
- i18n: confermato (non solo ipotizzato) — le nuove sezioni aggiunte in questa sessione
  (tab Calendario/Profilo in PlayerPortal.jsx, widget weeklyLoad in Dashboard.jsx, label PDF in
  SetPlays.jsx/Calendar.jsx) usano stringhe italiane hardcoded, non `t()`. Questo è coerente con
  uno stile già presente in quei file prima delle mie modifiche (es. "Caricamento..." a riga 165
  di PlayerPortal.jsx era già hardcoded), quindi non è una regressione introdotta oggi — ma se
  l'app deve davvero supportare l'inglese, va pianificato un giro di i18n-izzazione più ampio,
  non solo sulle parti nuove.

## Istruzioni d'uso di questo prompt
Incolla questo file (o il suo contenuto) all'inizio di una nuova conversazione con Claude per
dargli il contesto necessario senza dover ripetere la cronologia. Aggiorna o elimina le sezioni
una volta risolte.
