import assert from "node:assert/strict";
import { getGoalkeeperGoalsConceded, getPlayerMatchEntries, getPlayerMatchTotals, getPlayerSummary, isGoalkeeper } from "../src/utils/helpers.js";

const keeper = { id: "gk", role: "Portiere" };
const reserve = { id: "reserve", position: "GK" };
const striker = { id: "forward", role: "Attaccante" };
const players = [keeper, reserve, striker];
const match = { id: "home", type: "Partita", matchKind: "Campionato", date: "2020-01-01", result: "3-2",
  attendance: { gk: { minutes: 90 }, reserve: { minutes: 0 } } };
const conceded = (player, matches, rows = []) => getGoalkeeperGoalsConceded(player, matches, players, rows);
assert.equal(isGoalkeeper(reserve), true);
assert.equal(isGoalkeeper(striker), false);
assert.equal(conceded(keeper, [match]), 2);
assert.equal(conceded(reserve, [match]), 0, "Bench goalkeepers must not inherit the team score");
assert.equal(conceded(keeper, [{ ...match, location: "Trasferta" }]), 3);
assert.equal(conceded(keeper, [{ ...match, result: "0-0" }]), 0);
assert.equal(conceded(keeper, [{ ...match, attendance: { gk: { minutes: 45 } } }]), null, "Partial appearances cannot inherit all goals");
const shared = { ...match, attendance: { gk: { minutes: 45 }, reserve: { minutes: 45 } } };
assert.equal(conceded(keeper, [shared]), null);
assert.equal(conceded(keeper, [shared], [{ player_id: "gk", match_id: "home", minutes_played: 45, goals_conceded: 0 }]), 0, "Recorded zero is known, not missing");
assert.equal(conceded(reserve, [shared], [{ player_id: "reserve", match_id: "home", minutes_played: 45, goals_conceded: 2 }]), 2);
assert.equal(conceded(keeper, [match], [{ player_id: "gk", match_id: "home", minutes_played: 0, goals_conceded: null }]), 0, "Official zero-minute rows override local appearances");
assert.equal(conceded(keeper, [{ ...match, result: "" }]), null, "Unknown results must not look like clean sheets");
assert.equal(conceded(keeper, [{ ...match, date: "2999-01-01" }]), 0);
assert.equal(conceded(keeper, [{ ...match, isFriendly: true }]), 0);
assert.equal(conceded(keeper, [{ ...match, matchKind: "Coppa" }]), 0);

const league = { ...match, attendance: { forward: { status: "Presente", minutes: 10, goals: 9 } } };
const fallback = { ...league, id: "local", attendance: { forward: { minutes: 20, goals: 1, assists: 1 } } };
const bench = { ...league, id: "bench", lineup: { calledUpIds: ["forward"] }, attendance: {} };
const matches = [league, fallback, bench, { ...league, id: "cup", matchKind: "Coppa" }, { ...league, id: "future", date: "2999-01-01" }];
const rows = [{ player_id: "forward", match_id: "home", minutes_played: 90, goals: 2, assists: 1 },
  { player_id: "forward", match_id: "bench", minutes_played: 0, goals: 0 },
  { player_id: "reserve", match_id: "home", minutes_played: 90, goals: 8 }];
const stats = getPlayerMatchTotals(striker, matches, rows, players);
assert.equal(stats.presences, 2, "A call-up or saved bench row is not a played match");
assert.equal(stats.minutes, 110, "Missing rows use the local match, without discarding other official rows");
assert.equal(stats.goals, 3, "Use the selected player's rows, not another player's");
assert.equal(stats.assists, 2);
const summary = getPlayerSummary(striker, { matches, players, playerMatchesDB: rows,
  sessions: [{ type: "Allenamento", date: "2020-01-01", attendance: { forward: { status: "Presente", minutes: 60, goals: 7, assists: 8, rpe: 5 } } }] });
for (const field of ["presences", "minutes", "goals", "assists"]) assert.equal(summary.stats[field], stats[field], `${field} must agree across profile, portal and statistics`);
assert.equal(summary.stats.load, 300, "Training workload remains available separately");
assert.equal(getPlayerMatchEntries(striker, matches, rows).find(({ event }) => event.id === "bench").data.status, "Non impiegato");
assert.equal(getPlayerSummary(keeper, { matches: [shared], players,
  playerMatchesDB: [{ player_id: "gk", match_id: "home", minutes_played: 45, goals_conceded: 1 }] }).recentEvents[0].data.goalsConceded, 1);
console.log("Player statistics regression checks passed");
