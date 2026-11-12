import assert from "node:assert/strict";
import { getMatchCompletionTasks } from "../src/utils/matchCompletion.js";
import { buildMatchScope, buildStatisticsEvents } from "../src/utils/matchScope.js";
import { confirmUnrecordedTrainingPresences, getCompletedTrainingEvents, getPlayerUnavailabilityOnDate, getRecordedTrainingStatus, hasPlayerTransferred, formatTrainingAttendance, getTrainingSessionStatus, parseRecordedMinutes, resolveMatchMinutes, getTrainingAttendanceSummary, getGoalkeeperGoalsConceded, getPlayerMatchEntries, getPlayerMatchTotals, getPlayerSummary, isGoalkeeper } from "../src/utils/helpers.js";

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

const fullGames = Array.from({ length: 9 }, (_, index) => ({ ...match, id: "played-" + index }));
const unused = { ...match, id: "unused" };
const unusedRow = { player_id: "gk", match_id: "unused", minutes_played: 0, goals_conceded: 1, yellow_cards: 1 };
const keeperTotals = getPlayerMatchTotals(keeper, [...fullGames, unused], [unusedRow], players);
assert.equal(keeperTotals.presences, 9);
assert.equal(keeperTotals.minutes, 810);
assert.equal(keeperTotals.goalkeeperRecord.appearances, 9);
assert.equal(keeperTotals.goalsConceded, 18);
assert.equal(keeperTotals.yellowCards, 1, "Bench cards still count as discipline");
const unusedEntry = getPlayerMatchEntries(keeper, [unused], [unusedRow])[0].data;
assert.equal(unusedEntry.status, "Non impiegato");
assert.equal(unusedEntry.goalsConceded, null);

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

const summerPlayer = { id: "summer", absences: [{ dateStart: "2020-07-20", dateEnd: "2020-07-22" }] };
const sessions = [
  { id: "a", date: "2020-07-20" },
  { id: "b", date: "2020-07-22", attendance: { summer: { rpe: 6 } } },
  { id: "c", date: "2020-07-24", attendance: { summer: { status: "Recupero" } } },
  { id: "d", date: "2020-07-25", attendance: { summer: { status: "Infortunato" } } },
  { id: "future", date: "2020-08-03", attendance: { summer: { status: "Assente" } } },
];
const summerMatches = [
  { ...match, date: "2020-08-01" },
  { id: "friendly", type: "Partita", matchKind: "Amichevole", date: "2020-07-31", attendance: { summer: { status: "Assente" } } },
  { id: "other-season", type: "Partita", matchKind: "Amichevole", date: "2020-06-30" },
];
const scope = buildMatchScope(summerMatches, { season: "2020/21", competition: "league" });
const scoped = buildStatisticsEvents(sessions, summerMatches, scope);
assert.equal(scoped.find((event) => event.id === "friendly")?.attendanceOnly, true);
assert.equal(scoped.some((event) => event.id === "other-season"), false);
const all = buildStatisticsEvents(sessions, summerMatches, buildMatchScope(summerMatches, { season: "2020/21", competition: "all" }));
assert.equal(all.filter((event) => event.id === "friendly").length, 1);
const completed = getCompletedTrainingEvents(scoped, "2020-08-01", "21:00");
assert.deepEqual(getTrainingAttendanceSummary(summerPlayer, completed), { trainingPresences: 1, absences: 3, injuries: 1, totalTrainings: 5, pendingTrainings: 0, trainingPct: 20 });
assert.equal(getTrainingAttendanceSummary({ ...summerPlayer, absences: [] }, completed).absences, 1);

const attendanceCases = [
  { attendance: { forward: { status: "Presente" } } },
  { attendance: { forward: { status: "Presente", minutes: 30 } } },
  { date: "2020-01-01" },
];
assert.equal(getTrainingSessionStatus(striker, attendanceCases[2]), "Presente");
assert.equal(getRecordedTrainingStatus(striker, attendanceCases[2]), null);
assert.equal(parseRecordedMinutes(attendanceCases[0].attendance.forward.minutes, Infinity), null);
const attendanceTotals = getTrainingAttendanceSummary(striker, attendanceCases);
assert.equal(attendanceTotals.trainingPresences, 3);
assert.equal(attendanceTotals.pendingTrainings, 0);
assert.equal(attendanceTotals.trainingPct, 100);
const pendingSession = { date: "2020-01-02", completed: true, attendance: { forward: { status: "Da confermare" } } };
const unrecordedSession = { date: "2020-01-03", completed: true };
const transferredPlayer = { ...striker, transferDate: '2026-06-02' };
const beforeTransfer = { date: '2026-06-01', attendance: { [striker.id]: { status: 'Presente' } } };
const onTransfer = { ...beforeTransfer, date: '2026-06-02' };
const afterTransfer = { date: '2026-06-03' };
assert.equal(hasPlayerTransferred(transferredPlayer, beforeTransfer.date), false);
assert.equal(getPlayerUnavailabilityOnDate(transferredPlayer, onTransfer.date).type, 'transfer');
assert.equal(getTrainingSessionStatus(transferredPlayer, onTransfer), null);
for (const requireConfirmedPresence of [true, false]) {
  assert.deepEqual(getTrainingAttendanceSummary(transferredPlayer, [beforeTransfer, onTransfer, afterTransfer], { requireConfirmedPresence }), {
    trainingPresences: 1, absences: 0, injuries: 0, totalTrainings: 1, pendingTrainings: 0, trainingPct: 100,
  });
}
const transferMatches = [beforeTransfer, onTransfer].map(({ date }) => ({
  id: date, date, attendance: { [striker.id]: { minutes: 45, goals: 1 } },
}));
assert.deepEqual(getPlayerMatchEntries(transferredPlayer, transferMatches, [], false).map(({ data }) => [data.minutes, data.goals]), [[45, 1]]);

