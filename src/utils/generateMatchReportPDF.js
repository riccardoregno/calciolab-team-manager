import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  dark:    [15,  23,  42],   // #0f172a
  mid:     [30,  41,  59],   // #1e293b
  accent:  [37,  99, 235],   // #2563eb
  accentL: [96, 165, 250],   // #60a5fa
  white:   [255, 255, 255],
  muted:   [148, 163, 184],  // #94a3b8
  green:   [34,  197,  94],  // #22c55e
  red:     [239,  68,  68],  // #ef4444
  border:  [51,  65,  85],   // #334155
};

function fmt(date) {
  if (!date) return "—";
  try { return new Date(date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
}

function sectionHeader(doc, title, y) {
  doc.setFillColor(...C.accent);
  doc.roundedRect(14, y, doc.internal.pageSize.width - 28, 8, 2, 2, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 18, y + 5.5);
  return y + 13;
}

function addPageChrome(doc, teamName) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;

  doc.setFillColor(...C.dark);
  doc.rect(0, 0, W, 14, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.accentL);
  doc.text("⚽ CalcioLab", 14, 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(teamName || "", W - 14, 9, { align: "right" });

  doc.setDrawColor(...C.border);
  doc.line(14, H - 10, W - 14, H - 10);
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`Pagina ${doc.internal.getCurrentPageInfo().pageNumber}`, W / 2, H - 5, { align: "center" });
}

function box(doc, label, value, x, y, w, h) {
  doc.setFillColor(...C.mid);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.muted);
  doc.text(label.toUpperCase(), x + 4, y + 6);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.white);
  const lines = doc.splitTextToSize(String(value || "—"), w - 8);
  doc.text(lines.slice(0, 4), x + 4, y + 12);
}

function getLineup(match) {
  const lineup = match.lineup || {};
  return {
    starterIds: lineup.starters || lineup.starterIds || [],
    benchIds: lineup.bench || lineup.benchIds || [],
    roles: lineup.roles || {},
    captainId: lineup.captainId || null,
  };
}

/**
 * Genera e scarica il referto gara (post-match report) in PDF.
 *
 * @param {object} opts
 * @param {object} opts.match
 * @param {array}  opts.players
 * @param {object} opts.appSettings
 */
