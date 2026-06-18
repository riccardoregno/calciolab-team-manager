# CalcioLab vs YouCoach — Benchmark & Roadmap competitiva

## Confronto sintetico

| Area | YouCoach | CalcioLab |
|---|---|---|
| Libreria esercizi | 3500+ esercizi condivisi | Libreria personale del coach |
| Session builder | Guidato con AI | Manuale, flessibile |
| Convocazioni & RSVP | Base | Avanzato (email, RSVP realtime, portale) |
| Player Portal | No / limitato | Sì — disponibilità, convocazioni, prehab |
| Export PDF | Report base | Branded (Training, MatchDay, PostMatch, Microcycle, Player) |
| Lavagna tattica | Sì (animazioni) | Sì (mobile-first) |
| Disponibilità giocatori | Parziale | Sì — realtime, export giorno per giorno |
| Analytics & dashboard | Avanzate | Di base |
| Video analysis | Sì | No |
| Bio-banding | Sì | No |
| Schede valutazione | Sì | No |
| Questionari | Sì | No |
| Accesso genitori | Sì | No |
| AI generazione sessioni | Sì | No |
| App mobile | Sì | PWA (Android/iOS) |
| Prezzi | Premium | — |

---

## Punti forti YouCoach

- Comunità e catalogo esercizi condiviso (3500+)
- Metodologia integrata (obiettivi, principi, block design)
- Credibilità percepita "enterprise" e adozione federazioni
- AI per generazione sessioni e readiness
- Video analysis e scout nello stesso tool
- Bio-banding e schede valutazione strutturate
- Accesso genitori (utile youth football)
- Time tracking e reportistica dettagliata
- Configuratore uniformi e sistemi di gioco

## Punti forti CalcioLab

- Convocazioni con RSVP via email (link personalizzato per giocatore)
- Player Portal realtime — disponibilità, prehab, accesso diretto atleta
- Export PDF brandizzati pronti per il campo (Training, MatchDay, Microcycle, PostMatch, Player Report)
- Disponibilità giorno per giorno con export pianificatore
- RSVP stats con tasso risposta e tempo medio
- UX snella mobile-first pensata per staff in movimento
- Controllo ruoli staff/player granulare
- Stack moderno e flessibile (no lock-in)
- Codebase mantenibile — personalizzabile per ogni club

---

## Gap principali da colmare

### Gap ad alto impatto

| Gap | Impatto | Note |
|---|---|---|
| Libreria esercizi condivisa / filtrabile | Alto | Core del posizionamento YouCoach |
| Session builder guidato (drag & drop blocchi) | Alto | Riduce tempo costruzione seduta |
| Schede valutazione giocatori | Alto | Necessario per accademia/settore giovanile |
| Dashboard analytics avanzata | Alto | Presenze, carico, trend fisici, trend partite |

### Gap a medio impatto

| Gap | Impatto | Note |
|---|---|---|
| Questionari (benessere, post-gara) | Medio | Facile da fare, molto utile |
| Notifiche push native | Medio | WhatsApp è workaround attuale |
| Lavagna con animazioni | Medio | Attuale è statica |
| Accesso genitori / osservatori | Medio | Utile youth football |

### Gap a basso impatto (o da non copiare)

| Gap | Impatto | Note |
|---|---|---|
| Video analysis integrata | Basso | Già coperta da Wyscout/Hudl — duplicazione costosa |
| Bio-banding | Basso | Nicchia, bassa adozione pratica |
| Configuratore uniformi | Basso | Nice-to-have, non core |
| AI generazione sessioni | Basso* | Utile ma non differenziante se il coach non ci crede |

---

## Roadmap consigliata in 3 fasi

### Fase 1 — Player Portal & gestione squadra operativa
*Obiettivo: essere la control room quotidiana più completa per staff e atleti.*

| Task | Priorità | Stato |
|---|---|---|
| Player Portal con disponibilità realtime | Alta | ✅ Fatto |
| Convocazioni con RSVP email | Alta | ✅ Fatto |
| Export PDF brandizzati (Training, MatchDay, PostMatch, Microcycle, Player) | Alta | ✅ Fatto |
| Pianificatore disponibilità giorno per giorno | Alta | ✅ Fatto |
| Notifiche push (PWA) per convocazioni e disponibilità | Alta | Da fare |
| Dashboard presenze — % presenze per giocatore e per sessione | Alta | Da fare |
| Questionario benessere giocatore (RPE percepito, umore, sonno) nel portale atleta | Alta | Da fare |
| Dashboard analytics carico: carico settimana, trend mensile, alert overload | Alta | Da fare |
| Invio convocazioni in batch con stato invio per giocatore | Media | Da fare |
| Scheda giocatore: storico presenze, infortuni, RPE, note staff | Media | Parziale |

### Fase 2 — Session builder & libreria esercizi
*Obiettivo: rendere la preparazione della seduta più rapida e replicabile.*

| Task | Priorità |
|---|---|
| Libreria esercizi personale filtrabile (obiettivo, blocco, campo, categoria) | Alta |
| Session builder drag & drop con blocchi (riscaldamento, possesso, tattica, partitella, defaticamento) | Alta |
| Template seduta riutilizzabili | Alta |
| Carico stimato automatico dalla seduta (durata × RPE) | Media |
| PDF seduta con disegno campo (immagine SVG dal coach) | Media |
| Condivisione seduta via link o PDF al giocatore | Media |
| Importazione esercizi da YouCoach / CSV | Bassa |

### Fase 3 — Lavagna avanzata, valutazione & crescita
*Obiettivo: supportare il processo di sviluppo individuale e tattico.*

| Task | Priorità |
|---|---|
| Lavagna tattica con animazioni (record & replay) | Alta |
| Schede valutazione giocatore (tecnica, tattica, fisico, mentale) | Alta |
| Questionari post-gara e post-seduta (per giocatori) | Alta |
| Report di crescita individuale: confronto test fisici nel tempo | Media |
| Accesso osservatori / genitori (sola lettura) | Media |
| Integrazione GPS (upload CSV) con visualizzazione heatmap | Media |
| Analisi video leggera (timestamp + tag clip) | Bassa |

---

## Cosa NON copiare da YouCoach, ma reinterpretare

| Feature YouCoach | Approccio CalcioLab |
|---|---|
| Libreria esercizi pubblica condivisa | Libreria personale del coach + template condivisi tra staff dello stesso club. Il valore è la pertinenza al contesto, non il volume. |
| AI generazione sessioni | Non un "generatore magico" — ma un assistente che suggerisce blocchi in base a target carico, fase stagione, giocatori disponibili. Il coach decide sempre. |
| Video analysis integrata | Non competere con Wyscout/Hudl. Integrare timestamp e note su clip esterne, link a video esistenti. |
| Bio-banding | Raccogliere dati fisici già presenti (altezza, peso, nascita) e offrire un'analisi di gruppo semplice — senza costruire un modulo apposito. |
| Accesso genitori | Integrare nel Player Portal: il genitore accede con le stesse credenziali del figlio o con un link di sola lettura. Non un modulo separato. |

---

## Posizionamento consigliato

> CalcioLab è la control room quotidiana per coach e staff:
> convocazioni, disponibilità, sedute, partite, giocatori, report e portale atleta in un'unica app.
>
> Non la piattaforma con più contenuti — quella con il workflow più rapido dal campo all'ufficio.
