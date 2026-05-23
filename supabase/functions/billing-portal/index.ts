/**
 * billing-portal — crea una sessione Stripe Customer Portal.
 * Permette all'utente di gestire abbonamento, metodo pagamento e fatture
 * senza mai toccare il codice app.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY         = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_API                = "https://api.stripe.com/v1";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  if (!STRIPE_SECRET_KEY) return json({ error: "STRIPE_SECRET_KEY non configurata" }, 500);
  if (!supabase)          return json({ error: "Supabase non configurato" }, 500);

  let body: { teamId: string; returnUrl: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON non valido" }, 400);
  }

  const { teamId, returnUrl } = body;
  if (!teamId || !returnUrl) return json({ error: "teamId e returnUrl richiesti" }, 400);

  // Recupera stripe_customer_id dal DB
  const { data: team, error } = await supabase
    .from("teams")
    .select("stripe_customer_id")
    .eq("id", teamId)
    .single();

  if (error || !team?.stripe_customer_id) {
    return json({ error: "Nessun customer Stripe associato a questo team" }, 404);
  }

  // Crea la sessione Customer Portal
  const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer:   team.stripe_customer_id,
      return_url: returnUrl,
    }).toString(),
  });

  const session = await res.json();

  if (!res.ok || !session.url) {
    return json({ error: session.error?.message || "Stripe non ha restituito una URL" }, 502);
  }

  return json({ url: session.url });
});
