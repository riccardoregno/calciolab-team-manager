// Empty scores mean scheduled; a partial score must never erase an existing result.
export function isValidMatchScore(scored, conceded) {
  const values = [scored, conceded].map((value) => String(value ?? "").trim());
  return values.every((value) => value === "") || values.every((value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)));
}

// Inputs and the stored result always follow the fixture's home-away order.
export function buildHomeAwayScorePayload(match, homeRaw, awayRaw) {
  const home = String(homeRaw ?? "").trim();
  const away = String(awayRaw ?? "").trim();
  if (home === "" || away === "") {
    return { result: "", goalsFor: "", goalsAgainst: "", goalsScored: "", goalsConceded: "" };
  }
  const homeGoals = Number(home);
  const awayGoals = Number(away);
  const isAway = match.location === "Trasferta";
  return {
    result: `${homeGoals}-${awayGoals}`,
    goalsFor: String(homeGoals),
    goalsAgainst: String(awayGoals),
    goalsScored: String(isAway ? awayGoals : homeGoals),
    goalsConceded: String(isAway ? homeGoals : awayGoals),
  };
}
