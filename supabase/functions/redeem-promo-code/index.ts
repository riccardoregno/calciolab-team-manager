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

    // FIX: il riscatto NON fa più COUNT(*) poi INSERT separati — sotto
    // concorrenza (due team diversi che riscattano lo stesso codice in
    // parallelo) entrambe le richieste potevano leggere lo stesso COUNT
    // sotto il limite e superare max_uses globalmente. L'intero riscatto
    // (verifica esistenza/scadenza/limite, incremento contatore con UPDATE
    // condizionale used_count < max_uses, registrazione riscatto,
    // aggiornamento piano del team) ora avviene in un'unica funzione
    // Postgres atomica (vedi migrazione 20260607160000_atomic_promo_redeem.sql),
    // che funge anche da lock ottimistico serializzato dai lock di riga.
    const { data: rpcRows, error: rpcError } = await supabase
      .rpc("redeem_promo_code", { p_team_id: teamId, p_code: normalizedCode });

    if (rpcError) return json({ success: false, error: rpcError.message }, 500);

    const result = rpcRows?.[0];
    if (!result) return json({ success: false, error: "Errore riscatto codice" }, 500);

    switch (result.status) {
      case "not_found":
        return json({ success: false, error: "Codice non trovato o non valido" }, 404);
      case "expired":
        return json({ success: false, error: "Questo codice è scaduto" }, 410);
      case "limit_reached":
        return json({ success: false, error: "Questo codice ha raggiunto il limite di utilizzi" }, 409);
      case "already_redeemed":
      case "redeemed":
        return json({
          success: true,
          plan: result.plan,
          permanent: result.permanent,
          note: result.note || null,
          redeemedAt: result.redeemed_at || new Date().toISOString(),
        });
      default:
        return json({ success: false, error: "Errore riscatto codice" }, 500);
    }
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Errore riscatto codice" }, 500);
  }
});
