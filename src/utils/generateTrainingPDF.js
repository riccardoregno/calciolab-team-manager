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

  const structuredBlocks = session.sessionBlocks || [];
  const useStructured = structuredBlocks.length > 0;

  const planned = useStructured ? [] : (session.exercises || []).map((block, index) => {
    const exercise = exercises.find((item) => String(item.id) === String(block.exerciseId));
    return {
      title: exercise?.title || block.title || `Blocco ${index + 1}`,
      minutes: block.minutes || block.duration || block.customDuration || exercise?.duration || "-",
      block: exercise?.trainingBlock || exercise?.category || block.block || "-",
      field: exercise?.fieldSize || exercise?.space || block.field || "-",
      focus: block.note || exercise?.coachingPoints || exercise?.objective || exercise?.goal || exercise?.description || "-",
    };
  });

  const kpiItems = [
    { label: "Obiettivo", value: session.objective || "-" },
    { label: "Durata", value: `${session.duration || 0}'` },
    ...(session.rpe ? [{ label: "RPE", value: session.rpe }] : []),
    ...(session.rpe && session.duration ? [{ label: "Carico", value: Number(session.duration) * Number(session.rpe) }] : []),
  ];
  y = keyValueGrid(doc, kpiItems, y);

  y = sectionTitle(doc, "Timeline esercizi", y);

  if (useStructured) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;

    // Pre-fetch immagini come base64
    async function urlToBase64(url) {
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        return await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch { return null; }
    }

    const imgDataMap = {};
    await Promise.all(
      structuredBlocks.map(async (b) => {
        const url = b.image?.url || b.imageUrl || "";
        if (url) imgDataMap[b.id] = await urlToBase64(url);
      })
    );

    for (const b of structuredBlocks) {
      const imgData = imgDataMap[b.id] || null;
      const description = b.description || b.notes || b.objective || "";
      const descLines = description ? doc.splitTextToSize(description, contentW - 4) : [];

      // Calcola altezza immagine proporzionale (max 90mm larghezza piena)
      let imgH = 0;
      if (imgData) {
        try {
          const props = doc.getImageProperties(imgData);
          imgH = Math.min((contentW * props.height) / props.width, 90);
        } catch { imgH = 60; }
      }

      const textH = 6 + descLines.length * 4.5 + 10;
      const blockH = textH + (imgData ? imgH + 4 : 0);

      if (y + blockH + 6 > pageH - 20) { doc.addPage(); y = 14; }

      doc.setDrawColor(220, 220, 230);
      doc.setFillColor(250, 251, 252);
      doc.roundedRect(margin, y, contentW, blockH + 4, 2, 2, "FD");

      // Testo: nome + durata/fase
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(b.name || "Blocco", margin + 2, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${b.duration || "-"} min${b.phase ? "  ·  " + b.phase : ""}`, margin + 2, y + 11);

      if (descLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(descLines, margin + 2, y + 17);
      }

      // Immagine sotto, larghezza piena
      if (imgData) {
        try {
          doc.addImage(imgData, "JPEG", margin + 2, y + textH + 2, contentW - 4, imgH);
        } catch { /* immagine non supportata */ }
      }

      y += blockH + 8;
    }
  } else if (planned.length) {
    y = defaultTable(doc, {
      startY: y,
      head: [["Min", "Blocco", "Esercizio", "Campo", "Focus"]],
      body: planned.map((item) => [item.minutes, item.block, item.title, item.field, item.focus]),
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
