import { getAgendaDateKey } from "./coachAgenda.js";
import { getLineup, parseMatchResult, getMatchCompletionPlayerIds, resolveMatchMinutes, parseRecordedMinutes } from "./helpers.js";

export { getMatchCompletionPlayerIds };

export function hasRecordedMinutes(value) {
  return parseRecordedMinutes(value) !== null;
}

export function getMatchCompletionTasks({ matches, players, rows, canCheckMinutes, now = new Date() }) {
  const today = getAgendaDateKey(now);
  const rosterIds = new Set(players.map((player) => String(player.id)));
  const minutesByMatch = new Map();
  for (const row of rows) {
    const matchId = String(row.match_id);
    if (!minutesByMatch.has(matchId)) minutesByMatch.set(matchId, new Map());
    minutesByMatch.get(matchId).set(String(row.player_id), row);
  }

  const pending = [];
  for (const match of matches) {
    const day = getAgendaDateKey(match.date);
    const score = parseMatchResult(match.result, match);
    if (!day || day > today || (day === today && !score && !match.completed)) continue;

    const lineup = getLineup(match);
    const ids = getMatchCompletionPlayerIds(match);
    const recorded = minutesByMatch.get(String(match.id));
    const missingMinutes = canCheckMinutes ? ids.filter((id) =>
      rosterIds.has(id) && resolveMatchMinutes(recorded?.get(id)?.minutes_played, match.attendance?.[id]?.minutes, recorded?.get(id)?.minutes_cleared) === null
    ).length : 0;
    const missingResult = !score;
    const missingFormation = !lineup.starterIds.some(Boolean);
    if (missingResult || missingFormation || missingMinutes) {
      pending.push({ match, missingResult, missingFormation, missingMinutes });
    }
  }
  return pending;
}
