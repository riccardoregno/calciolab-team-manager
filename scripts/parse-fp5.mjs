/**
 * parse-fp5.mjs  —  Legge ESERCIZIARIO 2.fp5 → src/data/eserciziarioFp5.js
 *
 *   node scripts/parse-fp5.mjs "D:/ESERCIZIARIO  2.fp5"
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const fp5Path = process.argv[2] || "D:/ESERCIZIARIO  2.fp5";
console.log("📂 Lettura:", fp5Path);
const buf = readFileSync(fp5Path);
console.log("📦 Dimensione:", (buf.length / 1024 / 1024).toFixed(1), "MB");

// ─── Mappatura categorie → CalcioLab ────────────────────────────────────────
const CAT_MAP = [
  [/passaggio a muro/i,     { cat: "Passaggio",            phase: "Fase offensiva",       intensity: "Media"  }],
  [/possesso palla|possesso/i, { cat: "Possesso",           phase: "Possesso consolidato", intensity: "Media"  }],
  [/ampiezza/i,             { cat: "Ampiezza",              phase: "Fase offensiva",       intensity: "Media"  }],
  [/penetrazione/i,         { cat: "Penetrazione",          phase: "Fase offensiva",       intensity: "Alta"   }],
  [/scaglionamento/i,       { cat: "Scaglionamento",        phase: "Fase offensiva",       intensity: "Media"  }],
  [/superiorit/i,           { cat: "Superiorità numerica",  phase: "Fase offensiva",       intensity: "Alta"   }],
  [/tiro in porta|conclusione/i, { cat: "Finalizzazione",   phase: "Conclusione",          intensity: "Alta"   }],
  [/corsa in diagonale|inserimento/i, { cat: "Inserimento", phase: "Fase offensiva",       intensity: "Alta"   }],
  [/sovrapposizione|sovrapp/i, { cat: "Sovrapposizione",    phase: "Fase offensiva",       intensity: "Alta"   }],
  [/incrocio/i,             { cat: "Combinazione",          phase: "Fase offensiva",       intensity: "Alta"   }],
  [/cross/i,                { cat: "Cross",                 phase: "Finalizzazione",       intensity: "Alta"   }],
  [/colpo di testa/i,       { cat: "Gioco aereo",           phase: "Finalizzazione",       intensity: "Alta"   }],
  [/taglio/i,               { cat: "Taglio",                phase: "Fase offensiva",       intensity: "Alta"   }],
  [/pressing/i,             { cat: "Pressing",              phase: "Non possesso",         intensity: "Alta"   }],
  [/contrasto/i,            { cat: "Fase difensiva",        phase: "Non possesso",         intensity: "Alta"   }],
  [/blocco/i,               { cat: "Palle inattive",        phase: "Palle inattive",       intensity: "Media"  }],
  [/rapidit/i,              { cat: "Rapidità",              phase: "Preparazione fisica",  intensity: "Alta"   }],
  [/resistenza/i,           { cat: "Resistenza",            phase: "Preparazione fisica",  intensity: "Alta"   }],
  [/1 vs 1|duello/i,        { cat: "Duello",                phase: "Fase offensiva",       intensity: "Alta"   }],
  [/partita/i,              { cat: "Partita",               phase: "Partita",              intensity: "Media"  }],
  [/riscaldamento/i,        { cat: "Riscaldamento",         phase: "Riscaldamento",        intensity: "Bassa"  }],
  [/psicocinetica/i,        { cat: "Psicocinetica",         phase: "Riscaldamento",        intensity: "Bassa"  }],
  [/dominio della palla/i,  { cat: "Possesso",              phase: "Possesso consolidato", intensity: "Media"  }],
  [/torello/i,              { cat: "Possesso",              phase: "Possesso consolidato", intensity: "Media"  }],
  [/difesa|difensiv/i,      { cat: "Fase difensiva",        phase: "Non possesso",         intensity: "Alta"   }],
  [/attacco|offensiv/i,     { cat: "Fase offensiva",        phase: "Fase offensiva",       intensity: "Alta"   }],
  [/combinazione|terzo uomo/i, { cat: "Combinazione",       phase: "Fase offensiva",       intensity: "Alta"   }],
  [/passaggio/i,            { cat: "Passaggio",             phase: "Fase offensiva",       intensity: "Media"  }],
];

function mapCategory(text) {
  for (const [re, val] of CAT_MAP) {
    if (re.test(text)) return val;
  }
  return { cat: "Tecnica individuale", phase: "Tecnica", intensity: "Media" };
}

// ─── PARSING BINARIO ─────────────────────────────────────────────────────────
function parseFp5(buf) {
  const records = [];
  const seen    = new Set();

  for (let i = 0; i < buf.length - 20; i++) {
    // Cerca "ESERC" bytes: 45 53 45 52 43
    if (buf[i]!==69||buf[i+1]!==83||buf[i+2]!==69||buf[i+3]!==82||buf[i+4]!==67) continue;

    // Leggi 2500 bytes dal punto trovato
    const end = Math.min(i + 2500, buf.length);
    const raw = buf.slice(i, end);

    // Converti in testo: non-printable → "|", 0x0D/0x0A → spazio
    let text = "";
    for (let j = 0; j < raw.length; j++) {
      const c = raw[j];
      if ((c >= 0x20 && c <= 0x7E) || (c >= 0xC0 && c <= 0xFF)) {
        text += String.fromCharCode(c);
      } else if (c === 0x0D || c === 0x0A) {
        text += " ";
      } else {
        text += "|";
      }
    }

    // Estrai numero esercizio (dopo "ESERC. N" o "ESERC N" con 0-3 separatori)
    const numMatch = text.match(/ESERC\.?\s*N\.?\|*\s*(\d{1,4})/i);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1], 10);
    if (!num || num > 2000 || seen.has(num)) continue;
    seen.add(num);

    // Descrizione: fino al primo campo strutturato (|S|, |H|, |O|, |P|, |N|, |I|, |T|)
    const descEnd = text.search(/\|[SHIOPNTG]\|/);
    const descRaw = (descEnd > 20 ? text.slice(0, descEnd) : text.slice(0, 800));

    // Pulizia descrizione
    const desc = descRaw
      .replace(/\|+/g, " ")
      .replace(/  +/g, " ")
      .trim()
      .slice(0, 1000);

    // Campi strutturati dopo la desc
    const fieldRe = /\|([SHIOPNTBG])\|([^|]{2,120})/g;
    const fields  = {};
    let fm;
    while ((fm = fieldRe.exec(text)) !== null) {
      const [, key, val] = fm;
      if (!fields[key]) fields[key] = val.replace(/\|+/g, " ").trim().slice(0, 150);
    }

    records.push({ num, desc, fields });
  }

  records.sort((a, b) => a.num - b.num);
  return records;
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function extractMaterial(text) {
  const parts = [];
  if (/palloni/i.test(text))  parts.push("Palloni");
  if (/cinesini/i.test(text)) parts.push("Cinesini");
  if (/casacche/i.test(text)) parts.push("Casacche");
  if (/sagome/i.test(text))   parts.push("Sagome");
  if (/paletti/i.test(text))  parts.push("Paletti");
  if (/ostacoli/i.test(text)) parts.push("Ostacoli");
  if (/porte/i.test(text) || /portier/i.test(text)) parts.push("Porte");
  return parts.length ? parts.join(", ") : "Palloni, cinesini";
}

function extractFieldSize(text) {
  const m = /(\d{1,3})\s*[xX×]\s*(\d{1,3})/g.exec(text);
  if (!m) return "";
  const [,w,h] = m;
  if (+w > 0 && +h > 0 && +w <= 120 && +h <= 120) return `${w}x${h} mt`;
  return "";
}

function extractPlayerCount(text, fieldsS) {
  if (fieldsS) {
    const m = /(\d{1,2})/.exec(fieldsS);
    if (m) return m[1];
  }
  let m;
  m = /(\d{1,2})\s*vs\s*(\d{1,2})/i.exec(text);
  if (m) return String(+m[1] + +m[2]);
  m = /N\.?\s*gioc\.?\s*(\d{1,2})/i.exec(text);
  if (m) return m[1];
  m = /(\d{1,2})\s*giocatori/i.exec(text);
  if (m) return m[1];
  return "";
}

function extractVariant(text) {
  const m = /VARIANTE[^:]*[:\s]([\s\S]{5,250})/i.exec(text);
  return m ? m[1].replace(/\|+/g, " ").trim().slice(0, 250) : "";
}

function extractObjective(text) {
  let m;
  m = /FINALIT[AÀ][^:]*[:\s]([\s\S]{5,150})/i.exec(text);
  if (m) return m[1].replace(/\|+/g, " ").trim().slice(0, 150);
  m = /OBIETTIV[OI][^:]*[:\s]([\s\S]{5,150})/i.exec(text);
  if (m) return m[1].replace(/\|+/g, " ").trim().slice(0, 150);
  m = /SCOPO[^:]*[:\s]([\s\S]{5,150})/i.exec(text);
  if (m) return m[1].replace(/\|+/g, " ").trim().slice(0, 150);
  return "";
}

function extractPureDesc(text) {
  // Rimuove l'intestazione ESERC. N xxx dal testo
  return text.replace(/^ESERC\.? N\.? \d+[\s\S]{0,60}?[.:]\s*/i, "").trim();
}

