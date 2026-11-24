function escapeCell(value) {
  let text = String(value ?? "");
  // Quoting a cell alone does not stop spreadsheets from evaluating it as a formula.
  if (typeof value === "string" && /^(?:[\t\r\n]|\s*[=+@-])/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function buildWeeklyRosterCsv({ groups, teamName, scopeLabel, start, end, minutesUnavailable, language, t }) {
  const headers = [
    "team", "scope", "from", "to", "player", "sessions", "presences", "pendingPresences",
    "matches", "minutes", "missingMinutes", "unknownCallups", "minutesStatus",
  ].map(key => t("rosterCsv." + key));
  const rows = groups.flatMap(({ rows }) => rows.map(row => [
    teamName,
    scopeLabel,
    start,
    end,
    row.player.name,
    row.playerSessions.length,
    row.trainingPresences,
    row.pendingSessions.length,
    row.games.length,
    !minutesUnavailable && row.known.length ? row.totalMinutes : null,
    minutesUnavailable ? null : row.missing.length,
    minutesUnavailable ? null : row.unverifiable,
    minutesUnavailable || row.matchSummary,
  ]));
  const delimiter = language === "en" ? "," : ";";
  return "\uFEFF" + [headers, ...rows].map(row => row.map(escapeCell).join(delimiter)).join("\r\n");
}
