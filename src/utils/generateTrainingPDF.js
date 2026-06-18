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

export async function generateTrainingPDF({ session, exercises = [], appSettings = {}, save = true }) {
  if (!session) return null;

  const dateStr = formatPdfDate(session.date);
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: "Scheda seduta di allenamento",
    dateStr,
  });

  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(session.title || "Seduta", 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text([dateStr, session.theme || session.type || "", `${session.duration || 0}'`].filter(Boolean).join("  |  "), 14, y);
  y += 8;

  const planned = (session.exercises || []).map((block, index) => {
    const exercise = exercises.find((item) => String(item.id) === String(block.exerciseId));
    return {
      index: index + 1,
      title: exercise?.title || block.title || `Blocco ${index + 1}`,
      minutes: block.minutes || block.duration || block.customDuration || exercise?.duration || "-",
      block: exercise?.trainingBlock || exercise?.category || block.block || "-",
      field: exercise?.fieldSize || exercise?.space || block.field || "-",
      focus: block.note || exercise?.coachingPoints || exercise?.objective || exercise?.goal || exercise?.description || "-",
    };
  });

  y = keyValueGrid(doc, [
    { label: "Obiettivo", value: session.objective || session.theme || "-" },
    { label: "RPE", value: session.rpe || "-" },
    { label: "Durata", value: `${session.duration || 0}'` },
    { label: "Carico", value: Number(session.duration || 0) * Number(session.rpe || 0) || "-" },
  ], y);

  y = sectionTitle(doc, "Timeline esercizi", y);
  if (planned.length) {
    y = defaultTable(doc, {
      startY: y,
      head: [["Min", "Blocco", "Esercizio", "Campo", "Focus"]],
      body: planned.map((item) => [
        item.minutes,
        item.block,
        item.title,
        item.field,
        item.focus,
      ]),
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 28 },
        2: { cellWidth: 42 },
        3: { cellWidth: 30 },
      },
    });
  } else {
    doc.text("Nessun esercizio inserito.", 14, y);
    y += 8;
  }

  y = sectionTitle(doc, "Materiali e note", y);
  const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
  textBox(doc, "Materiali", session.materials || "Da definire", 14, y, boxW, 30);
  textBox(doc, "Note staff", session.notes || "Nessuna nota", 18 + boxW, y, boxW, 30);

  const filename = `Seduta_${safePdfName(session.title || "allenamento")}_${String(session.date || "").slice(0, 10)}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
