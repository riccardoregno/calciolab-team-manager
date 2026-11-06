import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { loadBrandingAssets } from "./pdfBranding";
import { getPlayerMatchTotals, getSeasonRecord, isLeagueStatsMatch, parseMatchResult } from "./helpers";

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
  yellow:  [234, 179,   8],  // #eab308
  border:  [51,  65,  85],   // #334155
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(date) {
  if (!date) return "—";
  try { return new Date(date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
}

function pct(num, den) {
  if (!den) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

function resultText(match) {
  const parsed = parseMatchResult(match.result, match);
  if (!parsed) return "—";
  return `${parsed.homeGoals} - ${parsed.awayGoals}`;
}

function resultOutcome(match) {
  const parsed = parseMatchResult(match.result, match);
  if (!parsed) return null;
  if (parsed.goalsFor > parsed.goalsAgainst) return "V";
  if (parsed.goalsFor < parsed.goalsAgainst) return "S";
  return "P";
}

// ─── Section header ──────────────────────────────────────────────────────────
function sectionHeader(doc, title, y) {
  doc.setFillColor(...C.accent);
  doc.roundedRect(14, y, doc.internal.pageSize.width - 28, 8, 2, 2, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 18, y + 5.5);
  return y + 13;
}

// ─── Cover page ──────────────────────────────────────────────────────────────
function drawCover(doc, { teamName, season, competition, generatedAt, calciolabLogo, teamLogo }) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;

  doc.setFillColor(...C.dark);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...C.accent);
  doc.rect(0, 0, W, 3, "F");

  // CalcioLab logo or text
  if (calciolabLogo) {
    try { doc.addImage(calciolabLogo, "PNG", W / 2 - 22, 60, 44, 38); } catch { /* skip */ }
  }

  // App name
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("CalcioLab", W / 2, 108, { align: "center" });

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text("Report Stagione", W / 2, 118, { align: "center" });

  // Team logo + name box
  if (teamLogo) {
    try { doc.addImage(teamLogo, "PNG", W / 2 - 12, 126, 24, 24); } catch { /* skip */ }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.white);
    doc.text(teamName || "La mia squadra", W / 2, 160, { align: "center" });
  } else {
    doc.setFillColor(...C.mid);
    doc.roundedRect(W / 2 - 55, 130, 110, 22, 4, 4, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.accentL);
    doc.text(teamName || "La mia squadra", W / 2, 145, { align: "center" });
  }

  if (season || competition) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.muted);
    const scope = [season === "all" ? "Tutte le stagioni" : season && `Stagione ${season}`, competition].filter(Boolean);
    doc.text(doc.splitTextToSize(scope.join("\n"), W - 36), W / 2, 170, { align: "center" });
  }

  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(`Generato il ${generatedAt}`, W / 2, H - 20, { align: "center" });

  doc.setFillColor(...C.accent);
  doc.rect(0, H - 3, W, 3, "F");
}

// ─── Page header / footer ────────────────────────────────────────────────────
function addPageChrome(doc, teamName) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;

  doc.setFillColor(...C.dark);
  doc.rect(0, 0, W, 14, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.accentL);
  doc.text("CalcioLab", 14, 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(teamName || "", W - 14, 9, { align: "right" });

  doc.setFillColor(...C.border);
  doc.setDrawColor(...C.border);
  doc.line(14, H - 10, W - 14, H - 10);
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`Pagina ${doc.internal.getCurrentPageInfo().pageNumber}`, W / 2, H - 5, { align: "center" });
}

// ─── Main generator ──────────────────────────────────────────────────────────
/**
 * Genera e scarica il PDF del report stagionale.
 *
 * @param {object} opts
 * @param {array}  opts.players
 * @param {array}  opts.sessions
 * @param {array}  opts.matches
 * @param {array}  opts.physicalTests
 * @param {object} opts.appSettings
 */
