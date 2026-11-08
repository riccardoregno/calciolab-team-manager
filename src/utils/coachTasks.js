import { getMatchCompletionPlayerIds, getRecordedTrainingStatus, parseMatchResult, resolveMatchMinutes } from "./helpers.js";
import { getAgendaDateKey, buildCoachAgenda } from "./coachAgenda.js";
import { hasTrainingEnded } from "./trainingArchive.js";

export function summarizeMatchRsvps(match, rsvps = []) {
  const ids = [...new Set((match?.convocazione?.playerIds || []).map(String))];
  if (!ids.length) return null;
  const latest = new Map([...rsvps].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || ""))).map((row) => [String(row.player_id), row.response]));
  return ids.reduce((summary, id) => {
    const response = latest.get(id);
    if (response === "yes") summary.available += 1;
    else if (response === "no") summary.unavailable += 1;
    else summary.pending += 1;
    return summary;
  }, { total: ids.length, available: 0, unavailable: 0, pending: 0 });
}

export function buildCoachTasks({ sessions = [], matches = [], players = [], matchRows = [], canCheckMatchStats = true, now = new Date() } = {}) {
  const agenda = buildCoachAgenda(sessions, matches, now);
  const today = getAgendaDateKey(now);
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 12);
  const from = getAgendaDateKey(since);
  const tasks = [];
  const next = agenda.nextMatch;
  if (next && !(next.convocazione?.playerIds || []).length) tasks.push({ id: `callup:${next.id}`, kind: "callup", event: next, count: 0, to: `/match-convocation/${next.id}` });
  const playerIds = new Set(players.map((player) => String(player.id)));
  const recent = agenda.events.filter((event) => {
    const day = getAgendaDateKey(event.date);
    if (day < from || day > today) return false;
    if (event.type !== "Partita") return hasTrainingEnded(event, now);
    return day < today || event.completed || Boolean(parseMatchResult(event.result, event));
  }).reverse();
  for (const event of recent) {
    if (event.type === "Partita") {
      if (event.attendanceOnly) continue;
      if (!parseMatchResult(event.result, event)) tasks.push({ id: `result:${event.id}`, kind: "result", event, count: 0, to: `/post-match/${event.id}` });
      if (!canCheckMatchStats) continue;
      const ids = getMatchCompletionPlayerIds(event).filter((id) => playerIds.has(id));
      const rows = new Map(matchRows.filter((row) => String(row.match_id) === String(event.id)).map((row) => [String(row.player_id), row]));
      const missing = ids.filter((id) => resolveMatchMinutes(rows.get(id)?.minutes_played, event.attendance?.[id]?.minutes, rows.get(id)?.minutes_cleared) === null);
      if (missing.length) tasks.push({ id: `stats:${event.id}`, kind: "stats", event, count: missing.length, to: `/match-completion/${encodeURIComponent(event.id)}`, state: { fromDashboard: true, missingMinutesOnly: true } });
    } else {
      const roster = players.filter((player) => String(player.gruppo || "prima").trim().toLowerCase() === "prima");
      const missing = roster.filter((player) => getRecordedTrainingStatus(player, event) === null);
      if (missing.length) tasks.push({ id: `attendance:${event.id}`, kind: "attendance", event, count: missing.length, to: `/session-attendance/${encodeURIComponent(event.id)}`, state: { fromDashboard: true, pendingOnly: true } });
    }
  }
  return tasks;
}
