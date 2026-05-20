/**
 * exerciseContent.js
 * Generates exercise-specific SVG diagrams and descriptions at runtime.
 * Replaces the 4.2 MB of category-identical base64 images stored in eserciziarioFp5.js.
 */

// ─── SVG helpers ────────────────────────────────────────────────────────────
const W = 400, H = 280;

function svgWrap(inner, label = "") {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
    `width="${W}" height="${H}" style="border-radius:12px;overflow:hidden">` +
    fieldBase() +
    inner +
    (label ? badge(label) : "") +
    `</svg>`
  );
}

function fieldBase() {
  return `<defs>
  <pattern id="fps" width="30" height="30" patternUnits="userSpaceOnUse">
    <rect width="30" height="15" fill="#1a3d26"/>
    <rect y="15" width="30" height="15" fill="#1e4a2d"/>
  </pattern>
  <marker id="fpmP" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
    <path d="M0,0L6,3L0,6Z" fill="#fbbf24"/>
  </marker>
  <marker id="fpmR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
    <path d="M0,0L6,3L0,6Z" fill="rgba(255,255,255,0.7)"/>
  </marker>
</defs>
<rect width="${W}" height="${H}" fill="#0d2818"/>
<rect width="${W}" height="${H}" fill="url(#fps)" opacity="0.6"/>
<rect x="16" y="16" width="368" height="248" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" rx="2"/>`;
}

// Player circle (r=12)
function pl(x, y, lbl, team = "own") {
  const [fill, tc] =
    team === "own"  ? ["#38bdf8", "#07192e"] :
    team === "opp"  ? ["#fb923c", "#3b1400"] :
                     ["#a3e635", "#1a3008"];
  return `<circle cx="${x}" cy="${y}" r="12" fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>` +
    `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="8.5" font-weight="800" ` +
    `font-family="system-ui,sans-serif" fill="${tc}">${lbl}</text>`;
}

// Small player (r=9, for crowded drawings)
function ps(x, y, lbl, team = "own") {
  const [fill, tc] =
    team === "own"  ? ["#38bdf8", "#07192e"] :
    team === "opp"  ? ["#fb923c", "#3b1400"] :
                     ["#a3e635", "#1a3008"];
  return `<circle cx="${x}" cy="${y}" r="9" fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>` +
    `<text x="${x}" y="${y+3}" text-anchor="middle" font-size="7" font-weight="800" ` +
    `font-family="system-ui,sans-serif" fill="${tc}">${lbl}</text>`;
}

function ball(x, y) {
  return `<circle cx="${x}" cy="${y}" r="7" fill="#fbbf24" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>` +
    `<circle cx="${x-2}" cy="${y-2}" r="2" fill="rgba(255,255,255,0.35)"/>`;
}

function pass(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fbbf24" stroke-width="1.5" marker-end="url(#fpmP)"/>`;
}

function run(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#fpmR)"/>`;
}

function goalH(cx, y, half = false) { // horizontal goal (top or bottom)
  const w = half ? 32 : 44;
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="6" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>`;
}

function goalV(x, cy, half = false) { // vertical goal (left or right side)
  const h = half ? 32 : 44;
  return `<rect x="${x}" y="${cy - h / 2}" width="6" height="${h}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>`;
}

function zone(x, y, w, h, col = "rgba(255,255,255,0.06)", stroke = "rgba(255,255,255,0.14)") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}" stroke="${stroke}" stroke-width="1" rx="4"/>`;
}

function cone(x, y) {
  return `<polygon points="${x},${y - 8} ${x - 5},${y + 4} ${x + 5},${y + 4}" fill="#f97316" opacity="0.85"/>`;
}

function badge(text) {
  const w = text.length * 7 + 14;
  return `<rect x="8" y="8" width="${w}" height="20" rx="6" fill="rgba(0,0,0,0.55)"/>` +
    `<text x="15" y="22" font-size="10" font-weight="700" font-family="system-ui,sans-serif" fill="white">${text}</text>`;
}

// ─── Specific draw functions ─────────────────────────────────────────────────

function drawRondo(nvnAtt = 6, nvnDef = 2) {
  const cx = 200, cy = 148, r = 85;
  const n = Math.min(Math.max(nvnAtt, 4), 9);
  const parts = [zone(110, 60, 180, 176)];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    const x = Math.round(cx + r * Math.cos(a));
    const y = Math.round(cy + r * Math.sin(a));
    parts.push(pl(x, y, String(i + 1)));
  }
  const defs = nvnDef >= 2 ? [[185, 138], [215, 158]] : [[200, 148]];
  defs.forEach(([x, y]) => parts.push(pl(x, y, "D", "opp")));
  parts.push(ball(cx, 73));
  parts.push(pass(cx, 67, cx - 5, 126));
  return svgWrap(parts.join(""), "Possesso");
}

