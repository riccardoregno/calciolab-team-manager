import { RPE_BY_MATCH_DAY } from "./helpers";
import {
  createBrandedPdf,
  defaultTable,
  ensureSpace,
  finishBrandedPdf,
  formatPdfDate,
  keyValueGrid,
  safePdfName,
  sectionTitle,
  textBox,
} from "./pdfExportHelpers";

const MICRO_DAYS = [
  { key: "MD+1", offset: -6 },
  { key: "MD-4", offset: -4 },
  { key: "MD-3", offset: -3 },
  { key: "MD-2", offset: -2 },
  { key: "MD-1", offset: -1 },
  { key: "MD",   offset: 0 },
];

const THEME_BY_DAY = {
  "MD+1": "Recupero",
  "MD-4": "Possesso",
  "MD-3": "Transizione",
  "MD-2": "Fase difensiva",
  "MD-1": "Palla inattiva",
  "MD":   "Partita",
};

function toDateOnly(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sessionLoad(session) {
  const attendance = Object.values(session.attendance || {});
  const rpeValues = attendance.map((item) => Number(item.rpe || 0)).filter(Boolean);
  const avgRpe = rpeValues.length
    ? rpeValues.reduce((sum, v) => sum + v, 0) / rpeValues.length
    : Number(session.rpe || 0);
  return Math.round(Number(session.duration || 0) * avgRpe);
}

function gpsForDay(gpsSessions, dateKey) {
  const day = (gpsSessions || []).filter((s) => toDateOnly(s.date) === dateKey);
  const distance = day.reduce(
    (sum, s) => sum + (s.rows || []).reduce((r, row) => r + Number(row.totalDistance || 0), 0),
    0,
  );
  return distance > 0 ? `${(distance / 1000).toFixed(1)} km` : null;
}

function buildMicroDays(match, sessions, gpsSessions) {
  if (!match?.date) return [];
  const matchDate = new Date(match.date);
  return MICRO_DAYS.map((day) => {
    const date = addDays(matchDate, day.offset);
    const dateKey = toDateOnly(date);
    const daySessions = sessions.filter((s) => toDateOnly(s.date) === dateKey);
    const isMatchDay = day.key === "MD";
    const dayMatches = isMatchDay ? [match] : [];
    const planned = RPE_BY_MATCH_DAY[day.key] || null;
    const load = daySessions.reduce((sum, s) => sum + sessionLoad(s), 0);
    const gps = gpsForDay(gpsSessions, dateKey);

    return {
      key: day.key,
      dateKey,
      date,
      daySessions,
      dayMatches,
      planned,
      load,
      gps,
      focus: THEME_BY_DAY[day.key] || "",
      staffAlert: daySessions.flatMap((s) => s.alerts || []).filter(Boolean).join(", ") || null,
    };
  });
}

export async function generateMicrocyclePDF({ match, sessions = [], gpsSessions = [], appSettings = {}, save = true }) {
  if (!match) return null;

  const opponent = match.opponent || "Avversario";
  const dateStr = formatPdfDate(match.date);
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: "Piano microciclo settimanale",
    dateStr,
  });

  const microDays = buildMicroDays(match, sessions, gpsSessions);
  const totalLoad = microDays.reduce((sum, d) => sum + d.load, 0);

  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`Microciclo — vs ${opponent}`, 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (microDays.length) {
    const first = microDays[0].dateKey;
    const last = microDays[microDays.length - 1].dateKey;
    doc.text(`${formatPdfDate(first)} — ${formatPdfDate(last)}`, 14, y);
    y += 8;
  }

  // ── KPI ─────────────────────────────────────────────────────────────────
  y = keyValueGrid(doc, [
    { label: "Avversario",     value: opponent },
    { label: "Data partita",   value: formatPdfDate(match.date) },
    { label: "Carico totale",  value: totalLoad > 0 ? String(totalLoad) : "-" },
    { label: "Modulo",         value: match.formation || "-" },
  ], y);

  // ── Tabella settimanale ──────────────────────────────────────────────────
  y = sectionTitle(doc, "Piano settimanale", y);

  y = defaultTable(doc, {
    startY: y,
    head: [["Giorno", "Data", "Sessioni", "Partite", "Carico", "GPS", "Focus"]],
    body: microDays.map((d) => [
      d.key,
      formatPdfDate(d.dateKey),
      d.daySessions.length ? d.daySessions.map((s) => s.title || s.type || "Seduta").join(", ") : "-",
      d.dayMatches.length ? d.dayMatches.map((m) => m.opponent || "Partita").join(", ") : "-",
      d.load > 0 ? String(d.load) : "-",
      d.gps || "-",
      d.focus,
    ]),
    columnStyles: {
      0: { cellWidth: 14, fontStyle: "bold" },
      1: { cellWidth: 20 },
      2: { cellWidth: 36 },
      3: { cellWidth: 24 },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
    },
  });

  // ── Dettaglio per giorno (solo giorni con sessioni o alert) ──────────────
  for (const d of microDays) {
    if (!d.daySessions.length && !d.staffAlert) continue;

    y = ensureSpace(doc, y, 34);
    y = sectionTitle(doc, `${d.key} · ${formatPdfDate(d.dateKey)} · ${d.focus}`, y);

    const plannedRpe = d.planned?.rpe != null ? String(d.planned.rpe) : "-";
    const plannedDuration = d.planned?.duration != null ? `${d.planned.duration}'` : "-";

    y = keyValueGrid(doc, [
      { label: "Sessioni",       value: d.daySessions.length || 0 },
      { label: "Carico",         value: d.load > 0 ? String(d.load) : "-" },
      { label: "RPE previsto",   value: plannedRpe },
      { label: "Durata prevista", value: plannedDuration },
    ], y, { columns: 4, rowHeight: 20 });

    if (d.daySessions.length) {
      y = defaultTable(doc, {
        startY: y,
        head: [["Sessione", "Durata", "RPE", "Tema", "Obiettivo"]],
        body: d.daySessions.map((s) => [
          s.title || s.type || "Seduta",
          s.duration ? `${s.duration}'` : "-",
          s.rpe || "-",
          s.theme || s.category || "-",
          s.objective || s.notes || "-",
        ]),
        columnStyles: {
          0: { cellWidth: 44 },
          1: { cellWidth: 18, halign: "center" },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 30 },
        },
      });
    }

    if (d.staffAlert) {
      const boxW = doc.internal.pageSize.getWidth() - 28;
      y = ensureSpace(doc, y, 30);
      textBox(doc, "Alert staff", d.staffAlert, 14, y, boxW, 22);
      y += 28;
    }
  }

  // ── Piano gara (post-match / scouting) ──────────────────────────────────
  const report = match.postMatch || {};
  const scouting = match.opponentScouting || {};
  const hasExtra = report.nextWeekFocus || scouting.strengths || scouting.weaknesses || match.matchPlan;
  if (hasExtra) {
    y = ensureSpace(doc, y, 48);
    y = sectionTitle(doc, "Focus settimana", y);
    const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
    textBox(doc, "Piano gara", match.matchPlan || "-", 14, y, boxW, 30);
    textBox(doc, "Focus settimana prossima", report.nextWeekFocus || "-", 18 + boxW, y, boxW, 30);
    y += 36;
    if (scouting.strengths || scouting.weaknesses) {
      y = ensureSpace(doc, y, 36);
      textBox(doc, "Punti forti avversario", scouting.strengths || "-", 14, y, boxW, 30);
      textBox(doc, "Punti deboli avversario", scouting.weaknesses || "-", 18 + boxW, y, boxW, 30);
    }
  }

  const filename = `Microciclo_${safePdfName(opponent)}_${String(match.date || "").slice(0, 10)}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
