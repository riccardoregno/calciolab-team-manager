import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { subscriptionId, teamId } = await req.json();

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY non configurata");
    }

    const resolvedSubscriptionId = subscriptionId || await loadSubscriptionId(teamId);
    if (!resolvedSubscriptionId) {
      throw new Error("subscriptionId mancante");
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions/${resolvedSubscriptionId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          cancel_at_period_end: "true",
        }),
      }
    );

    const subscription = await stripeResponse.json();
    if (!stripeResponse.ok) {
      throw new Error(subscription?.error?.message || "Errore cancellazione abbonamento");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

async function loadSubscriptionId(teamId?: string) {
  if (!teamId || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("teams")
    .select("stripe_subscription_id")
    .eq("id", teamId)
    .maybeSingle();

  if (error) throw error;
  return data?.stripe_subscription_id || "";
}
