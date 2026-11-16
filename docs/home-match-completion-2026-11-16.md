# Home → tabellino → Quadro

La Home propone la gara più recente da completare indicando cosa manca: risultato, formazione oppure minutaggi. Una gara senza risultato resta visibile anche quando tutti i minutaggi sono registrati. Se la lettura dei minuti fallisce, risultato e formazione restano verificabili senza inventare dati sui minuti.

Il controllo dei titolari usa il campo del primo tempo salvato, con il precedente elenco titolari come fallback. Anche i giocatori presenti solo nel campo salvato vengono considerati per i minuti mancanti. Gli zeri espliciti restano valori confermati. Il vecchio task «risultato mancante» apre ora il tabellino modificabile, anziché il report narrativo Dopo gara.

Nel tabellino è disponibile «Quadro di questa settimana», calcolato dalla data della gara, anche se la gara appartiene alla settimana precedente. I ritorni a un Quadro già selezionato conservano il loro contesto. Nessuna nuova scrittura automatica, migrazione o modifica dei criteri di salvataggio.

## Controlli

Test di logica e rendering SSR: risultato mancante con minuti tutti zero, campo del primo tempo con elenco legacy vuoto, minutaggio nullo distinto dallo zero, lettura minuti indisponibile, assenza di azioni di modifica per utenti in sola lettura, destinazione del task e parità delle traduzioni italiano/inglese. Inclusi nella suite npm test. Lint e build controllati sul candidato.

Il collaudo browser/Supabase di questo intervento NON è concluso: motore Docker Linux non disponibile (`dockerDesktopLinuxEngine` inesistente), API locale 54321 con connessione rifiutata e frontend locale con timeout. Tentato l'avvio di Docker Desktop senza ottenere il motore pronto. Nessuna fixture è stata inserita, nessun database remoto contattato e nessuna scrittura in produzione.

## Ripetizione sul PC

Aprire Docker Desktop e attendere Engine running. In PowerShell 7 eseguire:

```powershell
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File 'C:\Users\rregno\Documents\Codex\2026-11-09\riprendi-il-collaudo-supabase-di-calciolab\outputs\calciolab-collaudo-home-tabellino.ps1'
```

Lo script riusa soltanto il pilot `calciolab-pilot-local`, verifica i binding loopback e lo ferma in caso di esposizione fuori da localhost. Non esegue reset, importazioni o migrazioni. Prepara una sola gara nella squadra QA esistente con 11 zeri esplicitamente registrati: è una fixture costruita per isolare il risultato mancante, non un esempio di minutaggio realistico. Non richiede chiavi amministrative o Stripe. Avvia il frontend su http://127.0.0.1:4185/.

Accedere con l'account QA `qa-percorso-1794404639497@example.com`, password esclusivamente fittizia `CalcioLab-QA!2026`. Aprire dalla Home l'azione per AS Collaudo risultato del 15 novembre. Deve indicare soltanto «Risultato da inserire», mantenere gli 11 titolari e gli zeri, consentire il salvataggio di 1-0 e rimuovere quella gara dalle azioni dopo la conferma online. Da quella gara «Quadro di questa settimana» deve aprire 9–15 novembre, non la nuova settimana del 16 novembre.

Controllare gli stessi passaggi su desktop e viewport 390 px. In un secondo terminale eseguire lo stesso comando con `-VerifyOnly`: l'esito atteso è PASS con risultato 1-0, campo del primo tempo conservato e 11 zeri invariati. Nessuna chiave va incollata in chat.

La pagina tecnica `scripts/home-match-rehearsal.html` è anche disponibile sul solo 127.0.0.1:4184 per una prova dei componenti in memoria; non verifica la persistenza Supabase. La prova fisica sui due telefoni resta separata.
