import { isLeagueStatsMatch, parseMatchResult } from "./helpers.js";

// Only league results contribute points. Missing results must not reset the running total.
export function buildLeagueSeasonTrend(events = []) {
  const matches = events.filter((event) => event.type === "Partita" && event.date && isLeagueStatsMatch(event))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return matches.reduce((trend, match) => {
    const result = parseMatchResult(match.result, match);
    if (!result) return trend;
    const { goalsFor, goalsAgainst } = result;
    const outcome = goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L";
    const pts = outcome === "W" ? 3 : outcome === "D" ? 1 : 0;
    const index = trend.length + 1;
    trend.push({
      match: index, label: match.opponent ? String(match.opponent).slice(0, 10) : "G" + index,
      outcome, pts, cumPts: (trend.at(-1)?.cumPts || 0) + pts, goalsFor, goalsAgainst,
    });
    return trend;
  }, []);
}