function buildTitle(num, desc) {
  // Prendi la prima frase significativa
  const clean = desc.replace(/^ESERC\.? N\.? \d+\.?\s*/i, "").trim();
  const first = clean.split(/[.!?]/)[0].trim();
  if (first.length > 8 && first.length < 80) return `N.${num} — ${first}`;
  return `Esercizio N.${num}`;
}

function buildTags(text, catObj) {
  const src = text.toLowerCase();
  const candidates = [
    "passaggio","possesso","dribbling","tiro","pressing","cross","colpo di testa",
    "penetrazione","ampiezza","sovrapposizione","incrocio","transizione","rapidità",
    "portiere","1vs1","duello","torello","rondo","partita","riscaldamento",
    "costruzione","smarcamento","combinazione","difesa",
  ];
  const tags = candidates.filter((t) => src.includes(t)).slice(0, 5);
  if (!tags.includes(catObj.cat.toLowerCase())) tags.unshift(catObj.cat.toLowerCase());
  return tags.slice(0, 5);
}

function guessDifficulty(text, playerCount) {
  const n = parseInt(playerCount) || 0;
  if (n >= 18 || /avanzat|complesso/i.test(text)) return "Avanzato";
  if (n <= 6 || /base|semplice|inizial/i.test(text)) return "Base";
  return "Intermedio";
}