const confirmedSummary = getTrainingAttendanceSummary(striker,
  [{ ...attendanceCases[0], completed: true }, pendingSession, unrecordedSession],
  { requireConfirmedPresence: true });
assert.equal(confirmedSummary.trainingPresences, 1);
assert.equal(confirmedSummary.pendingTrainings, 2);

const roster = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
const unconfirmed = {
  date: "2020-01-03", completed: true, attendance: {
    0: { status: "Assente", note: "Fixture" },
    1: { status: "Da confermare" },
    2: "Presente",
    3: { rpe: 5 },
  },
};
const confirmed = confirmUnrecordedTrainingPresences(unconfirmed, roster);
const reloaded = JSON.parse(JSON.stringify(confirmed));
assert.equal(Object.keys(unconfirmed.attendance).length, 4);
assert.equal(Object.keys(reloaded.attendance).length, 25);
assert.deepEqual(reloaded.attendance[0], unconfirmed.attendance[0]);
assert.deepEqual(reloaded.attendance[1], unconfirmed.attendance[1]);
assert.equal(reloaded.attendance[2], "Presente");
assert.deepEqual(reloaded.attendance[3], { rpe: 5, status: "Presente" });
const countConfirmed = (event) => roster.map((player) =>
  getTrainingAttendanceSummary(player, [event], { requireConfirmedPresence: true }));
const beforeBulk = countConfirmed(unconfirmed);
assert.deepEqual(beforeBulk.slice(1, 4).map(({ trainingPresences, pendingTrainings }) =>
  [trainingPresences, pendingTrainings]), [[0, 1], [1, 0], [0, 1]]);
assert.equal(countConfirmed(reloaded).filter(({ trainingPresences }) => trainingPresences === 1).length, 23);
assert.equal(countConfirmed(reloaded).filter(({ pendingTrainings }) => pendingTrainings === 1).length, 1);
assert.equal(confirmUnrecordedTrainingPresences(reloaded, roster), reloaded);
const injured = { id: "4", injuries: [{ startDate: "2020-01-01" }] };
assert.equal(confirmUnrecordedTrainingPresences(unconfirmed, [injured]), unconfirmed);

assert.equal(getTrainingSessionStatus(striker, pendingSession), "Da confermare");
assert.deepEqual(getTrainingAttendanceSummary(striker, [attendanceCases[2], pendingSession]), {
  trainingPresences: 1, absences: 0, injuries: 0, totalTrainings: 2, pendingTrainings: 1, trainingPct: null,
});
assert.equal(getTrainingSessionStatus({ ...striker, injuries: [{ startDate: "2020-01-01" }] }, attendanceCases[2]), "Infortunato");
assert.equal(getTrainingSessionStatus(striker, { ...attendanceCases[2], attendance: { forward: "Assente" } }), "Assente");
const expected = { ...bench, id: "expected" };
const starterWithoutMinutes = { ...bench, id: "starter", lineup: { starterIds: ["forward"] } };
const legacyMinutes = { ...league, id: "legacy", attendance: { forward: { minutes: "65" } } };
const cases = [bench, expected, starterWithoutMinutes, legacyMinutes];
const entries = getPlayerMatchEntries(striker, cases, rows);
assert.deepEqual(entries.map(({ data }) => [data.status, data.minutes]), [
  ["Non impiegato", 0], ["Minutaggio da completare", null],
  ["Minutaggio da completare", null], ["Presente", 65],
]);
assert.equal(getPlayerMatchTotals(striker, cases, rows).minutes, 65);
assert.equal(getPlayerMatchTotals(striker, cases, rows).missingMinutes, 2);
assert.equal(resolveMatchMinutes(0, 65), 0);
assert.equal(resolveMatchMinutes("", 65), 65);
assert.equal(resolveMatchMinutes(null, ""), null);
assert.equal(formatTrainingAttendance(attendanceTotals), "3 presenti");
const recentTraining = getPlayerSummary(striker, { sessions: [{ ...attendanceCases[0], type: "Allenamento", date: "2020-01-01" }] }).recentEvents[0];
assert.equal(recentTraining.data.status, "Presente");
assert.equal(recentTraining.data.minutes, null);
const completeLegacy = { ...legacyMinutes, lineup: { starterIds: ["forward"] } };
const tasks = getMatchCompletionTasks({ matches: [starterWithoutMinutes, completeLegacy], players,
  rows: [{ player_id: "forward", match_id: "legacy", minutes_played: null }], canCheckMinutes: true, now: new Date("2020-02-01") });
assert.deepEqual(tasks.map(({ match: event, missingMinutes }) => [event.id, missingMinutes]), [["starter", 1]]);

const partialSession = { date: "2020-01-02", type: "Allenamento", duration: 90,
  attendance: { forward: { status: "Parziale", partialMinutes: 30, rpe: 4 } } };
const partialSummary = getPlayerSummary(striker, { sessions: [partialSession] });
assert.equal(partialSummary.stats.trainingPresences, 1);
assert.equal(partialSummary.stats.pendingTrainings, 0);
assert.equal(partialSummary.stats.load, 120);
assert.equal(partialSummary.recentEvents[0].data.status, "Parziale");
assert.equal(partialSummary.recentEvents[0].data.minutes, 30);
const unknownPartial = { ...partialSession, attendance: { forward: { status: "Parziale", rpe: 4 } } };
const unknownSummary = getPlayerSummary(striker, { sessions: [unknownPartial] });
assert.equal(unknownSummary.recentEvents[0].data.minutes, null);
assert.equal(unknownSummary.stats.load, 0, "Unknown partial minutes must not inherit the full session duration");
