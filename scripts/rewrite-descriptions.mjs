/**
 * scripts/rewrite-descriptions.mjs
 * Riscrive description + objective per tutti i 893 esercizi FP5
 * con lo stile CalcioLab: professionale, uniforme, italiano tecnico calcistico.
 *
 * Uso: node scripts/rewrite-descriptions.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FP5_PATH = path.join(__dirname, "../src/data/eserciziarioFp5.js");

// ─── Dizionario contesti tattici per categoria ────────────────────────────────
// 4 varianti per categoria → selezione con hash sull'ID per evitare monotonia

const CATEGORY_CONTEXT = {
  "Possesso": [
    "Esercitazione di possesso palla orientato, finalizzata a sviluppare la capacità di mantenere il controllo del gioco e creare superiorità numerica locale attraverso la circolazione rapida.",
    "Situazione di possesso palla in spazio ridotto, progettata per affinare la tecnica ricettiva, il piede debole e la lettura delle traiettorie sotto pressione avversaria.",
    "Esercitazione tecnico-tattica di mantenimento palla, incentrata sul triangolo di supporto, la gestione del terzo uomo e l'uscita dalla pressione avversaria.",
    "Lavoro di possesso palla strutturato per sviluppare la fluidità di manovra, la mobilità senza palla e la capacità di verticalizzare nel momento opportuno.",
  ],
  "Passaggio": [
    "Esercitazione tecnica sul passaggio, focalizzata sulla pulizia del gesto, la scelta del piede di trasmissione e la calibrazione della forza in funzione della distanza.",
    "Situazione tecnica di passaggio e ricezione, progettata per consolidare la qualità della trasmissione, il controllo orientato e i movimenti di smarcamento del ricevente.",
    "Lavoro tecnico sul passaggio in movimento: sviluppa la sincronia tra passer e ricevente, la correttezza della traiettoria e la gestione del timing di giocata.",
    "Esercitazione di passaggio sotto pressione temporale, progettata per automatizzare la tecnica di trasmissione e migliorare la rapidità decisionale con palla.",
  ],
  "Finalizzazione": [
    "Esercitazione di rifinitura e conclusione, progettata per sviluppare la qualità del tiro in porta, il posizionamento in area e la lettura delle traiettorie in situazioni di gioco reale.",
    "Situazione di finalizzazione con percorso tecnico, finalizzata a consolidare la tecnica di conclusione, il controllo della palla in corsa e la coordinazione nella fase offensiva.",
    "Lavoro di finalizzazione in superiorità numerica, incentrato sull'occupazione degli spazi in area, la sincronizzazione degli attaccanti e la scelta della soluzione di tiro.",
    "Esercitazione di attacco alla porta con sviluppi combinati, progettata per affinare la qualità del tiro, il tocco ravvicinato e la mobilità negli ultimi 16 metri.",
  ],
  "Cross": [
    "Situazione di cross dalla fascia e attacco al secondo palo, progettata per sviluppare la qualità del traversone, i movimenti in area degli attaccanti e la coordinazione con l'esterno.",
    "Esercitazione di rifinitura con palla a terra e cross, finalizzata a consolidare la tecnica di inversione, l'attacco allo spazio in area e le combinazioni sugli esterni.",
    "Lavoro combinato sul cross basso e cross teso: sviluppa la sincronia tra l'esterno e gli attaccanti in area, la scelta del tipo di traversone e l'inserimento al limite.",
    "Situazione di gioco sugli esterni con finalizzazione: allena la conduzione palla, il momento del cross e i movimenti dei compagni in area di rigore avversaria.",
  ],
  "Sovrapposizione": [
    "Esercitazione sulla sovrapposizione esterna, progettata per sviluppare la combinazione terzino-esterno, il timing del movimento sovrapposto e l'utilizzo dell'ampiezza in fase offensiva.",
    "Situazione di gioco con movimento sovrapposto sistematico, finalizzata a consolidare la sincronizzazione tra chi conduce palla e chi esegue la sovrapposizione per creare superiorità in fascia.",
    "Lavoro di combinazione con sovrapposizione e cross, incentrato sulla lettura del momento di scatto, la qualità del passaggio in profondità e l'attacco al primo o secondo palo.",
    "Esercitazione tecnico-tattica sulla fascia: sviluppa il dialogo a due (1-2 sovrapposto), la capacità di sfruttare l'ampiezza e l'occupazione corretta dell'area al cross.",
  ],
  "Taglio": [
    "Esercitazione sul taglio tra le linee, progettata per sviluppare i movimenti in profondità, la lettura del momento del taglio e la sincronizzazione con il portatore di palla.",
    "Situazione di attacco con palla a terra e tagli in profondità: allena la mobilità degli attaccanti, la qualità del passaggio filtrante e il controllo orientato verso la porta.",
    "Lavoro sul taglio in diagonale e in verticale, finalizzato a consolidare i movimenti di rottura della linea difensiva, la tempistica dello scatto e la conclusione.",
    "Esercitazione tecnico-tattica sul taglio e smarcamento: sviluppa la capacità di liberarsi dalla marcatura, il movimento a sorprendere e la scelta tra tiro e passaggio.",
  ],
  "Ampiezza": [
    "Esercitazione di gioco in ampiezza, progettata per sviluppare la gestione delle fasce, il cambio di gioco e la capacità di allargare la difesa avversaria per creare spazi centrali.",
    "Situazione di manovra con utilizzo sistematico dell'ampiezza, finalizzata a consolidare le posizioni degli esterni alti, il cambio campo veloce e l'attacco all'1vs1 in fascia.",
    "Lavoro tattico sulle catene laterali: sviluppa la sincronizzazione tra il giocatore in ampiezza, il terzino sovrapposto e il trequartista in appoggio per creare situazioni di superiorità.",
    "Esercitazione di possesso con sviluppo sulle fasce: allena il cambio di gioco immediato, la ricezione dell'esterno in corsa e la creazione di superiorità numerica nel corridoio laterale.",
  ],
  "Scaglionamento": [
    "Esercitazione di fase difensiva con scaglionamento e copertura, progettata per consolidare la disposizione scalata dei reparti, la lettura delle linee di passaggio e l'intercetto.",
    "Situazione tattica di scaglionamento difensivo, finalizzata a sviluppare la copertura preventiva, le scalate della linea difensiva e la comunicazione tra i reparti.",
    "Lavoro difensivo sullo scaglionamento e raddoppio di marcatura: allena la corretta disposizione difensiva, l'anticipo sul portatore di palla e la copertura del compagno.",
    "Esercitazione tecnico-tattica sulla disposizione difensiva: sviluppa il posizionamento scalato, l'uscita in pressing coordinata e il recupero posizionale dopo palla persa.",
  ],
  "Inserimento": [
    "Esercitazione sull'inserimento del centrocampista, progettata per sviluppare i movimenti in avanti senza palla, la lettura del momento di inserimento e il taglio verso porta.",
    "Situazione combinata con inserimento del terzo uomo: allena la profondità di manovra, la sincronizzazione dei tempi tra chi costruisce e chi si inserisce in area.",
    "Lavoro tattico sull'inserimento e il dialogo a tre: sviluppa la capacità del centrocampista di aggredire la profondità, la qualità del passaggio filtrante e la conclusione.",
    "Esercitazione tecnico-tattica sull'inserimento in area: consolida i movimenti combinati, la lettura del gioco senza palla e il posizionamento al momento della conclusione.",
  ],
  "Penetrazione": [
    "Esercitazione sull'azione individuale di penetrazione, progettata per sviluppare la conduzione palla in spazio ristretto, il superamento dell'avversario diretto e la verticalizzazione.",
    "Situazione di 1vs1 offensivo e penetrazione nello spazio: allena la tecnica di dribbling, la protezione palla e la scelta tra conclusione e passaggio dopo il superamento.",
    "Lavoro di penetrazione con sviluppo combinato, finalizzato a consolidare l'azione individuale di rottura, il dribbling tecnico e l'assist all'inserimento del compagno.",
    "Esercitazione tecnica sulla penetrazione in fascia o al centro: sviluppa l'accelerazione con palla, il cambio di passo e la decisione finale nelle ultime fasi offensive.",
  ],
  "Pressing": [
    "Esercitazione di pressing offensivo, progettata per sviluppare il recupero palla nella metà campo avversaria, la sincronizzazione del blocco in pressione e il riaggressione immediata.",
    "Situazione di pressing organizzato sull'uscita palla avversaria: allena i trigger di pressing, la scalata dei centrocampisti e il compattamento verticale dei reparti.",
    "Lavoro tattico di pressing alto e trap pressing: sviluppa la lettura delle linee di passaggio avversarie, il momento dell'attivazione del pressing e la copertura degli spazi.",
    "Esercitazione di pressing coordinato a blocco: consolida la comunicazione tra i reparti, i movimenti di pressing sugli appoggi laterali e la transizione difensiva→offensiva.",
  ],
  "Fase difensiva": [
    "Esercitazione di organizzazione difensiva, progettata per sviluppare la disposizione della linea, la scalata coordinata dei reparti e la gestione della profondità avversaria.",
    "Situazione difensiva con blocco basso e gestione dell'ampiezza: allena il posizionamento scalato, la copertura delle zone di cross e l'anticipo sui movimenti offensivi.",
    "Lavoro tattico di fase difensiva in transizione: sviluppa il rientro organizzato, la lettura delle traiettorie di ripartenza avversaria e il pressing coordinato sul portatore.",
    "Esercitazione di difesa di reparto: consolida la compattezza verticale, la comunicazione difensiva e la gestione delle situazioni di inferiorità numerica temporanea.",
  ],
  "Fase offensiva": [
    "Esercitazione di manovra offensiva, progettata per sviluppare la costruzione dal basso, il fraseggio tra i reparti e la progressione verso la porta avversaria.",
    "Situazione di gioco offensivo con sviluppo combinato: allena la mobilità degli attaccanti, le combinazioni tra reparto e reparto e la finalizzazione sull'azione costruita.",
    "Lavoro tattico di fase offensiva organizzata: sviluppa i principi di attacco posizionale, la profondità del reparto offensivo e la ricerca della situazione di superiorità.",
    "Esercitazione di costruzione e sviluppo offensivo: consolida i meccanismi di attacco, i movimenti complementari tra i reparti e la gestione del ritmo di gioco.",
  ],
  "Superiorità numerica": [
    "Esercitazione in superiorità numerica offensiva, progettata per sviluppare la gestione del vantaggio numerico, la circolazione palla e l'utilizzo degli spazi liberi in profondità.",
    "Situazione di gioco in superiorità numerica locale: allena la capacità di sfruttare il vantaggio di uomo, la scelta della soluzione rapida e la verticalizzazione sul libero.",
    "Lavoro tecnico-tattico in superiorità numerica: sviluppa la fluidità di manovra con uomo in più, la copertura del pressing difensivo e la gestione del ritmo di palleggio.",
    "Esercitazione di possesso in superiorità: consolida la capacità di mantenere palla, trovare il libero e accelerare il gioco nel momento di superiorità creato.",
  ],
  "Duello": [
    "Esercitazione sul duello individuale, progettata per sviluppare la competitività 1vs1, la protezione palla in fase offensiva e l'anticipo aggressivo in fase difensiva.",
    "Situazione di duello diretto con finalizzazione: allena la forza atletica specifica, la tecnica di contrasto nel rispetto del regolamento e la determinazione agonistica.",
    "Lavoro di duello in spazio ridotto: sviluppa la capacità di vincere il contrasto, la protezione palla con il corpo e la transizione immediata dopo il duello vinto.",
    "Esercitazione di duello aereo e/o a terra: consolida la corretta tecnica di salto, l'utilizzo del corpo e la gestione del secondo tempo sul rimbalzo o sulla palla contesa.",
  ],
  "Combinazione": [
    "Esercitazione di combinazione tecnica, progettata per sviluppare il dialogo a due e a tre, la qualità dei movimenti di smarcamento e l'automatizzazione dei meccanismi combinati.",
    "Situazione combinata con scambi veloci: allena la precisione del passaggio corto, il controllo orientato e la lettura anticipata delle posizioni dei compagni.",
    "Lavoro tecnico sulle combinazioni in movimento: sviluppa la sincronia dei tempi, la qualità della trasmissione a un tocco e il posizionamento dopo la giocata.",
    "Esercitazione di combinazione con terzo uomo: consolida il triangolo di supporto, il passaggio in profondità e il movimento complementare del terzo giocatore coinvolto.",
  ],
  "Palle inattive": [
    "Esercitazione su palle inattive offensive, progettata per sviluppare l'organizzazione su calci piazzati, i movimenti combinati dei giocatori e la qualità del battitore.",
    "Situazione di palla inattiva difensiva: allena il posizionamento corretto sulla barriera, le marcature a uomo o a zona e la gestione del rimbalzo in area di rigore.",
    "Lavoro sulle palle inattive con sviluppi prestabiliti: sviluppa la memorizzazione degli schemi, la qualità dell'esecuzione tecnica e la capacità di adattamento in funzione della difesa.",
    "Esercitazione di palla inattiva con varianti su schema: consolida l'automatizzazione degli schemi su punizione/corner, la precisione del battitore e il movimento degli inseritori.",
  ],
  "Resistenza": [
    "Esercitazione di resistenza aerobica specifica, progettata per sviluppare la capacità di mantenere alta intensità per tutta la durata della seduta attraverso situazioni di gioco.",
    "Situazione di resistenza con la palla, finalizzata a stimolare il sistema aerobico-lattacido attraverso esercitazioni tecnico-tattiche ad alta frequenza di lavoro.",
    "Lavoro di resistenza specifica con transizioni continue: sviluppa la capacità di sostenere ritmi elevati di gioco, il recupero rapido e la qualità tecnica sotto affaticamento.",
    "Esercitazione di resistenza in forma di gioco: allena la potenza aerobica attraverso situazioni ad alta frequenza cardiaca, mantenendo la qualità tecnica e tattica.",
  ],
  "Partita": [
    "Partita a campo intero con regolamento modificato, progettata per consolidare in situazione reale tutti i principi tattici e tecnici sviluppati durante la seduta.",
    "Partita finale libera: momento di applicazione globale degli automatismi allenati, con focus sull'autonomia decisionale e sulla competitività agonistica.",
    "Partita con regole tematiche: allena la coerenza tra il tema della seduta e il comportamento in gara, stimolando l'applicazione consapevole dei principi allenati.",
    "Partita conclusiva della seduta: sviluppa la capacità di mantenere alta la qualità tecnico-tattica sotto stanchezza fisica e in condizione di pressione agonistica.",
  ],
  "Tecnica individuale": [
    "Esercitazione di tecnica individuale, progettata per perfezionare il gesto tecnico di base (controllo, conduzione, passaggio) in condizioni progressive di difficoltà.",
    "Situazione tecnica individuale con percorso strutturato: allena la pulizia del gesto, la coordinazione motoria specifica e l'automatizzazione delle abilità tecniche fondamentali.",
    "Lavoro di tecnica applicata individuale: sviluppa il controllo orientato, la conduzione in velocità e la qualità del passaggio in situazioni di pressione temporale crescente.",
    "Esercitazione tecnica per l'affinamento del gesto: consolida il tocco di palla, la sensibilità del piede e la qualità esecutiva nelle skill tecniche di base del calciatore.",
  ],
  "Riscaldamento": [
    "Esercitazione di attivazione neuro-muscolare, progettata per preparare organismo e sistema nervoso all'impegno fisico attraverso movimenti tecnici a bassa intensità progressiva.",
    "Situazione di riscaldamento con palla: allena la coordinazione, l'attivazione articolare e la preparazione tecnica in un contesto ludico a intensità controllata.",
    "Lavoro di attivazione tecnica e atletica: sviluppa la mobilità articolare, la temperatura muscolare e la connessione neuro-muscolare in preparazione all'allenamento principale.",
    "Esercitazione di riscaldamento strutturato: consolida la routine di attivazione, stimola la concentrazione tecnica e prepara la squadra all'intensità della sessione successiva.",
  ],
  "Rapidità": [
    "Esercitazione di rapidità con la palla, progettata per sviluppare la velocità di esecuzione tecnica, la reattività agli stimoli e la frequenza dei gesti nel breve tempo.",
    "Situazione di rapidità e cambio direzionale: allena la velocità di reazione, la coordinazione nei cambi di senso e il controllo palla ad alta frequenza di movimento.",
    "Lavoro di rapidità applicata: sviluppa la velocità gestuale, la capacità di accelerare nel breve e il coordinamento tra rapidità di pensiero e rapidità di esecuzione.",
    "Esercitazione di rapidità e tecnica a tempo: consolida la capacità di mantenere qualità tecnica in condizioni di massima velocità esecutiva e stimolo reattivo.",
  ],
  "Gioco aereo": [
    "Esercitazione sul gioco aereo, progettata per sviluppare la tecnica di colpo di testa in attacco e difesa, il timing del salto e la gestione del duello aereo.",
    "Situazione di gioco aereo con finalizzazione: allena la tecnica di stacco, la coordinazione del movimento di testa e il posizionamento per il primo e secondo tempo.",
    "Lavoro specifico sul colpo di testa: sviluppa la corretta tecnica di salto, l'impatto frontale e laterale con la palla e la forza esplosiva specifica nel duello aereo.",
    "Esercitazione di gioco aereo offensivo e difensivo: consolida il timing nel duello aereo, la gestione della traiettoria del cross e la deviazione in porta o in sicurezza.",
  ],
  "Psicocinetica": [
    "Esercitazione psicocinetica, progettata per sviluppare la concentrazione, la prontezza decisionale e la coordinazione oculo-motoria attraverso stimoli visivi e cognitivi.",
    "Situazione psicocinetica con palla: allena la reattività al segnale, la capacità di elaborare informazioni sotto pressione e la qualità del gesto tecnico associato.",
    "Lavoro psicocinetico applicato al calcio: sviluppa la velocità di lettura situazionale, la scelta rapida tra soluzioni multiple e l'automatizzazione della risposta motoria.",
    "Esercitazione di psicocinetica e tecnica: consolida il collegamento tra stimolo cognitivo e azione motoria, migliorando la reattività e la qualità decisionale nel gioco.",
  ],
};

// Fallback se categoria non trovata
const BLOCK_CONTEXT = {
  "Riscaldamento":       CATEGORY_CONTEXT["Riscaldamento"],
  "Possesso Palla":      CATEGORY_CONTEXT["Possesso"],
  "Giochi di Posizione": CATEGORY_CONTEXT["Ampiezza"],
  "Small Side Games":    CATEGORY_CONTEXT["Superiorità numerica"],
  "Partita a Tema":      CATEGORY_CONTEXT["Fase offensiva"],
  "Partita Finale":      CATEGORY_CONTEXT["Partita"],
};

// ─── Helper: hash stabile sull'id per scegliere variante template ─────────────
function hashVariant(id, n = 4) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

// ─── Helper: rileva se un campo di testo è "spazzatura" ───────────────────────
function isGarbage(str) {
  if (!str || str.trim().length < 4) return true;
  // % chars non-ASCII su totale > 30%
  const nonAscii = (str.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii / str.length > 0.15) return true;
  // Solo parola uguale alla categoria (inutile)
  const cleaned = str.trim().toLowerCase();
  if (cleaned.length < 10) return true;
  // Pattern tipici di garbage interno
  if (/\bÀÀÀ\b|\bÁ\s+Á\b|ÿ\s*[A-Z]|\x00|carlo regno/i.test(str)) return true;
  return false;
}

// ─── Helper: estrae info strutturali dal titolo ────────────────────────────────
function parseTitleStructure(title) {
  const vsMatch = title.match(/(\d+)\s*[vV][sS]\s*(\d+)/);
  if (vsMatch) return `${vsMatch[1]} contro ${vsMatch[2]}`;
  const nMatch = title.match(/^(\d+)\s+gioc/i);
  if (nMatch) return `${nMatch[1]} giocatori`;
  return null;
}

// ─── Genera obiettivo pulito ───────────────────────────────────────────────────
function genObjective(ex) {
  const catObjectives = {
    "Possesso":            "Mantenere il controllo del gioco attraverso il possesso palla collettivo e la gestione degli spazi.",
    "Passaggio":           "Perfezionare la tecnica di trasmissione palla e il controllo orientato in situazione.",
    "Finalizzazione":      "Sviluppare la qualità del tiro in porta e il posizionamento offensivo nell'ultimo terzo di campo.",
    "Cross":               "Migliorare la qualità del traversone dalla fascia e l'attacco all'area dei giocatori inseriti.",
    "Sovrapposizione":     "Allenare il movimento sovrapposto e la combinazione con l'esterno per creare superiorità in fascia.",
    "Taglio":              "Sviluppare i movimenti in profondità e il taglio tra le linee per liberarsi dalla marcatura.",
    "Ampiezza":            "Sfruttare l'ampiezza del campo per allargare la difesa avversaria e creare spazi centrali.",
    "Scaglionamento":      "Consolidare lo scaglionamento difensivo e la copertura preventiva dei reparti.",
    "Inserimento":         "Allenare l'inserimento del centrocampista in area e la sincronizzazione con i compagni.",
    "Penetrazione":        "Sviluppare la capacità di penetrare in spazio ridotto e superare l'avversario diretto.",
    "Pressing":            "Organizzare il pressing collettivo per recuperare palla nella metà campo avversaria.",
    "Fase difensiva":      "Consolidare l'organizzazione difensiva, la scalata dei reparti e la gestione della profondità.",
    "Fase offensiva":      "Sviluppare la manovra offensiva organizzata e la progressione verso la porta avversaria.",
    "Superiorità numerica":"Sfruttare la superiorità numerica locale per costruire azioni finalizzate a rete.",
    "Duello":              "Sviluppare la competitività nel contrasto individuale e la gestione del duello con la palla.",
    "Combinazione":        "Automatizzare le combinazioni tecniche a due e a tre per creare spazio e superiorità.",
    "Palle inattive":      "Sviluppare schemi prestabiliti su palle inattive offensive e la corretta organizzazione difensiva.",
    "Resistenza":          "Sviluppare la resistenza specifica attraverso situazioni di gioco ad alta intensità.",
    "Partita":             "Applicare in gara i principi tecnico-tattici allenati nella sessione, in contesto competitivo.",
    "Tecnica individuale": "Perfezionare il gesto tecnico individuale di base in condizioni progressive di difficoltà.",
    "Riscaldamento":       "Preparare l'organismo all'allenamento principale attraverso attivazione progressiva con la palla.",
    "Rapidità":            "Sviluppare la velocità di esecuzione tecnica e la reattività agli stimoli nel breve spazio.",
    "Gioco aereo":         "Migliorare la tecnica di colpo di testa e la gestione del duello aereo offensivo e difensivo.",
    "Psicocinetica":       "Sviluppare la prontezza decisionale e la coordinazione oculo-motoria attraverso stimoli cognitivi.",
  };
  return catObjectives[ex.category] || `Sviluppare le abilità tecnico-tattiche legate a ${ex.category.toLowerCase()}.`;
}

// ─── Genera description CalcioLab ─────────────────────────────────────────────
function genDescription(ex) {
  const variants = CATEGORY_CONTEXT[ex.category] || BLOCK_CONTEXT[ex.trainingBlock] || CATEGORY_CONTEXT["Tecnica individuale"];
  const v = hashVariant(ex.id, variants.length);
  let desc = variants[v];

  // Aggiungi struttura dal titolo (es. "4 vs 2")
  const struct = parseTitleStructure(ex.title);
  if (struct) {
    desc += ` L'esercitazione si sviluppa in una situazione di ${struct}.`;
  }

  // Riga organizzativa (escludo duration: è sempre il default 20 nel dataset FP5)
  const org = [];
  if (ex.players) org.push(`${ex.players} giocatori`);
  if (ex.fieldSize) org.push(`campo ${ex.fieldSize}`);
  if (org.length) desc += `\n\nOrganizzazione: ${org.join(" · ")}.`;

  // Età (solo se non "Tutte" o vuoto)
  if (ex.ageGroup && ex.ageGroup !== "Tutte") {
    desc += ` Fascia d'età consigliata: ${ex.ageGroup}.`;
  }

  return desc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const raw = readFileSync(FP5_PATH, "utf8");

// Estrai il body dell'array dal file (tutto tra il primo [ e l'ultimo ])
const match = raw.match(/export const eserciziarioFp5\s*=\s*(\[[\s\S]*\]);/);
if (!match) {
  console.error("❌ Pattern export non trovato in eserciziarioFp5.js");
  process.exit(1);
}

let exercises;
try {
  exercises = eval(match[1]); // eslint safe: solo file locale nostro
} catch (err) {
  console.error("❌ Errore parsing array:", err.message);
  process.exit(1);
}

console.log(`📚 Caricati ${exercises.length} esercizi`);

let updated = 0;

const rewritten = exercises.map((ex) => {
  const newDesc = genDescription(ex);
  const newObj  = genObjective(ex);

  const changed =
    isGarbage(ex.description) || ex.description !== newDesc ||
    isGarbage(ex.objective)   || ex.objective  !== newObj;

  if (changed) updated++;

  return {
    ...ex,
    description: newDesc,
    objective:   newObj,
  };
});

console.log(`✏️  ${updated} esercizi aggiornati`);

// Serializza in JS
const serialized = JSON.stringify(rewritten, null, 2)
  .replace(/"([^"]+)":/g, "$1:"); // rimuovi virgolette dai nomi chiave (stile JS)

const output = `// Auto-generated by scripts/rewrite-descriptions.mjs — CalcioLab style
export const eserciziarioFp5 = ${serialized};\n`;

writeFileSync(FP5_PATH, output, "utf8");
console.log("✅ eserciziarioFp5.js aggiornato con descrizioni CalcioLab!");

// Mostra campione di 3 esercizi per verifica
console.log("\n─── Campione output ───────────────────────────────────────────");
[0, 100, 500].forEach((i) => {
  const e = rewritten[i];
  console.log(`\n[${e.id}] ${e.title}`);
  console.log(`OBJECTIVE: ${e.objective}`);
  console.log(`DESCRIPTION:\n${e.description}`);
});
