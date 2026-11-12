import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/requireAuth.ts";
import { isCoachPremiumMonthlyPrice } from "../_shared/coachSubscription.js";
import { billingSnapshot, verifyWebhook } from "./rules.mjs";

const local = Deno.env.get("SUPABASE_URL") ?? "";
const secret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const priceId = Deno.env.get("STRIPE_PRICE_COACH_MONTHLY") ?? "";
const portalConfig = Deno.env.get("STRIPE_TEST_PORTAL_CONFIGURATION") ?? "";
const clock = Deno.env.get("STRIPE_TEST_CLOCK_ID");
const origin = "http://127.0.0.1:4180";
const allowed = Deno.env.get("TEAM_BILLING_LOCAL_TEST") === "true" &&
  /^http:\/\/(kong|127\.0\.0\.1|localhost|supabase_kong_[a-z0-9_-]+):\d+\/?$/i.test(local) &&
  secret.startsWith("sk_test_") && webhookSecret.startsWith("whsec_") &&
  priceId.startsWith("price_") && portalConfig.startsWith("bpc_");
const admin = allowed ? createClient(local, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) : null;

const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function stripe(path: string, data?: Record<string, string>, idempotencyKey?: string) {
  const response = await fetch("https://api.stripe.com/v1/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + secret,
      "Stripe-Version": "2024-06-20",
      ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: data && new URLSearchParams(data),
  });
  if (!response.ok) throw new Error("Stripe API: " + response.status);
  return response.json();
}

async function findBilling(teamId: string) {
  const { data, error } = await admin!.from("team_billing_test").select("*").eq("team_id", teamId).maybeSingle();
  if (error) throw error;
  return data;
}

async function createCheckout(teamId: string) {
  if (!isCoachPremiumMonthlyPrice(await stripe("prices/" + encodeURIComponent(priceId)))) {
    return json({ error: "Configura un prezzo test di 9,90 EUR al mese." }, 503);
  }
  let billing = await findBilling(teamId);
  if (!billing) {
    const { data: team, error } = await admin!.from("teams").select("stripe_subscription_id, stripe_customer_id").eq("id", teamId).single();
    if (error) throw error;
    if (team.stripe_subscription_id || team.stripe_customer_id) {
      return json({ error: "Usa una squadra fittizia senza associazioni Stripe esistenti." }, 409);
    }

    const customer = await stripe("customers", {
      "metadata[calciolab_test_team_id]": teamId,
      ...(clock ? { test_clock: clock } : {}),
    }, "calciolab-test-customer-" + teamId);
    const { error: insertError } = await admin!.from("team_billing_test").insert({ team_id: teamId, customer_id: customer.id });
    if (insertError && insertError.code !== "23505") throw insertError;
    billing = await findBilling(teamId);
    if (!billing) throw new Error("Missing team billing record");
  }

  const customerQuery = "customer=" + encodeURIComponent(billing.customer_id);
  const previous = (await stripe("checkout/sessions?limit=1&" + customerQuery)).data[0];
  if (previous?.status === "open" && previous.url) return json({ url: previous.url });
  const subscriptions = await stripe("subscriptions?status=all&limit=100&" + customerQuery);
  if (subscriptions.has_more || subscriptions.data.some((sub: { status: string }) =>
    !["canceled", "incomplete_expired"].includes(sub.status))) {
    return json({ error: "La squadra ha già un abbonamento. Usa il portale di fatturazione." }, 409);
  }
  const session = await stripe("checkout/sessions", {
    mode: "subscription",
    customer: billing.customer_id,
    "payment_method_types[0]": "card",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: origin + "/premium?checkout=success",
    cancel_url: origin + "/premium?checkout=cancel",
    client_reference_id: teamId,
    "subscription_data[metadata][calciolab_test_team_id]": teamId,
  }, "calciolab-test-checkout-" + teamId + "-" + (previous?.id ?? "first"));
  return json({ url: session.url });
}

async function createPortal(teamId: string) {
  const billing = await findBilling(teamId);
  if (!billing) return json({ error: "Nessun cliente Stripe test per la squadra." }, 404);
  const portal = await stripe("billing_portal/sessions", {
    customer: billing.customer_id,
    configuration: portalConfig,
    return_url: origin + "/premium",
  });
  return json({ url: portal.url });
}

const eventTypes = new Set([
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed",
]);

async function reconcile(req: Request, signature: string) {
  const raw = await req.text();
  if (!await verifyWebhook(raw, signature, webhookSecret)) return json({ error: "Firma non valida." }, 401);
  const event = JSON.parse(raw);
  if (event.livemode !== false || !eventTypes.has(event.type)) return json({ received: true });
  const customer = event.data?.object?.customer;
  if (typeof customer !== "string" || typeof event.id !== "string") return json({ received: true });

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: billing, error } = await admin!.from("team_billing_test").select("*").eq("customer_id", customer).maybeSingle();
    if (error) throw error;
    if (!billing) return json({ received: true });

    const result = await stripe("subscriptions?status=all&limit=100&expand[]=data.latest_invoice&customer=" + encodeURIComponent(customer));
    if (result.has_more) throw new Error("Unexpected test subscription count");
    const own = result.data.filter((sub: { metadata?: Record<string, string> }) =>
      sub.metadata?.calciolab_test_team_id === billing.team_id);
    const subscription = own.find((sub: { status: string }) => !["canceled", "incomplete_expired"].includes(sub.status)) ?? own[0];
    const snapshot = billingSnapshot(subscription, priceId);
    const { data: applied, error: applyError } = await admin!.rpc("apply_team_billing_test", {
      p_event_id: event.id,
      p_team_id: billing.team_id,
      p_revision: billing.revision,
      ...snapshot,
    });
    if (applyError) throw applyError;
    if (applied !== "retry") return json({ received: true, duplicate: applied === "duplicate" });
  }
  return json({ error: "Stato aggiornato in parallelo. Riprovare." }, 503);
}

Deno.serve(async (req) => {
  if (!admin) return json({ error: "Billing Stripe test locale disabilitato." }, 503);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  try {
    const signature = req.headers.get("stripe-signature");
    if (signature !== null) return await reconcile(req, signature);
    const { teamId, action } = await req.json();
    if (typeof teamId !== "string" || !/^[0-9a-f-]{36}$/i.test(teamId)) return json({ error: "Squadra richiesta." }, 400);
    if (action !== "checkout" && action !== "portal") return json({ error: "Azione non valida." }, 400);
    if (req.headers.has("x-internal-secret")) return json({ error: "Autenticazione utente richiesta." }, 401);
    const auth = await requireAuth(req, teamId, ["owner"]);
    if (auth.error) return json({ error: auth.error }, auth.status);
    return action === "checkout" ? await createCheckout(teamId) : await createPortal(teamId);
  } catch (error) {
    console.error("Team billing test:", error instanceof Error ? error.message : "database operation failed");
    return json({ error: "Operazione di fatturazione test non riuscita." }, 503);
  }
});
