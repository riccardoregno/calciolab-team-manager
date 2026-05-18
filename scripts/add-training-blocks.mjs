/**
 * add-training-blocks.mjs
 * Aggiunge trainingBlock (blocco sessione) e rpe (carico percepito) a ogni esercizio FP5.
 * Uso: node scripts/add-training-blocks.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const FILE  = resolve(__dir, "../src/data/eserciziarioFp5.js");

const CATEGORY_TO_BLOCK = {
  "Riscaldamento":        "Riscaldamento",
  "Psicocinetica":        "Riscaldamento",
  "Rapidità":             "Riscaldamento",
  "Tecnica individuale":  "Riscaldamento",
  "Possesso":             "Possesso Palla",
  "Passaggio":            "Possesso Palla",
  "Combinazione":         "Possesso Palla",
  "Scaglionamento":       "Giochi di Posizione",
  "Ampiezza":             "Giochi di Posizione",
  "Sovrapposizione":      "Giochi di Posizione",
  "Inserimento":          "Giochi di Posizione",
  "Taglio":               "Giochi di Posizione",
  "Superiorità numerica": "Small Side Games",
  "Duello":               "Small Side Games",
  "Cross":                "Small Side Games",
  "Gioco aereo":          "Small Side Games",
  "Fase offensiva":       "Partita a Tema",
  "Fase difensiva":       "Partita a Tema",
  "Pressing":             "Partita a Tema",
  "Penetrazione":         "Partita a Tema",
  "Finalizzazione":       "Partita a Tema",
  "Palle inattive":       "Partita a Tema",
  "Partita":              "Partita Finale",
  "Resistenza":           "Partita Finale",
};

function getRpe(intensity) {
  if (intensity === "Alta")  return 8;
  if (intensity === "Bassa") return 4;
  return 6;
}

const raw = readFileSync(FILE, "utf8");
const match = raw.match(/export const eserciziarioFp5\s*=\s*(\[[\s\S]*?\]);[\s\n]*$/);
if (!match) { console.error("Pattern non trovato"); process.exit(1); }

const exercises = JSON.parse(match[1]);

const updated = exercises.map((ex) => ({
  ...ex,
  trainingBlock: CATEGORY_TO_BLOCK[ex.category] || "Partita a Tema",
  rpe: ex.rpe ?? getRpe(ex.intensity),
}));

// Conta blocchi
const blockCounts = {};
updated.forEach((e) => { blockCounts[e.trainingBlock] = (blockCounts[e.trainingBlock] || 0) + 1; });

const out = [
  "// AUTO-GENERATO — training blocks + RPE aggiunti da add-training-blocks.mjs",
  "export const eserciziarioFp5 = " + JSON.stringify(updated, null, 2) + ";",
].join("\n");

writeFileSync(FILE, out, "utf8");
console.log("✅ Aggiornati", updated.length, "esercizi");
console.log("📊 Blocchi:", JSON.stringify(blockCounts, null, 2));
