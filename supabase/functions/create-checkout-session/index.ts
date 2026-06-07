import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAuth, isAllowedPriceId, isAllowedReturnUrl } from "../_shared/requireAuth.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) return json({ error: "STRIPE_SECRET_KEY non configurata" }, 500);

  let body: { priceId: string; teamId: string; planId?: string; successUrl?: string; cancelUrl?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  const { priceId, teamId, planId, successUrl, cancelUrl } = body;

  if (!priceId)  return json({ error: "priceId mancante" }, 400);
  if (!teamId)   return json({ error: "teamId mancante" }, 400);

  // Validate priceId server-side — client cannot inject arbitrary price IDs
  if (!isAllowedPriceId(priceId)) {
    return json({ error: "priceId non valido" }, 400);
  }

  // Validate return URLs to prevent open redirects
  const resolvedSuccess = successUrl || `https://calciolab.org/premium?checkout=success`;
  const resolvedCancel  = cancelUrl  || `https://calciolab.org/premium?checkout=cancel`;
  if (!isAllowedReturnUrl(resolvedSuccess) || !isAllowedReturnUrl(resolvedCancel)) {
    return json({ error: "URL di ritorno non valido" }, 400);
  }

  // Verify caller is authenticated and is owner of the team
  const auth = await requireAuth(req, teamId, ["owner", "director"]);
  if (auth.error) return json({ error: auth.error }, auth.status!);

  try {
    // FIX (audit Codex — "Stripe checkout: sessioni duplicate"): senza una
    // Idempotency-Key, un doppio click o un retry di rete sul bottone
    // "abbonati" può creare due checkout session distinte per lo stesso
    // acquisto, con rischio di doppio addebito se l'utente le completa
    // entrambe. Deriviamo una chiave deterministica da team+prezzo+finestra
    // temporale: richieste identiche entro la stessa finestra di 5 minuti
    // riusano la sessione già creata da Stripe (stessa risposta), mentre
    // un nuovo tentativo di acquisto genuino (oltre la finestra, o con
    // priceId diverso) genera una nuova chiave e una nuova sessione.
    const idempotencyWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    const idempotencyKey = `checkout-${teamId}-${priceId}-${idempotencyWindow}`;

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: resolvedSuccess,
        cancel_url:  resolvedCancel,
        allow_promotion_codes: "true",
        client_reference_id: teamId,
        "metadata[team_id]": teamId,
        "metadata[plan]": planId || "premium",
        "subscription_data[metadata][team_id]": teamId,
        "subscription_data[metadata][plan]":    planId || "premium",
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Errore Stripe Checkout");

    return json({ url: data.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return json({ error: message }, 500);
  }
});
