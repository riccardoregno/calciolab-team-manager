/**
 * generateDistintaPDF
 * Genera la distinta di gara in formato PDF con jsPDF.
 *
 * Struttura:
 *  - Header: logo società, nome squadra, gara, data/ora
 *  - Tabella giocatori: N° | Cognome e Nome | Data nascita | Ruolo | T/P
 *  - Sezione staff (opzionale)
 *  - Area firme arbitro + delegato
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Costanti colori ─────────────────────────────────────────────────────────
const C = {
  dark:   [15,  23,  42],
  accent: [37,  99, 235],
  white:  [255, 255, 255],
  muted:  [100, 116, 139],
  light:  [241, 245, 249],
  border: [203, 213, 225],
  green:  [22,  163,  74],
  rowAlt: [248, 250, 252],
};

// ─── Helper: formatta data ─────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

// ─── Helper: split nome in cognome/nome per ordinamento ───────────────────
function splitName(fullName = "") {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return { cognome: parts[0], nome: "" };
  // Convenzione: primo token = nome, resto = cognome (come nei DB calcio italiano)
  const nome    = parts[0];
  const cognome = parts.slice(1).join(" ");
  return { cognome, nome };
}

// ─── Mappa ruolo → abbreviazione FIGC ─────────────────────────────────────
const ROLE_SHORT = {
  "Portiere":         "POR",
  "Difensore":        "DIF",
  "Difensore centrale": "DIF",
  "Terzino destro":   "DIF",
  "Terzino sinistro": "DIF",
  "Centrocampista":   "CEN",
  "Mediano":          "CEN",
  "Mezzala":          "CEN",
  "Regista":          "CEN",
  "Trequartista":     "CEN",
  "Attaccante":       "ATT",
  "Ala destra":       "ATT",
  "Ala sinistra":     "ATT",
  "Prima punta":      "ATT",
  "Seconda punta":    "ATT",
};

const ROLE_ORDER = ["Portiere", "DIF", "CEN", "ATT"];

function getRoleShort(role = "") {
  return ROLE_SHORT[role] || role.slice(0, 3).toUpperCase() || "—";
}

function getRoleSortOrder(role = "") {
  const s = getRoleShort(role);
  const idx = ROLE_ORDER.indexOf(s === "POR" ? "Portiere" : s);
  return idx >= 0 ? idx : 99;
}

// ─── Principale ───────────────────────────────────────────────────────────
/**
 * @param {object} match         - oggetto match normalizzato
 * @param {object[]} allPlayers  - tutta la rosa
 * @param {object} profile       - workspaceProfile da appSettings
 * @param {object[]} [staffList] - membri dello staff (opzionale)
 */