function guessAgeGroup(text) {
  if (/giovanil|under|primavera|youth|sett\. giov/i.test(text)) return "Giovani";
  if (/adulti|professionis/i.test(text)) return "Adulti";
  return "Tutte";
}

// ─── SVG GENERATOR ───────────────────────────────────────────────────────────
const W = 400, H = 280;
const C = {
  fieldMid:  "#1a3d26", fieldLight: "#1e4a2d", fieldDark: "#0d2818",
  lineColor: "rgba(255,255,255,0.22)",
  teamA:     "#38bdf8", teamB: "#fb923c", teamN: "#a3e635",
  ball:      "#fbbf24", cone: "#fbbf24", goal: "rgba(255,255,255,0.6)",
  arrowP:    "#fbbf24", arrowR: "rgba(255,255,255,0.7)",
};

const SVG_BASE = () => [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="border-radius:12px;overflow:hidden">`,
  `<defs>`,
  `<pattern id="str" width="30" height="30" patternUnits="userSpaceOnUse">`,
  `<rect width="30" height="15" fill="${C.fieldMid}"/>`,
  `<rect y="15" width="30" height="15" fill="${C.fieldLight}"/>`,
  `</pattern>`,
  `<marker id="mP" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6Z" fill="${C.arrowP}"/></marker>`,
  `<marker id="mR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6Z" fill="${C.arrowR}"/></marker>`,
  `</defs>`,
  `<rect width="${W}" height="${H}" fill="${C.fieldDark}"/>`,
  `<rect width="${W}" height="${H}" fill="url(#str)" opacity="0.6"/>`,
].join("");

