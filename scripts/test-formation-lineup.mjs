import assert from "node:assert/strict";
import { getRecordedLineupRole, syncFormationLineup } from "../src/utils/matchDayHelpers.js";

const calledUpIds = Array.from({ length: 20 }, (_, index) => index + 1);
const firstHalf = { slots: Object.fromEntries(calledUpIds.slice(0, 11).map((id, index) => [index, String(id)])) };
const original = { calledUpIds, starterIds: [], benchIds: calledUpIds, formationPlans: { firstHalf } };
const lineup = syncFormationLineup(original);
assert.deepEqual(lineup.starterIds, calledUpIds.slice(0, 11).map(String));
assert.deepEqual(lineup.benchIds, calledUpIds.slice(11).map(String));
assert.deepEqual(original.starterIds, []);

const swapped = syncFormationLineup({ ...lineup, formationPlans: { firstHalf: { slots: { ...firstHalf.slots, 0: "12" } } } });
assert.ok(swapped.starterIds.includes("12"));
assert.ok(swapped.benchIds.includes("1"));
assert.ok(!swapped.benchIds.includes("12"));

const secondHalf = syncFormationLineup({ ...lineup, formationPlans: { firstHalf, secondHalf: { slots: { 0: "20" } } } });
assert.deepEqual(secondHalf.starterIds, lineup.starterIds);
const cleared = syncFormationLineup({ ...lineup, formationPlans: { firstHalf: { slots: {} } } });
assert.deepEqual(cleared.starterIds, []);
assert.deepEqual(cleared.benchIds, calledUpIds.map(String));
const invalid = syncFormationLineup({ ...lineup, formationPlans: { firstHalf: { slots: { 0: "1", 1: 1, 2: "missing", 3: "" } } } });
assert.deepEqual(invalid.starterIds, ["1"]);
const legacy = { starterIds: [1], benchIds: [2] };
assert.equal(syncFormationLineup(legacy), legacy);
const savedField = {
  lineup: {
    starterIds: ["vecchia-formazione"],
    benchIds: ["mura", "riserva"],
    formationPlans: {
      firstHalf: { slots: { 0: "mura", 1: "jammeh" } },
      secondHalf: { slots: { 0: "subentrato" } },
    },
  },
};
assert.equal(getRecordedLineupRole(savedField, "mura"), "starter");
assert.equal(getRecordedLineupRole(savedField, "jammeh"), "starter");
assert.equal(getRecordedLineupRole(savedField, "riserva"), "bench");
assert.equal(getRecordedLineupRole(savedField, "vecchia-formazione"), null);
assert.equal(getRecordedLineupRole(savedField, "subentrato"), null);
assert.equal(getRecordedLineupRole({ lineup: legacy }, "1"), "starter");
assert.equal(getRecordedLineupRole({ lineup: { ...legacy, formationPlans: { firstHalf: { slots: {} } } } }, "1"), "starter");
console.log("Formation lineup tests passed");
