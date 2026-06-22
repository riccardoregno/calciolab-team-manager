import {
  createBrandedPdf,
  defaultTable,
  finishBrandedPdf,
  formatPdfDate,
  safePdfName,
  sectionTitle,
  textBox,
} from "./pdfExportHelpers";

function findPlayerName(players, id) {
  if (!id) return "-";
  const p = players.find((pl) => String(pl.id) === String(id));
  return p ? (p.name || [p.firstName, p.lastName].filter(Boolean).join(" ")) : "-";
}

function addDiagramIfImage(doc, diagram, y, maxW = 90, maxH = 55) {
  if (!diagram || diagram.type !== "image" || !diagram.src) return y;
  try {
    const fmt = diagram.src.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(diagram.src, fmt, 14, y, maxW, maxH);
    return y + maxH + 6;
  } catch {
    return y;
  }
}

function renderScheme(doc, { title, players, off, def, offAssignmentsKey = "offAssignments", defAssignmentsKey = "defAssignments" }, y) {
  y = sectionTitle(doc, title, y);

  // Offensivo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Offensivo", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const offMeta = [off.offSchemeName, off.offCallCode, off.offVariant].filter(Boolean).join(" · ") || "-";
  doc.text(offMeta, 14, y);
  y += 6;

  const offAssignments = (off[offAssignmentsKey] || []).filter((a) => a.playerId);
  if (offAssignments.length) {
    y = defaultTable(doc, {
      startY: y,
      head: [["Giocatore", "Zona/Ruolo"]],
      body: offAssignments.map((a) => [findPlayerName(players, a.playerId), a.zone || a.role || "-"]),
    });
  }
  if (off.offNotes) {
    const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
    textBox(doc, "Note offensive", off.offNotes, 14, y, boxW, 22);
  }
  y = addDiagramIfImage(doc, off.offDiagram, y + (off.offNotes ? 28 : 4));

  // Defensivo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Defensivo", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const defMeta = [def.defSchemeName, def.defCallCode, def.defVariant].filter(Boolean).join(" · ") || "-";
  doc.text(defMeta, 14, y);
  y += 6;

  const defAssignments = (def[defAssignmentsKey] || []).filter((a) => a.playerId);
  if (defAssignments.length) {
    y = defaultTable(doc, {
      startY: y,
      head: [["Giocatore", "Compito", "Avversario", "Zona"]],
      body: defAssignments.map((a) => [findPlayerName(players, a.playerId), a.task || "-", a.opponent || "-", a.zone || "-"]),
    });
  }
  if (def.defNotes) {
    const boxW = (doc.internal.pageSize.getWidth() - 32) / 2;
    textBox(doc, "Note defensive", def.defNotes, 14, y, boxW, 22);
  }
  y = addDiagramIfImage(doc, def.defDiagram, y + (def.defNotes ? 28 : 4));

  return y + 4;
}

export async function generateSetPlaysPDF({ setPlays = {}, players = [], appSettings = {}, save = true }) {
  const dateStr = formatPdfDate(new Date());
  const { doc, teamName, assets, y: startY } = await createBrandedPdf({
    appSettings,
    subtitle: "Schemi su palla inattiva",
    dateStr,
  });

  let y = startY;
  const corners = setPlays.corners || {};
  const freekicks = setPlays.freekicks || {};
  const penalties = setPlays.penalties || {};

  y = renderScheme(doc, { title: "Calci d'angolo", players, off: corners, def: corners }, y);

  if (y > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = 20;
  }
  y = renderScheme(doc, { title: "Punizioni", players, off: freekicks, def: freekicks }, y);

  if (penalties.takers?.some(Boolean) || penalties.notes) {
    if (y > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 20;
    }
    y = sectionTitle(doc, "Rigori", y);
    const takers = (penalties.takers || []).filter(Boolean);
    if (takers.length) {
      y = defaultTable(doc, {
        startY: y,
        head: [["Ordine", "Giocatore"]],
        body: takers.map((id, i) => [String(i + 1), findPlayerName(players, id)]),
      });
    }
    if (penalties.notes) {
      const boxW = doc.internal.pageSize.getWidth() - 28;
      textBox(doc, "Note", penalties.notes, 14, y, boxW, 22);
    }
  }

  const filename = `Schemi_${safePdfName(teamName)}.pdf`;
  return finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save });
}
