import { getAgendaDateKey } from "./coachAgenda.js";
import { getLineup, parseMatchResult } from "./helpers.js";

export function hasRecordedMinutes(value) {
  return value != null && String(value).trim() !== "" &&
    Number.isInteger(Number(value)) && Number(value) >= 0;
}

export function getMatchCompletionPlayerIds(match) {
  const lineup = getLineup(match);
  return [...new Set([
    ...lineup.starterIds, ...lineup.benchIds, ...lineup.calledUpIds,
    ...(match.convocazione?.playerIds || []),
  ].filter((id) => id != null).map(String))];
}

export function getMatchCompletionTasks({ matches, players, rows, canCheckMinutes, now = new Date() }) {
  const today = getAgendaDateKey(now);
  const rosterIds = new Set(players.map((player) => String(player.id)));
  const minutesByMatch = new Map();
  for (const row of rows) {
    const matchId = String(row.match_id);
    if (!minutesByMatch.has(matchId)) minutesByMatch.set(matchId, new Map());
    minutesByMatch.get(matchId).set(String(row.player_id), row.minutes_played);
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
      rosterIds.has(id) && !hasRecordedMinutes(recorded?.has(id) ? recorded.get(id) : match.attendance?.[id]?.minutes)
    ).length : 0;
    const missingResult = !score;
    const missingFormation = !lineup.starterIds.some(Boolean);
    if (missingResult || missingFormation || missingMinutes) {
      pending.push({ match, missingResult, missingFormation, missingMinutes });
    }
  }
  return pending;
}
