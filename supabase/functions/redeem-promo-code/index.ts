import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { teamId, code } = await req.json();
    const normalizedCode = String(code || "").trim().toUpperCase();

    if (!teamId) return json({ success: false, error: "teamId mancante" }, 400);
    if (!normalizedCode) return json({ success: false, error: "Codice mancante" }, 400);

    // Solo owner/headCoach possono riscattare un codice per il team —
    // stesso perimetro dei controlli di billing esistenti.
    const auth = await requireAuth(req, teamId, ["owner", "headCoach"]);
    if (auth.error) return json({ success: false, error: auth.error }, auth.status!);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // FIX: la lista dei codici NON vive più nel bundle client (era hardcoded
    // in src/utils/helpers.js, leggibile da chiunque con devtools) né in
    // teams.settings (JSON scrivibile dall'owner). Vive in promo_codes,
    // tabella senza policy RLS per anon/authenticated — leggibile e
    // scrivibile solo da qui (service role).
    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select("id, code, plan, permanent, max_uses, expires_at, note")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (promoError) return json({ success: false, error: promoError.message }, 500);
    if (!promo) return json({ success: false, error: "Codice non trovato o non valido" }, 404);

    if (!promo.permanent && promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      return json({ success: false, error: "Questo codice è scaduto" }, 410);
    }

    // Già riscattato da questo stesso team? Operazione idempotente — niente
    // doppio conteggio sul max_uses, ma confermiamo comunque il piano attivo.
    const { data: existingRedemption, error: existingError } = await supabase
      .from("promo_redemptions")
      .select("id, redeemed_at")
      .eq("code_id", promo.id)
      .eq("team_id", teamId)
      .maybeSingle();

    if (existingError) return json({ success: false, error: existingError.message }, 500);

    if (!existingRedemption && promo.max_uses > 0) {
      const { count, error: countError } = await supabase
        .from("promo_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("code_id", promo.id);

      if (countError) return json({ success: false, error: countError.message }, 500);
      if ((count || 0) >= promo.max_uses) {
        return json({ success: false, error: "Questo codice ha raggiunto il limite di utilizzi" }, 409);
      }
    }

    if (!existingRedemption) {
      // Vincolo UNIQUE (code_id, team_id) rende l'inserimento sicuro anche
      // sotto richieste concorrenti: un eventuale doppio click produce al
      // più un conflitto 23505, che trattiamo come "già riscattato".
      const { error: insertError } = await supabase
        .from("promo_redemptions")
        .insert({ code_id: promo.id, team_id: teamId });

      if (insertError && insertError.code !== "23505") {
        return json({ success: false, error: insertError.message }, 500);
      }
    }

    // Aggiorna direttamente le colonne trusted lette da App.jsx
    // (remoteSubscription / subscriptionOverride) — niente più bisogno di un
    // "promoOverride" locale che potesse vincere sui dati Stripe reali.
    const { error: updateError } = await supabase
      .from("teams")
      .update({
        subscription_plan: promo.plan,
        billing_status: "active",
      })
      .eq("id", teamId);

    if (updateError) return json({ success: false, error: updateError.message }, 500);

    return json({
      success: true,
      plan: promo.plan,
      permanent: promo.permanent,
      note: promo.note || null,
      redeemedAt: existingRedemption?.redeemed_at || new Date().toISOString(),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Errore riscatto codice" }, 500);
  }
});
