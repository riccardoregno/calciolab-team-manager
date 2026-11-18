# Orario della seduta

Il modulo Sedute permette ora di inserire o cancellare l’orario insieme a titolo, data e durata. Il campo è facoltativo: una seduta senza orario resta valida e la Home indica «Orario da definire». Il testo di aiuto è associato al campo, senza appesantirne il nome accessibile.

La lettura riusa `getAgendaEventTime`: `time`, `startTime` e `start_time` restano compatibili. L’editor carica l’orario esistente, compresi i valori storici con ore a una cifra o secondi. Il salvataggio usa il campo canonico `time` con precisione al minuto; soltanto nella seduta modificata azzera a null i due alias storici. In questo modo la cancellazione non fa riapparire un vecchio valore alternativo. Nessuna riscrittura collettiva o migrazione.

L’elenco Sedute usa la stessa lettura della Home. Il registro presenze mostra lo stesso orario e la stessa durata pianificata; prima il sottotitolo ricavava la durata soltanto dagli esercizi e poteva omettere una durata manuale. Il calendario legge gli orari storici delle sedute e applica la stessa normalizzazione quando l’utente li modifica o li cancella. Il ramo di modifica delle partite resta invariato.

## Browser locale

18 novembre 2026, frontend 127.0.0.1:4186 e Supabase 127.0.0.1:54321. Account QA, squadra AS Collaudo e seduta fittizia già creata nel precedente collaudo (`session-1b897a0d-30c2-4db3-af37-93d555e081f1`). La fixture è stata spostata al 19 novembre per mantenerla futura.

- Piano della seduta: impostato 19:30 e conservata la durata di 75 minuti; attesa Salvato online. Riaprendo il piano il valore è presente.
- Home dopo ricarica: 19 novembre, 19:30 e 75 min previsti. Il registro della stessa seduta mostra 19:30 e 75 min.
- Cancellato l’orario dal modulo, salvato online e ricaricato: la Home mostra Orario da definire; il valore precedente non ritorna.
- Dal calendario della settimana 16–22 novembre, Modifica evento sulla sola seduta QA: impostato 20:15. Dopo salvataggio online e ricarica il calendario e la Home mostrano 20:15.
- L’editor Sedute riaperto dalla Home mostra 20:15 e 75 minuti. Su mobile anche la finestra di modifica del calendario mostra gli stessi dati; chiusa senza ulteriori modifiche.
- Desktop 1280 px/documento 1270; mobile 390 px/documento 380. Campo e suggerimento leggibili, finestra del calendario entro lo schermo, nessun overflow orizzontale.

La fixture rimane soltanto nel Supabase locale con data 19 novembre 2026 e orario finale 20:15. Non sono state modificate presenze precedenti o dati reali. La prova sui telefoni fisici resta separata.

Screenshot nel workspace outputs: `calciolab-orario-seduta-desktop.jpg`, `calciolab-orario-seduta-mobile.jpg`, `calciolab-orario-calendario-mobile.jpg`.

## Controlli

`npm run test`, `npm run lint`, `npm run build` e `git diff --check`. Dopo la rifinitura dell’accessibilità, ripetuti rendering, regressione orari, lint e build.

Controlli mirati: caricamento di orari legacy nell’editor, visualizzazione in lettura, cancellazione senza recupero degli alias dopo round trip JSON, conservazione di presenze e blocchi, record originale immutato. Una seduta di 75 minuti alle 19:30 resta in corso alle 20:44 e risulta terminata alle 20:45; senza orario resta da determinare nello stesso giorno e segue la regola da calendario dal giorno successivo. La logica condivisa delle presenze non è stata cambiata.

## Rilascio

Solo frontend, senza migrazioni. Il push del candidato include i precedenti commit locali per confronto continuità/minuti e scheda Prossima seduta. Rollback del frontend al commit precedente se necessario; nessun intervento SQL richiesto.
