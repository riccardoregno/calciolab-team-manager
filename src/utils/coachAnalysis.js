import { getAgendaDateKey, buildCoachAgenda } from "./coachAgenda.js";
import { getPlayerMatchTotals, getPlayerUnavailabilityOnDate, getSeasonRecord, isLeagueStatsMatch, parseMatchResult } from "./helpers.js";

const order = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || "").localeCompare(String(b.time || ""));
const hasMinutes = (value) => value != null && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

export function hasRecordedLineup(match, rows = []) {
  const saved = new Map(rows.filter((row) => String(row.match_id) === String(match.id)).map((row) => [String(row.player_id), row]));
  const expected = [...new Set([...(match.convocazione?.playerIds || []), ...(match.lineup?.calledUpIds || []), ...(match.lineup?.starterIds || []), ...(match.lineup?.benchIds || [])].map(String))];
  const recorded = (id) => {
    const row = saved.get(id);
    // An authoritative saved row with missing minutes must not fall back to stale local values.
    return row ? hasMinutes(row.minutes_played) : hasMinutes(match.attendance?.[id]?.minutes);
  };
  if (expected.length) return expected.every(recorded);
  return [...saved.values()].some((row) => hasMinutes(row.minutes_played)) ||
    Object.values(match.attendance || {}).some((entry) => hasMinutes(entry?.minutes));
}

export function buildCoachAnalysis({ matches = [], players = [], sessions = [], rows = [], now = new Date(), season = "", group = "prima", canCheckStats = true, leagueOnly = true } = {}) {
  const today = getAgendaDateKey(now);
  const scoped = matches.filter((match) => getAgendaDateKey(match.date) && (!season || !match.season || match.season === season));
  const past = scoped.filter((match) => getAgendaDateKey(match.date) < today || (getAgendaDateKey(match.date) === today && parseMatchResult(match.result, match))).sort(order);
  const played = past.filter((match) => (!leagueOnly || isLeagueStatsMatch(match)) && parseMatchResult(match.result, match));
  const record = getSeasonRecord(played);
  const points = record.wins * 3 + record.draws;
  let cumulative = 0;
  const results = played.map((match) => {
    const score = parseMatchResult(match.result, match);
    const outcome = score.goalsFor > score.goalsAgainst ? "win" : score.goalsFor < score.goalsAgainst ? "loss" : "draw";
    const earned = outcome === "win" ? 3 : outcome === "draw" ? 1 : 0;
    cumulative += earned;
    return { match, score, outcome, earned, cumulative };
  });
  const agenda = buildCoachAgenda(sessions, scoped.filter((match) => !parseMatchResult(match.result, match)), now);
  const nextMatch = agenda.nextMatch;
  const roster = players.filter((player) => group === "tutti" || (player.gruppo || "prima") === group);
  const referenceDate = nextMatch?.date || today;
  const availability = { available: [], limited: [], unavailable: [], unknown: [] };
  for (const player of roster) {
    const period = getPlayerUnavailabilityOnDate(player, referenceDate);
    const status = player.status;
    const category = period || ["Infortunato", "Squalificato", "Assente", "Permesso"].includes(status) ? "unavailable" :
      ["Recupero", "Differenziato"].includes(status) ? "limited" : status === "Disponibile" ? "available" : "unknown";
    availability[category].push({ ...player, reason: period?.label || status || "" });
  }
  const playerStats = canCheckStats ? roster.map((player) => ({ player, ...getPlayerMatchTotals(player, played, rows, roster, leagueOnly) })) : [];
  const leaders = (key) => [...playerStats].filter((item) => item[key] > 0).sort((a, b) => b[key] - a[key] || b.minutes - a.minutes || String(a.player.id).localeCompare(String(b.player.id))).slice(0, 3);
  const missingResults = past.filter((match) => !parseMatchResult(match.result, match)).reverse();
  const missingLineups = canCheckStats ? played.filter((match) => !hasRecordedLineup(match, rows)).reverse() : [];
  const latest = past.at(-1) || null;
  return { record, points, pointsPerGame: record.played ? points / record.played : null, results, form: results.slice(-5), trend: results.slice(-8),
    nextMatch, nextTraining: agenda.nextTraining, latest, latestScore: latest ? parseMatchResult(latest.result, latest) : null,
    roster, availability, referenceDate, topScorers: leaders("goals"), topAssists: leaders("assists"), topMinutes: leaders("minutes"),
    missingResults, missingLineups, recordedLineups: canCheckStats ? played.length - missingLineups.length : null,
  };
}
