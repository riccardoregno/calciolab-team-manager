import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVipLevel, getVipProgress, getVipReward } from "../_shared/vip.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const STRIPE_VIP_SOURCE = "stripe";
const VIP_POINTS_BY_PLAN: Record<string, number> = {
  premium: 100,
  club: 300,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const signature = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Stripe webhook secret non configurato" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const isValid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase service role non configurato" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (event.type === "checkout.session.completed") {
    const result = await handleCheckoutCompleted(event.id, event.data.object);
    if (result?.duplicate) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    await handleSubscriptionUpdated(event.data.object);
  }

  if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event.data.object);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

async function handleCheckoutCompleted(eventId: string, session: Record<string, unknown>) {
  const metadata = session["metadata"] as Record<string, string> | undefined;
  const teamId = metadata?.team_id || session["client_reference_id"] as string | undefined;
  const planId = metadata?.plan || "premium";
  const customerId = session["customer"] as string | undefined;
  const subscriptionId = session["subscription"] as string | undefined;
  const sessionId = session["id"] as string | undefined;

  if (!teamId) throw new Error("team_id mancante nella checkout session");
  if (await hasVipEvent(STRIPE_VIP_SOURCE, eventId)) return { duplicate: true };

  const { error } = await supabase!
    .from("teams")
    .update({
      subscription_plan: planId,
      subscription_status: "active",
      billing_status: "active",
      trial_plan: "",
      trial_started_at: null,
      trial_ends_at: null,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscriptionId ?? null,
    })
    .eq("id", teamId);

  if (error) throw error;
  await assignVipPointsFromCheckout({ teamId, eventId, sessionId, planId });

  return { duplicate: false };
}

async function handleSubscriptionUpdated(subscription: Record<string, unknown>) {
  const metadata = subscription["metadata"] as Record<string, string> | undefined;
  const subscriptionId = subscription["id"] as string | undefined;
  const teamId = metadata?.team_id || await findTeamIdBySubscription(subscriptionId);
  const planId = metadata?.plan || "premium";
  const stripeStatus = subscription["status"] as string | undefined;
  const status = mapStripeStatus(stripeStatus);

  if (!teamId) throw new Error("team_id mancante nella subscription");

  const { error } = await supabase!
    .from("teams")
    .update({
      subscription_plan: status === "canceled" ? "free" : planId,
      subscription_status: status,
      billing_status: status,
      stripe_customer_id: subscription["customer"] as string | undefined ?? null,
      stripe_subscription_id: subscriptionId ?? null,
    })
    .eq("id", teamId);

  if (error) throw error;
}

async function handleSubscriptionDeleted(subscription: Record<string, unknown>) {
  const metadata = subscription["metadata"] as Record<string, string> | undefined;
  const subscriptionId = subscription["id"] as string | undefined;
  const teamId = metadata?.team_id || await findTeamIdBySubscription(subscriptionId);

  if (!teamId) throw new Error("team_id mancante nella subscription cancellata");

  const { error } = await supabase!
    .from("teams")
    .update({
      subscription_plan: "free",
      subscription_status: "canceled",
      billing_status: "canceled",
      stripe_subscription_id: subscriptionId ?? null,
    })
    .eq("id", teamId);

  if (error) throw error;
}

async function findTeamIdBySubscription(subscriptionId?: string) {
  if (!subscriptionId) return "";

  const { data, error } = await supabase!
    .from("teams")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) throw error;
  return data?.id || "";
}

function mapStripeStatus(status = "") {
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "active";
}

async function assignVipPointsFromCheckout({
  teamId,
  eventId,
  sessionId,
  planId,
}: {
  teamId: string;
  eventId: string;
  sessionId?: string;
  planId: string;
}) {
  const points = VIP_POINTS_BY_PLAN[planId] || VIP_POINTS_BY_PLAN.premium;

  const { data: team, error: teamError } = await supabase!
    .from("teams")
    .select("id, vip_points, vip_level")
    .eq("id", teamId)
    .single();

  if (teamError) throw teamError;
  if (!team) throw new Error("Team non trovato per accredito VIP");

  const previousLevel = team.vip_level || "bronze";
  const newPoints = Math.max(0, Number(team.vip_points || 0) + points);
  const newLevel = getVipLevel(newPoints).name;
  const levelChanged = newLevel !== previousLevel;
  const candidateReward = levelChanged ? getVipReward(newLevel) : null;
  const rewardAlreadyGranted = candidateReward
    ? await hasRewardAlreadyBeenGranted(teamId, candidateReward.promotionCode)
    : false;
  const reward = rewardAlreadyGranted ? null : candidateReward;

  const insertResult = await insertVipEvent({
    teamId,
    type: "stripe_checkout_completed",
    source: STRIPE_VIP_SOURCE,
    externalId: eventId,
    points,
    rewardCode: reward?.promotionCode || null,
    metadata: {
      stripeEventId: eventId,
      checkoutSessionId: sessionId || null,
      planId,
      previousLevel,
      newLevel,
      rewardAlreadyGranted,
    },
  });

  if (insertResult.duplicate) return { duplicate: true };

  const { error: updateError } = await supabase!
    .from("teams")
    .update({
      vip_points: newPoints,
      vip_level: newLevel,
      vip_updated_at: new Date().toISOString(),
    })
    .eq("id", teamId);

  if (updateError) {
    await rollbackVipEvent(STRIPE_VIP_SOURCE, eventId);
    throw updateError;
  }

  return {
    duplicate: false,
    levelChanged,
    newLevel,
    reward,
    progress: getVipProgress(newPoints),
  };
}

async function hasVipEvent(source: string, externalId: string) {
  const { data, error } = await supabase!
    .from("vip_events")
    .select("id")
    .eq("source", source)
    .eq("external_id", externalId)
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

async function hasRewardAlreadyBeenGranted(teamId: string, rewardCode: string) {
  const { data, error } = await supabase!
    .from("vip_events")
    .select("id")
    .eq("team_id", teamId)
    .eq("reward_code", rewardCode)
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

async function insertVipEvent({
  teamId,
  type,
  source,
  externalId,
  points,
  rewardCode,
  metadata,
}: {
  teamId: string;
  type: string;
  source: string;
  externalId: string;
  points: number;
  rewardCode: string | null;
  metadata: Record<string, unknown>;
}) {
  const { error } = await supabase!
    .from("vip_events")
    .insert({
      team_id: teamId,
      type,
      source,
      external_id: externalId,
      points,
      reward_code: rewardCode,
      metadata,
    });

  if (!error) return { duplicate: false };

  if (error.code === "23505" && String(error.message || "").includes("vip_events_source_external_id_key")) {
    return { duplicate: true };
  }

  if (error.code === "23505" && rewardCode) {
    const retry = await supabase!
      .from("vip_events")
      .insert({
        team_id: teamId,
        type,
        source,
        external_id: externalId,
        points,
        reward_code: null,
        metadata: {
          ...metadata,
          rewardAlreadyGranted: true,
        },
      });

    if (!retry.error) return { duplicate: false };
    if (retry.error.code === "23505") return { duplicate: true };
    throw retry.error;
  }

  throw error;
}

async function rollbackVipEvent(source: string, externalId: string) {
  await supabase!
    .from("vip_events")
    .delete()
    .eq("source", source)
    .eq("external_id", externalId);
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = header.split(",").reduce((acc: Record<string, string>, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts["t"];
    const sig = parts["v1"];
    if (!timestamp || !sig) return false;
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const computedHex = Array.from(new Uint8Array(computed))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    return computedHex === sig;
  } catch {
    return false;
  }
}