export function generateDistintaPDF(match, allPlayers, profile = {}, staffList = [], options = {}) {
  const doc = options.doc || new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw  = doc.internal.pageSize.width;   // 210
  const ph  = doc.internal.pageSize.height;  // 297

  // ── Dati base ─────────────────────────────────────────────────────────────
  const clubName    = profile.teamName || profile.clubName || "CalcioLab";
  const opponent    = match.opponent   || "Avversario";
  const competition = [match.competition, match.matchday ? `Giornata ${match.matchday}` : ""]
    .filter(Boolean).join(" — ");
  const isHome      = match.location === "Casa";
  const homeTeam    = isHome ? clubName   : opponent;
  const awayTeam    = isHome ? opponent   : clubName;
  const venue       = match.venueName || (isHome ? profile.homeFieldName : "") || "";

  // ── Giocatori convocati ───────────────────────────────────────────────────
  const calledIds = new Set([
    ...(match.convocazione?.playerIds || []),
    ...(match.lineup?.calledUpIds     || []),
  ].map(String));
  const starterIds = new Set((match.lineup?.starterIds || []).map(String));
  const captainId  = String(match.lineup?.captainId || "");

  const calledPlayers = allPlayers
    .filter((p) => calledIds.has(String(p.id)))
    .map((p) => ({
      ...p,
      isStarter: starterIds.has(String(p.id)),
    }))
    .sort((a, b) => {
      // Prima per ruolo, poi per numero maglia
      const roleDiff = getRoleSortOrder(a.role) - getRoleSortOrder(b.role);
      if (roleDiff !== 0) return roleDiff;
      return Number(a.shirtNumber || 99) - Number(b.shirtNumber || 99);
    });

  // Se non c'è nessuno convocato ma la rosa esiste, usiamo tutta la rosa (fallback)
  const playersToList = calledPlayers.length > 0
    ? calledPlayers
    : allPlayers
        .filter((p) => (p.status || "Disponibile") === "Disponibile")
        .sort((a, b) => Number(a.shirtNumber || 99) - Number(b.shirtNumber || 99));

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoY = 14;
  if (profile.logo) {
    try {
      // Determina il formato dall'header base64
      const fmt = profile.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(profile.logo, fmt, 14, logoY, 20, 20);
    } catch { /* logo non supportato — salta */ }
  }

  // ── Intestazione ─────────────────────────────────────────────────────────
  const headerX = profile.logo ? 38 : 14;

  doc.setFillColor(...C.accent);
  doc.rect(0, 0, pw, 36, "F");

  doc.setTextColor(...C.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(clubName.toUpperCase(), headerX, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (competition) doc.text(competition, headerX, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${homeTeam}  vs  ${awayTeam}`, pw / 2, 28, { align: "center" });

  // ── Info gara ─────────────────────────────────────────────────────────────
  doc.setFillColor(...C.light);
  doc.rect(0, 36, pw, 16, "F");
  doc.setTextColor(...C.dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const infoItems = [
    match.date   ? `Data: ${fmtDate(match.date)}` : null,
    match.time   ? `Ore: ${match.time}` : null,
    venue        ? `Campo: ${venue}` : null,
    match.location ? `${isHome ? "🏠 Casa" : "✈ Trasferta"}` : null,
  ].filter(Boolean);

  const infoStr = infoItems.join("   |   ");
  doc.text(infoStr, pw / 2, 43, { align: "center" });

  // ── Titolo tabella ────────────────────────────────────────────────────────
  let y = 54;
  doc.setFillColor(...C.accent);
  doc.roundedRect(14, y, pw - 28, 7, 1, 1, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("LISTA CALCIATORI", pw / 2, y + 4.5, { align: "center" });

  // ── Tabella giocatori ─────────────────────────────────────────────────────
  y = 62;

  const rows = playersToList.map((p) => {
    const { cognome, nome } = splitName(p.name);
    const tp    = calledPlayers.length > 0
      ? (p.isStarter ? "T" : "P")
      : "";
    const cap   = String(p.id) === captainId ? " (C)" : "";

    return [
      p.shirtNumber || "—",
      `${cognome.toUpperCase()}${cap}`,
      nome,
      fmtDate(p.birthDate),
      getRoleShort(p.role),
      tp,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["N°", "Cognome", "Nome", "Data nascita", "Ruolo", "T/P"]],
    body: rows,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: C.dark,
      lineColor: C.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 48, fontStyle: "bold" },
      2: { cellWidth: 38 },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 10, halign: "center" },
    },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      // Evidenzia titolari
      if (data.section === "body" && data.column.index === 5 && data.cell.text[0] === "T") {
        data.cell.styles.textColor = C.green;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ── Legenda ───────────────────────────────────────────────────────────────
  const afterTable = doc.lastAutoTable.finalY + 4;
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.setFont("helvetica", "italic");
  doc.text("T = Titolare  |  P = Panchina  |  (C) = Capitano  |  POR = Portiere  |  DIF = Difensore  |  CEN = Centrocampista  |  ATT = Attaccante",
    14, afterTable);

  // ── Staff ─────────────────────────────────────────────────────────────────
  let staffY = afterTable + 8;

  if (staffList.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.setFillColor(...C.dark);
    doc.roundedRect(14, staffY, pw - 28, 6, 1, 1, "F");
    doc.setTextColor(...C.white);
    doc.text("STAFF TECNICO", pw / 2, staffY + 4, { align: "center" });
    staffY += 8;

    const staffRows = staffList.map((s) => [
      s.name || "—",
      s.role ? (s.role.charAt(0).toUpperCase() + s.role.slice(1).replace(/([A-Z])/g, " $1").trim()) : "—",
    ]);

    autoTable(doc, {
      startY: staffY,
      head: [["Nominativo", "Ruolo"]],
      body: staffRows,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: C.dark, lineColor: C.border, lineWidth: 0.2 },
      headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: "bold", fontSize: 8 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 60 } },
      alternateRowStyles: { fillColor: C.rowAlt },
      margin: { left: 14, right: 14 },
    });

    staffY = doc.lastAutoTable.finalY + 6;
  } else {
    staffY += 4;
  }

  // ── Area firme ────────────────────────────────────────────────────────────
  const sigY = Math.max(staffY, ph - 42);

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);

  // Firma allenatore
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  const sigW = (pw - 28 - 10) / 3;

  [[14, "Allenatore"], [14 + sigW + 5, "Arbitro"], [14 + (sigW + 5) * 2, "Delegato / Ufficiale"]].forEach(([x, lbl]) => {
    doc.text(lbl, x, sigY);
    doc.line(x, sigY + 10, x + sigW, sigY + 10);
    doc.setFontSize(7);
    doc.text("Firma", x, sigY + 14);
    doc.setFontSize(8);
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Generato da CalcioLab · calciolab.org · ${new Date().toLocaleDateString("it-IT")}`,
    pw / 2, ph - 6, { align: "center" }
  );

  // ── Salva ─────────────────────────────────────────────────────────────────
  if (options.save === false) return doc;
  const dateStr = match.date ? match.date.slice(0, 10) : "senza-data";
  const opponentSlug = (match.opponent || "avversario").replace(/\s+/g, "-").toLowerCase();
  doc.save(`distinta-${opponentSlug}-${dateStr}.pdf`);
}
