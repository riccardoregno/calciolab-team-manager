import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { isCoachPremiumMonthlyPrice } from "../supabase/functions/_shared/coachSubscription.js";
import { billingSnapshot, verifyWebhook } from "../supabase/functions/team-billing-test/rules.mjs";
import { getTeamBillingTestState } from "../src/lib/teamBillingTest.js";

const env = {
  SUPABASE_URL: "http://kong:8000", TEAM_BILLING_LOCAL_TEST: "true",
  STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_COACH_MONTHLY: "price_fixture", STRIPE_TEST_PORTAL_CONFIGURATION: "bpc_fixture",
};
const teamId = "f0000000-0000-0000-0000-000000000001";
const billing = { team_id: teamId, customer_id: "cus_fixture", revision: 0 };
const seen = new Set();
let lastSnapshot;
let handler;
let callerRole = "owner";
const calls = [];
const subscription = {
  id: "sub_fixture", status: "active", current_period_end: 2000000000,
  metadata: { calciolab_test_team_id: teamId },
  latest_invoice: { status: "paid" },
  items: { data: [{ quantity: 1, price: { id: env.STRIPE_PRICE_COACH_MONTHLY } }] },
};
let currentStripeState = subscription;
let simulateConcurrentWrite = false;
const source = readFileSync(new URL("../supabase/functions/team-billing-test/index.ts", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.length, 0);
vm.runInNewContext(compiled.outputText, {
  Deno: { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn; } },
  Request, Response, URLSearchParams, console, encodeURIComponent,
  isCoachPremiumMonthlyPrice, billingSnapshot, verifyWebhook,
  requireAuth: async (_req, requestedTeam, roles) =>
    requestedTeam === teamId && roles.includes(callerRole) ? { error: null } : { error: "Forbidden", status: 403 },
  createClient: () => ({
    from: (table) => {
      assert.equal(table, "team_billing_test");
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...billing } }) }) }) };
    },
    rpc: async (name, snapshot) => {
      assert.equal(name, "apply_team_billing_test");
      if (seen.has(snapshot.p_event_id)) return { data: "duplicate" };
      if (simulateConcurrentWrite) {
        billing.revision++;
        simulateConcurrentWrite = false;
        currentStripeState = subscription;
      }
      if (snapshot.p_revision !== billing.revision) return { data: "retry" };
      billing.revision++;
      seen.add(snapshot.p_event_id);
      lastSnapshot = snapshot;
      return { data: "applied" };
    },
  }),
  fetch: async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/prices/")) return Response.json({
      active: true, currency: "eur", unit_amount: 990, type: "recurring", billing_scheme: "per_unit",
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    });
    if (url.includes("/subscriptions?")) return Response.json({ data: currentStripeState ? [currentStripeState] : [] });
    if (url.includes("/checkout/sessions?")) return Response.json({ data: [] });
    return Response.json({ url: "https://example.test/stripe" });
  },
});
const request = (body, headers = {}) => new Request("http://127.0.0.1/team-billing-test", { method: "POST", headers, body });
const action = (name, id = teamId) => request(JSON.stringify({ action: name, teamId: id, priceId: "ignored_client_price" }));
callerRole = "assistantCoach";
assert.equal((await handler(action("checkout"))).status, 403);
assert.equal((await handler(action("portal"))).status, 403);
callerRole = "owner";
assert.equal((await handler(action("checkout", "f0000000-0000-0000-0000-000000000002"))).status, 403);
assert.equal(calls.length, 0);
assert.equal((await handler(action("portal"))).status, 200);
currentStripeState = null;
assert.equal((await handler(action("checkout"))).status, 200);
assert.equal(calls.at(-1).options.body.get("line_items[0][price]"), env.STRIPE_PRICE_COACH_MONTHLY);
assert.equal(lastSnapshot, undefined, "Checkout creation cannot grant access");

const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
async function webhook(id, type, age = 0) {
  const payload = JSON.stringify({ id, type, livemode: false, data: { object: { customer: billing.customer_id } } });
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + "." + payload))).toString("hex");
  return handler(request(payload, { "Stripe-Signature": "t=" + timestamp + ",v1=" + signature }));
}

assert.equal((await webhook("expired", "invoice.paid", 600)).status, 401);
assert.equal((await handler(request("{}", { "Stripe-Signature": "invalid" }))).status, 401);
currentStripeState = { ...subscription, status: "incomplete", latest_invoice: { status: "open" } };
assert.equal((await webhook("initial-failed", "invoice.payment_failed")).status, 200);
assert.equal(lastSnapshot.p_status, "incomplete");
currentStripeState = subscription;
assert.equal((await webhook("paid", "invoice.paid")).status, 200);
assert.equal(lastSnapshot.p_status, "active");
const revision = billing.revision;
assert.equal((await (await webhook("paid", "invoice.paid")).json()).duplicate, true);
assert.equal(billing.revision, revision);
currentStripeState = { ...subscription, status: "past_due", latest_invoice: { status: "open" } };
await webhook("renewal-failed", "invoice.payment_failed");
assert.equal(lastSnapshot.p_status, "past_due");
simulateConcurrentWrite = true;
await webhook("late-event", "invoice.payment_failed");
assert.equal(lastSnapshot.p_status, "active", "Retry must reread current Stripe state");
currentStripeState = { ...subscription, cancel_at_period_end: true };
await webhook("cancel-scheduled", "customer.subscription.updated");
const scheduled = { status: lastSnapshot.p_status, period_end: lastSnapshot.p_period_end };
assert.equal(lastSnapshot.p_cancel_at_period_end, true);
assert.equal(getTeamBillingTestState(scheduled, 1999999999999), "active");
assert.equal(getTeamBillingTestState(scheduled, 2000000000000), "canceled");
currentStripeState = { ...subscription, status: "canceled" };
await webhook("cancel-final", "customer.subscription.deleted");
assert.equal(lastSnapshot.p_status, "canceled");
console.log("Team billing test: authorization, server price, signatures, payment states, duplicate and concurrent replay passed.");