const FIELD_LINES = (p = 16) => [
  `<rect x="${p}" y="${p}" width="${W-p*2}" height="${H-p*2}" fill="none" stroke="${C.lineColor}" stroke-width="1.5" rx="2"/>`,
  `<line x1="${p}" y1="${H/2}" x2="${W-p}" y2="${H/2}" stroke="${C.lineColor}" stroke-width="1"/>`,
  `<circle cx="${W/2}" cy="${H/2}" r="28" fill="none" stroke="${C.lineColor}" stroke-width="1"/>`,
  `<circle cx="${W/2}" cy="${H/2}" r="2" fill="${C.lineColor}"/>`,
  `<rect x="${W/2-50}" y="${H-p-40}" width="100" height="40" fill="none" stroke="${C.lineColor}" stroke-width="1"/>`,
  `<rect x="${W/2-22}" y="${H-p-18}" width="44" height="18" fill="none" stroke="${C.lineColor}" stroke-width="0.8"/>`,
  `<rect x="${W/2-18}" y="${H-p-2}" width="36" height="6" fill="none" stroke="${C.goal}" stroke-width="2"/>`,
  `<rect x="${W/2-50}" y="${p}" width="100" height="40" fill="none" stroke="${C.lineColor}" stroke-width="1"/>`,
  `<rect x="${W/2-18}" y="${p-4}" width="36" height="6" fill="none" stroke="${C.goal}" stroke-width="2"/>`,
].join("");

const PLR  = (x,y,lbl,t="A") => {
  const bg = t==="A"?C.teamA:t==="B"?C.teamB:C.teamN;
  const fg = t==="A"?"#07192e":t==="B"?"#3b1400":"#1a2e00";
  const s  = String(lbl||t).slice(0,3);
  return `<circle cx="${x}" cy="${y}" r="12" fill="${bg}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>`+
         `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="8.5" font-weight="800" font-family="system-ui,sans-serif" fill="${fg}">${s}</text>`;
};
const CONE = (x,y) => `<polygon points="${x},${y-7} ${x-5},${y+4} ${x+5},${y+4}" fill="${C.cone}" opacity="0.9"/>`;
const BALL = (x,y) => `<circle cx="${x}" cy="${y}" r="7" fill="${C.ball}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>`+
                      `<circle cx="${x-2}" cy="${y-2}" r="2" fill="rgba(255,255,255,0.35)"/>`;
