# Quadro → correzione → ritorno

## Problema e modifica

Il ritorno al Quadro era conservato soltanto nello stato della navigazione React. Il normale passaggio nella stessa scheda funzionava, ma un collegamento di correzione aperto separatamente perdeva il contesto. Nel browser locale, la seduta selezionata e il giocatore erano corretti, mentre comparivano «Indietro» e «Quadro di questa settimana», non il ritorno alle quattro settimane con i filtri originali.

I collegamenti del Quadro a presenze, minutaggi e Registro ora includono il percorso di ritorno nella query URL. Il Registro lo conserva anche nei collegamenti alle singole sedute. Le pagine di destinazione leggono prima il contesto esplicito della URL e poi lo stato precedente, che rimane supportato per compatibilità.

Sono conservati periodo, settimana selezionata, ordinamento e filtro Solo da completare. Nel passaggio attraverso il Registro sono conservati anche mese, gruppo e ricerca. Il collegamento al tabellino mantiene l'identificativo del giocatore da correggere. I testi del ritorno dal tabellino riusano le traduzioni del Quadro, senza chiamare «settimanale» una vista di quattro settimane.

I percorsi di ritorno accettati rimangono soltanto quelli interni del Quadro e del Registro. URL esterne e frammenti non vengono accettati. Gli identificativi e i filtri non sostituiscono autorizzazioni o selettore squadra: la squadra rimane quella selezionata e i controlli di accesso esistenti restano applicati. Nessuna credenziale viene inserita nei collegamenti.

## Browser: prove effettive

20 novembre 2026. Supabase locale, AS Due Annate · Collaudo, stagione 2026/27. Proprietario su localhost:4186, assistente su localhost:4187. Dataset fittizio già preparato; nessuna scrittura in produzione.

1. Prima della modifica: Quadro Ultime 4 settimane e Solo da completare → dettaglio Bruno → URL della seduta aperta in un'altra scheda. Riprodotta la perdita del ritorno al Quadro.
2. Dopo: stesso evento con minuti crescenti e filtro pendenti. Aperto il nuovo collegamento direttamente senza lo stato della scheda originale: «Torna al Quadro della rosa» presente, Bruno selezionato correttamente.
3. Segnato Bruno Presente nella seduta QA del 19 novembre; osservato lo stato pendente, attesa la conferma online, ricaricata la pagina e usato il ritorno. Quadro 26 ottobre–22 novembre, settimana selezionata 16 novembre, quattro settimane, minuti crescenti e filtro pendenti conservati. Bruno passa da 1/3 presenze e 2 pendenti a 2/3 e 1 pendente.
4. Ripristinato Bruno a Da confermare nella sola fixture, attesa la conferma online. Conteggi iniziali ripristinati e verificati anche dall'assistente.
5. Collegamento ai minuti di QA Sporting Monteverde aperto direttamente su desktop: giocatore evidenziato dal focus, risultato e minuti mancanti consultabili, ritorno alla medesima URL del Quadro. Nessun tabellino salvato durante questa prova.
6. Quadro → Registro novembre, filtro Prima squadra e ricerca Bruno. Copiata l'URL del Registro in un'altra scheda: ricerca e ritorno mantenuti. Aperta poi la seduta dal Registro, copiata anche questa URL e ricaricata: Torna al Registro ripristina mese, gruppo e ricerca; Torna al Quadro ripristina il contesto iniziale.
7. Assistente: aperto direttamente il collegamento alla correzione, poi tornato al Quadro con lo stesso periodo, ordinamento e filtro. Squadra, ruolo e conteggi corretti.
8. Desktop 1280 px e mobile 390 px. Documento mobile 380 px, nessuno scorrimento orizzontale osservato nel Quadro. Chiusa la scheda mobile creata per la prova al termine.

## Controlli automatici

- `npm run test`: PASS, compresa la regressione sul contesto di navigazione senza history state.
- Rendering finale dopo la modifica dei testi: PASS (`node scripts/test-match-flow-render.mjs`).
- `npm run lint`, `npm run build` e `git diff --check`: PASS.
- Casi mirati: identità e codifica del giocatore, URL esplicita prevalente su uno stato precedente, contesto annidato Registro/Quadro, ritorno da link copiato, focus dei minuti, compatibilità dei collegamenti precedenti, rifiuto delle destinazioni esterne e dei frammenti.

Screenshot nel workspace outputs: `quadro-ritorno-prima-mobile.jpg`, `quadro-ritorno-dopo-mobile.jpg`, `quadro-ritorno-filtri-mobile.jpg`.

La prova sui telefoni fisici resta separata. Non sono stati provati in questo intervento un cambio squadra durante una modifica pendente né un nuovo guasto di rete; le protezioni di sincronizzazione già collaudate non sono modificate.

## Ripetizione e rilascio

Con il Supabase pilot locale già attivo, dalla cartella del progetto Codex:

```powershell
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File '.\outputs\calciolab-avvia-frontend-background.ps1'
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File '.\outputs\calciolab-avvia-collaborazione-background.ps1'
```

Aprire la Home con gli account fittizi già preparati. Scegliere AS Due Annate · Collaudo, 2026/27, poi Confronta presenze e minuti. Impostare Minuti di gara crescenti e Solo da completare. Espandere Dettaglio eventi e aprire una seduta in una nuova scheda. Dopo una correzione attendere Salvato online, ricaricare e usare Torna al Quadro: periodo e filtri devono restare identici. Ripetere attraverso Apri Registro presenze e tramite un collegamento ai minutaggi.

Rilascio del solo frontend; nessuna migrazione o nuova variabile di configurazione. Rollback al frontend `f233051` se necessario. Stripe resta in modalità test.
