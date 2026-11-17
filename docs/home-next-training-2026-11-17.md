# Home → prossima seduta

La Home espone una scheda «Prossima seduta» subito dopo le azioni quotidiane. Prima la prossima seduta era calcolata dal modello e richiamata soltanto da un collegamento generico in fondo alla pagina. La nuova scheda mostra titolo, data, orario e durata previsti, e permette di aprire direttamente il piano esistente e le presenze della seduta.

Lo stato vuoto offre «Crea seduta» agli utenti che possono gestire i dati; usa il flusso già disponibile di Trainings. Gli utenti in lettura vedono archivio e presenze, senza azioni per creare o modificare il piano. Durante il caricamento non viene mostrato un calendario falsamente vuoto.

## Regole e compatibilità

- La selezione usa l’agenda condivisa, sul dataset della squadra e stagione già selezionate. Cerca un allenamento futuro non completato; riposo e riunioni restano eventi dell’agenda ma non diventano la prossima seduta.
- L’orario riconosce `time`, `startTime` e `start_time`, normalizza ore con una sola cifra e non sostituisce un orario mancante con mezzanotte. La durata riusa `getTrainingDuration`, inclusi blocchi, esercizi e durata pianificata.
- Data, orario o durata non vengono inventati: la scheda segnala Orario da definire e Durata da definire quando necessario.
- I link del piano riusano `editSessionId`; le presenze riusano la pagina esistente e il ritorno alla Dashboard. I controlli di modifica restano quelli delle pagine di destinazione.
- Nessuna nuova regola di presenze: le sedute future restano escluse dalle sedute svolte, e la scheda non genera richieste di conferma. Nessuna migrazione o scrittura in produzione.

## Collaudo browser locale

17 novembre 2026, frontend 127.0.0.1:4186, Supabase 127.0.0.1:54321, account QA e AS Collaudo con 25 profili fittizi. Prova su desktop e viewport 390 px.

1. Stato iniziale: nessuna seduta futura; Crea seduta apre direttamente l’editor.
2. Creata la seduta fittizia «QA Prossima seduta — costruzione e transizione della squadra», ID `session-1b897a0d-30c2-4db3-af37-93d555e081f1`, e verificata la data finale 18 novembre 2026 e la durata di 75 minuti dopo conferma Salvato online.
3. Home: titolo lungo leggibile, data corretta, Orario da definire (nessun orario salvato), 75 min previsti. La scheda resta presente dopo ricarica.
4. Apri piano della seduta apre Modifica seduta con titolo e data corretti; chiusura senza modifiche. Apri presenze della seduta apre l’ID corretto e mostra i 24 giocatori attivi, escludendo il trasferito.
5. Quadro di questa settimana apre 16–22 novembre: 0 sedute svolte e 0 gare. La nuova seduta futura non viene contata come presenza già effettuata e non incrementa le attività arretrate della Home.
6. Desktop: viewport 1280 px, documento 1270 px. Mobile: viewport 390 px, documento 380 px. Titolo e pulsanti leggibili, nessuno scorrimento orizzontale.

La fixture viene lasciata soltanto nell’ambiente locale per la revisione. Non sono state modificate le presenze precedenti. Il controllo su telefoni fisici resta separato.

Screenshot nel workspace outputs: `calciolab-prossima-seduta-vuoto-desktop.jpg`, `calciolab-prossima-seduta-desktop.jpg`, `calciolab-prossima-seduta-mobile.jpg`.

## Controlli automatici e rilascio

Regressioni mirate su orari legacy e invalidi, ordinamento cronologico, esclusione di eventi completati, riposo, riunioni e date invalide; immutabilità del dataset; rendering con piano e presenze, orario/durata mancanti, caricamento e accesso in lettura. Verificata la codifica degli ID nei link.

Comandi del candidato: `npm run test`, `npm run lint`, `npm run build`, `git diff --check`. Nessuna migrazione richiesta; rollback tramite frontend precedente. Il rilascio comprende anche il confronto presenze/minuti del commit locale precedente, se non ancora pubblicato.
