import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawBrandedFooters, drawBrandedHeader, loadBrandingAssets } from "./pdfBranding";

export { autoTable };

export const PDF_COLORS = {
  blue: [37, 99, 235],
  blueLight: [96, 165, 250],
  dark: [15, 23, 42],
  darker: [8, 13, 24],
  text: [15, 23, 42],
  muted: [100, 116, 139],
  border: [203, 213, 225],
  white: [255, 255, 255],
  green: [22, 163, 74],
  orange: [234, 88, 12],
  red: [220, 38, 38],
};

export function formatPdfDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function safePdfName(value, fallback = "export") {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}

export async function createBrandedPdf({ appSettings = {}, subtitle = "", dateStr = "" } = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", putOnlyUsedFonts: true });
  const teamName = appSettings?.workspaceProfile?.clubName ||
    appSettings?.workspaceProfile?.teamName ||
    "CalcioLab";
  const teamLogoUrl = appSettings?.workspaceProfile?.logo || null;
  const assets = await loadBrandingAssets(teamLogoUrl);
  const startY = drawBrandedHeader(doc, {
    teamName,
    subtitle,
    dateStr,
    teamLogo: assets.teamLogo,
  });
  return { doc, teamName, assets, y: startY };
}

export function finishBrandedPdf(doc, { teamName, dateStr, assets, filename, save = true }) {
  drawBrandedFooters(doc, {
    teamName,
    dateStr,
    calciolabLogo: assets?.calciolabLogo,
  });
  if (save) doc.save(filename);
  return doc;
}

export function sectionTitle(doc, title, y) {
  ensureSpace(doc, y, 18);
  doc.setFillColor(...PDF_COLORS.blue);
  doc.roundedRect(14, y, 182, 8, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(String(title || "").toUpperCase(), 18, y + 5.4);
  return y + 13;
}

export function keyValueGrid(doc, items, y, { columns = 4, rowHeight = 20 } = {}) {
  const gap = 4;
  const pageW = doc.internal.pageSize.getWidth();
  const width = (pageW - 28 - gap * (columns - 1)) / columns;
  let cursorY = y;

  items.forEach((item, index) => {
    if (index > 0 && index % columns === 0) cursorY += rowHeight + gap;
    ensureSpace(doc, cursorY, rowHeight + 8);
    const col = index % columns;
    const x = 14 + col * (width + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.roundedRect(x, cursorY, width, rowHeight, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(String(item.label || "").toUpperCase(), x + 3, cursorY + 6);
    doc.setFontSize(13);
    doc.setTextColor(...PDF_COLORS.text);
    const value = doc.splitTextToSize(String(item.value ?? "-"), width - 6);
    doc.text(value.slice(0, 2), x + 3, cursorY + 13);
  });

  return cursorY + rowHeight + 8;
}

export function textBox(doc, label, value, x, y, w, h = 26) {
  ensureSpace(doc, y, h + 8);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(String(label || "").toUpperCase(), x + 3, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.text);
  const lines = doc.splitTextToSize(String(value || "-"), w - 6);
  doc.text(lines.slice(0, Math.max(1, Math.floor((h - 11) / 4))), x + 3, y + 12);
}

export function defaultTable(doc, { startY, head, body, columnStyles = {} }) {
  autoTable(doc, {
    startY,
    head,
    body,
    margin: { left: 14, right: 14, bottom: 18 },
    headStyles: {
      fillColor: PDF_COLORS.blue,
      textColor: PDF_COLORS.white,
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: PDF_COLORS.text,
      cellPadding: 2.5,
      lineColor: PDF_COLORS.border,
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "top",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
  });
  return doc.lastAutoTable.finalY + 8;
}

export function ensureSpace(doc, y, needed = 30) {
  if (y + needed <= 282) return y;
  doc.addPage();
  return 18;
}
