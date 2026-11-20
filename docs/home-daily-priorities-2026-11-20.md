# Home: attività da completare

La Home mostrava soltanto la prima seduta con stati da confermare e la prima gara incompleta. Le altre attività richiedevano l'apertura dei registri. Il blocco «Prima della prossima seduta» ora mostra il numero totale di sedute interessate, la somma degli stati individuali pendenti e il numero di gare incomplete. Una gara conta una sola volta anche quando mancano più campi.

Il Quadro resta l'azione principale. L'elenco ordinato per data espone tre attività e rende esplicito quante altre sono disponibili attraverso «Mostra altre attività». Registro e confronto su quattro settimane rimangono raggiungibili come collegamenti secondari. Un utente in sola lettura conserva questi collegamenti di consultazione, senza ricevere attività di modifica.

## Regole riusate

- Le sedute provengono da `buildCoachTasks`: allenamenti svolti nel periodo recente, stati individuali effettivamente pendenti, trasferimenti valutati alla data dell'evento. Nessuna nuova conferma richiesta per il semplice valore predefinito del calendario.
- Le gare provengono da `getMatchCompletionTasks`, sui dati della stagione e competizione già selezionate. Risultato, formazione e minutaggio sono valutati con le regole esistenti. I collegamenti conservano `fromDashboard`, `pendingOnly` e `missingMinutesOnly`.
- Il totale degli stati di presenza somma i record pendenti delle sedute, non il numero di persone distinte.
- Durante il caricamento non si mostrano zeri confermati. Se i minuti sono ancora in verifica o non leggibili, la Home lo dichiara e mantiene disponibili le attività già individuate da risultato o formazione. Non compare il messaggio «Nessun arretrato» fino a verifica conclusa.
- Testi nel catalogo italiano/inglese esistente. Nessuna migrazione e nessun intervento sul billing.

## Prove eseguite

Supabase locale e frontend locali, due account fittizi con ruoli Proprietario e Assistente, squadra AS Due Annate · Collaudo e stagione 2026/27. Aggiunte soltanto due sedute e due gare tecniche con prefisso `qa-home-priorita-`, senza modificare eventi estranei.

1. Home: 3 sedute, 4 stati da confermare, 2 gare da completare. Anteprima di tre righe; espansione mostra tutte le cinque attività. Proprietario e assistente mostrano gli stessi totali.
2. Home → seduta del 19 novembre → Bruno presente → conferma online → Home: 2 sedute e 3 stati pendenti. Conteggi conservati dopo ricarica.
3. Home → Quadro: squadra, stagione e settimana 16–22 novembre conservate; 3 sedute svolte, 2 gare. Minuti mancanti distinti dallo zero registrato.
4. Home → Registro: dati della stessa squadra e stagione. Ripristinato Bruno a «Da confermare» nella sola fixture e attesa la conferma online. Totali iniziali ripristinati.
5. Home → tabellino QA Aurora: gara corretta, risultato mancante e zero minuti già registrato conservato. Nessun salvataggio sul tabellino effettuato.
6. Cambio alla 2025/26: nessuna attività delle fixture 2026/27 presente nell'elenco. Ritorno alla stagione corrente: conteggi ripristinati.
7. Italiano/inglese: titoli, conteggi e azioni del nuovo riepilogo tradotti; lingua italiana ripristinata.
8. Home → confronto delle quattro settimane: intervallo 26 ottobre–22 novembre e ordinamento Continuità e minuti corretti.
9. Desktop a 1280 px e mobile a 390 px. Documento mobile 380 px: nessuno scorrimento orizzontale. Titoli lunghi, azioni ed espansione leggibili. Dimensione del browser ripristinata dopo la prova.

La prova browser usa due giocatori attivi e un trasferito della fixture stagioni; non viene dichiarata una nuova prova con 25 giocatori né con telefoni fisici. Gli stati vuoti, di errore e di accesso in lettura del nuovo riepilogo sono verificati automaticamente; non sono stati simulati errori di rete nel browser per questo intervento.

## Controlli e rilascio

`npm run test`, `npm run lint`, `npm run build` e `git diff --check`. Regressioni aggiunte al rendering: conteggio di tutte le sedute, somma degli stati pendenti, gara contata una sola volta, attività oltre l'anteprima dichiarate, accesso al Registro sempre presente, caricamento/errore non scambiati per assenza di arretrati.

Nessuna scrittura sui dati di produzione. Il rilascio richiede soltanto il frontend, con possibilità di tornare al commit precedente `b2b9762`. Non servono comandi SQL, reset o nuove chiavi. La verifica dei telefoni fisici rimane separata.

Screenshot nel workspace `outputs`: `home-priorita-prima-desktop.jpg`, `home-priorita-dopo-desktop.jpg`, `home-priorita-dopo-mobile.jpg`. Il prima è una cattura desktop con la precedente fixture; il dopo aggiunge gli eventi tecnici necessari a provare più arretrati, quindi i conteggi non costituiscono un confronto sul medesimo dataset. Non è disponibile un prima mobile verificato.

Per ripetere la prova locale dalla cartella del progetto Codex, con il pilot già avviato:

```powershell
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File '.\outputs\calciolab-avvia-frontend-background.ps1'
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File '.\outputs\calciolab-avvia-collaborazione-background.ps1'
```

Aprire `http://localhost:4186/` con il proprietario fittizio già preparato e `http://localhost:4187/` con l'assistente. Selezionare AS Due Annate · Collaudo, stagione 2026/27. Le fixture sono datate 16–19 novembre 2026: oltre il periodo recente le sedute escono normalmente dagli arretrati della Home.
