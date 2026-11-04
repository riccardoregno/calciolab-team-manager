import assert from "node:assert/strict";
import { COACH_PREMIUM_MONTHLY_CENTS, isCoachPremiumMonthlyPrice } from "../supabase/functions/_shared/coachSubscription.js";
import { COACH_PLANS } from "../src/constants/coachPlans.js";
import { isFeatureUnlocked } from "../src/utils/helpers.js";

const valid = { active: true, currency: "eur", unit_amount: 990, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } };
assert.equal(isCoachPremiumMonthlyPrice(valid), true);
for (const changed of [
  { unit_amount: 1490 }, { unit_amount: 0 }, { unit_amount: 9900 }, { currency: "usd" },
  { active: false }, { type: "one_time" }, { billing_scheme: "tiered" },
  { transform_quantity: { divide_by: 2, round: "up" } },
  { recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } },
  { recurring: { interval: "month", interval_count: 2, usage_type: "licensed" } },
  { recurring: { interval: "month", interval_count: 1, usage_type: "metered" } },
]) assert.equal(isCoachPremiumMonthlyPrice({ ...valid, ...changed }), false, JSON.stringify(changed));
assert.equal(isCoachPremiumMonthlyPrice(null), false);
assert.deepEqual(COACH_PLANS.map((plan) => plan.id), ["free", "premium"]);
assert.equal(Number(COACH_PLANS[1].price.replace(",", ".")) * 100, COACH_PREMIUM_MONTHLY_CENTS);
assert.equal(isFeatureUnlocked("playerPortal", { subscription: { plan: "premium", billingStatus: "active" } }), true);
assert.equal(isFeatureUnlocked("playerPortal", { subscription: { plan: "free" } }), false);
assert.equal(isFeatureUnlocked("playerPortal", { subscription: { plan: "club", billingStatus: "active" } }), true, "Legacy subscribers retain access");
console.log("Coach plans: shared prices, legacy access and Stripe amount/currency/interval validation passed");
