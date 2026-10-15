# Audit desktop e mobile — 15 ottobre 2026

## Esito e limiti

Web e app Capacitor usano gli stessi componenti React (vite.config.js differenzia la base degli asset). Questo riduce le divergenze funzionali, ma non certifica il layout su ogni dispositivo.

Inventario statico di 48 file pagina e controllo approfondito dei componenti condivisi. Nessuna certificazione visiva: il browser integrato non raggiunge il server locale e Chrome non è disponibile. Non sono stati eseguiti test su dispositivi iOS/Android né pubblicazioni.

## Correzioni implementate

- Catalogo unico di navigazione per percorsi, icone e ruoli: Sidebar e MobileBottomNav leggono la stessa fonte. AI, generatore squadre e portale giocatore sono raggiungibili anche dalla sidebar; onboarding e rosa Juniores anche dal menu mobile.
- Colonne della bottom bar proporzionate alle voci visibili per ruolo; menu a tre colonne preservato anche sotto 640 px.
- Griglia mensile del calendario preservata a sette colonne sotto 640 px.
- MetricStrip a due colonne su telefono, con variante di scorrimento esistente preservata; il minimo della griglia non supera il contenitore.
- Titoli PageHeader coerenti su tablet/telefono e titoli ActionBar leggibili senza troncamento obbligatorio.
- Safe area su tutti i lati del contenuto e della bottom bar, altezza dinamica del viewport per contenuto e finestre.
- Modal e ConfirmDialog condividono la stessa superficie; portale nel body sopra la navigazione; conferme compatte.
- Hook comune per focus iniziale, Tab/Shift+Tab, Esc, ripristino del focus e scroll lock con finestre sovrapposte. Anche il menu mobile lo utilizza.
- Hook responsive basato su useSyncExternalStore; autenticazione riusa lo stesso hook.
- Campi del gestionale a 16 px sui telefoni per evitare zoom involontario sui campi; ricerca con nome accessibile e pulsante di cancellazione da 44 px.
- Button preserva la classe della variante anche con className personalizzato; rispetto della preferenza per movimento ridotto.

## Verifiche ripetibili

- npm test: test esistenti di logica e persistenza locale, più test di parità dei menu per sette ruoli, onboarding completato/non completato, e regole Juniores.
- npm run lint: analisi statica.
- npm run build e npm run build:mobile: compilazione dei due target e generazione PWA. Queste compilazioni non equivalgono a test nativi o visivi.

## Lavoro successivo prioritario

1. Verifica visiva autenticata a 360, 390, 640, 768, 1024 e 1440 px; includere landscape, tastiera aperta, nomi lunghi, dati vuoti e molte righe. Provare anche il cambio di dimensione con menu/finestre aperti.
2. Sostituire gradualmente il selettore globale CSS basato su style*="grid-template-columns" con classi esplicite per griglie. Le eccezioni corrette qui non eliminano ogni possibile conflitto nelle altre pagine.
3. Estrarre da Trainings, TacticalBoard, Dashboard, Statistics e PlayerPortal le sezioni indipendenti e i relativi hook. Sono file grandi: compattare righe senza separare responsabilità rende più difficile verificarli.
4. Misurare le prestazioni con dati realistici prima di aggiungere virtualizzazione o modificare i bundle. Grafici, PDF e catalogo esercizi sono già suddivisi in chunk: mantenere il caricamento differito e verificare le richieste effettive.
5. Verificare sul dispositivo safe area, tastiera, pulsante Indietro Android, esportazione PDF e drag-and-drop delle lavagne. Aggiungere poi regressioni browser con screenshot sui flussi principali.

## Inventario statico delle pagine

Le colonne seguenti indicano solo segnali presenti nel sorgente. L'assenza di useIsMobile o @media nel file NON implica un errore: una pagina può usare componenti condivisi o layout fluidi. La loro presenza NON dimostra che la schermata sia corretta.

