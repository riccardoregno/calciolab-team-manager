import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RSVP_REMINDER_SECRET = Deno.env.get("RSVP_REMINDER_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://calciolab.org";
const REMINDER_AFTER_HOURS = 24;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request) {
  if (RSVP_REMINDER_SECRET && req.headers.get("x-internal-secret") === RSVP_REMINDER_SECRET) return true;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  return Boolean(SUPABASE_SERVICE_ROLE_KEY && bearer === SUPABASE_SERVICE_ROLE_KEY);
}

function playerName(data: Record<string, unknown> = {}) {
  return [data.firstName, data.lastName].map((part) => String(part || "").trim()).filter(Boolean).join(" ") ||
    String(data.name || "Giocatore");
}

function matchLabel(data: Record<string, unknown> = {}) {
  return [
    data.opponent ? `vs ${data.opponent}` : "",
    data.date ? String(data.date) : "",
    data.time ? `ore ${data.time}` : "",
    data.location ? String(data.location) : "",
  ].filter(Boolean).join(" · ");
}

async function sendReminderEmail(payload: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(String(error?.error || "Invio email non riuscito"));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Supabase non configurato" }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const olderThan = new Date(Date.now() - REMINDER_AFTER_HOURS * 60 * 60 * 1000).toISOString();

  try {
    const { data: tokens, error } = await supabase
      .from("rsvp_tokens")
      .select("id, team_id, match_id, player_id, token, created_at")
      .eq("response", "pending")
      .is("reminder_sent_at", null)
      .lte("created_at", olderThan)
      .gt("expires_at", new Date().toISOString())
      .limit(100);

    if (error) throw error;

    const results: Array<{ id: string; sent: boolean; reason?: string }> = [];

    for (const row of tokens || []) {
      const [{ data: team }, { data: matchRow }, { data: playerRow }] = await Promise.all([
        supabase.from("teams").select("name").eq("id", row.team_id).maybeSingle(),
        supabase.from("matches").select("data").eq("team_id", row.team_id).eq("id", row.match_id).maybeSingle(),
        supabase.from("players").select("data").eq("team_id", row.team_id).eq("id", row.player_id).maybeSingle(),
      ]);

      const playerData = (playerRow?.data || {}) as Record<string, unknown>;
      const matchData = (matchRow?.data || {}) as Record<string, unknown>;
      const to = String(playerData.email || "").trim();

      if (!to) {
        results.push({ id: row.id, sent: false, reason: "email giocatore mancante" });
        continue;
      }

      const rsvpUrl = `${APP_URL}/rsvp?t=${encodeURIComponent(row.token)}`;
      await sendReminderEmail({
        type: "custom",
        to,
        subject: `Promemoria convocazione ${team?.name || "CalcioLab"}`,
        html: `
          <h1 style="margin:0 0 16px;font-size:24px;color:white;">Promemoria disponibilità</h1>
          <p style="color:#94a3b8;line-height:1.7;">Ciao ${playerName(playerData)}, non abbiamo ancora ricevuto la tua risposta per la convocazione di ${team?.name || "CalcioLab"}.</p>
          <p style="color:#e2e8f0;line-height:1.7;">${matchLabel(matchData)}</p>
          <p style="color:#94a3b8;line-height:1.7;">Conferma se sei disponibile o non disponibile dal link qui sotto.</p>
          <p><a href="${rsvpUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800;">Rispondi alla convocazione</a></p>
          <p style="color:#64748b;font-size:12px;word-break:break-all;">${rsvpUrl}</p>
        `,
      });

      const { error: updateError } = await supabase
        .from("rsvp_tokens")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      if (updateError) throw updateError;
      results.push({ id: row.id, sent: true });
    }

    return json({ ok: true, checked: tokens?.length || 0, sent: results.filter((item) => item.sent).length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rsvp-reminder]", message);
    return json({ ok: false, error: message }, 500);
  }
});
