import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const signature = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  if (STRIPE_WEBHOOK_SECRET) {
    const isValid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const teamId = session["client_reference_id"] as string | undefined;
    const planId = (session["metadata"] as Record<string, string> | undefined)?.plan ?? "premium";
    const customerId = session["customer"] as string | undefined;
    const subscriptionId = session["subscription"] as string | undefined;

    if (teamId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase
        .from("teams")
        .update({
          subscription_plan: planId,
          billing_status: "active",
          trial_plan: "",
          trial_started_at: null,
          trial_ends_at: null,
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
        })
        .eq("id", teamId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

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
