import assert from "node:assert/strict";
import { NAVIGATION_ITEMS, PRIMARY, CORE_SECONDARY, ADVANCED_SECONDARY, primaryMenuGroups, toolboxGroups, juniorNavigationItems } from "../src/constants/navigation.js";

const desktopItems = [...primaryMenuGroups, ...toolboxGroups].flatMap((group) => group.items);
const mobileItems = [...PRIMARY, ...CORE_SECONDARY, ...ADVANCED_SECONDARY];
const roles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
for (const items of [NAVIGATION_ITEMS, desktopItems, mobileItems]) {
  assert.equal(new Set(items.map((item) => item.to)).size, items.length, "Duplicate navigation route");
  for (const item of items) {
    assert.ok(item.labelKey && item.icon && item.roles.length, 'Incomplete navigation item: ' + item.to);
    assert.ok(item.roles.every((role) => roles.includes(role)));
  }
}
for (const role of roles) {
  for (const onboardingCompleted of [false, true]) {
    const visibleRoutes = (items) => items
      .filter((item) => item.roles.includes(role) && !(onboardingCompleted && item.to === "/onboarding"))
      .map((item) => item.to).sort();
    assert.deepEqual(visibleRoutes(desktopItems), visibleRoutes(mobileItems), 'Desktop/mobile navigation mismatch for ' + role);
  }
}
assert.deepEqual(juniorNavigationItems(), []);
assert.deepEqual(juniorNavigationItems({ workspaceProfile: { managesJuniores: true, teamLevel: "juniores" } }), []);
assert.equal(juniorNavigationItems({ workspaceProfile: { managesJuniores: true, teamLevel: "prima" } })[0].to, "/players?gruppo=juniores");
assert.deepEqual(PRIMARY.filter((item) => item.roles.includes("player")).map((item) => item.to), ["/", "/calendar"]);
assert.deepEqual(PRIMARY.filter((item) => item.roles.includes("sponsor")).map((item) => item.to), ["/"]);
console.log("Navigation parity tests passed (7 roles, onboarding and junior roster)");
