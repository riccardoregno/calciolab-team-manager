import { getPhysicalReference, getPlayerSummary } from "./helpers";
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

function getReadinessScore(player, summary) {
  let score = 100;
  if (player.status === "Infortunato") score -= 55;
  if (player.status === "Recupero") score -= 35;
  if (player.status === "Differenziato") score -= 25;
  if (player.status === "Squalificato") score -= 20;
  if (!summary.latestTests.length) score -= 10;
  if ((player.injuries || []).some((injury) => injury.status !== "rientrato" && !injury.endDate)) score -= 20;
  return Math.max(0, Math.min(100, score));
}

export async function generatePlayerReportPDF({ player, sessions = [], matches = [], physicalTests = [], appSettings = {}, save = true }) {
  if (!player) return null;

  const dateStr = formatPdfDate(new Date());
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: "Scheda giocatore",
    dateStr,
  });

  const summary = getPlayerSummary(player, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const reference = getPhysicalReference(latestTest, appSettings?.coachParameters);
  const readiness = getReadinessScore(player, summary);
  const activeInjuries = (player.injuries || []).filter((injury) => injury.status !== "rientrato" && !injury.endDate);

  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(player.name || "Giocatore", 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text([player.role || "", player.status || "", player.shirtNumber ? `#${player.shirtNumber}` : ""].filter(Boolean).join("  |  "), 14, y);
  y += 8;

  y = keyValueGrid(doc, [
    { label: "Presenze", value: summary.stats.presences },
    { label: "Minuti", value: summary.stats.minutes },
    { label: "Gol + Assist", value: `${summary.stats.goals} + ${summary.stats.assists}` },
    { label: "Readiness", value: `${readiness}%` },
  ], y);

  y = sectionTitle(doc, "Test fisici", y);
  y = keyValueGrid(doc, [
    { label: "Ultimo test", value: latestTest ? formatPdfDate(latestTest.date) : "-" },
    { label: "Gruppo", value: reference.group || "-" },
    { label: "MAS", value: reference.mas ? `${reference.mas} km/h` : "-" },
    { label: "Indicazione", value: reference.intensity || "-" },
  ], y, { columns: 4, rowHeight: 22 });

  if (reference.reps?.length) {
    y = defaultTable(doc, {
      startY: y,
      head: [["Protocollo", "Metri", "Ripetizioni", "Serie", "Recupero"]],
      body: reference.reps.map((block) => [
        block.label,
        `${block.meters} m`,
        block.reps,
        block.sets,
        block.recovery,
      ]),
    });
  }

  y = sectionTitle(doc, "Storico recente", y);
  y = defaultTable(doc, {
    startY: y,
    head: [["Evento", "Data", "Min", "RPE", "Stato"]],
    body: summary.recentEvents.length
      ? summary.recentEvents.map(({ event, data }) => [
        event.title,
        formatPdfDate(event.date),
        data.minutes || "-",
        data.rpe || "-",
        data.status || "-",
      ])
      : [["Nessun evento recente", "-", "-", "-", "-"]],
    columnStyles: { 1: { cellWidth: 24 }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 }, 4: { cellWidth: 28 } },
  });

  y = sectionTitle(doc, "Note e obiettivi", y);
  const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
  textBox(doc, "Obiettivo", player.weeklyGoal || "-", 14, y, boxW, 30);
  textBox(doc, "Alert", summary.alerts.join(", ") || "-", 18 + boxW, y, boxW, 30);
  y += 36;
  textBox(doc, "Punti di forza", player.strengths || player.developmentNotes?.strengths || "-", 14, y, boxW, 30);
  textBox(doc, "Margini", player.improvements || player.developmentNotes?.improvements || "-", 18 + boxW, y, boxW, 30);
  y += 36;

  y = sectionTitle(doc, "Medico", y);
  textBox(
    doc,
    "Stato",
    activeInjuries.length
      ? activeInjuries.map((injury) => injury.injuryType || injury.type || "Infortunio").join(", ")
      : player.status || "-",
    14,
    y,
    boxW,
    30
  );
  textBox(doc, "Note prevenzione", player.injuryNotes || player.preventionNotes || "-", 18 + boxW, y, boxW, 30);

  const filename = `Scheda_${safePdfName(player.name || "giocatore")}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
