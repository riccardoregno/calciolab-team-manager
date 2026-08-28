import { getLineup } from "./helpers";
import {
  createBrandedPdf,
  defaultTable,
  finishBrandedPdf,
  formatPdfDate,
  keyValueGrid,
  safePdfName,
  sectionTitle,
  textBox,
} from "./pdfExportHelpers";

function findPlayer(players, id) {
  return players.find((player) => String(player.id) === String(id));
}

function playerLine(player, lineup = {}, captainId = null) {
  if (!player) return "-";
  const shirtNumber = getShirtNumber(player, lineup);
  const shirt = shirtNumber ? `${shirtNumber}. ` : "";
  const leader = captainId && String(captainId) === String(player.id)
    ? " (C)"
    : String(lineup.viceCaptainId || "") === String(player.id)
      ? " (VC)"
      : "";
  return `${shirt}${player.name}${leader}`;
}

function getShirtNumber(player = {}, lineup = {}) {
  const playerId = String(player.id || "");
  const matchNumber = lineup.shirtNumbers?.[playerId];
  return String(matchNumber || player.shirtNumber || player.number || "").trim();
}

function sortByShirtNumber(players = [], lineup = {}) {
  return [...players].sort((a, b) => {
    const aNumber = Number(getShirtNumber(a, lineup));
    const bNumber = Number(getShirtNumber(b, lineup));
    const aRank = Number.isFinite(aNumber) && aNumber > 0 ? aNumber : 999;
    const bRank = Number.isFinite(bNumber) && bNumber > 0 ? bNumber : 999;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.name || "").localeCompare(String(b.name || ""), "it");
  });
}

export async function generateMatchDayPDF({ match, players = [], appSettings = {}, save = true }) {
  if (!match) return null;

  const dateStr = formatPdfDate(match.date);
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: "Distinta pre-partita",
    dateStr,
  });

  const opponent = match.opponent || "Avversario";
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${teamName} vs ${opponent}`, 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text([dateStr, match.time || "", match.location || "", match.competition || ""].filter(Boolean).join("  |  "), 14, y);
  y += 8;

  const lineup = getLineup(match);
  const starters = sortByShirtNumber((lineup.starterIds || []).map((id) => findPlayer(players, id)).filter(Boolean), lineup);
  const bench = sortByShirtNumber((lineup.benchIds || []).map((id) => findPlayer(players, id)).filter(Boolean), lineup);
  const calledUp = (lineup.calledUpIds || []).map((id) => findPlayer(players, id)).filter(Boolean);
  const totalCalled = calledUp.length || starters.length + bench.length;

  y = keyValueGrid(doc, [
    { label: "Avversario", value: opponent },
    { label: "Convocati", value: totalCalled },
    { label: "Modulo", value: match.formation || "-" },
    { label: "Campo", value: match.venueName || match.location || "-" },
  ], y);

  y = sectionTitle(doc, "Formazione", y);
  const rows = Array.from({ length: Math.max(starters.length, bench.length, 1) }).map((_, index) => [
    playerLine(starters[index], lineup, lineup.captainId),
    playerLine(bench[index], lineup, null),
  ]);
  y = defaultTable(doc, {
    startY: y,
    head: [["Titolari", "Panchina"]],
    body: rows,
  });

  const opponentLineup = match.opponentScouting?.lineup || [];
  if (opponentLineup.length || match.opponentScouting?.formation || match.opponentScouting?.strengths || match.opponentScouting?.weaknesses) {
    y = sectionTitle(doc, "Avversario", y);
    if (opponentLineup.length) {
      y = defaultTable(doc, {
        startY: y,
        head: [["N", "Giocatore", "Anno", "Ruolo", "Note"]],
        body: opponentLineup.map((item) => [
          item.number || "-",
          item.name || "-",
          item.birthYear || "-",
          item.role || "-",
          item.notes || "-",
        ]),
        columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 18 }, 3: { cellWidth: 28 } },
      });
    }

    const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
    textBox(doc, "Modulo avversario", match.opponentScouting?.formation || "-", 14, y, boxW, 24);
    textBox(doc, "Punti deboli", match.opponentScouting?.weaknesses || "-", 18 + boxW, y, boxW, 24);
    y += 30;
  }

  y = sectionTitle(doc, "Piano gara", y);
  const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
  textBox(doc, "Piano", match.matchPlan || "-", 14, y, boxW, 34);
  textBox(doc, "Punti forti avversario", match.opponentScouting?.strengths || "-", 18 + boxW, y, boxW, 34);

  const filename = `Distinta_${safePdfName(opponent)}_${String(match.date || "").slice(0, 10)}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
