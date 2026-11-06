import { getAgendaDateKey } from "./coachAgenda.js";
import { isLeagueStatsMatch } from "./helpers.js";

export function normalizeSeason(value) {
  const label = String(value ?? "").trim();
  const years = label.match(/^(\d{4})\s*[/–-]\s*(\d{2}|\d{4})$/);
  return years ? years[1] + "/" + years[2].slice(-2) : label;
}

export function getMatchSeason(match) {
  const stored = normalizeSeason(match.season);
  if (stored) return stored;
  const date = getAgendaDateKey(match.date);
  if (!date) return "";
  const [year, month] = date.split("-").map(Number);
  const start = year - (month < 7 ? 1 : 0);
  return normalizeSeason(start + "/" + (start + 1));
}

function competitionName(match) {
  return String(match.competition || match.matchKind || (isLeagueStatsMatch(match) ? "Campionato" : "")).trim();
}

export function buildMatchScope(matches, selection, currentSeason) {
  const seasons = [...new Set(matches.map(getMatchSeason).filter(Boolean))].sort().reverse();
  const configured = normalizeSeason(currentSeason);
  const season = selection.season === "all" || seasons.includes(selection.season)
    ? selection.season : seasons.includes(configured) ? configured : seasons[0] || "all";
  const seasonMatches = matches.filter((match) => season === "all" || getMatchSeason(match) === season);
  const names = [...new Set(seasonMatches.map(competitionName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
  const competitions = [
    { value: "all", label: "" },
    ...(seasonMatches.some(isLeagueStatsMatch) ? [{ value: "league", label: "" }] : []),
    ...names.filter((name) => name !== "Campionato").map((name) => ({ value: "name:" + name, label: name })),
  ];
  const competition = competitions.some(({ value }) => value === selection.competition)
    ? selection.competition : competitions[1]?.value === "league" ? "league" : "all";
  const scopedMatches = seasonMatches.filter((match) =>
    competition === "all" || (competition === "league" ? isLeagueStatsMatch(match) : "name:" + competitionName(match) === competition)
  );
  return { seasons, season, competitions, competition, matches: scopedMatches };
}
