/**
 * rename-fp5-titles.mjs
 * Applica la naming convention CalcioLab agli esercizi FP5 già parsati.
 *
 * Formato: [COD]-NNN — Titolo In Title Case
 * Esempi : POS-001 — La Zona Franca
 *          PAS-012 — Triangolo Di Supporto
 *          FIN-003 — Conclusione Rapida
 *
 * Uso: node scripts/rename-fp5-titles.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dir  = dirname(fileURLToPath(import.meta.url));
const INPUT  = resolve(__dir, "../src/data/eserciziarioFp5.js");
const OUTPUT = INPUT; // sovrascrive il file originale

// ─── Codici categoria ─────────────────────────────────────────────────────────
const CAT_CODE = {
  "Ampiezza":             "AMP",
  "Combinazione":         "COM",
  "Cross":                "CRO",
  "Duello":               "DUE",
  "Fase difensiva":       "DEF",
  "Fase offensiva":       "OFF",
  "Finalizzazione":       "FIN",
  "Gioco aereo":          "AER",
  "Inserimento":          "INS",
  "Palle inattive":       "SET",
  "Partita":              "PAR",
  "Passaggio":            "PAS",
  "Penetrazione":         "PEN",
  "Possesso":             "POS",
  "Pressing":             "PRE",
  "Psicocinetica":        "PSI",
  "Rapidità":             "RAP",
  "Resistenza":           "RES",
  "Riscaldamento":        "RIS",
  "Scaglionamento":       "SCA",
  "Sovrapposizione":      "SOV",
  "Superiorità numerica": "SUP",
  "Taglio":               "TAG",
  "Tecnica individuale":  "TEC",
};

// Parole italiane da non mettere in Title Case (articoli, preposizioni, congiunzioni)
const LOWERCASE_WORDS = new Set([
  "a","al","allo","alla","ai","agli","alle","con","da","dal","dallo","dalla",
  "dai","dagli","dalle","del","dello","della","dei","degli","delle","di","e",
  "ed","i","il","in","l","la","le","lo","ma","nel","nello","nella","nei",
  "negli","nelle","o","per","su","sul","sulla","sui","sugli","sulle","un",
  "una","uno","su","tra","fra","che","se","non","come","più",
]);

// ─── Pulizia titolo originale ─────────────────────────────────────────────────
function cleanOriginalTitle(raw) {
  let t = raw
    // Rimuovi prefisso già applicato da rename precedente: "POS-001 — "
    .replace(/^[A-Z]{2,4}-\d{1,4}\s*[—–-]+\s*/i, "")
    // Rimuovi "N.X — " o "N.X - " in testa
    .replace(/^N\s*\.\s*\d+\s*[—–-]+\s*/i, "")
    // Rimuovi "ESERCIZIO N X" generico
    .replace(/^ESERCIZIO\s+N\.?\s*\d+\s*/i, "")
    // Rimuovi "ESERCITAZIONE" generico
    .replace(/^ESERCITAZIONE\s+(N\.?\s*\d+)?\s*/i, "")
    // Rimuovi solo virgolette doppie (NON l'apostrofo — serve per l'italiano)
    .replace(/["""]+/g, "")
    .trim();

  if (!t) return "";

  // Title Case intelligente
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      // Sempre maiuscola la prima parola
      if (i === 0) return capitalize(word);
      // Articoli/prep rimangono minuscoli (tranne inizio frase)
      if (LOWERCASE_WORDS.has(word)) return word;
      return capitalize(word);
    })
    .join(" ");
}

function capitalize(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ─── Titolo fallback da categoria ────────────────────────────────────────────
// Per gli esercizi senza titolo originale usiamo la categoria come base,
// non la fase (che è già visibile come campo separato nella card).
const CATEGORY_LABEL = {
  "Ampiezza":             "Ampiezza Di Gioco",
  "Combinazione":         "Combinazione",
  "Cross":                "Cross",
  "Duello":               "Duello",
  "Fase difensiva":       "Fase Difensiva",
  "Fase offensiva":       "Fase Offensiva",
  "Finalizzazione":       "Finalizzazione",
  "Gioco aereo":          "Gioco Aereo",
  "Inserimento":          "Inserimento",
  "Palle inattive":       "Palla Inattiva",
  "Partita":              "Partita",
  "Passaggio":            "Passaggio",
  "Penetrazione":         "Penetrazione",
  "Possesso":             "Possesso Palla",
  "Pressing":             "Pressing",
  "Psicocinetica":        "Psicocinetica",
  "Rapidità":             "Rapidità",
  "Resistenza":           "Resistenza",
  "Riscaldamento":        "Riscaldamento",
  "Scaglionamento":       "Scaglionamento",
  "Sovrapposizione":      "Sovrapposizione",
  "Superiorità numerica": "Superiorità Numerica",
  "Taglio":               "Taglio",
  "Tecnica individuale":  "Tecnica Individuale",
};

function fallbackTitle(category) {
  return CATEGORY_LABEL[category] || cleanOriginalTitle(category) || category;
}

function isGeneric(title) {
  return /^esercizio\s+n\.?\s*\d+\s*$/i.test(title.trim());
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log("📖 Lettura eserciziarioFp5.js...");
  const raw = readFileSync(INPUT, "utf8");

  // Estrae l'array JSON dal file JS (export default [...] o export const)
  const match = raw.match(/export const eserciziarioFp5\s*=\s*(\[[\s\S]*\]);/);
  if (!match) {
    console.error("❌ Impossibile trovare export const eserciziarioFp5 nel file.");
    process.exit(1);
  }

  let exercises;
  try {
    exercises = JSON.parse(match[1]);
  } catch (e) {
    console.error("❌ Errore parsing JSON:", e.message);
    process.exit(1);
  }

  console.log(`✅ ${exercises.length} esercizi caricati`);

  // Contatore progressivo per categoria
  const counters = {};

  const renamed = exercises.map((ex) => {
    const cat  = ex.category || "Esercizio";
    const code = CAT_CODE[cat] || cat.slice(0, 3).toUpperCase();

    counters[code] = (counters[code] || 0) + 1;
    const n = String(counters[code]).padStart(3, "0");
    const prefix = `${code}-${n}`;

    // Determina il titolo pulito
    let cleanTitle;
    if (isGeneric(ex.title)) {
      cleanTitle = fallbackTitle(cat);
    } else {
      cleanTitle = cleanOriginalTitle(ex.title);
      if (!cleanTitle) cleanTitle = fallbackTitle(cat);
    }

    return {
      ...ex,
      title: `${prefix} — ${cleanTitle}`,
    };
  });

  // Statistiche
  const renamed_count = renamed.filter((e, i) => e.title !== exercises[i].title).length;
  console.log(`✏️  ${renamed_count} titoli aggiornati`);

  // Campione
  console.log("\n📋 Campione titoli:");
  renamed.slice(0, 15).forEach((e) => console.log(`  ${e.title}`));

  // Scrivi file
  const jsContent = [
    "// AUTO-GENERATO da scripts/parse-fp5.mjs + rename-fp5-titles.mjs",
    "// Naming convention: [COD]-NNN — Titolo In Title Case",
    "// Categorie: " + Object.entries(CAT_CODE).map(([k, v]) => `${v}=${k}`).join(", "),
    "export const eserciziarioFp5 = " + JSON.stringify(renamed, null, 2) + ";",
  ].join("\n");

  writeFileSync(OUTPUT, jsContent, "utf8");
  console.log(`\n✅ File scritto: ${OUTPUT}`);
  console.log(`   Dimensione: ${(jsContent.length / 1024 / 1024).toFixed(2)} MB`);
}

run().catch((e) => { console.error(e); process.exit(1); });