function drawWarmup() {
  const cones = [[100, 110], [160, 90], [220, 110], [280, 90], [340, 110]];
  const p1 = [70, 110], p2 = [370, 110];
  const parts = [
    zone(60, 70, 320, 180),
    ...cones.map(([x, y]) => cone(x, y)),
    ...cones.map(([x, y]) => cone(x, y + 80)),
    pl(p1[0], 180, "1"), pl(p1[0] + 30, 200, "2"), pl(p1[0] + 60, 180, "3"),
    pl(p2[0], 180, "4"), pl(p2[0] - 30, 200, "5"), pl(p2[0] - 60, 180, "6"),
    ball(170, 110),
    run(82, 174, 145, 100),
    run(155, 95, 210, 104),
    run(228, 108, 282, 92),
  ];
  return svgWrap(parts.join(""), "Riscaldamento");
}

function drawTechnical() {
  const path = [[60, 220], [100, 170], [150, 220], [200, 150], [250, 220], [300, 160], [350, 210]];
  const parts = [];
  path.forEach(([x, y]) => parts.push(cone(x, y)));
  // movement arrows between cones
  for (let i = 0; i < path.length - 1; i++) {
    parts.push(run(path[i][0], path[i][1] - 5, path[i + 1][0], path[i + 1][1] - 5));
  }
  parts.push(pl(60, 248, "1"));
  parts.push(ball(60, 230));
  return svgWrap(parts.join(""), "Tecnica");
}

function drawDuel1v1() {
  const parts = [
    zone(130, 25, 140, 230),
    goalH(200, 20, true),
    pl(200, 80, "A"),
    pl(200, 155, "D", "opp"),
    pl(200, 48, "P"),
    ball(200, 110),
    run(200, 92, 200, 140),
  ];
  return svgWrap(parts.join(""), "1 vs 1");
}

function drawDuel2v1() {
  const parts = [
    zone(90, 25, 220, 230),
    goalH(200, 20),
    pl(155, 195, "A"),
    pl(245, 195, "A"),
    pl(200, 125, "D", "opp"),
    pl(200, 48, "P"),
    ball(155, 183),
    pass(155, 178, 245, 180),
    run(245, 180, 230, 100),
  ];
  return svgWrap(parts.join(""), "2 vs 1");
}

function drawSmallGame(att = 3, def = 2) {
  const parts = [
    zone(50, 40, 300, 200),
    goalV(44, 140), goalV(350, 140),
  ];
  // Attackers left side
  const aPositions = [[130, 80], [110, 145], [130, 210]].slice(0, att);
  aPositions.forEach(([x, y], i) => parts.push(pl(x, y, String(i + 1))));
  // Defenders right side
  const dPositions = [[270, 115], [270, 175], [280, 145]].slice(0, def);
  dPositions.forEach(([x, y]) => parts.push(pl(x, y, "D", "opp")));
  parts.push(ball(155, 145));
  parts.push(pass(143, 145, 200, 120));
  return svgWrap(parts.join(""), `${att}v${def}`);
}

function drawMediumGame(att = 5, def = 5) {
  const n = Math.min(att, 6);
  const attPos = [
    [90, 235], [155, 210], [200, 230], [245, 210], [310, 235],
    [200, 185],
  ].slice(0, n);
  const m = Math.min(def, 6);
  const defPos = [
    [90, 55], [155, 75], [200, 50], [245, 75], [310, 55],
    [200, 100],
  ].slice(0, m);
  const parts = [
    goalH(200, 14), goalH(200, 260),
    `<line x1="16" y1="140" x2="384" y2="140" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`,
    `<circle cx="200" cy="140" r="26" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`,
  ];
  attPos.forEach(([x, y], i) => parts.push(ps(x, y, String(i + 1))));
  defPos.forEach(([x, y], i) => parts.push(ps(x, y, String(i + 1), "opp")));
  parts.push(ball(200, 140));
  return svgWrap(parts.join(""), `${att}v${def}`);
}

function drawFullGame() {
  const ownPos = [
    [200, 262], // GK
    [90, 215], [145, 225], [255, 225], [310, 215], // defense
    [130, 165], [200, 175], [270, 165],             // midfield
    [140, 115], [200, 105], [260, 115],             // attack
  ];
  const oppPos = [
    [200, 25], // GK
    [90, 68], [145, 58], [255, 58], [310, 68],
    [130, 118], [200, 108], [270, 118],
    [140, 165], [200, 175], [260, 165],
  ];
  const parts = [
    goalH(200, 14), goalH(200, 260),
    `<line x1="16" y1="140" x2="384" y2="140" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`,
    `<circle cx="200" cy="140" r="26" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`,
    `<rect x="130" y="220" width="140" height="44" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
    `<rect x="130" y="16" width="140" height="44" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
  ];
  ownPos.forEach(([x, y], i) => parts.push(ps(x, y, i === 0 ? "P" : String(i))));
  oppPos.forEach(([x, y], i) => parts.push(ps(x, y, i === 0 ? "P" : String(i), "opp")));
  parts.push(ball(200, 140));
  return svgWrap(parts.join(""), "Partita");
}

