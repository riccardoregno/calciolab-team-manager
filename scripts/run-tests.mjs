import assert from "node:assert/strict";
import {
  getAvailabilityGroups,
  getLineup,
  getPhysicalReference,
  getSessionLoad,
  generatePhysicalWorkout,
  getCoachAlerts,
  getPlayerSummary,
  normalizeAppState,
  uniqueIds,
} from "../src/utils/helpers.js";

const normalized = normalizeAppState({
  players: [{ id: 1, name: "A", number: "9" }],
  exercises: [{ id: 1, space: "20x20" }],
  sessions: [{ id: 1, duration: 60, attendance: { 1: { rpe: 6 } } }],
  matches: [{ id: 1, opponent: "B" }],
  physicalTests: [{ id: 1, playerId: 1 }],
});

assert.equal(normalized.players[0].shirtNumber, "9");
assert.equal(normalized.exercises[0].fieldSize, "20x20");
assert.equal(normalized.matches[0].lineup.ready, false);
assert.equal(normalized.physicalTests.length, 1);

const groups = getAvailabilityGroups([
  { status: "Disponibile" },
  { status: "Recupero" },
  { status: "Infortunato" },
  { status: "Squalificato" },
]);

assert.equal(groups.available.length, 1);
assert.equal(groups.limited.length, 1);
assert.equal(groups.injured.length, 1);
assert.equal(groups.suspended.length, 1);

assert.equal(getSessionLoad(normalized.sessions[0]), 360);
assert.deepEqual(uniqueIds([1, 1, 2]), [1, 2]);
assert.deepEqual(getLineup({ lineup: { starterIds: [1], captainId: 1 } }).starterIds, [1]);

const physicalReference = getPhysicalReference({ gaconLevel: 22 });
assert.equal(physicalReference.mas, 19);
assert.equal(physicalReference.group, "Gruppo A");
assert.equal(physicalReference.reps[0].meters, 75);
const customReference = getPhysicalReference(
  { gaconLevel: 18 },
  { groupA: 18, groupB: 16, groupC: 14 }
);
assert.equal(customReference.group, "Gruppo B");

const generatedWorkout = generatePhysicalWorkout(
  [{ id: 1, name: "A" }],
  [{ playerId: 1, gaconLevel: 20 }],
  {}
);
assert.equal(generatedWorkout[0].reference.group, "Gruppo B");

const alerts = getCoachAlerts({
  players: [{ id: 1, name: "A", status: "Disponibile" }],
  matches: [{ id: 1, title: "M", date: "2999-01-01", lineup: { ready: false } }],
  physicalTests: [],
  sessions: [{ id: 1, title: "S" }],
});
assert.ok(alerts.length >= 3);

const playerSummary = getPlayerSummary(
  { id: 1, name: "A", status: "Disponibile" },
  {
    sessions: [{ id: 1, title: "S", type: "Allenamento", date: "2026-01-01", attendance: { 1: { status: "Presente", minutes: 60, goals: 1, assists: 2, rpe: 6 } } }],
    matches: [],
    physicalTests: [{ id: 1, playerId: 1, date: "2026-01-02", gaconLevel: 20 }],
  }
);
assert.equal(playerSummary.stats.minutes, 60);
assert.equal(playerSummary.stats.assists, 2);
assert.equal(playerSummary.latestTests.length, 1);

console.log("All tests passed");
