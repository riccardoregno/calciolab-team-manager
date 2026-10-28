import assert from "node:assert/strict";
import { buildLeagueSeasonTrend } from "../src/utils/seasonTrend.js";
import { parseMatchResult } from "../src/utils/helpers.js";

const league = (date, opponent, result, extra = {}) => ({ type: "Partita", matchKind: "Campionato", date, opponent, result, location: "Casa", ...extra });
const events = [
  league("2026-10-25", "PIETRACUTA", "1-3", { location: "Trasferta", goalsScored: "1", goalsConceded: "3" }),
  league("2026-10-01", "A", "2-0"),
  league("2026-10-02", "Osteria", "4-0", { matchKind: "Coppa" }),
  league("2026-10-03", "Imolese", "1-0", { competition: "Coppa Italia" }),
  league("2026-10-04", "Senza risultato", ""),
  league("2026-10-05", "B", "1-1"),
  league("2026-10-06", "Amichevole", "5-0", { isFriendly: true }),
  league("2026-10-18", "Osteria", "2-1"),
];
const trend = buildLeagueSeasonTrend(events);
assert.equal(trend.length, 4);
assert.deepEqual(trend.map((m) => m.cumPts), [3, 4, 7, 10]);
assert.deepEqual(trend.map((m) => m.match), [1, 2, 3, 4]);
assert.equal(trend.at(-1).outcome, "W");
assert.equal(trend.at(-1).goalsFor, 3);
assert.equal(trend.at(-1).goalsAgainst, 1);
assert.equal(trend.at(-1).pts, 3);
assert.equal(events[0].opponent, "PIETRACUTA", "Do not reorder source data");
assert.deepEqual(parseMatchResult("1-3", { location: "Trasferta", goalsFor: "3", goalsAgainst: "1" }),
  { goalsFor: 3, goalsAgainst: 1, homeGoals: 1, awayGoals: 3 });
assert.equal(parseMatchResult("", { goalsScored: null, goalsConceded: null }), null);
assert.equal(parseMatchResult("", { goalsScored: "3", goalsConceded: "1", location: "Trasferta" }).goalsFor, 3);
assert.equal(buildLeagueSeasonTrend([league("2026-10-01", "Zero", "0-0")])[0].cumPts, 1);
console.log("League charts: cup exclusion, running points, away win and score consistency passed.");
