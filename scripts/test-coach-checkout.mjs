import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { isCoachPremiumMonthlyPrice } from "../supabase/functions/_shared/coachSubscription.js";

const source = fs.readFileSync(new URL("../supabase/functions/create-checkout-session/index.ts", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.length, 0);
let handler;
let auth = { error: null };
const calls = [];
let price = { active: true, currency: "eur", unit_amount: 990, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } };
const valid = structuredClone(price);
vm.runInNewContext(compiled.outputText, {
  Deno: { env: { get: (key) => ({ STRIPE_SECRET_KEY: "test-secret", STRIPE_PRICE_COACH_MONTHLY: "price_coach" })[key] }, serve: (fn) => { handler = fn; } },
  Request, Response, URLSearchParams, Date, encodeURIComponent,
  requireAuth: async () => auth,
  isAllowedPriceId: (id) => id === "price_coach",
  isAllowedReturnUrl: (url) => url.startsWith("https://calciolab.org/"),
  isCoachPremiumMonthlyPrice,
  fetch: async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.includes("/prices/") ? price : { url: "https://checkout.stripe.com/test" });
  },
});
const request = (changes = {}) => new Request("https://example.test/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: "premium", priceId: "price_coach", teamId: "team-1", ...changes }) });
for (const changes of [{ planId: "club" }, { planId: "free" }, { priceId: "price_legacy" }]) {
  calls.length = 0;
  const result = await handler(request(changes));
  assert.ok(result.status >= 400);
  assert.equal(calls.length, 0, "Rejected plans and legacy prices must not contact Stripe");
}
for (const wrong of [{ unit_amount: 1490 }, { currency: "usd" }, { recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } }]) {
  calls.length = 0;
  price = { ...valid, ...wrong };
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.length, 1, "A mismatched price must never create a checkout session");
  assert.ok(calls[0].url.includes("/prices/"));
}
calls.length = 0;
auth = { error: "Autenticazione richiesta", status: 401 };
assert.equal((await handler(request())).status, 401);
assert.equal(calls.length, 0);
auth = { error: null };
price = valid;
const result = await handler(request());
assert.equal(result.status, 200);
assert.equal((await result.json()).url, "https://checkout.stripe.com/test");
assert.equal(calls.length, 2);
const checkout = calls[1];
assert.equal(checkout.options.method, "POST");
assert.equal(checkout.options.body.get("line_items[0][price]"), "price_coach");
assert.equal(checkout.options.body.get("metadata[plan]"), "premium");
assert.ok(checkout.options.headers["Idempotency-Key"]);
console.log("Coach checkout: real handler rejects legacy/wrong prices before creating sessions");
