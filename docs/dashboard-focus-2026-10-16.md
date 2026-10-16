# Dashboard: priorità quotidiane e agenda

- Un solo pannello di focus per seduta o gara, con azione principale e calendario.
- Anteprima dei successivi tre eventi e quattro contatori; su mobile i contatori precedono l’agenda.
- Dettagli pre-gara, avvisi aggiuntivi e configurazione parziale espandibili. I dettagli operativi di convocazione e formazione restano disponibili.
- Avvisi ordinati per gravità, deduplicati e accessibili anche da tastiera; gravità leggibile dagli screen reader.
- Riordino delle sezioni attivo durante la personalizzazione; preferenze recuperate senza duplicati o sezioni mancanti.
- Vista essenziale senza ripetizione della settimana già presente nel focus.
- Agenda ordinata per giorno e ora locali, senza limiti artificiali al conteggio dei sette giorni. Attività recenti escludono gli appuntamenti futuri.
- La dashboard apre la seduta specifica in modifica, anche dopo il caricamento asincrono; il salvataggio conserva i metadati esistenti.

## Verifiche

Test automatici su ordinamento, più di cinque eventi, giorni inclusivi, cambio anno, date non valide, orari passati e futuri, immutabilità, priorità degli avvisi e preferenze delle sezioni. La suite include regressioni di navigazione e persistenza.

Verifica nel browser dei componenti reali con dati sintetici: dashboard a 320, 390, 768, 1024 e 1440 px senza overflow della pagina o del pannello focus; apertura e aggiornamento di una seduta mantenendo otto sedute e l’orario; espansione degli avvisi; stato vuoto e primi passi; gara prioritaria con dettagli convocazione, formazione e logistica. Nessuna prova su dispositivi iOS/Android fisici o su dati di produzione.
