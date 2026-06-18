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

const PHASE_COLORS = {
  "Riscaldamento":    [251, 146,  60],
  "Tecnico-tattica":  [ 56, 189, 248],
  "Parte principale": [167, 139, 250],
  "Fisico":           [ 74, 222, 128],
  "Defaticamento":    [148, 163, 184],
};

/**
 * Genera PDF scheda seduta.
 * @param {{ session: object, appSettings: object, save?: boolean }} opts
 */
export async function generateSessionPlanPDF({ session, appSettings, save = true }) {
  const { doc, y: startY, pageW, margins } = await createBrandedPdf({ appSettings });
  const usableW = pageW - margins.l - margins.r;
  let y = startY;

  // ── Intestazione seduta ───────────────────────────────────────
  y = sectionTitle(doc, "SCHEDA SEDUTA", y);

  const meta = [
    { label: "Data",       value: formatPdfDate(session.date) },
    { label: "Tipo",       value: session.type || "Allenamento" },
    { label: "Tema",       value: session.theme || "—" },
    { label: "Carico",     value: session.matchDayDistance || "—" },
    { label: "Durata tot", value: totalMinutes(session) > 0 ? `${totalMinutes(session)} min` : "—" },
    { label: "RPE target", value: session.rpeTarget ? String(session.rpeTarget) : "—" },
  ];
  y = keyValueGrid(doc, meta, y, { cols: 3, usableW, margins });

  if (session.objective) {
    y = textBox(doc, "Obiettivo", session.objective, margins.l, y, usableW);
  }

  // ── Blocchi strutturati ───────────────────────────────────────
  const blocks = session.sessionBlocks || [];
  if (blocks.length > 0) {
    y = sectionTitle(doc, "STRUTTURA SEDUTA", y);

    const blockRows = blocks.map((b) => [
      b.phase || "—",
      b.name  || "—",
      b.duration ? `${b.duration} min` : "—",
      b.intensity ? `${b.intensity}/10` : "—",
      b.notes || "",
    ]);

    y = defaultTable(doc, {
      head: [["Fase", "Esercizio / Esercitazione", "Durata", "Intensità", "Note"]],
      body: blockRows,
      startY: y,
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold" },
        1: { cellWidth: 68 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: usableW - 32 - 68 - 20 - 22 },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const phase = blocks[data.row.index]?.phase;
          const rgb = PHASE_COLORS[phase] || [148, 163, 184];
          doc.setFillColor(...rgb);
          doc.rect(data.cell.x, data.cell.y, 3, data.cell.height, "F");
        }
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // ── Esercizi dalla libreria ───────────────────────────────────
  const exercises = session.exercises || [];
  if (exercises.length > 0) {
    y = ensureSpace(doc, y, 24);
    y = sectionTitle(doc, "ESERCIZI IN PROGRAMMA", y);

    const exRows = exercises.map((item, i) => [
      String(i + 1),
      item.name || item.title || "—",
      item.customDuration || item.duration ? `${item.customDuration || item.duration} min` : "—",
      item.players ? String(item.players) : "—",
      item.variantNotes || item.notes || "",
    ]);

    y = defaultTable(doc, {
      head: [["#", "Esercizio", "Durata", "Giocatori", "Varianti / Note"]],
      body: exRows,
      startY: y,
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 60 },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: usableW - 10 - 60 - 22 - 24 },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // ── Note staff ────────────────────────────────────────────────
  if (session.notes) {
    y = ensureSpace(doc, y, 30);
    textBox(doc, "Note staff", session.notes, margins.l, y, usableW, 36);
  }

  finishBrandedPdf(doc, appSettings);

  if (save) {
    const dateStr = (session.date || "").replace(/-/g, "");
    doc.save(`scheda_seduta_${dateStr}_${safePdfName(session.title || session.theme || "allenamento")}.pdf`);
  }
  return doc;
}

function totalMinutes(session) {
  const fromBlocks = (session.sessionBlocks || []).reduce((s, b) => s + (Number(b.duration) || 0), 0);
  if (fromBlocks > 0) return fromBlocks;
  return (session.exercises || []).reduce((s, e) => s + (Number(e.customDuration || e.duration) || 0), 0);
}
