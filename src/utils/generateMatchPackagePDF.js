import { jsPDF } from "jspdf";
import { generateDistintaPDF } from "./generateDistintaPDF";
import { generateMatchReportPDF } from "./generateMatchReportPDF";

/**
 * Genera un unico PDF "pacchetto partita": distinta FIGC + referto post-gara.
 * @param {object} match
 * @param {object[]} allPlayers
 * @param {object} profile      - workspaceProfile da appSettings
 * @param {object[]} staffList
 * @param {object} appSettings
 */
export function generateMatchPackagePDF({ match, allPlayers = [], profile = {}, staffList = [], appSettings = {} }) {
  if (!match) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  generateDistintaPDF(match, allPlayers, profile, staffList, { doc, save: false });
  generateMatchReportPDF({ match, players: allPlayers, appSettings, doc, save: false });

  const safeOpponent = (match.opponent || "Avversario").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
  const dateStr = (match.date || new Date().toISOString()).slice(0, 10);
  doc.save(`Pacchetto_${safeOpponent}_${dateStr}.pdf`);
}