| Pagina | PageHeader condiviso | Hook responsive o media query nel file | Griglie dichiarate nel file |
| --- | --- | --- | --- |
| AiSessionBuilder.jsx | Sì | Sì | 3 |
| AttendanceRegister.jsx | Sì | Sì | 2 |
| Auth.jsx | No | Sì | 4 |
| Availability.jsx | Sì | No | 5 |
| Calendar.jsx | Sì | Sì | 7 |
| ClubSettings.jsx | Sì | Sì | 5 |
| CoachSettings.jsx | Sì | Sì | 6 |
| Dashboard.jsx | Sì | Sì | 20 |
| ExerciseLibrary.jsx | Sì | Sì | 13 |
| Exercises.jsx | Sì | No | 2 |
| ExportCenter.jsx | Sì | Sì | 4 |
| GpsLoad.jsx | Sì | No | 1 |
| JoinTeam.jsx | No | No | 0 |
| Landing.jsx | No | Sì | 6 |
| MatchConvocation.jsx | Sì | Sì | 9 |
| MatchDay.jsx | Sì | Sì | 2 |
| Matches.jsx | Sì | Sì | 10 |
| MatchLive.jsx | Sì | Sì | 2 |
| MatchStats.jsx | Sì | No | 5 |
| Microcycle.jsx | Sì | Sì | 6 |
| NotFound.jsx | No | No | 0 |
| Onboarding.jsx | No | No | 5 |
| Opponents.jsx | Sì | Sì | 5 |
| PhysicalTests.jsx | Sì | Sì | 5 |
| PhysicalWorkouts.jsx | Sì | Sì | 6 |
| PlayerComparison.jsx | Sì | No | 4 |
| PlayerDetail.jsx | Sì | Sì | 4 |
| PlayerPortal.jsx | Sì | Sì | 10 |
| Players.jsx | Sì | Sì | 3 |
| PostMatch.jsx | Sì | Sì | 8 |
| Premium.jsx | Sì | Sì | 10 |
| Privacy.jsx | No | No | 0 |
| ResetPassword.jsx | No | No | 0 |
| Rsvp.jsx | No | No | 0 |
| SeasonGoals.jsx | Sì | No | 2 |
| SessionAttendance.jsx | Sì | No | 2 |
| SessionGenerator.jsx | Sì | Sì | 1 |
| Sessions.jsx | No | No | 0 |
| SetPlays.jsx | Sì | Sì | 8 |
| Settings.jsx | Sì | No | 0 |
| Sponsors.jsx | Sì | Sì | 8 |
| StaffChat.jsx | Sì | Sì | 0 |
| StaffTasks.jsx | Sì | Sì | 11 |
| Statistics.jsx | Sì | Sì | 16 |
| TacticalBoard.jsx | Sì | Sì | 10 |
| TeamGenerator.jsx | Sì | Sì | 2 |
| Terms.jsx | No | No | 0 |
| Trainings.jsx | Sì | Sì | 10 |

## Secondo intervento — compattazione e operatività

- AppCard usa un padding predefinito di 16 px su telefono e 22 px su desktop; padding espliciti e noPadding restano supportati. Titoli e sottotitoli gestiscono testi lunghi. ActionBar distribuisce le azioni su righe utilizzabili su telefono.
- Classe condivisa cl-fluid-grid per disponibilità, schede delle presenze e modulo GPS: si adatta alla larghezza del contenitore, evitando minimi più larghi della scheda e il selettore globale sugli stili inline.
- Statistiche partita: preservate matrice, contatori e controlli di scorrimento; colonna giocatore più stretta su mobile; barra Salva sopra la navigazione inferiore. Su telefono/tablet i contatori offrono campi numerici, mantenendo i comandi più/meno su desktop; nomi accessibili distinguono giocatore e partita.
- Navigazione delle fasi partita con link semantici, fase attiva annunciata e disposizione a due colonne su telefono.
- Confronto giocatori: selettori impilati su telefono, etichette associate ai campi e metriche senza obbligo di testo su una sola riga.
- Notifiche adattate alla larghezza del telefono e spostate in alto per evitare la sovrapposizione con navigazione e salvataggio.
- Presenze: conferma multipla nel componente condiviso, stato selezionato annunciato e campo RPE con etichetta accessibile.

Validazione del secondo intervento: npm test, npm run lint, npm run build e npm run build:mobile. Resta da eseguire la verifica visiva interattiva sui dispositivi; le build non la sostituiscono.
