import assert from "node:assert/strict";
import {
  getAvailabilityGroups,
  getLineup,
  getPhysicalReference,
  getSessionLoad,
  generatePhysicalWorkout,
  getCoachAlerts,
  getCoachRewardProfile,
  getBillingStatus,
  getCurrentUserRole,
  getPlayerSummary,
  getSetupProgress,
  getSubscriptionPlan,
  generateGuidedSession,
  hasPermission,
  isFeatureUnlocked,
  isRoleAllowed,
  normalizeAppSettings,
  normalizeAppState,
  startSubscriptionTrial,
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
assert.deepEqual(normalized.exercises[0].tags, []);
assert.equal(normalized.matches[0].lineup.ready, false);
assert.equal(normalized.physicalTests.length, 1);
assert.equal(normalized.appSettings.subscription.plan, "free");
assert.equal(getSubscriptionPlan({ subscription: { plan: "premium", billingStatus: "active" } }).id, "premium");
assert.equal(getBillingStatus({ subscription: { plan: "premium", billingStatus: "active" } }).effectivePlanId, "premium");
assert.equal(isFeatureUnlocked("exports", { subscription: { plan: "free" } }), false);
assert.equal(isFeatureUnlocked("exports", { subscription: { plan: "premium", billingStatus: "active" } }), true);
assert.equal(isFeatureUnlocked("aiSessionBuilder", { subscription: { plan: "free" } }), false);
assert.equal(isFeatureUnlocked("aiSessionBuilder", { subscription: { plan: "premium", billingStatus: "active" } }), true);
assert.equal(isFeatureUnlocked("playerPortal", { subscription: { plan: "premium" } }), false);
assert.equal(isFeatureUnlocked("playerPortal", { subscription: { plan: "club", billingStatus: "active" } }), true);

const trialSettings = startSubscriptionTrial({}, "club", 14);
assert.equal(trialSettings.subscription.billingStatus, "trialing");
assert.equal(getBillingStatus(trialSettings).trialActive, true);
assert.equal(getBillingStatus(trialSettings).effectivePlanId, "club");
assert.equal(isFeatureUnlocked("playerPortal", trialSettings), true);

const expiredTrial = normalizeAppSettings({
  subscription: {
    billingStatus: "trialing",
    trialPlan: "club",
    trialEndsAt: "2000-01-01T00:00:00.000Z",
  },
});
assert.equal(getBillingStatus(expiredTrial).trialExpired, true);
assert.equal(isFeatureUnlocked("playerPortal", expiredTrial), false);

const monetizationSettings = normalizeAppSettings({
  playerPortal: {
    enabled: true,
    programs: { 1: "Core stability" },
  },
  sponsorHub: {
    sponsors: [{ id: "s1", name: "Bar Sport", package: "Gold" }],
  },
});
assert.equal(monetizationSettings.playerPortal.enabled, true);
assert.equal(monetizationSettings.playerPortal.programs[1], "Core stability");
assert.equal(monetizationSettings.sponsorHub.sponsors[0].name, "Bar Sport");
assert.equal(monetizationSettings.sponsorHub.sponsors[0].active, true);

const workspaceSettings = normalizeAppSettings({
  onboarding: { completed: true },
  workspaceProfile: { teamName: "Prima squadra", seasonGoal: "Playoff", userRole: "owner" },
  members: [{ id: "m1", name: "Mister", role: "headCoach" }],
});
assert.equal(workspaceSettings.onboarding.completed, true);
assert.equal(workspaceSettings.workspaceProfile.userRole, "owner");
assert.equal(workspaceSettings.members[0].role, "headCoach");
assert.equal(hasPermission("owner", "manageBilling"), true);
assert.equal(hasPermission("player", "manageBilling"), false);
assert.equal(getCurrentUserRole(workspaceSettings), "owner");
assert.equal(getCurrentUserRole({ workspaceProfile: { userRole: "athleticTrainer" } }), "athleticTrainer");
assert.equal(isRoleAllowed("owner", ["sponsor"]), true);
assert.equal(isRoleAllowed("player", ["headCoach"]), false);

const setupProgress = getSetupProgress({
  players: Array.from({ length: 18 }, (_, index) => ({ id: index })),
  exercises: Array.from({ length: 10 }, (_, index) => ({ id: index })),
  sessions: [{ id: 1 }],
  matches: [{ id: 1 }],
  appSettings: workspaceSettings,
});
assert.equal(setupProgress.percent, 100);

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

const reward = getCoachRewardProfile({
  players: [{ id: 1 }, { id: 2 }],
  exercises: [{ id: 1 }],
  sessions: [{ id: 1, objective: "Pressione" }],
  matches: [{ id: 1, matchPlan: "Aggredire alto" }],
  physicalTests: [{ id: 1, playerId: 1 }],
});
assert.ok(reward.points > 0);
assert.ok(reward.level >= 1);

const generatedSession = generateGuidedSession({
  exercises: [
    { id: 1, title: "Pressing alto", category: "Pressing", objective: "Pressing", duration: 20, intensity: "Alta", tags: ["pressing"] },
    { id: 2, title: "Possesso", category: "Possesso", objective: "Possesso", duration: 15, intensity: "Media", tags: ["possesso"] },
  ],
  objective: "Pressing",
  duration: 35,
  intensity: "Alta",
});
assert.equal(generatedSession.theme, "Pressing");
assert.ok(generatedSession.exercises.length > 0);
assert.equal(generatedSession.exercises[0].exerciseId, 1);

console.log("All tests passed");