export async function generateSeasonReport({
  players = [], sessions = [], matches = [], physicalTests = [], appSettings = {},
  season = appSettings.workspaceProfile?.currentSeason || appSettings.workspaceProfile?.season || "",
  competition = "", record = getSeasonRecord(matches), playerMatchRows = [],
}) {
  const teamLogoUrl = appSettings?.workspaceProfile?.logo || null;
  const { calciolabLogo, teamLogo } = await loadBrandingAssets(teamLogoUrl);

  const doc = new jsPDF({ unit: "mm", format: "a4", putOnlyUsedFonts: true });
  const W   = doc.internal.pageSize.width;

  const teamName = appSettings?.workspaceProfile?.clubName || "La mia squadra";
  const generatedAt = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  // ── 1. Cover ──────────────────────────────────────────────────────────────
  drawCover(doc, { teamName, season, competition, generatedAt, calciolabLogo, teamLogo });

  // ── 2. Riepilogo stagione ─────────────────────────────────────────────────
  doc.addPage();
  addPageChrome(doc, teamName);

  let y = 22;
  y = sectionHeader(doc, "Riepilogo stagione", y);

  const { played, wins, draws, losses, goalsFor: gf, goalsAgainst: gc, cleanSheets } = record;
  const showPoints = matches.every(isLeagueStatsMatch);

  const stats = [
    ["Partite giocate", played, "Allenamenti", sessions.length],
    ["Vittorie",        wins,          "Pareggi",     draws],
    ["Sconfitte",       losses,        showPoints ? "Punti" : "", showPoints ? wins * 3 + draws : ""],
    ["Gol fatti",       gf,            "Gol subiti",  gc],
    ["Clean sheet",     cleanSheets,   "Giocatori",   players.length],
  ];

  autoTable(doc, {
    startY: y,
    body: stats.map(([k1, v1, k2, v2]) => [k1, v1, k2, v2]),
    columns: [
      { dataKey: 0 }, { dataKey: 1 },
      { dataKey: 2 }, { dataKey: 3 },
    ],
    columnStyles: {
      0: { cellWidth: (W - 28) * 0.35, fontStyle: "bold", textColor: C.muted },
      1: { cellWidth: (W - 28) * 0.15, halign: "center", fontStyle: "bold", textColor: C.accentL },
      2: { cellWidth: (W - 28) * 0.35, fontStyle: "bold", textColor: C.muted },
      3: { cellWidth: (W - 28) * 0.15, halign: "center", fontStyle: "bold", textColor: C.accentL },
    },
    styles: { fillColor: C.mid, textColor: C.white, fontSize: 9, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: [24, 35, 55] },
    theme: "plain",
    margin: { left: 14, right: 14 },
  });

  // ── 3. Partite ────────────────────────────────────────────────────────────
  y = doc.lastAutoTable.finalY + 10;
  if (y > 240) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
  y = sectionHeader(doc, "Calendario partite", y);

  const matchRows = [...matches]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((m) => {
      const outcome = resultOutcome(m);
      return [
        fmt(m.date),
        m.opponent || m.title || "—",
        m.location === "Casa" || m.home ? "Casa" : "Trasferta",
        resultText(m),
        outcome === "V" ? "Vinta"
          : outcome === "S" ? "Sconfitta"
          : outcome === "P" ? "= Pareggio"
          : "Da giocare",
      ];
    });

  autoTable(doc, {
    startY: y,
    head: [["Data", "Avversario", "Sede", "Risultato", "Esito"]],
    body: matchRows.length ? matchRows : [["—", "Nessuna partita registrata", "", "", ""]],
    headStyles: { fillColor: C.mid, textColor: C.accentL, fontSize: 8, fontStyle: "bold" },
    styles: { fillColor: C.dark, textColor: C.white, fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [20, 30, 48] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 24 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 28 },
    },
    didParseCell(data) {
      if (data.column.index === 4 && data.section === "body") {
        const v = String(data.cell.raw);
        if (v === "Vinta") data.cell.styles.textColor = C.green;
        else if (v === "Sconfitta") data.cell.styles.textColor = C.red;
        else if (v.startsWith("=")) data.cell.styles.textColor = C.yellow;
      }
    },
    theme: "plain",
    margin: { left: 14, right: 14 },
  });

  // ── 4. Presenze allenamenti ───────────────────────────────────────────────
  doc.addPage();
  addPageChrome(doc, teamName);
  y = 22;
  y = sectionHeader(doc, "Presenze allenamenti", y);

  const sessionsWithAttendance = sessions.filter((s) => s.attendance && Object.keys(s.attendance).length > 0);
  const presenceRows = [...players]
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((p) => {
      const present = sessionsWithAttendance.filter(
        (s) => s.attendance?.[p.id]?.status === "Presente"
      ).length;
      const absent = sessionsWithAttendance.filter(
        (s) => s.attendance?.[p.id]?.status === "Assente"
      ).length;
      const total = sessionsWithAttendance.filter((s) => s.attendance?.[p.id]).length;
      return [
        p.name || "—",
        p.role || "—",
        present,
        absent,
        total ? pct(present, total) : "—",
        p.status === "Infortunato" ? "Infortunato" : p.status === "Squalificato" ? "Squalificato" : "—",
      ];
    });

  autoTable(doc, {
    startY: y,
    head: [["Giocatore", "Ruolo", "Presenze", "Assenze", "%", "Stato"]],
    body: presenceRows.length ? presenceRows : [["—", "Nessun giocatore", "", "", "", ""]],
    headStyles: { fillColor: C.mid, textColor: C.accentL, fontSize: 8, fontStyle: "bold" },
    styles: { fillColor: C.dark, textColor: C.white, fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [20, 30, 48] },
    columnStyles: {
      0: { cellWidth: "auto", fontStyle: "bold" },
      1: { cellWidth: 28 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 26, halign: "center" },
    },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === "body") {
        const v = String(data.cell.raw);
        if (v === "Infortunato") data.cell.styles.textColor = C.red;
        else if (v === "Squalificato") data.cell.styles.textColor = C.yellow;
      }
      if (data.column.index === 4 && data.section === "body") {
        const v = parseInt(data.cell.raw);
        if (!isNaN(v)) {
          data.cell.styles.textColor = v >= 80 ? C.green : v >= 60 ? C.yellow : v < 60 ? C.red : C.white;
        }
      }
    },
    theme: "plain",
    margin: { left: 14, right: 14 },
  });

  // ── 5. Statistiche giocatori (gare) ───────────────────────────────────────
  y = doc.lastAutoTable.finalY + 10;
  if (y > 220) { doc.addPage(); addPageChrome(doc, teamName); y = 22; }
  y = sectionHeader(doc, "Statistiche giocatori — gare", y);

  const statsRows = [...players]
    .map((p) => {
      const { presences: pres, goals, assists, minutes } = getPlayerMatchTotals(p, matches, playerMatchRows, players, false);
      return { name: p.name, role: p.role, pres, goals, assists, minutes };
    })
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.pres - a.pres)
    .map((r) => [r.name || "—", r.role || "—", r.pres, r.goals, r.assists, r.minutes ? `${r.minutes}'` : "—"]);

  autoTable(doc, {
    startY: y,
    head: [["Giocatore", "Ruolo", "Gare", "Gol", "Assist", "Minuti"]],
    body: statsRows.length ? statsRows : [["—", "Nessun dato", "", "", "", ""]],
    headStyles: { fillColor: C.mid, textColor: C.accentL, fontSize: 8, fontStyle: "bold" },
    styles: { fillColor: C.dark, textColor: C.white, fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [20, 30, 48] },
    columnStyles: {
      0: { cellWidth: "auto", fontStyle: "bold" },
      1: { cellWidth: 30 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
    },
    theme: "plain",
    margin: { left: 14, right: 14 },
  });

  // ── 6. Test fisici ────────────────────────────────────────────────────────
  if (physicalTests.length > 0) {
    doc.addPage();
    addPageChrome(doc, teamName);
    y = 22;
    y = sectionHeader(doc, "Test fisici", y);

    // Ultimi test per giocatore
    const latestByPlayer = {};
    for (const test of physicalTests) {
      const pid = String(test.playerId);
      if (!latestByPlayer[pid] || new Date(test.date) > new Date(latestByPlayer[pid].date)) {
        latestByPlayer[pid] = test;
      }
    }

    const testRows = Object.values(latestByPlayer)
      .map((test) => {
        const player = players.find((p) => String(p.id) === String(test.playerId));
        return [
          player?.name || "—",
          player?.role || "—",
          test.type || test.testType || "—",
          test.value ?? test.result ?? "—",
          test.unit || "",
          fmt(test.date),
        ];
      })
      .sort((a, b) => (a[0] || "").localeCompare(b[0] || ""));

    autoTable(doc, {
      startY: y,
      head: [["Giocatore", "Ruolo", "Test", "Valore", "Unità", "Data"]],
      body: testRows.length ? testRows : [["—", "Nessun test", "", "", "", ""]],
      headStyles: { fillColor: C.mid, textColor: C.accentL, fontSize: 8, fontStyle: "bold" },
      styles: { fillColor: C.dark, textColor: C.white, fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [20, 30, 48] },
      columnStyles: {
        0: { cellWidth: "auto", fontStyle: "bold" },
        1: { cellWidth: 28 },
        2: { cellWidth: 30 },
        3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
      },
      theme: "plain",
      margin: { left: 14, right: 14 },
    });
  }

  // ── Salva ─────────────────────────────────────────────────────────────────
  const safeName = (teamName || "CalcioLab").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
  const dateStr  = new Date().toISOString().slice(0, 10);
  doc.save(`${safeName}_Report_${dateStr}.pdf`);
}