function drawShooting(combo = false) {
  const parts = [
    goalH(200, 14),
    `<rect x="130" y="14" width="140" height="60" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
    pl(200, 45, "P"),
  ];
  if (combo) {
    parts.push(pl(120, 180, "1"), pl(200, 160, "2"), pl(280, 180, "3"));
    parts.push(ball(120, 168));
    parts.push(pass(120, 168, 200, 148));
    parts.push(pass(200, 148, 280, 168));
    parts.push(run(280, 168, 240, 80));
    parts.push(`<path d="M240,80 L215,50" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3,2" marker-end="url(#fpmP)"/>`);
  } else {
    parts.push(pl(150, 190, "1"), pl(240, 175, "2"));
    parts.push(ball(150, 178));
    parts.push(run(152, 166, 170, 80));
    parts.push(run(242, 163, 220, 70));
    parts.push(`<path d="M172,78 L205,46" stroke="#fbbf24" stroke-width="1.5" marker-end="url(#fpmP)"/>`);
  }
  return svgWrap(parts.join(""), "Finalizzazione");
}

function drawCross() {
  const parts = [
    goalH(200, 14),
    `<rect x="130" y="14" width="140" height="70" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
    pl(200, 45, "P"),
    pl(360, 90, "E"), // winger
    pl(165, 95, "1"),  // box player 1
    pl(220, 115, "2"), // box player 2
    pl(155, 200, "D", "opp"),
    ball(360, 108),
    // Curved cross arrow
    `<path d="M355,106 C300,80 240,60 220,90" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="6,3" fill="none" marker-end="url(#fpmP)"/>`,
    run(360, 80, 320, 50),
    run(165, 109, 185, 65),
  ];
  return svgWrap(parts.join(""), "Cross");
}

function drawPressing() {
  const parts = [
    zone(60, 20, 280, 100, "rgba(239,68,68,0.07)", "rgba(239,68,68,0.2)"),
    // Ball carrier + support
    pl(200, 60, "A", "opp"), pl(130, 80, "B", "opp"), pl(280, 75, "C", "opp"),
    ball(200, 72),
    // Pressing players closing in
    pl(200, 145, "1"), pl(140, 165, "2"), pl(260, 165, "3"), pl(110, 130, "4"),
    run(200, 133, 200, 80),
    run(140, 153, 160, 88),
    run(260, 153, 240, 82),
    run(112, 118, 140, 84),
  ];
  return svgWrap(parts.join(""), "Pressing");
}

function drawDefensive() {
  const parts = [
    // First defensive line
    zone(40, 80, 320, 50, "rgba(239,68,68,0.08)", "rgba(239,68,68,0.2)"),
    // Second defensive line
    zone(40, 145, 320, 50, "rgba(251,191,36,0.08)", "rgba(251,191,36,0.18)"),
    pl(80, 105, "D1", "opp"), pl(180, 98, "D2", "opp"), pl(280, 105, "D3", "opp"),
    pl(100, 170, "1"), pl(170, 162, "2"), pl(230, 162, "3"), pl(300, 170, "4"),
    pl(130, 225, "5"), pl(200, 232, "6"), pl(270, 225, "7"),
    ball(180, 80),
    pass(180, 74, 140, 45),
  ];
  return svgWrap(parts.join(""), "Fase Difensiva");
}

function drawPossession(neutral = true) {
  const parts = [zone(50, 30, 300, 220)];
  // Central players
  const own = [[140, 100], [260, 100], [140, 180], [260, 180], [200, 140]];
  own.forEach(([x, y], i) => parts.push(pl(x, y, String(i + 1))));
  // Neutrals on edges
  if (neutral) {
    parts.push(pl(50, 140, "N", "neu"), pl(350, 140, "N", "neu"));
    parts.push(pl(200, 30, "N", "neu"), pl(200, 250, "N", "neu"));
  }
  // Opponents in middle
  parts.push(pl(185, 130, "D", "opp"), pl(215, 152, "D", "opp"));
  parts.push(ball(140, 88));
  parts.push(pass(140, 88, 50, 128));
  parts.push(pass(50, 148, 140, 168));
  return svgWrap(parts.join(""), "Superiorità");
}

function drawCombination() {
  const parts = [
    pl(200, 240, "1"), pl(100, 160, "2"), pl(300, 160, "3"), pl(200, 80, "4"),
    ball(200, 228),
    pass(200, 226, 105, 168),
    pass(102, 155, 298, 155),
    pass(302, 155, 206, 86),
    run(200, 225, 200, 95),
    run(100, 155, 300, 155),
  ];
  return svgWrap(parts.join(""), "Combinazione");
}

function drawSetpiece() {
  const parts = [
    // Corner area
    `<rect x="260" y="200" width="124" height="64" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`,
    `<rect x="310" y="218" width="74" height="46" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`,
    goalH(350, 256, false),
    // Corner spot + ball
    `<circle cx="384" cy="264" r="4" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>`,
    ball(384, 264),
    pl(384, 244, "B"), // ball taker
    // Players in box
    pl(320, 240, "1"), pl(340, 228, "2"), pl(360, 218, "3"),
    pl(305, 218, "4", "opp"), pl(330, 208, "5", "opp"),
    pl(350, 250, "G", "opp"),
    `<path d="M382,258 C360,230 340,215 325,235" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="5,3" fill="none" marker-end="url(#fpmP)"/>`,
  ];
  return svgWrap(parts.join(""), "Palla Inattiva");
}

function drawAerial() {
  const parts = [
    `<rect x="130" y="14" width="140" height="70" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
    goalH(200, 14),
    pl(200, 45, "P"),
    // High ball arc
    `<path d="M60,200 C80,60 320,60 340,200" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="6,3" fill="none"/>`,
    ball(200, 58),
    pl(170, 100, "1"), pl(230, 90, "2"), pl(165, 140, "3"),
    pl(195, 120, "D", "opp"), pl(225, 130, "D", "opp"),
    run(170, 112, 185, 70),
    run(230, 102, 215, 66),
  ];
  return svgWrap(parts.join(""), "Gioco Aereo");
}

function drawOffensive() {
  const parts = [
    goalH(200, 14),
    `<rect x="130" y="14" width="140" height="70" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
    `<line x1="16" y1="140" x2="384" y2="140" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>`,
    // Build-up triangle
    pl(200, 248, "R"), pl(130, 210, "TD"), pl(270, 210, "TS"),
    pl(160, 165, "M1"), pl(240, 165, "M2"),
    pl(200, 120, "TQ"), pl(140, 90, "ES"), pl(260, 90, "ED"),
    pl(200, 50, "P9"),
    ball(200, 235),
    pass(200, 235, 132, 218),
    pass(130, 210, 158, 172),
    run(165, 155, 200, 115),
  ];
  return svgWrap(parts.join(""), "Fase Offensiva");
}

function drawFitness() {
  // Running loops across the field
  const parts = [
    `<path d="M50,70 C100,50 150,90 200,70 C250,50 300,90 350,70" stroke="#38bdf8" stroke-width="1.5" fill="none" stroke-dasharray="6,3" marker-end="url(#fpmR)"/>`,
    `<path d="M350,140 C300,160 250,120 200,140 C150,160 100,120 50,140" stroke="#38bdf8" stroke-width="1.5" fill="none" stroke-dasharray="6,3" marker-end="url(#fpmR)"/>`,
    `<path d="M50,210 C100,190 150,230 200,210 C250,190 300,230 350,210" stroke="#38bdf8" stroke-width="1.5" fill="none" stroke-dasharray="6,3" marker-end="url(#fpmR)"/>`,
    pl(50, 70, "1"), pl(200, 70, "2"), pl(350, 70, "3"),
    pl(350, 140, "4"), pl(200, 140, "5"), pl(50, 140, "6"),
    ball(200, 140),
  ];
  return svgWrap(parts.join(""), "Resistenza");
}

// ─── Classification ──────────────────────────────────────────────────────────

export function parseNvsN(title = "") {
  const m = title.match(/(\d+)\s*[Vv][Ss]\s*(\d+)/);
  return m ? { att: parseInt(m[1]), def: parseInt(m[2]) } : null;
}

export function parseFieldSize(title = "") {
  const m = title.match(/(\d+)\s*[xX×]\s*(\d+)/);
  return m ? { w: parseInt(m[1]), h: parseInt(m[2]) } : null;
}

function classify(ex) {
  const t = (ex.title + " " + (ex.tags || []).join(" ")).toLowerCase();
  const cat = (ex.category || "").toLowerCase();

  if (/rondo|torello/.test(t))                           return "rondo";
  if (/riscaldamento/.test(t))                           return "warmup";
  if (/tecnica individuale|birilli|fosso|a secco|psico/.test(t)) return "technical";
  if (/cross/.test(t) || cat === "cross")               return "cross";
  if (/pressing|riaggressione/.test(t))                 return "pressing";
  if (/palle inattive|punizione|calcio.d.angolo|set.?piece/.test(t) || cat === "palle inattive") return "setpiece";
  if (/fase difensiva|scaglionamento/.test(t) || cat === "fase difensiva" || cat === "scaglionamento") return "defensive";
  if (/reparti|corridoi|fase offensiva/.test(t) || cat === "fase offensiva") return "offensive";
  if (/gioco aereo|colpo di testa/.test(t) || cat === "gioco aereo") return "aerial";
  if (/resistenza/.test(t) || cat === "resistenza")     return "fitness";
  if (/tiro|finalizzaz/.test(t) || cat === "finalizzazione") return "shooting";
  if (/combinazione|passaggio|sovrapposizione|taglio|inserimento/.test(t) ||
      ["combinazione", "passaggio", "taglio", "sovrapposizione", "inserimento"].includes(cat)) return "combination";
  if (/ampiezza|fascia/.test(t) || cat === "ampiezza")  return "cross";
  if (/superi/.test(t) || cat === "superiorità numerica") return "possession";
  if (/possesso/.test(t) || cat === "possesso")         return "rondo";
  if (/partita/.test(cat))                              return "fullgame";

  // NvN based classification
  const nvn = parseNvsN(ex.title);
  if (nvn) {
    if (nvn.att === 1 && nvn.def === 1) return "duel1v1";
    if (nvn.att === 2 && nvn.def === 1) return "duel2v1";
    if (nvn.att + nvn.def <= 6)         return "smallgame";
    if (nvn.att + nvn.def <= 14)        return "mediumgame";
    return "fullgame";
  }

  return "rondo"; // default
}

// ─── Main SVG generator ──────────────────────────────────────────────────────

export function generateExerciseSvg(ex) {
  const type = classify(ex);
  const nvn  = parseNvsN(ex.title);

  switch (type) {
    case "rondo":      return drawRondo(nvn?.att ?? 6, nvn?.def ?? 2);
    case "warmup":     return drawWarmup();
    case "technical":  return drawTechnical();
    case "duel1v1":    return drawDuel1v1();
    case "duel2v1":    return drawDuel2v1();
    case "smallgame":  return drawSmallGame(nvn?.att ?? 3, nvn?.def ?? 2);
    case "mediumgame": return drawMediumGame(nvn?.att ?? 5, nvn?.def ?? 5);
    case "fullgame":   return drawFullGame();
    case "shooting":   return drawShooting(nvn?.att >= 3);
    case "cross":      return drawCross();
    case "pressing":   return drawPressing();
    case "defensive":  return drawDefensive();
    case "possession": return drawPossession(true);
    case "combination":return drawCombination();
    case "setpiece":   return drawSetpiece();
    case "aerial":     return drawAerial();
    case "offensive":  return drawOffensive();
    case "fitness":    return drawFitness();
    default:           return drawRondo();
  }
}

// ─── Description generator ───────────────────────────────────────────────────

// Returns true if the stored description is auto-generated generic text
export function isGenericDescription(desc = "") {
  const GENERIC_PATTERNS = [
    "Lavoro di possesso palla strutturato per sviluppare la fluidità",
    "Partita finale libera: momento di applicazione globale",
    "Esercitazione di fase difensiva con scaglionamento",
    "Lavoro tattico di fase difensiva",
    "Esercitazione di organizzazione difensiva",
    "Situazione tattica di scaglionamento",
    "Esercitazione tecnico-tattica di mantenimento palla",
    "Esercitazione di tecnica individuale, progettata per perfezionare",
    "Lavoro di resistenza specifica con transizioni",
    "Esercitazione di resistenza in forma di gioco",
    "Situazione di resistenza con la palla",
    "Situazione di gioco in superiorità numerica locale",
    "Esercitazione di possesso in superiorità",
    "Situazione di finalizzazione con percorso tecnico",
    "Esercitazione di attacco alla porta con sviluppi combinati",
    "Situazione di pressing organizzato",
    "Esercitazione di pressing offensivo",
    "Lavoro sulle palle inattive con sviluppi prestabiliti",
    "Esercitazione di palla inattiva con varianti",
    "Lavoro di rapidità applicata",
    "Esercitazione di rapidità con la palla",
    "Situazione di rapidità e cambio direzionale",
    "Esercitazione di combinazione tecnica, progettata per sviluppare",
    "Situazione combinata con scambi veloci",
    "Lavoro di penetrazione con sviluppo combinato",
    "Situazione di 1vs1 offensivo e penetrazione",
    "Esercitazione tecnica sulla penetrazione",
    "Situazione tecnica di passaggio e ricezione",
    "Lavoro tecnico sul passaggio in movimento",
    "Esercitazione di passaggio sotto pressione temporale",
    "Situazione di gioco con movimento sovrapposto",
    "Esercitazione sulla sovrapposizione esterna",
    "Esercitazione tecnico-tattica sulla fascia",
    "Situazione di gioco sugli esterni con finalizzazione",
    "Esercitazione di rifinitura con palla a terra e cross",
    "Situazione combinata con inserimento del terzo uomo",
    "Lavoro tattico sull'inserimento e il dialogo a tre",
    "Lavoro tattico sulle catene laterali",
    "Esercitazione di possesso con sviluppo sulle fasce",
    "Esercitazione sul gioco aereo, progettata per sviluppare",
    "Lavoro tattico di fase offensiva organizzata",
    "Esercitazione di costruzione e sviluppo offensivo",
    "Situazione di attivazione",
    "Esercitazione di attivazione neuro",
    "Lavoro di attivazione tecnica",
    "Partita conclusiva della seduta",
    "Lavoro di duello in spazio ridotto",
    "Esercitazione sul duello individuale",
    "Situazione di duello diretto con finalizzazione",
  ];
  return GENERIC_PATTERNS.some(p => desc.includes(p));
}

const NAMED_EXERCISES = {
  "ruba palla":    () => buildDesc("Griglia 20×20 m. Un giocatore inizia come 'rubapalla' al centro.", "Tutti i giocatori conducono una palla all'interno della griglia. Il rubapalla (o i rubapalla) deve calciare fuori la palla degli avversari. Chi perde la palla si aggiunge ai rubapalla.", "Sviluppare protezione del pallone, corpo tra palla e avversario, cambi di direzione in spazio ridotto."),
  "la zona franca": () => buildDesc("Campo 30×25 m diviso in zone. Zona franca al centro.", "Le squadre mantengono il possesso. Chi riesce a ricevere o condurre nella zona franca guadagna un punto. Vince chi raggiunge il punteggio obiettivo.", "Gestire gli spazi, trovare il varco nella zona centrale, sviluppare il terzo uomo."),
  "l' interspazio": () => buildDesc("Campo 25×20 m. Due squadre di 4-6 giocatori.", "Il giocatore in possesso deve servire un compagno che riceve negli spazi tra le linee (interspazio). Punti assegnati solo per ricezione nell'interspazio con buona qualità di tocco.", "Sviluppare la ricerca e l'occupazione degli spazi interlinea, la visione periferica del portatore."),
  "i birilli":     () => buildDesc("Area 20×10 m con birilli/cinesini. 1 giocatore per corsia.", "Il giocatore conduce il pallone nello slalom tra i birilli usando entrambi i piedi. Varianti: solo piede debole, cambio ritmo, conclusione finale.", "Migliorare il controllo della palla in conduzione, l'uso del piede debole e la coordinazione."),
  "il fosso":      () => buildDesc("Due linee parallele separate da uno spazio ('fosso'). Giocatori su ogni lato.", "I giocatori si scambiano passaggi a due tocchi. Al segnale, uno attraversa il fosso per ricevere dall'altra parte. Chi sbaglia tocca e riparte.", "Migliorare la precisione del passaggio, il controllo orientato e il timing dei movimenti."),
  "le 11 porte":   () => buildDesc("Campo grande (60×40 m) con 11 mini-porte distribuite. Due squadre.", "Si gioca a campo aperto. Si segna passando la palla a un compagno attraverso una qualsiasi delle 11 mini-porte. Cambiare spesso porta, sfruttare tutta l'ampiezza.", "Mobilità senza palla, utilizzo di tutto il campo, visione globale per trovare le porte libere."),
  "gremlin":       () => buildDesc("Campo 30×20 m. Squadra in possesso vs 2-3 'gremlin' che pressano.", "I Gremlin non si possono muovere a caso: devono restare nella loro metà ma sono veloci nel pressing. La squadra in possesso mantiene la palla con tocchi limitati.", "Resistenza al pressing coordinato, velocità di circolazione, prendere le giuste decisioni sotto pressione."),
  "carlos santaba": () => buildDesc("Metà campo. Due squadre + portieri.", "Lavoro di pressing con trigger codificati: al segnale dell'allenatore la squadra fuori palla scatta in pressing coordinato. Obiettivo: recuperare la palla entro 5 secondi.", "Pressing sincronizzato, comunicazione tra linee, trigger di riaggressione collettiva."),
  "cockatrice":    () => buildDesc("Area di rigore + fascia. Vari attaccanti + portiere.", "Attacchi in serie: combinazione sulla fascia, appoggio a centrocampo, ripartenza in velocità e conclusione. Schema ripetuto da entrambi i lati.", "Automatizzare la fase di rifinitura, sviluppare la fluidità nelle combinazioni offensive in area."),
  "ranger":        () => buildDesc("Campo largo. Due squadre di 6-8 giocatori.", "Possesso con la regola: ogni passaggio deve avanzare o cambiare lato. Vietato il passaggio indietro orizzontale nella propria metà. Il possesso senza avanzamento non conta.", "Verticalizzazione, velocità di gioco in avanzamento, sviluppare il coraggio di giocare in avanti."),
};

function buildDesc(setup, svolgimento, obiettivo) {
  return `Setup: ${setup}\nSvolgimento: ${svolgimento}\nObiettivo: ${obiettivo}`;
}

function generateByPattern(ex) {
  const t = ex.title.toLowerCase();
  const cat = (ex.category || "").toLowerCase();
  const nvn = parseNvsN(ex.title);
  const fs  = parseFieldSize(ex.title);
  const titleClean = ex.title.replace(/^[A-Z]+-\d+ — /, "").trim();

  // NvsN specific descriptions
  if (nvn) {
    const { att, def } = nvn;
    const fieldStr = fs ? `${fs.w}×${fs.h} m` : "area adeguata al formato";
    const neutralMatch = ex.title.match(/\+\s*(\d+)/);
    const neutrals = neutralMatch ? parseInt(neutralMatch[1]) : 0;

    if (att === 1 && def === 1) {
      const variant = titleClean.toLowerCase();
      if (/quattro porte/.test(variant))
        return buildDesc(
          `Campo 20×15 m con 4 mini-porte agli angoli. 1v1 senza portiere.`,
          "I giocatori si contendono il possesso; ognuno può segnare in qualsiasi delle 4 porte. Cambi di direzione continui per trovare il varco.",
          "Velocità di reazione, cambio di ritmo, lettura difensiva nel duello individuale."
        );
      if (/porte sfalsate/.test(variant))
        return buildDesc(
          `Corridoio 20×12 m con 2 mini-porte sfalsate su ogni lato. 1v1.`,
          "L'attaccante tenta di superare il difensore e segnare in una delle porte. Il difensore deve neutralizzare e transizionare in attacco.",
          "Dribbling in spazio stretto, orientamento difensivo, rapidità di transizione."
        );
      return buildDesc(
        `Corridoio ${fieldStr}. 1 attaccante vs 1 difensore + portiere.`,
        "L'attaccante parte con la palla e tenta di superare il difensore per concludere in porta. Il difensore deve intercettare o spingere fuori corridoio.",
        "Duello individuale offensivo, forza atletica 1v1, dribbling sotto pressione."
      );
    }

    if (att === 2 && def === 1)
      return buildDesc(
        `Corridoio ${fieldStr}. 2 attaccanti vs 1 difensore${neutrals ? ` + ${neutrals} sponde` : ""}.`,
        "La coppia attaccante sfrutta la superiorità con passaggi veloci o conduzione verso il varco. Il difensore tenta di recuperare o ritardare.",
        "Sfruttare la superiorità 2v1 con decisione rapida, uno-due, selezione del momento giusto."
      );

    if (att === 3 && def === 1)
      return buildDesc(
        `Griglia ${fieldStr}. 3 giocatori + 1 difensore centrale (torello).`,
        "I 3 giocatori mantengono il possesso con max 2 tocchi. Il difensore intercetta: chi sbaglia entra in mezzo.",
        "Possesso in spazio ridotto, triangolazioni rapide, gestione della pressione."
      );

    if (att === 4 && def === 2 && (t.includes("torello") || t.includes("rondo")))
      return buildDesc(
        `Griglia 12×12 m. 4 giocatori in cerchio + 2 difensori centrali (torello/rondo).`,
        "I 4 esterni mantengono il possesso con max 2 tocchi; i 2 centrali intercettano. Chi perde la palla va in mezzo.",
        "Possesso sotto pressione, triangolazioni, anticipazione del pressing, velocità esecutiva."
      );

    if (att + def <= 7)
      return buildDesc(
        `Campo ${fieldStr}. ${att} attaccanti vs ${def} difensori${neutrals ? ` + ${neutrals} neutrali/sponde` : ""}.`,
        `La squadra in attacco gestisce la superiorità numerica cercando la conclusione o mantenendo il possesso. I ${def} difensori pressano e tentano la riconquista.`,
        `Sfruttare la superiorità ${att}v${def}: scelta del momento di verticalizzare vs mantenere.`
      );

    if (att + def <= 12)
      return buildDesc(
        `Campo ${fieldStr}. ${att} vs ${def} con portieri.`,
        "Partitella a tema: la squadra in possesso costruisce dal basso applicando i principi della sessione. Transizioni immediate al cambio palla.",
        `Applicazione tattica in formato ridotto ${att}v${def}: principi di reparto in spazio limitato.`
      );

    return buildDesc(
      `Campo ${fieldStr}. ${att} vs ${def}.`,
      "Le due squadre si affrontano applicando gli automatismi della sessione. Cambio palla immediato, transizioni rapide.",
      `Applicazione pratica in contesto ${att}v${def}: gestione delle fasi di gioco.`
    );
  }

  // Category-specific with richer context
  switch (cat) {
    case "possesso":
      return buildDesc(
        `Griglia 20-25 m. Due squadre + eventuali giocatori neutri.`,
        "Le squadre si alternano nel mantenimento del possesso con numero di tocchi limitato. Al cambio palla il pressing è immediato.",
        "Velocità di circolazione, trovare le linee di passaggio, resistenza al pressing avversario."
      );
    case "finalizzazione":
      return buildDesc(
        `Metà campo. Attaccanti con/senza combinazione, portiere in porta.`,
        "Sviluppo dell'azione offensiva con combinazioni prestabilite e conclusione finale. Ogni giocatore lavora sulla qualità del tiro (piatto, incrociato, potente).",
        "Precisione e qualità della conclusione in porta, timing dell'attacco alla palla."
      );
    case "pressing":
      return buildDesc(
        `Metà campo o campo intero. Due squadre + portieri.`,
        "La squadra fuori palla scatta in pressing coordinato al trigger concordato (passaggio all'indietro, controllo sbagliato, ecc.). Obiettivo: recupero entro 5-6 sec.",
        "Pressing sincronizzato, comunicazione tra linee, trigger di riaggressione collettiva."
      );
    case "fase difensiva":
    case "scaglionamento":
      return buildDesc(
        `Metà campo. Blocco difensivo vs catena offensiva.`,
        "La squadra difensiva si organizza in blocco compatto con le giuste distanze. Lavoro su copertura preventiva, scaglionamento e uscite sul portatore.",
        "Compattezza difensiva, comunicazione tra i reparti, distanze corrette tra le linee."
      );
    case "fase offensiva":
      return buildDesc(
        `Metà campo o campo intero. Reparti in posizione.`,
        "Lavoro posizionale: ogni reparto applica i propri principi offensivi in sincronia. Costruzione dal basso, superamento delle linee, rifinitura e finalizzazione.",
        "Automatizzare la fase offensiva di squadra, fluidità nelle transizioni tra costruzione e rifinitura."
      );
    case "tecnica individuale":
      return buildDesc(
        `Porzione di campo con cinesini, birilli o porte. Un giocatore per corsia.`,
        "L'atleta esegue il percorso tecnico prestabilito: conduzione, finte, cambi di direzione, eventuale conclusione. Ripetizioni alternate piede forte/debole.",
        "Migliorare il gesto tecnico individuale in condizioni di lavoro controllato, automatizzare il gesto."
      );
    case "resistenza":
      return buildDesc(
        `Campo grande o intero campo. Squadra o gruppi di lavoro.`,
        "Esercitazione ad alta intensità con lavoro continuo (20-45 s) alternato a recupero attivo. La palla è sempre presente per mantenere il contesto tecnico.",
        "Migliorare la capacità aerobica specifica, tolleranza al lattato, qualità tecnica sotto fatica."
      );
    case "riscaldamento":
      return buildDesc(
        `Area delimitata o percorso sul campo. Tutti i giocatori.`,
        "Attivazione progressiva: mobilità articolare, skip e coordinazione, cambio di direzione e accelerazioni brevi. Eventuale esercizio tecnico leggero con palla.",
        "Preparare il sistema neuro-muscolare, alzare la temperatura corporea, ridurre il rischio infortuni."
      );
    case "combinazione":
      return buildDesc(
        `Area 20×20 m. Gruppi di 3-5 giocatori.`,
        "Schema combinativo prestabilito (triangle, uno-due, dai-e-vai) ripetuto in serie. Rotazione automatica delle posizioni dopo ogni sequenza.",
        "Automatizzare le combinazioni tecnico-tattiche a due e tre, sincronismo nei movimenti senza palla."
      );
    case "passaggio":
      return buildDesc(
        `Area 15-25 m. Gruppi di 4-8 giocatori.`,
        "Circolazione del pallone con schemi di passaggio codificati (incroci, tagli, sponde). Max 2 tocchi, con movimento obbligatorio dopo ogni passaggio.",
        "Precisione e velocità del passaggio, automatizzare il movimento senza palla, sincronismo."
      );
    case "cross":
    case "ampiezza":
      return buildDesc(
        `Fascia + area di rigore. Esterno + 2-3 attaccanti + portiere.`,
        "L'esterno conduce palla, supera il terzino (o riceve dal regista) e serve il cross al momento giusto. I compagni attaccano il cross con movimenti coordinati.",
        "Qualità del cross (raso, teso, a rientrare), timing del taglio e attacco alla palla in area."
      );
    case "duello":
      return buildDesc(
        `Corridoio 15×12 m. 1 attaccante vs 1 difensore.`,
        "Duello diretto con o senza porta: l'attaccante tenta di superare il difensore, il difensore imposta la postura corretta per neutralizzare.",
        "Forza atletica nel duello individuale, tecnica difensiva di anticipo e contrasto, competitività."
      );
    case "superiorità numerica":
      return buildDesc(
        `Campo 25-35 m. Squadra in superiorità + avversari.`,
        "La squadra numericamente superiore gestisce il possesso cercando il varco per la conclusione o mantenendo per il tempo prefissato. I difensori lavorano su compattezza.",
        "Sfruttare la superiorità numerica: velocità di circolazione, trovare il giocatore libero, verticalizzare."
      );
    case "gioco aereo":
      return buildDesc(
        `Area di rigore o zona alta. Giocatori + portiere.`,
        "Cross o lanci alti verso l'area: attaccanti e difensori si contendono il pallone aereo. Focus su postura, tempo di salto e orientamento del colpo di testa.",
        "Migliorare la tecnica di colpo di testa (centro, deviazione), timing del salto, duello aereo."
      );
    case "palle inattive":
      return buildDesc(
        `Zona specifica (fascia, limite area, corner). Tutti i reparti coinvolti.`,
        "Esecuzione ripetuta degli schemi di palla inattiva codificati: movimenti, trigger e assegnazioni precise per ogni giocatore in fase offensiva e difensiva.",
        "Automatizzare gli schemi di palla inattiva, responsabilizzare ogni giocatore sulla propria zona."
      );
    default:
      return buildDesc(
        `Campo adeguato al numero di giocatori. Squadre bilanciate.`,
        `Esercitazione di ${ex.category || "allenamento"} con focus sui principi tecnico-tattici della seduta. Transizioni immediate, intensità controllata dall'allenatore.`,
        `Consolidare i principi di ${ex.category || "gioco"} all'interno del modello di gioco della squadra.`
      );
  }
}

