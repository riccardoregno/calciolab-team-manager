import {
  createBrandedPdf,
  defaultTable,
  finishBrandedPdf,
  formatPdfDate,
  safePdfName,
  sectionTitle,
} from "./pdfExportHelpers";

function eventRow(event) {
  const isMatch = event.type === "Partita";
  return [
    formatPdfDate(event.date),
    isMatch ? "Partita" : (event.type || "Allenamento"),
    isMatch ? `vs ${event.opponent || "-"}` : (event.title || "-"),
    isMatch ? (event.location || "-") : (event.theme || "-"),
  ];
}

export async function generateWeekCalendarPDF({ weekLabel, weekEvents = [], availability = {}, appSettings = {}, save = true }) {
  const dateStr = formatPdfDate(new Date());
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: `Settimana ${weekLabel || ""}`,
    dateStr,
  });

  let y = startY;
  const sorted = [...weekEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

  y = sectionTitle(doc, "Programma settimanale", y);
  y = defaultTable(doc, {
    startY: y,
    head: [["Data", "Tipo", "Dettaglio", "Luogo / Tema"]],
    body: sorted.length ? sorted.map(eventRow) : [["-", "-", "Nessun evento", "-"]],
  });

  const injured   = availability.injured   || [];
  const limited   = availability.limited   || [];
  const suspended = availability.suspended || [];

  if (injured.length || limited.length || suspended.length) {
    y = sectionTitle(doc, "Disponibilità rosa", y);
    const maxLen = Math.max(injured.length, limited.length, suspended.length, 1);
    const rows = Array.from({ length: maxLen }).map((_, i) => [
      injured[i]?.name || "",
      limited[i]?.name || "",
      suspended[i]?.name || "",
    ]);
    defaultTable(doc, {
      startY: y,
      head: [["Infortunati", "Recupero/Differenziati", "Squalificati"]],
      body: rows,
    });
  }

  const filename = `Settimana_${safePdfName(weekLabel || "")}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
