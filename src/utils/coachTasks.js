import { getAgendaDateKey, buildCoachAgenda } from "./coachAgenda.js";
import { isLeagueStatsMatch, parseMatchResult } from "./helpers.js";

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
  const recent = agenda.pastEvents.filter((event) => {
    const day = getAgendaDateKey(event.date);
    return day >= from && (day < today || event.completed === true);
  });
  for (const event of recent) {
    if (event.type === "Partita") {
      if (!parseMatchResult(event.result, event)) tasks.push({ id: `result:${event.id}`, kind: "result", event, count: 0, to: `/post-match/${event.id}` });
      if (!canCheckMatchStats || !isLeagueStatsMatch(event)) continue;
      const ids = [...new Set([...(event.convocazione?.playerIds || []), ...(event.lineup?.calledUpIds || []), ...(event.lineup?.starterIds || []), ...(event.lineup?.benchIds || [])].map(String))].filter((id) => playerIds.has(id));
      const rows = new Map(matchRows.filter((row) => String(row.match_id) === String(event.id)).map((row) => [String(row.player_id), row]));
      const missing = ids.filter((id) => {
        const row = rows.get(id) || event.attendance?.[id];
        const minutes = row?.minutes_played ?? row?.minutes;
        return minutes == null || String(minutes).trim() === "" || !Number.isFinite(Number(minutes));
      });
      if (missing.length) tasks.push({ id: `stats:${event.id}`, kind: "stats", event, count: missing.length, to: `/match-stats/${event.id}` });
    } else {
      const roster = players.filter((player) => (player.gruppo || "prima") === "prima");
      const missing = roster.filter((player) => !event.attendance?.[player.id]?.status);
      if (missing.length) tasks.push({ id: `attendance:${event.id}`, kind: "attendance", event, count: missing.length, to: `/session-attendance/${event.id}` });
    }
  }
  return tasks;
}
