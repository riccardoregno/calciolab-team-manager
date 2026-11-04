import assert from "node:assert/strict";
import { buildCoachAnalysis, hasRecordedLineup } from "../src/utils/coachAnalysis.js";

const now = new Date(2020, 0, 10, 12);
const base = { matchKind: "Campionato", season: "2019/20", location: "Casa" };
const players = [
  { id: "a", name: "A", status: "Disponibile" },
  { id: "b", name: "B", status: "Recupero" },
  { id: "c", name: "C", status: "Disponibile", absences: [{ dateStart: "2020-01-11", dateEnd: "2020-01-14", type: "Permesso" }] },
  { id: "d", name: "D" },
  { id: "j", name: "J", gruppo: "juniores", status: "Disponibile" },
];
const matches = [
  { ...base, id: "away", date: "2020-01-02", location: "Trasferta", result: "0-2", convocazione: { playerIds: ["a", "b"] } },
  { ...base, id: "draw", date: "2020-01-04", result: "1-1" },
  { ...base, id: "cup", date: "2020-01-05", matchKind: "Coppa", result: "6-0" },
  { ...base, id: "missing", date: "2020-01-06", result: "" },
  { ...base, id: "loss", date: "2020-01-07", result: "0-1", attendance: { a: { minutes: 90, goals: 0 } } },
  { ...base, id: "future-scored", date: "2020-02-01", result: "9-0" },
  { ...base, id: "next", date: "2020-01-12", result: "" },
  { ...base, id: "old", season: "2018/19", date: "2019-05-01", result: "10-0" },
  { ...base, id: "invalid", date: "2020-02-30", result: "3-0" },
];
const rows = [
  { match_id: "away", player_id: "a", minutes_played: 90, goals: 2, assists: 1 },
  { match_id: "away", player_id: "b", minutes_played: 0, goals: 0 },
  { match_id: "cup", player_id: "a", minutes_played: 90, goals: 6 },
  { match_id: "old", player_id: "a", minutes_played: 90, goals: 10 },
  { match_id: "future-scored", player_id: "a", minutes_played: 90, goals: 9 },
  { match_id: "away", player_id: "j", minutes_played: 30, goals: 1 },
];
const snapshot = JSON.stringify({ players, matches, rows });
const model = buildCoachAnalysis({ players, matches, rows, now, season: "2019/20" });
assert.equal(model.points, 4);
assert.equal(model.record.played, 3);
assert.equal(model.record.goalsFor, 3, "An away 0-2 win means two scored and none conceded");
assert.equal(model.record.goalsAgainst, 2);
assert.equal(model.pointsPerGame, 4 / 3);
assert.deepEqual(model.form.map((item) => item.outcome), ["win", "draw", "loss"]);
assert.deepEqual(model.trend.map((item) => item.cumulative), [3, 4, 4]);
assert.equal(model.latest.id, "loss");
assert.equal(model.nextMatch.id, "next");
assert.equal(model.topScorers[0].goals, 2, "Use league rows only, without old seasons or future games");
assert.equal(model.topScorers.some((item) => item.player.id === "j"), false);
assert.deepEqual(model.missingResults.map((match) => match.id), ["missing"]);
assert.deepEqual(model.missingLineups.map((match) => match.id), ["draw"]);
assert.equal(model.recordedLineups, 2);
assert.equal(model.availability.available.length, 1);
assert.equal(model.availability.limited.length, 1);
assert.equal(model.availability.unavailable[0].id, "c", "Availability must use the date of the next fixture");
assert.equal(model.availability.unknown[0].id, "d", "Unknown status must not be reported as available");
assert.equal(hasRecordedLineup(matches[0], rows), true, "A recorded zero minutes is complete");
assert.equal(hasRecordedLineup(matches[0], rows.filter((row) => row.player_id !== "b")), false);
assert.equal(hasRecordedLineup({ ...matches[0], convocazione: {}, lineup: { starterIds: ["a"], benchIds: ["missing-player"] } }, rows), false, "The saved formation must also be checked");
assert.equal(hasRecordedLineup({ id: "x", convocazione: { playerIds: ["a"] }, attendance: { a: { minutes: 90 } } }, [{ match_id: "x", player_id: "a", minutes_played: null }]), false);
const offline = buildCoachAnalysis({ players, matches, rows, now, canCheckStats: false });
assert.equal(offline.topScorers.length, 0);
assert.equal(offline.recordedLineups, null);
const empty = buildCoachAnalysis({ now });
assert.equal(empty.record.played, 0);
assert.equal(empty.pointsPerGame, null);
assert.equal(empty.latest, null);
assert.equal(empty.nextMatch, null);
assert.equal(JSON.stringify({ players, matches, rows }), snapshot, "Dashboard calculations must not change stored data");
console.log("Coach analysis: home-away, league scope, missing data, availability, zero minutes and loading/error contracts passed");
