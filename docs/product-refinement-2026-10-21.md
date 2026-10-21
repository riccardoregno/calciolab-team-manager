# Gerarchia e usabilità web/mobile — 21 ottobre 2026

## Cambiamenti

- La dashboard presenta prima l'attività principale. Su desktop il riquadro dei promemoria la affianca; su telefono segue l'attività. Le preferenze di ordine e visibilità rimangono applicate. Se il riquadro principale è nascosto, i promemoria restano disponibili.
- Tre promemoria iniziali; il comando Mostra altre attività consente di consultare tutti gli altri, anche da tastiera. L'elenco esteso ha scorrimento proprio. Le attività non vengono più nascoste fino al completamento delle precedenti.
- Indicatore di sincronizzazione compatto in condizioni normali; errori e pulsante di recupero restano evidenti.
- Statistiche: filtri prima dei dati e scheda individuale subito sotto. Eliminata la scheda duplicata nella colonna laterale. Valori con icone coerenti, quattro colonne desktop e due su telefono; metriche portieri su due colonne con formattazione numerica italiana/inglese.
- Indicatori generali riutilizzano MetricStrip, già presente nelle altre pagine. I grafici si possono richiudere e sono inizialmente chiusi sui telefoni. La matrice minutaggi usa un pulsante con stato espanso e gestione della tastiera.
- Ricerca globale con etichetta accessibile, normalizzazione degli accenti ed Esc per cancellare. Le sedute aprono l'elemento cercato tramite editSessionId; le partite aprono direttamente la relativa pagina gara. I risultati esercizio mantengono il collegamento all'elenco esistente.
- Le regole CSS della scheda prioritaria sono circoscritte al contenitore e mantengono la precedenza anche con il caricamento differito delle pagine.

## Verifiche

- npm test e npm run lint superati dopo le modifiche JavaScript.
- Build web/mobile e sincronizzazione Capacitor Android/iOS eseguite; la firma dei pacchetti e il deploy sono documentati nel rapporto di rilascio locale.
- Nel browser, con dati fittizi e backend isolato: promemoria espansi/richiusi con Invio, tutte le attività raggiungibili, riquadro principale disabilitato e riattivato senza duplicare/perdere i promemoria.
- Griglie e assenza di overflow della pagina controllate a 320, 390, 768, 1024 e 1440 px. Scheda individuale e filtri su due colonne nei telefoni; metriche principali della squadra coerenti con le altre pagine.
- Grafici e matrice aperti/richiusi da tastiera. Ricerca seduta verificata con destinazione /trainings e stato editSessionId corretto; link gara e cancellazione con Esc verificati.
- Memoria locale indisponibile simulata: avviso e recupero ancora visibili; successivo ritorno a Salvato online dopo ripristino.

## Limiti

Le prove responsive nel browser non equivalgono a un collaudo su Android/iPhone fisici. La compilazione iOS richiede macOS/Xcode e configurazione Apple. Nessun caricamento negli store: l'utente ha richiesto di lasciare i pacchetti pronti. Non sono state alterate le statistiche o le presenze reali per eseguire i test.

## Caricamento delle statistiche

La scheda individuale indica esplicitamente il caricamento, con aria-busy e segnaposto al posto dei valori numerici. Verificata con risposta del backend ritardata: inizialmente nessun falso zero, poi valori corretti e aria-busy disattivato. Uscendo da una squadra viene azzerato anche lo stato di caricamento.
