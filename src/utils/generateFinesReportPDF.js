import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadBrandingAssets, drawBrandedHeader, drawBrandedFooters } from "./pdfBranding";

const C = {
  dark:   [15, 23, 42],
  accent: [37, 99, 235],
  white:  [255, 255, 255],
  red:    [220, 38, 38],
  rowAlt: [248, 250, 252],
};

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export async function generateFinesReportPDF({ rows, rangeStart, rangeEnd, teamName = "Squadra", teamLogoUrl }) {
  const { calciolabLogo, teamLogo } = await loadBrandingAssets(teamLogoUrl);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateStr = fmtDate(new Date().toISOString());
  const rangeLabel = rangeStart && rangeEnd ? `${fmtDate(rangeStart)} — ${fmtDate(rangeEnd)}` : "";

  let y = drawBrandedHeader(doc, { teamName, subtitle: `Report assenze per multe${rangeLabel ? ` · ${rangeLabel}` : ""}`, dateStr, teamLogo });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.accent);
  doc.text(`Giocatori con assenze multabili (${rows.length})`, 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Cognome e Nome", "Ruolo", "Giorni multabili", "Date"]],
    body: rows.map((row) => [
      row.name,
      row.role || "—",
      String(row.count),
      row.entries.map((e) => `${fmtDate(e.date)} (${e.reason})`).join(", ") || "—",
    ]),
    headStyles: { fillColor: C.accent, textColor: C.white, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, textColor: C.dark },
    alternateRowStyles: { fillColor: C.rowAlt },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 28 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: "auto" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 2) {
        data.cell.styles.textColor = C.red;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  drawBrandedFooters(doc, { teamName, dateStr, calciolabLogo });

  const safeName = teamName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`multe_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
