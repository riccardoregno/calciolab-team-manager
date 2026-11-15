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
export async function generateMatchPackagePDF({ match, allPlayers = [], profile = {}, staffList = [], appSettings = {}, rows = [], statsUnavailable = false, language = 'it', save = true, brandingAssets }) {
  if (!match) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  generateDistintaPDF(match, allPlayers, profile, staffList, { doc, save: false });
  await generateMatchReportPDF({ match, players: allPlayers, appSettings, rows, statsUnavailable, language, brandingAssets, doc, save: false });

  const safeOpponent = (match.opponent || "Avversario").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
  const dateStr = (match.date || new Date().toISOString()).slice(0, 10);
  if (save) doc.save(`Pacchetto_${safeOpponent}_${dateStr}.pdf`);
  return doc;
}
