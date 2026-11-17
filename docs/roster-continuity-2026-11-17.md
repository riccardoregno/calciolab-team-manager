# Confronto presenze e minuti

La Home propone «Confronta presenze e minuti», che apre il Quadro nelle Ultime 4 settimane con `rosterSort=continuity`. L’apertura ordinaria del Quadro mantiene Settimana come vista predefinita.

L’ordinamento usa prima la quota di sedute frequentate nel periodo, in ordine decrescente, e poi i minuti registrati in ordine crescente a parità di quota. Non applica soglie o giudizi tecnici automatici. Recupero e Parziale seguono la regola di partecipazione già usata nel Quadro; i rapporti restano visibili in ogni riga. Settimana, squadra e contesto di ritorno seguono i collegamenti esistenti.

Il confronto principale richiede almeno una seduta e minutaggi completi. Presenze esplicitamente da confermare, minutaggi mancanti e convocazioni non verificabili sono separati in «Dati da completare o verificare». I non convocati restano distinti da zero minuti registrati. Chi ha gare ma nessuna seduta è mostrato separatamente. Nei periodi senza gare, o durante caricamento/errore dei minuti, non viene proposto un gruppo di dati completi per il confronto.

L’ordinamento precedente per minuti mantiene le proprie regole. La nuova vista non modifica presenze salvate, default da calendario, disponibilità, statistiche o dati storici. Nessuna migrazione richiesta.

## Controlli automatici

- `npm run test`: passato, incluse regressioni su stagioni, presenze da calendario, sincronizzazione e rendering.
- `npm run lint`, `npm run build`, `git diff --check`: passati.
- Test mirati: quote equivalenti con numero diverso di sedute, parità di presenze, minuti crescenti, zero registrato, dati mancanti, nessuna seduta, non convocati e immutabilità dei dati.
- Rendering: accesso dalla Home; tre giocatori con poche presenze e pochi minuti, molte presenze e pochi minuti, minutaggio incompleto; periodo senza gare.

## Collaudo browser completato

17 novembre 2026, AS Collaudo con 25 profili fittizi, solo Supabase locale. Nessuna modifica ai dati applicativi durante questo collaudo.

- Home → Confronta presenze e minuti apre Ultime 4 settimane e Continuità e minuti. L’apertura normale del Quadro resta settimanale.
- De Santis: 3/3 presenze e 0 min non impiegato, primo nel gruppo completo. Rossi: 2/3 presenze e 30 minuti; Ferrari: 0/3 e tre infortuni, dopo chi ha continuità maggiore.
- Bianchi: 3/3 presenze e 0 minuti registrati con una gara da completare, nel gruppo incompleto. Della Valle: 2/3 e uno stato intenzionalmente da confermare, separato anche se il minutaggio di 65 minuti è noto.
- Minuti crescenti mantiene la regola precedente: Della Valle torna nel gruppo dei minutaggi completi; Nome ripristina l’ordine alfabetico.
- Dal dettaglio di Bianchi si apre soltanto la sua riga nella seduta. Il ritorno conserva periodo, ordinamento e Solo da completare. Con settimana esplicita l’URL coincide esattamente; partendo dal periodo predefinito viene fissata la stessa settimana nell’URL.
- Settimana 9–15 novembre: Bianchi 2 presenze e zero minuti registrati; tornando alle quattro settimane ricompaiono 3/3 e la gara incompleta precedente. La preferenza Continuità e minuti viene conservata e applicata soltanto alle quattro settimane.
- Periodo 14 settembre–11 ottobre: nessuna seduta e nessuna gara, nessun gruppo presentato come confronto completo.
- Desktop 1280 px/documento 1270; mobile 390 px/documento 380. Nome lungo, selettore e gruppi leggibili senza overflow orizzontale. Risolta una compressione dei filtri desktop: le spiegazioni lunghe ora occupano tutta la riga della griglia.

Screenshot nel workspace outputs: `calciolab-continuita-home-desktop.jpg`, `calciolab-continuita-home-mobile.jpg`, `calciolab-continuita-quadro-desktop.jpg`, `calciolab-continuita-quadro-mobile.jpg`, `calciolab-continuita-incompleti-mobile.jpg`.

## Ripetizione della prova

La porta locale 4186 risultava non avviata al primo tentativo. Usare lo script del workspace `outputs/calciolab-avvia-registro-locale.ps1`, che avvia soltanto il frontend con la configurazione pubblica del Supabase locale, e l’account QA già esistente.

Dopo il riavvio il server rispondeva ma il browser rimaneva bianco: le richieste dei moduli ottimizzati restituivano 504 con la vecchia versione della cache. Il launcher locale ora usa `node_modules/.vite-qa-browser`, separata dalla cache dei test, e rigenera le dipendenze all’avvio. Questa modifica riguarda soltanto lo strumento di collaudo del workspace.

1. Home → Confronta presenze e minuti. Verificare Ultime 4 settimane e il nuovo ordinamento.
2. A 390 px controllare filtro, spiegazione, rapporti e gruppi senza overflow orizzontale; confrontare con desktop.
3. Nella fixture AS Collaudo verificare De Santis (quota piena e zero minuti registrati), Rossi (un’assenza), Bianchi (minutaggio incompleto) e Della Valle (presenza esplicitamente da confermare).
4. Aprire un evento di un giocatore e tornare: settimana, vista e ordinamento devono restare identici.
5. Cambiare Settimana e poi tornare alle quattro settimane: etichetta e ordinamento devono seguire la vista. Provare Nome e Minuti crescenti.
6. Cambiare settimana fino a un periodo senza gare: mostrare Nessuna gara, senza presentare il minutaggio come zero.

Non usare dati di produzione per le prove. Il test sui telefoni fisici resta separato dalla simulazione a 390 px.
