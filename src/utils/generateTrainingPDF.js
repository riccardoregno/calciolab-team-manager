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

const MARGIN = 14;
const LINE_H = 4.5;
const FONT_BODY = 8.5;

export async function generateTrainingPDF({ session, exercises = [], appSettings = {}, save = true }) {
  if (!session) return null;

  const dateStr = formatPdfDate(session.date);
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: "Scheda seduta di allenamento",
    dateStr,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const bottomMargin = 22;

  function checkPage(neededH) {
    if (y + neededH > pageH - bottomMargin) {
      doc.addPage();
      y = MARGIN;
    }
  }

  let y = startY;

  // Titolo seduta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(session.title || "Seduta", MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text([dateStr, session.theme || session.type || "", `${session.duration || 0}'`].filter(Boolean).join("  |  "), MARGIN, y);
  y += 8;

  // KPI
  const kpiItems = [
    { label: "Obiettivo", value: session.objective || "-" },
    { label: "Durata",    value: `${session.duration || 0}'` },
    ...(session.rpe ? [{ label: "RPE", value: session.rpe }] : []),
    ...(session.rpe && session.duration ? [{ label: "Carico", value: Number(session.duration) * Number(session.rpe) }] : []),
  ];
  y = keyValueGrid(doc, kpiItems, y);

  // ── Timeline ──────────────────────────────────────────────────────
  const structuredBlocks = session.sessionBlocks || [];
  const useStructured = structuredBlocks.length > 0;

  y = sectionTitle(doc, "Timeline esercizi", y);

  if (useStructured) {
    // Pre-fetch immagini
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
      const descLines = description ? doc.splitTextToSize(description, contentW - 6) : [];

      // Immagine: calcola proporzioni reali
      let imgH = 0;
      let imgW = contentW - 4;
      if (imgData) {
        try {
          const props = doc.getImageProperties(imgData);
          const ratio = props.height / props.width;
          imgH = Math.min(imgW * ratio, 80); // max 80mm
          imgW = imgH / ratio; // ricalcola larghezza per mantenere proporzioni
          if (imgW > contentW - 4) imgW = contentW - 4;
        } catch { imgH = 60; }
      }

      // Stima altezza blocco per sapere se fare page break
      const estimatedH = 16 + descLines.length * LINE_H + (imgData ? imgH + 4 : 0) + 6;
      checkPage(estimatedH);

      const blockStartY = y;

      // Header blocco
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(b.name || "Blocco", MARGIN + 2, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${b.duration || "-"} min${b.phase ? "  ·  " + b.phase : ""}`,
        MARGIN + 2, y + 11
      );
      y += 14;

      // Descrizione
      if (descLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FONT_BODY);
        doc.setTextColor(71, 85, 105);
        doc.text(descLines, MARGIN + 2, y);
        y += descLines.length * LINE_H + 3;
      }

      // Immagine sotto, centrata
      if (imgData) {
        const imgX = MARGIN + (contentW - imgW) / 2;
        try {
          doc.addImage(imgData, "JPEG", imgX, y, imgW, imgH);
        } catch {
          try { doc.addImage(imgData, "PNG", imgX, y, imgW, imgH); } catch { /* skip */ }
        }
        y += imgH + 3;
      }

      // Bordo blocco
      doc.setDrawColor(220, 220, 230);
      doc.setFillColor(250, 251, 252);
      doc.roundedRect(MARGIN, blockStartY, contentW, y - blockStartY + 2, 2, 2, "S");

      y += 6;
    }
  } else {
    const planned = (session.exercises || []).map((block, index) => {
      const exercise = exercises.find((item) => String(item.id) === String(block.exerciseId));
      return {
        title: exercise?.title || block.title || `Blocco ${index + 1}`,
        minutes: block.minutes || block.duration || block.customDuration || exercise?.duration || "-",
        block: exercise?.trainingBlock || exercise?.category || block.block || "-",
        field: exercise?.fieldSize || exercise?.space || block.field || "-",
        focus: block.note || exercise?.coachingPoints || exercise?.objective || exercise?.goal || exercise?.description || "-",
      };
    });

    if (planned.length) {
      y = defaultTable(doc, {
        startY: y,
        head: [["Min", "Blocco", "Esercizio", "Campo", "Focus"]],
        body: planned.map((item) => [item.minutes, item.block, item.title, item.field, item.focus]),
        columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 28 }, 2: { cellWidth: 42 }, 3: { cellWidth: 30 } },
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(100, 116, 139);
      doc.text("Nessun esercizio inserito.", MARGIN, y);
      y += 8;
    }
  }

  // ── Materiali e note ─────────────────────────────────────────────
  checkPage(50);
  y = sectionTitle(doc, "Materiali e note", y);
  const boxW = (pageW - 32) / 2;
  textBox(doc, "Materiali",  session.materials || "Da definire",     MARGIN,        y, boxW, 30);
  textBox(doc, "Note staff", session.notes     || "Nessuna nota", 18 + boxW,     y, boxW, 30);

  const filename = `Seduta_${safePdfName(session.title || "allenamento")}_${String(session.date || "").slice(0, 10)}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
