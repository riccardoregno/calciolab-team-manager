import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const C = {
  dark:    [15,  23,  42],
  accent:  [37,  99, 235],
  white:   [255, 255, 255],
  muted:   [100, 116, 139],
  light:   [241, 245, 249],
  border:  [203, 213, 225],
  green:   [22,  163,  74],
  red:     [220,  38,  38],
  orange:  [234, 88,   12],
  amber:   [180, 120,   0],
  purple:  [147,  51, 234],
  rowAlt:  [248, 250, 252],
};

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function statusColor(status) {
  switch (status) {
    case "Infortunato":   return C.red;
    case "Recupero":      return C.orange;
    case "Differenziato": return C.amber;
    case "Squalificato":  return C.purple;
    default:              return C.green;
  }
}

export function generateAvailabilityPDF({ players, teamName = "Squadra", date, prepRange, prepDays }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const dateStr = date ? fmtDate(date) : fmtDate(new Date().toISOString());
  const hasPlannerData = Array.isArray(prepDays) && prepDays.length > 0;

  const UNAVAILABLE = ["Infortunato", "Recupero", "Differenziato", "Squalificato"];
  const available = players.filter((p) => !UNAVAILABLE.includes(p.status || "Disponibile"));
  const unavailable = players.filter((p) => UNAVAILABLE.includes(p.status || "Disponibile"));

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, W, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text(teamName, 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Report disponibilità", 14, 16);
  doc.text(dateStr, W - 14, 16, { align: "right" });

  let y = 30;

  // ── Disponibili ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.green);
  doc.text(`Disponibili (${available.length})`, 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["N°", "Cognome e Nome", "Ruolo", "Status"]],
    body: available.map((p) => [
      p.number ?? "—",
      [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—",
      p.role || "—",
      p.status || "Disponibile",
    ]),
    headStyles: { fillColor: C.green, textColor: C.white, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: C.dark },
    alternateRowStyles: { fillColor: C.rowAlt },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 45 },
      3: { cellWidth: 35 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.textColor = C.green;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ── Non disponibili ────────────────────────────────────────────────────────
  if (unavailable.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.red);
    doc.text(`Non disponibili (${unavailable.length})`, 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["N°", "Cognome e Nome", "Ruolo", "Status", "Tipo", "Rientro previsto"]],
      body: unavailable.map((p) => [
        p.number ?? "—",
        [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—",
        p.role || "—",
        p.status || "—",
        p.injuryType || "—",
        fmtDate(p.expectedReturn),
      ]),
      headStyles: { fillColor: C.red, textColor: C.white, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: C.dark },
      alternateRowStyles: { fillColor: C.rowAlt },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 35 },
        3: { cellWidth: 28 },
        4: { cellWidth: 30 },
        5: { cellWidth: 22 },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 3) {
          const row = unavailable[data.row.index];
          data.cell.styles.textColor = statusColor(row?.status);
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  // ── Pianificazione giorno per giorno ───────────────────────────────────────
  if (hasPlannerData) {
    if (y > 220) { doc.addPage(); y = 20; }

    const rangeLabel = prepRange?.start && prepRange?.end
      ? `${fmtDate(prepRange.start)} — ${fmtDate(prepRange.end)}`
      : "";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.accent);
    doc.text(`Pianificazione disponibilità${rangeLabel ? ` · ${rangeLabel}` : ""}`, 14, y);
    y += 3;

    const CRITICAL_RATIO = 0.7;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["Giorno", "Data", "Disponibili", "Assenti"]],
      body: prepDays.map((day) => {
        const ratio = day.total > 0 ? day.available / day.total : 1;
        const isCritical = ratio < CRITICAL_RATIO;
        const absentNames = (day.absentEntries || [])
          .map((e) => {
            const name = [e.player?.firstName, e.player?.lastName].filter(Boolean).join(" ") || e.player?.name || "—";
            const reason = e.info?.reason || e.info?.status || "";
            return reason ? `${name} (${reason})` : name;
          })
          .join(", ") || "—";

        const d = new Date(day.date);
        const dayLabel = d.toLocaleDateString("it-IT", { weekday: "short" });
        const dateLabel = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });

        return [
          dayLabel,
          dateLabel,
          { content: `${day.available}/${day.total}`, isCritical },
          absentNames,
        ];
      }),
      headStyles: { fillColor: C.accent, textColor: C.white, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5, textColor: C.dark },
      alternateRowStyles: { fillColor: C.rowAlt },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: "auto" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 2) {
          const row = prepDays[data.row.index];
          if (!row) return;
          const ratio = row.total > 0 ? row.available / row.total : 1;
          data.cell.styles.textColor = ratio < CRITICAL_RATIO ? C.red : ratio < 0.9 ? C.orange : C.green;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`CalcioLab · ${teamName} · ${dateStr}`, 14, 292);
    doc.text(`${i}/${pages}`, W - 14, 292, { align: "right" });
  }

  const safeName = teamName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`disponibilita_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateAvailabilityCSV({ players, teamName = "Squadra" }) {
  const UNAVAILABLE = ["Infortunato", "Recupero", "Differenziato", "Squalificato"];

  const rows = [
    ["Numero", "Nome", "Cognome", "Nome completo", "Ruolo", "Status", "Tipo infortunio", "Data inizio", "Rientro previsto", "Note"],
    ...players
      .slice()
      .sort((a, b) => {
        const aAvail = !UNAVAILABLE.includes(a.status || "Disponibile");
        const bAvail = !UNAVAILABLE.includes(b.status || "Disponibile");
        if (aAvail !== bAvail) return aAvail ? -1 : 1;
        return (Number(a.number) || 99) - (Number(b.number) || 99);
      })
      .map((p) => [
        p.number ?? "",
        p.firstName || "",
        p.lastName || "",
        [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "",
        p.role || "",
        p.status || "Disponibile",
        p.injuryType || "",
        p.injuryStartDate || "",
        p.expectedReturn || "",
        (p.injuryNotes || "").replace(/[\r\n]+/g, " "),
      ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `disponibilita_${teamName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
