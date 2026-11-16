# Home → presenze → Quadro

## Comportamento

Aprendo dalla Home le presenze da confermare, assegnare uno stato non rimuove più immediatamente la riga. Il giocatore resta modificabile fino alla selezione di «Aggiorna elenco da confermare». I contatori seguono gli stati registrati; mantenere una riga visibile non la mantiene nel conteggio dei dati mancanti. Passando a Mostra tutti o a un'altra seduta non vengono riutilizzate le righe trattenute della compilazione precedente.

Aggiornamento della regola di conteggio: una seduta già svolta nel calendario conta come presenza per chi era a disposizione, salvo eccezioni individuali o indisponibilità nel periodo. Non serve registrare retroattivamente le presenze predefinite. La conferma collettiva conserva le eccezioni e i «Da confermare» salvati intenzionalmente; non viene più proposta come operazione necessaria per una seduta passata. I controlli riportati sotto descrivono il collaudo precedente alla correzione; la regressione aggiornata è in `calendar-attendance-2026-11-16.md`.

Nel Quadro il pannello completo dei filtri scorre con la pagina. Rimane fisso un riepilogo più piccolo di squadra, periodo, vista e filtri attivi. Il pannello precedente copriva i link agli eventi a 390 px e impediva il tocco. Il nuovo riepilogo libera quei collegamenti.

## Verifiche eseguite

Collaudo browser del 15 novembre, conclusione del rilascio il 16 novembre 2026. Solo Supabase locale su 127.0.0.1:54321 e squadra QA fittizia di 25 profili; nessuna scrittura in produzione o modifica Stripe.

- Home → Completa presenze: 2 giocatori da confermare, un assente e un infortunato nella seduta già svolta.
- Presente salvato: 2 → 1 da confermare, riga ancora visibile e correggibile, campo RPE disponibile. Attesa della conferma Salvato online.
- Correzione in Assente e conferma collettiva: confermato soltanto il giocatore senza stato; assenza conservata. Totali: 21 presenti, 2 assenti, 1 infortunato, nessun dato da confermare per quella seduta. Righe ancora visibili fino ad Aggiorna elenco.
- Quadro settimanale: apertura della settimana della seduta, senza cambiare squadra. I dati di altre sedute incomplete restano segnalati separatamente.
- Ultime 4 settimane → Solo da completare → Minuti crescenti → dettaglio giocatore → seduta → Torna al Quadro: URL identico al ritorno, con settimana, vista, filtro e ordine conservati.
- A 390 px: larghezza documento 380 px, riepilogo fisso alto 103 px; il collegamento prima coperto si apre. Desktop: documento 1270 px con viewport 1280 px. Nessuno scorrimento orizzontale rilevato.
- Ripristinati i due stati originali della fixture (Da confermare salvato e nessun record), senza alterare le altre presenze.
- `npm run test`, `npm run lint`, `npm run build`, `git diff --check`: passati. Controllo mirato: `node scripts/test-daily-workflow.mjs`.

Il test della lista verifica che una riga appena risolta rimanga disponibile, che l'aggiornamento esplicito la rimuova, che i giocatori non eleggibili non riappaiano e che le righe non passino a un'altra seduta. Restano coperti conferma collettiva, eccezioni, trasferimenti e cataloghi italiano/inglese.

## Controllo dopo il deploy

Aprire Home → Completa presenze su una seduta fittizia. Cambiare uno stato, attendere Salvato online, controllare che la riga sia ancora modificabile e premere Aggiorna elenco da confermare. Dal Quadro aprire un evento e tornare indietro: periodo e filtri devono coincidere. Non usare dati reali per queste prove di scrittura.

La prova sui telefoni fisici Safari/Chrome resta distinta dalla simulazione a 390 px. Nessuna migrazione richiesta; per il rollback basta il frontend precedente.
