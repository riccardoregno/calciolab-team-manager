# Rosa, allenamenti e partite — 21 ottobre 2026

La Rosa usava il riepilogo player_stats, distinto dai dati delle gare, e mostrava i gol segnati anche ai portieri. Ora griglia ed elenco usano gli stessi totali del campionato della pagina Statistiche: minuti, presenze, cartellini e voti derivano dalle righe giocatore/gara, con il fallback locale previsto dagli helper condivisi. I portieri mostrano Gol subiti; i dati sconosciuti restano —. Caricamento ed errori sono espliciti, con recupero e aggiornamento al ritorno sulla pagina, alla riconnessione e dopo un salvataggio del tabellino. Il cambio squadra non riutilizza i risultati della squadra precedente.

Il Centro partite apre un solo editor delle statistiche: il tabellino completo, con gol subiti, bozze e gestione degli errori. Rimosso il secondo inserimento rapido che ignorava gli errori di lettura/scrittura e poteva azzerare valori mancanti. Risultati negativi, decimali o compilati a metà vengono rifiutati; entrambi vuoti consentono di rimuovere il risultato. Le azioni di conferma e chiusura hanno un'area di almeno 44 pixel e i campi punteggio hanno etichette accessibili.

Ricerca aggiunta agli archivi partite e sedute; supporta accenti e parole in ordine diverso, con Esc per cancellare. La ricerca partite comprende anche la gara in evidenza, senza duplicarla, e i contatori seguono i risultati. La ricerca delle sedute vale per elenco e settimana. La Rosa e la libreria esercizi usano la stessa normalizzazione. La prossima seduta usa la data locale ed esclude quelle già effettuate. L'elenco giocatori dispone le statistiche su tre colonne nei telefoni.

## Verifica

- Test automatici, ESLint, build web e mobile superati. Aggiunti casi di regressione per punteggi incompleti, negativi, decimali, non numerici e zero-zero.
- Browser con dati fittizi isolati: ricerca Rossi/Nicolò senza accento e parole invertite; portiere con 1 presenza/90 minuti/1 gol subito in entrambe le viste; errore di connessione con segnaposto e recupero; risultato incompleto bloccato senza modificare la gara; apertura del tabellino; ricerca sedute in elenco/settimana, stato vuoto ed Esc.
- Nessun overflow della pagina a 320 pixel su Rosa elenco, Centro partite e Allenamenti; Rosa griglia controllata anche a 390 pixel. Nessun errore console rilevato nella verifica locale finale.
- Sincronizzazione Capacitor Android/iOS superata. Compilazione Android release APK/AAB superata (344 task); firme verificate con apksigner/jarsigner. L'AAB conserva gli avvisi di certificato autofirmato e timestamp assente riportati nel rapporto locale; la verifica non certifica l'accettazione dello store.

## Limiti

Nessun caricamento negli store, secondo l'indicazione dell'utente. Versione Android 1.1.0, codice 2: controllare il prossimo codice disponibile prima dell'upload. Nessun collaudo su dispositivi fisici. Per l'archivio iOS occorrono Mac/Xcode e la configurazione Apple. I test non hanno scritto statistiche o presenze reali. Questa verifica riguarda i flussi elencati e non costituisce una certificazione dell'intera applicazione.