import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, teamId, planId, successUrl, cancelUrl } = await req.json();

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY non configurata");
    }

    if (!priceId) {
      throw new Error("priceId mancante");
    }

    if (!teamId) {
      throw new Error("teamId mancante");
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: successUrl || "http://localhost:5173/premium?checkout=success",
        cancel_url: cancelUrl || "http://localhost:5173/premium?checkout=cancel",
        allow_promotion_codes: "true",
        client_reference_id: teamId,
        "metadata[team_id]": teamId,
        "metadata[plan]": planId || "premium",
        "subscription_data[metadata][team_id]": teamId,
        "subscription_data[metadata][plan]": planId || "premium",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Errore Stripe Checkout");
    }

    return new Response(JSON.stringify({ url: data.url }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
