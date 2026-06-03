import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/requireAuth.ts";

const STRIPE_SECRET_KEY         = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  if (!STRIPE_SECRET_KEY) return json({ error: "STRIPE_SECRET_KEY non configurata" }, 500);

  let body: { subscriptionId?: string; teamId?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  const { teamId } = body;
  if (!teamId) return json({ error: "teamId mancante" }, 400);

  // Verify caller is authenticated and is owner of the team
  const auth = await requireAuth(req, teamId, ["owner"]);
  if (auth.error) return json({ error: auth.error }, auth.status!);

  try {
    // Always resolve subscriptionId from DB — never trust client-supplied subscriptionId
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("stripe_subscription_id")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) throw teamError;

    const resolvedSubscriptionId = team?.stripe_subscription_id;
    if (!resolvedSubscriptionId) return json({ error: "Nessun abbonamento attivo per questo team" }, 404);

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions/${resolvedSubscriptionId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ cancel_at_period_end: "true" }),
      }
    );

    const subscription = await stripeResponse.json();
    if (!stripeResponse.ok) throw new Error(subscription?.error?.message || "Errore cancellazione abbonamento");

    return json({
      ok: true,
      subscriptionId:    subscription.id,
      status:            subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd:  subscription.current_period_end,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return json({ error: message }, 500);
  }
});