const PASS = (x1,y1,x2,y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.arrowP}" stroke-width="1.5" marker-end="url(#mP)"/>`;
const RUN  = (x1,y1,x2,y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.arrowR}" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#mR)"/>`;
const LABEL= (text) => `<rect x="8" y="8" width="${text.length*7+14}" height="20" rx="6" fill="rgba(0,0,0,0.55)"/>`+
                       `<text x="15" y="22" font-size="10" font-weight="700" font-family="system-ui,sans-serif" fill="white">${text}</text>`;

const TEMPLATES = {
  "Possesso": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(200,70,"A"), PLR(280,120,"B"), PLR(260,200,"C"), PLR(140,200,"D"), PLR(120,120,"E"),
    PLR(200,140,"X","B"), PLR(195,165,"Y","B"),
    BALL(200,56), PASS(200,64,272,117), RUN(260,188,148,193),
    LABEL("Possesso"),
    "</svg>",
  ].join(""),

  "Passaggio": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(80,230,"A"), PLR(200,200,"B"), PLR(320,230,"C"), PLR(200,130,"D"),
    BALL(80,215), PASS(92,224,186,204), PASS(212,196,312,228), RUN(200,188,200,144),
    LABEL("Passaggio"),
    "</svg>",
  ].join(""),

  "Penetrazione": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(200,220,"A"), PLR(130,180,"B"), PLR(270,180,"C"), PLR(200,140,"D"),
    PLR(165,100,"Dif","B"), PLR(235,100,"Dif","B"),
    BALL(200,205), PASS(200,208,200,154), RUN(200,128,200,68), RUN(130,168,155,108), RUN(270,168,245,108),
    LABEL("Penetrazione"),
    "</svg>",
  ].join(""),

  "Finalizzazione": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(130,200,"A"), PLR(270,200,"B"), PLR(200,160,"C"), PLR(200,100,"POR","B"),
    BALL(130,185), PASS(142,195,186,164), RUN(200,148,200,78), RUN(270,188,240,96),
    LABEL("Tiro in porta"),
    "</svg>",
  ].join(""),

  "Scaglionamento": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(100,240,"A"), PLR(200,240,"B"), PLR(300,240,"C"),
    PLR(150,180,"D"), PLR(250,180,"E"), PLR(200,120,"F"),
    BALL(100,225), PASS(112,237,188,183), PASS(162,177,238,177), RUN(250,168,210,128),
    LABEL("Scaglionamento"),
    "</svg>",
  ].join(""),

  "Ampiezza": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(40,200,"E"), PLR(360,200,"E"), PLR(200,200,"A"), PLR(200,150,"B"), PLR(200,110,"C"),
    PLR(200,80,"POR","B"),
    BALL(40,185), PASS(52,196,186,202), PASS(212,197,348,196), RUN(360,186,290,108),
    LABEL("Ampiezza"),
    "</svg>",
  ].join(""),

  "Sovrapposizione": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(120,210,"T"), PLR(200,180,"A"), PLR(270,200,"E"), PLR(340,130,"E"),
    PLR(290,100,"Dif","B"),
    BALL(200,166), PASS(212,177,258,198), RUN(120,198,330,138), RUN(270,188,330,138),
    LABEL("Sovrapposizione"),
    "</svg>",
  ].join(""),

  "Superiorità numerica": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(160,210,"A"), PLR(240,210,"B"), PLR(200,170,"C"), PLR(160,130,"D"), PLR(240,130,"E"),
    PLR(190,95,"Def","B"), PLR(210,95,"Def","B"),
    BALL(160,195), PASS(172,206,226,206), RUN(240,198,230,144), RUN(160,198,170,144),
    LABEL("Sup. numerica"),
    "</svg>",
  ].join(""),

  "Pressing": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(150,80,"A","B"), PLR(250,80,"B","B"), PLR(200,50,"C","B"),
    PLR(140,130,"M","B"), PLR(260,130,"M","B"), PLR(200,110,"M","B"),
    PLR(200,190,"P"),
    BALL(200,190), RUN(150,95,190,185), RUN(250,95,210,185), RUN(200,65,200,180),
    LABEL("Pressing"),
    "</svg>",
  ].join(""),

  "Inserimento": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(120,220,"A"), PLR(200,200,"B"), PLR(280,220,"C"), PLR(320,140,"D"),
    PLR(200,90,"POR","B"), PLR(250,130,"Def","B"),
    BALL(120,205), PASS(132,216,188,203), RUN(280,208,310,148), RUN(320,128,290,90),
    LABEL("Inserimento"),
    "</svg>",
  ].join(""),

  "Cross": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(50,180,"E"), PLR(200,120,"A"), PLR(240,150,"B"), PLR(160,145,"C"),
    PLR(200,80,"POR","B"),
    BALL(50,165), RUN(62,175,150,135), RUN(50,152,50,90), PASS(55,90,185,128),
    LABEL("Cross"),
    "</svg>",
  ].join(""),

  "Gioco aereo": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(80,160,"E"), PLR(200,100,"A"), PLR(200,80,"POR","B"), PLR(180,105,"Def","B"),
    BALL(200,88), RUN(80,148,80,90), PASS(85,88,185,102), RUN(200,88,200,60),
    LABEL("Gioco aereo"),
    "</svg>",
  ].join(""),

  "Duello": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(200,200,"A"), PLR(200,130,"Def","B"), PLR(200,80,"POR","B"),
    BALL(200,185), RUN(200,188,200,144),
    CONE(180,155), CONE(220,155),
    LABEL("Duello 1v1"),
    "</svg>",
  ].join(""),

  "Combinazione": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(130,220,"A"), PLR(240,210,"B"), PLR(180,165,"C"), PLR(290,155,"D"),
    PLR(200,90,"POR","B"),
    BALL(130,205), PASS(142,215,226,213), RUN(240,198,280,160), PASS(292,148,220,95),
    LABEL("Combinazione"),
    "</svg>",
  ].join(""),

  "Taglio": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(120,220,"A"), PLR(260,210,"B"), PLR(200,175,"C"), PLR(320,140,"D"),
    PLR(200,90,"POR","B"),
    BALL(120,205), PASS(132,215,246,213), RUN(200,163,290,100), RUN(320,128,280,92),
    LABEL("Taglio"),
    "</svg>",
  ].join(""),

  "Fase difensiva": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(150,200,"A","B"), PLR(250,195,"B","B"),
    PLR(200,155,"Def"), PLR(240,170,"Def"), PLR(165,168,"Def"),
    BALL(150,185), RUN(157,193,165,174), RUN(248,187,243,175),
    LABEL("Difesa"),
    "</svg>",
  ].join(""),

  "Fase offensiva": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(130,220,"A"), PLR(200,200,"B"), PLR(270,220,"C"),
    PLR(170,155,"D"), PLR(230,155,"E"), PLR(200,110,"F"),
    PLR(200,80,"POR","B"),
    BALL(130,205), PASS(142,215,186,202), RUN(200,188,198,120), RUN(198,108,198,82),
    LABEL("Fase offensiva"),
    "</svg>",
  ].join(""),

  "Palle inattive": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(200,240,"BAT"), PLR(165,100,"1°"), PLR(200,90,"2°"), PLR(235,100,"3°"),
    PLR(170,60,"BLK"), PLR(230,60,"BLK"),
    PLR(200,75,"POR","B"), PLR(185,95,"Def","B"), PLR(215,95,"Def","B"),
    BALL(200,240), RUN(200,228,195,108), RUN(165,115,175,68), RUN(235,115,225,68),
    LABEL("Palle inattive"),
    "</svg>",
  ].join(""),

  "Rapidità": () => [
    SVG_BASE(), FIELD_LINES(20),
    CONE(80,240),CONE(120,240),CONE(160,200),CONE(200,180),CONE(240,200),CONE(280,240),CONE(320,240),
    PLR(80,200,"A"),
    RUN(92,200,108,240), RUN(120,228,148,207), RUN(160,193,192,186),
    RUN(200,174,230,197), RUN(240,208,268,240),
    LABEL("Rapidità"),
    "</svg>",
  ].join(""),

  "Resistenza": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(80,230,"A"), PLR(200,230,"B"), PLR(320,230,"C"),
    PLR(140,170,"D"), PLR(260,170,"E"), PLR(200,110,"F"),
    CONE(80,200),CONE(140,150),CONE(200,90),CONE(260,150),CONE(320,200),
    RUN(80,218,128,177), RUN(140,158,192,117), RUN(200,98,248,148), RUN(260,158,312,207),
    LABEL("Resistenza"),
    "</svg>",
  ].join(""),

  "Partita": () => {
    const own = [[200,240],[100,200],[300,200],[150,160],[250,160],[200,120],[80,130],[320,130]];
    const opp = [[200,40],[100,80],[300,80],[150,120],[250,120],[200,160]];
    return [
      SVG_BASE(), FIELD_LINES(),
      ...own.map(([x,y],i)=>PLR(x,y,String(i+1),"A")),
      ...opp.map(([x,y],i)=>PLR(x,y,String(i+1),"B")),
      BALL(200,200), LABEL("Partita"), "</svg>",
    ].join("");
  },

  "Riscaldamento": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(100,200,"A"), PLR(180,220,"B"), PLR(260,200,"C"),
    PLR(140,150,"D"), PLR(220,145,"E"),
    BALL(100,185), PASS(112,196,166,218), PASS(192,216,248,202), RUN(100,188,128,156),
    LABEL("Riscaldamento"),
    "</svg>",
  ].join(""),

  "Psicocinetica": () => {
    const pts = [[80,200],[160,230],[240,200],[320,230],[80,140],[320,140]];
    const lbls = ["A","B","C","D","E","F"];
    return [
      SVG_BASE(), FIELD_LINES(),
      ...pts.map(([x,y],i)=>PLR(x,y,lbls[i],"N")),
      BALL(pts[0][0],pts[0][1]-14),
      PASS(92,195,148,228), PASS(172,226,228,202), PASS(252,196,308,228), RUN(80,188,80,154),
      LABEL("Psicocinetica"), "</svg>",
    ].join("");
  },

  "Tecnica individuale": () => [
    SVG_BASE(), FIELD_LINES(),
    PLR(200,200,"A"),
    CONE(160,160), CONE(200,130), CONE(240,160), CONE(200,180),
    BALL(200,185), RUN(200,188,200,144), RUN(200,130,160,165), RUN(160,168,196,184),
    LABEL("Tecnica"), "</svg>",
  ].join(""),
};

function generateSVG(cat) {
  const fn = TEMPLATES[cat] || TEMPLATES["Tecnica individuale"];
  try {
    return "data:image/svg+xml;base64," + Buffer.from(fn()).toString("base64");
  } catch {
    return "";
  }
}

// ─── BUILD EXERCISE OBJECT ───────────────────────────────────────────────────
function buildExercise(record) {
  const { num, desc, fields } = record;

  // Obiettivo categoria: prima dalla descrizione, poi dai campi O/P
  const fullText = desc + " " + Object.values(fields).join(" ");
  const catObj   = mapCategory(fullText);

  const objective = extractObjective(desc) || catObj.cat;
  const fieldSize = extractFieldSize(desc) || (fields.I ? fields.I.trim() : "");
  const players   = extractPlayerCount(desc, fields.S);
  const material  = extractMaterial(desc + " " + (fields.H || ""));
  const variant   = extractVariant(desc);
  const cleanDesc = extractPureDesc(desc);
  const difficulty= guessDifficulty(desc, players);
  const ageGroup  = guessAgeGroup(desc);
  const tags      = buildTags(fullText, catObj);
  const image     = generateSVG(catObj.cat);

  return {
    id:            `fp5-${num}`,
    title:         buildTitle(num, desc),
    category:      catObj.cat,
    phase:         catObj.phase,
    objective,
    duration:      "20",
    players,
    intensity:     catObj.intensity,
    difficulty,
    fieldSize,
    material,
    coachingPoints: "",
    variants:      variant,
    description:   cleanDesc.slice(0, 800),
    image,
    premium:       false,
    tags,
    ageGroup,
    playersRange:  players ? `${players}` : "",
    goal:          catObj.cat,
    source:        "fp5",
    sourceNum:     num,
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
function run() {
  const records   = parseFp5(buf);
  console.log("✅ Record trovati:", records.length);

  const exercises = records.map(buildExercise);

  // Stats categorie
  const catCount = {};
  exercises.forEach(e => { catCount[e.category] = (catCount[e.category]||0)+1; });
  console.log("\nCategorie:");
  Object.entries(catCount).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(" ",c+":",n));

  // Output
  const outPath = resolve("src/data/eserciziarioFp5.js");
  const date    = new Date().toISOString().slice(0,10);
  const content = [
    "// AUTO-GENERATO da scripts/parse-fp5.mjs",
    "// Estratto da ESERCIZIARIO 2.fp5 il " + date,
    "// " + exercises.length + " esercizi — disegni SVG per categoria",
    "",
    "export const eserciziarioFp5 = " + JSON.stringify(exercises, null, 2) + ";",
    "",
    "export default eserciziarioFp5;",
    "",
  ].join("\n");

  writeFileSync(outPath, content, "utf8");
  const sizeMB = (Buffer.byteLength(content, "utf8") / 1024 / 1024).toFixed(1);
  console.log("\n📄 Scritto:", outPath, "(" + sizeMB + " MB)");
  console.log("📊 Totale:", exercises.length, "esercizi con SVG diagram");
}

run();