export function generateExerciseDescription(ex) {
  const titleClean = ex.title.replace(/^[A-Z]+-\d+ — /, "").trim().toLowerCase();

  // Check named exercise lookup
  for (const [key, fn] of Object.entries(NAMED_EXERCISES)) {
    if (titleClean.includes(key)) return fn(ex);
  }

  return generateByPattern(ex);
}

export function generateExerciseObjective(ex) {
  const desc = generateExerciseDescription(ex);
  const lines = desc.split("\n");
  const objLine = lines.find(l => l.startsWith("Obiettivo:"));
  return objLine ? objLine.replace("Obiettivo:", "").trim() : ex.objective || "";
}

/**
 * Returns the image SVG string for an exercise.
 * For FP5 catalog exercises (source === "fp5"), always generates a fresh SVG.
 * For personal exercises with a stored image, returns that image.
 */
export function getExerciseImage(ex) {
  if (ex.source === "fp5" || !ex.image) {
    return generateExerciseSvg(ex);
  }
  return ex.image; // user-uploaded or tactical board base64
}

/**
 * Returns the description for an exercise.
 * For FP5 catalog exercises, generates a specific description.
 * For personal exercises, returns the stored description unless it's generic.
 */
export function getExerciseDescription(ex) {
  if (ex.source === "fp5" || isGenericDescription(ex.description)) {
    return generateExerciseDescription(ex);
  }
  return ex.description || "";
}
