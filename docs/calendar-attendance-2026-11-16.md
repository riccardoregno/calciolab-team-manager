# Presenze dagli allenamenti in calendario

La regola richiesta è: seduta passata in calendario = presente per chi era a disposizione, salvo eccezioni registrate. Il resolver condiviso non trasforma più ogni stato mancante in «Da confermare». Rosa, riepiloghi individuali, Statistiche, confronto giocatori, Registro e Quadro usano la stessa regola. Le statistiche continuano a escludere le sedute future dal periodo svolto.

Restano prioritari gli stati individuali salvati, comprese assenze, recupero, parziale e un eventuale «Da confermare» inserito intenzionalmente. In assenza di uno stato individuale si applicano infortuni e permessi per data, quindi la presenza predefinita; i trasferiti restano esclusi dalla data effettiva. Sono riconosciute anche le date infortunio storiche `dateStart`/`dateEnd`, oltre a `startDate`/`endDate` e `expectedReturn`. Non si modifica la precedenza di una decisione individuale già registrata.

Non vengono inserite presenze nel database né riscritti i dati storici. La conferma collettiva rimane una registrazione esplicita utilizzabile dove prevista; per una seduta già svolta non viene presentata come operazione necessaria. Il testo nel Registro spiega di registrare solo le eccezioni. Nel Quadro l'etichetta è «presenze», senza attribuire una conferma manuale ai valori ricavati dal calendario.

## Regressione automatica

`scripts/test-calendar-attendance.mjs`, incluso in `npm run test`, riproduce il caso della segnalazione: 1 presenza salvata e 51 sedute passate senza stato devono restituire 52 presenze e nessun arretrato automatico. Non viene forzato un totale per un giocatore reale: dipende dalle sedute e dal periodo selezionati.

Sono controllati anche i conteggi settimanali e su quattro settimane, le due opzioni del riepilogo usate dai componenti, assenze individuali, infortuni datati in entrambi i formati, rientro dopo infortunio, permessi, trasferimenti, date future e immutabilità del JSON originale. Gli stati letti dal registro restano distinti dai valori inferiti. Rendering SSR: una seduta passata non chiede «Conferma presenze mancanti».

## Browser locale

Prova in sola lettura sui dati fittizi del pilot, frontend 127.0.0.1:4185. Rosa desktop e mobile: il profilo privo di registrazione individuale mostra 2 presenze, senza arretrato; l'assenza salvata e l'infortunio restano esclusi. Quadro del 9–15 novembre a 390 px: Bianchi 2 presenze; Ultime 4 settimane 3/3 presenze, ritorno a Settimana 2. L'infortunato mostra 3 infortuni nelle quattro settimane dopo il riconoscimento delle date storiche. Minutaggi e dati gara incompleti restano distinti dagli allenamenti.

Dal dettaglio evento aperto il Registro della seduta passata: nessun pulsante di conferma superflua e testo «Registra solo le eccezioni». Documento 380 px su viewport 390 px. Nessuna scrittura dei dati del pilot durante questa verifica; l'accesso usa il solo account QA già esistente.

La prova sui telefoni fisici resta separata. Non servono migrazioni o aggiornamenti massivi in produzione; il rilascio è solo frontend. Per tornare indietro basta ridistribuire il frontend precedente.