export function generateMatchReportPDF({ match, players = [], appSettings = {} }) {
  if (!match) return;

  const doc = new jsPDF({ unit: "mm", format: "a4", putOnlyUsedFonts: true });
  const W = doc.internal.pageSize.width;
  const teamName = appSettings?.workspaceProfile?.clubName || "La mia squadra";
  const report = match.postMatch || {};

  addPageChrome(doc, teamName);
  let y = 22;

  // ── Header partita ──────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.accentL);
  doc.text("REFERTO GARA", 14, y);
  y += 6;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text(`${teamName} vs ${match.opponent || "—"}`, 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(
    [fmt(match.date), match.competition || "", match.location || ""].filter(Boolean).join("  ·  "),
    14, y
  );
  y += 4;

  // Risultato
  const gs = match.goalsScored ?? match.goals_scored;
  const gc = match.goalsConceded ?? match.goals_conceded;
  if (gs !== undefined && gc !== undefined) {
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    const outcome = Number(gs) > Number(gc) ? C.green : Number(gs) < Number(gc) ? C.red : C.muted;
    doc.setTextColor(...outcome);
    doc.text(`${gs} - ${gc}`, W - 14, 26, { align: "right" });
  }

  y += 8;

  // ── Formazione ───────────────────────────────────────────────────────────
  y = sectionHeader(doc, "Formazione", y);
  const lineup = getLineup(match);
  const starters = lineup.starterIds.map((id) => players.find((p) => String(p.id) === String(id))).filter(Boolean);
  const bench = lineup.benchIds.map((id) => players.find((p) => String(p.id) === String(id))).filter(Boolean);

  const formationRows = Math.max(starters.length, bench.length, 1);
  const startersBody = [];
  for (let i = 0; i < formationRows; i++) {
    const s = starters[i];
    const b = bench[i];
    startersBody.push([
      s ? `${s.shirtNumber ? `${s.shirtNumber}. ` : ""}${s.name}${lineup.captainId && String(s.id) === String(lineup.captainId) ? " (C)" : ""}` : "",
      b ? `${b.shirtNumber ? `${b.shirtNumber}. ` : ""}${b.name}` : "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Titolari", "Riserve"]],
    body: startersBody,
    headStyles: { fillColor: C.mid, textColor: C.accentL, fontSize: 8, fontStyle: "bold" },
    styles: { fillColor: C.dark, textColor: C.white, fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [20, 30, 48] },
    theme: "plain",
    margin: { left: 14, right: 14 },
  });

  // ── Analisi post-gara ────────────────────────────────────────────────────
  y = doc.lastAutoTable.finalY + 10;
  if (y > 230) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
  y = sectionHeader(doc, "Analisi post-gara", y);

  const boxW = (W - 28 - 8) / 2;
  const boxH = 26;
  const analysisFields = [
    ["Cosa ha funzionato", report.worked],
    ["Cosa non ha funzionato", report.notWorked],
    ["Episodi chiave", report.keyMoments],
    ["Focus settimana prossima", report.nextWeekFocus],
    ["Correzioni tattiche", report.tacticalCorrections],
    ["Azioni in allenamento", report.trainingActions],
  ];

  for (let i = 0; i < analysisFields.length; i += 2) {
    if (y + boxH > 280) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
    const [l1, v1] = analysisFields[i];
    box(doc, l1, v1, 14, y, boxW, boxH);
    if (analysisFields[i + 1]) {
      const [l2, v2] = analysisFields[i + 1];
      box(doc, l2, v2, 14 + boxW + 8, y, boxW, boxH);
    }
    y += boxH + 6;
  }

  // ── Giocatori e situazione fisica ───────────────────────────────────────
  if (y + 26 > 280) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
  const positivePlayers = Array.isArray(report.positivePlayers)
    ? report.positivePlayers.map((id) => players.find((p) => String(p.id) === String(id))?.name || id).filter(Boolean).join(", ")
    : (report.positivePlayers || "");
  box(doc, "Giocatori in evidenza", positivePlayers, 14, y, boxW, boxH);
  box(doc, "Allarmi fisici", report.physicalAlerts, 14 + boxW + 8, y, boxW, boxH);
  y += boxH + 6;

  // ── Note set piece e video ──────────────────────────────────────────────
  if (y + 26 > 280) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
  box(doc, "Calci piazzati", report.setPiecesReview, 14, y, boxW, boxH);
  box(doc, "Decisioni staff", report.staffDecisions, 14 + boxW + 8, y, boxW, boxH);
  y += boxH + 6;

  // ── Clip video ───────────────────────────────────────────────────────────
  const videoClips = match.videoAnalysis || [];
  if (videoClips.length) {
    if (y > 230) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
    y = sectionHeader(doc, "Clip video", y);

    const clipRows = videoClips.map((clip) => [
      clip.minute || "—",
      clip.category || "—",
      clip.phase || "—",
      players.find((p) => String(p.id) === String(clip.playerId))?.name || "—",
      clip.note || clip.tags || "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Minuto", "Categoria", "Fase", "Giocatore", "Note"]],
      body: clipRows,
      headStyles: { fillColor: C.mid, textColor: C.accentL, fontSize: 8, fontStyle: "bold" },
      styles: { fillColor: C.dark, textColor: C.white, fontSize: 8, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [20, 30, 48] },
      theme: "plain",
      margin: { left: 14, right: 14 },
    });
  }

  // ── Salva ─────────────────────────────────────────────────────────────────
  const safeOpponent = (match.opponent || "Avversario").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
  const dateStr = (match.date || new Date().toISOString()).slice(0, 10);
  doc.save(`Referto_${safeOpponent}_${dateStr}.pdf`);
}
