# Quadro → correzione di una presenza

Il dettaglio allenamento di un giocatore nel Quadro apre ora la seduta con il suo ID nella query `player`. Il registro mostra direttamente quella riga e mantiene il contesto di ritorno del Quadro. La scelta non si basa sul nome: gli omonimi restano distinti. Una selezione non valida mostra uno stato esplicito, senza scegliere un altro giocatore.

«Mostra tutti» rimuove il filtro e conserva il ritorno. Il registro completo permette di cercare per nome e cognome, anche con parole in ordine diverso, maiuscole e accenti. La ricerca non cambia i totali dell’intera seduta, come indicato accanto al filtro. Cambiare lo stato non nasconde la riga selezionata. Autorizzazioni e regole di conteggio restano invariate.

Nella vista settimanale il riepilogo non mostra più l’ordinamento per minuti, applicabile solo alle quattro settimane; la preferenza viene conservata per il ritorno a tale vista.

## Prova browser locale

17 novembre 2026, Supabase 127.0.0.1:54321, frontend 127.0.0.1:4186. Account QA esistente, AS Collaudo, 25 profili (24 attivi nella seduta, un trasferito). Nessuna scrittura in produzione, migrazione o operazione Stripe.

- Home → Quadro → settimana 9–15 novembre → Ultime 4 settimane (19 ottobre–15 novembre) → minuti crescenti → Solo da completare.
- Luca Della Valle Castiglioni → dettaglio del 10 novembre: una sola riga nel registro; conteggi globali ancora 24 giocatori, 21 presenti, 1 assente, 1 infortunato e 1 stato esplicitamente da confermare.
- Modifica fittizia in Assente, conferma Salvato online, ricarica: stato conservato e giocatore ancora selezionato. I totali diventano 21 presenti, 2 assenti, 1 infortunato.
- Mostra tutti: 24 righe. Ricerca `ROVERE bianchi`: solo Luca Bianchi della Rovere. Ricerca inesistente: messaggio vuoto; cancellazione ricerca: tutte le righe.
- Ritorno al Quadro: URL identico, comprese settimana, vista, filtro e ordine. Il giocatore corretto esce da Solo da completare; togliendo il filtro mostra 2/3 presenze e 1 assenza, con 65 minuti invariati.
- Ripristinato Da confermare intenzionale della fixture, attesa conferma online. Tornando a Settimana: 1 presenza e 1 da confermare per quel giocatore; Bianchi 2 presenze; infortuni conservati.
- Desktop 1280 px: documento 1270 px; mobile 390 px: documento 380 px. Nessun overflow orizzontale. Nome lungo e azioni leggibili nel registro.

Screenshot in outputs del workspace: `calciolab-presenze-singolo-desktop.jpg`, `calciolab-presenze-singolo-mobile.jpg`. La prova su telefoni fisici resta separata.

## Controlli automatici

`npm run test`, `npm run lint`, `npm run build` e `git diff --check` superati sul cambiamento principale. Dopo la correzione dell’etichetta settimanale, rieseguiti i test di rendering pertinenti e lint/build finali.

Le regressioni verificano: ID e omonimi, ricerca normalizzata, riferimento non valido, una sola riga, totale seduta invariato, permessi in lettura, codifica degli ID nei link e assenza dell’etichetta di ordinamento nella Settimana. Nessuna migrazione necessaria; rollback tramite frontend precedente.
