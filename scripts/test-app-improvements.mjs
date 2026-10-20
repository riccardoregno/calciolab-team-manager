import assert from "node:assert/strict";
import { getSaveStatus } from "../src/utils/saveStatus.js";
import { summarizeMatchRsvps, buildCoachTasks } from "../src/utils/coachTasks.js";
import { getGoalkeeperRecord } from "../src/utils/helpers.js";
import { searchNavigationItems } from "../src/utils/navigationSearch.js";
import { toggleFavoritePath } from "../src/utils/navigationFavorites.js";

assert.equal(getSaveStatus({ source: "supabase" }), "online");
assert.equal(getSaveStatus({ source: "pending-upload" }), "pending");
assert.equal(getSaveStatus({ source: "pending-upload", saving: true }), "saving");
assert.equal(getSaveStatus({ source: "partial", error: "offline" }), "retry");
assert.equal(getSaveStatus({ source: "supabase", localError: "quota" }), "onlineNoLocal");
assert.equal(getSaveStatus({ source: "pending-upload", localError: "quota" }), "localError");
assert.equal(getSaveStatus({ source: "supabase", error: "offline", localError: "quota" }), "localError");
assert.equal(getSaveStatus({ source: "local" }), "device");
assert.equal(getSaveStatus({ loading: true, source: "supabase" }), "loading");
assert.equal(getSaveStatus({ refreshing: true, source: "supabase" }), "saving");

const callup = { convocazione: { playerIds: ["1", "2", "3", "3"] } };
assert.deepEqual(summarizeMatchRsvps(callup, [{ player_id: "1", response: "yes" }]), { total: 3, available: 1, unavailable: 0, pending: 2 }, "Missing token rows still mean a missing confirmation");
assert.equal(summarizeMatchRsvps(callup, [
  { player_id: "1", response: null, created_at: "2026-10-02" },
  { player_id: "1", response: "yes", created_at: "2026-10-01" },
]).pending, 3, "Use the newest invitation, regardless of row order");
assert.equal(summarizeMatchRsvps({}), null);

const player = { id: "1", role: "Portiere" }, reserve = { id: "2", role: "Portiere" };
const match = { id: "m", type: "Partita", date: "2020-01-01", matchKind: "Campionato", result: "0-0", attendance: { 1: { minutes: 90 } } };
assert.equal(getGoalkeeperRecord(player, [match], [player, reserve]).cleanSheets, 1);
assert.equal(getGoalkeeperRecord(player, [{ ...match, attendance: { 1: { minutes: 45 } } }], [player]).cleanSheets, 0, "A goalless partial stint is not a full-match clean sheet");
const partial = getGoalkeeperRecord(player, [match, { ...match, id: "unknown", result: "1-1", attendance: { 1: { minutes: 45 }, 2: { minutes: 45 } } }], [player, reserve]);
assert.equal(partial.goalsConceded, null);
assert.equal(partial.knownAppearances, 1);
assert.equal(partial.missingAppearances, 1);
assert.equal(partial.complete, false);
assert.equal(getGoalkeeperRecord(player, [], [player]).goalsAgainstPer90, null, "No appearances must not look like the best rate");
const rate = getGoalkeeperRecord(player, [match, { ...match, id: "m2" }, { ...match, id: "m3" }], [player], [
  { player_id: "1", match_id: "m", minutes_played: 90, goals_conceded: 1 },
  { player_id: "1", match_id: "m2", minutes_played: 90, goals_conceded: 1 },
  { player_id: "1", match_id: "m3", minutes_played: 90, goals_conceded: 0 },
]);
assert.equal(rate.goalsAgainstPer90, .67);
assert.equal(rate.complete, true);

const recentMatch = { ...match, date: "2026-10-18", convocazione: { playerIds: ["1", "2"] }, attendance: {} };
const tasks = buildCoachTasks({ players: [player, reserve], now: new Date(2026, 9, 20, 12),
  matches: [recentMatch, { ...match, id: "future", date: "2026-10-25" }, { ...recentMatch, id: "old", date: "2026-09-01" }],
  sessions: [{ id: "training", type: "Allenamento", date: "2026-10-19", attendance: { 1: { status: "Assente" } } }],
  matchRows: [{ player_id: "1", match_id: "m", minutes_played: 0 }],
});
assert.equal(tasks.find((task) => task.kind === "stats").count, 1, "Saved zero-minute bench records are complete");
assert.equal(tasks.find((task) => task.kind === "attendance").count, 1, "An explicit absence is complete");
assert.equal(tasks.some((task) => task.event.id === "old"), false);
assert.equal(tasks.find((task) => task.kind === "callup").event.id, "future");
assert.equal(buildCoachTasks({ players: [player], matches: [recentMatch], now: new Date(2026, 9, 20), canCheckMatchStats: false }).some((task) => task.kind === "stats"), false, "Do not report missing statistics when the server could not be checked");
assert.deepEqual(searchNavigationItems([{ label: "Disponibilità" }, { label: "Statistiche squadra" }], "DISPONIBILITA", (item) => item.label), [{ label: "Disponibilità" }]);
assert.equal(searchNavigationItems([{ label: "Statistiche squadra" }], "squadra statistiche", (item) => item.label).length, 1);
const inaccessible = Array.from({ length: 8 }, (_, index) => `/private-${index}`);
assert.deepEqual(toggleFavoritePath(inaccessible, "/calendar", ["/calendar"]), ["/calendar"], "A changed role can still add an accessible favorite");
assert.deepEqual(toggleFavoritePath(inaccessible, "/calendar", [...inaccessible, "/calendar"]), inaccessible, "Keep the limit when all eight favorites remain accessible");
assert.deepEqual(toggleFavoritePath([], "https://example.com", ["/calendar"]), [], "Never accept an arbitrary path outside the visible navigation");
console.log("Save status, goalkeeper coverage, operational tasks and navigation search checks passed");
