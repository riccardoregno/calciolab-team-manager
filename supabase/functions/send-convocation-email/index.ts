import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") ?? "CalcioLab <noreply@calciolab.org>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://calciolab.org";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metodo non supportato" }, 405);

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Secrets non configurati" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Utente non autenticato" }, 401);

    const payload = await req.json();
    const teamId = String(payload.teamId || "").trim();
    const to = String(payload.to || "").trim().toLowerCase();
    if (!teamId) return json({ error: "Team mancante" }, 400);
    if (!EMAIL_RE.test(to)) return json({ error: "Email destinatario non valida" }, 400);

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership, error: membershipError } = await serviceClient
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (membershipError) return json({ error: membershipError.message }, 500);
    if (!membership || membership.role === "player") return json({ error: "Non autorizzato" }, 403);

    const playerName = clean(payload.playerName) || "giocatore";
    const teamName = clean(payload.teamName) || "CalcioLab";
    const opponent = clean(payload.opponent) || "avversario";
    const matchDate = clean(payload.matchDate) || "";
    const matchTime = clean(payload.matchTime) || "";
    const matchVenue = clean(payload.matchVenue) || "";
    const rsvpUrl = isSafeAppUrl(payload.rsvpUrl) ? String(payload.rsvpUrl) : "";

    const subject = `Convocazione ${teamName} vs ${opponent}`;
    const html = buildHtml({
      playerName,
      teamName,
      opponent,
      matchDate,
      matchTime,
      matchVenue,
      rsvpUrl,
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[send-convocation-email] Resend error:", result);
      return json({ error: result?.message || "Errore Resend" }, 502);
    }

    return json({ ok: true, id: result?.id || null });
  } catch (error) {
    return json({ error: error?.message || "Errore invio convocazione" }, 500);
  }
});

function clean(value: unknown) {
  return String(value || "").trim().replace(/[<>]/g, "");
}

function isSafeAppUrl(value: unknown) {
  if (!value) return true;
  try {
    const expected = new URL(APP_URL);
    const actual = new URL(String(value));
    return actual.origin === expected.origin;
  } catch {
    return false;
  }
}

function buildHtml({ playerName, teamName, opponent, matchDate, matchTime, matchVenue, rsvpUrl }: Record<string, string>) {
  const details = [
    ["Squadra", teamName],
    ["Avversario", opponent],
    ["Data", matchDate],
    ["Ora", matchTime],
    ["Luogo", matchVenue],
  ].filter(([, value]) => Boolean(value));

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Convocazione CalcioLab</title>
</head>
<body style="margin:0;padding:0;background:#080b12;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b12;padding:36px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 24px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:38px;height:38px;background:#2563eb;border-radius:10px;text-align:center;vertical-align:middle;color:white;font-weight:900;">CL</td>
              <td style="padding-left:10px;font-size:18px;font-weight:900;color:white;">CalcioLab</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#111827;border:1px solid #263244;border-radius:20px;padding:34px 38px;">
          <p style="margin:0 0 8px;color:#60a5fa;font-size:12px;font-weight:800;text-transform:uppercase;">Convocazione</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:white;">Ciao ${playerName}</h1>
          <p style="margin:0 0 22px;color:#cbd5e1;font-size:15px;line-height:1.6;">
            Sei stato convocato per <strong>${teamName} vs ${opponent}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
            ${details.map(([label, value]) => `
              <tr>
                <td style="padding:9px 0;color:#94a3b8;font-size:13px;border-bottom:1px solid #263244;">${label}</td>
                <td style="padding:9px 0;color:white;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #263244;">${value}</td>
              </tr>
            `).join("")}
          </table>
          ${rsvpUrl ? `<a href="${rsvpUrl}" style="display:inline-block;background:#2563eb;color:white;font-size:15px;font-weight:800;padding:13px 26px;border-radius:12px;text-decoration:none;">Rispondi alla convocazione</a>` : ""}
        </td></tr>
        <tr><td style="padding:24px 0 0;text-align:center;color:#64748b;font-size:12px;">
          calciolab.org
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
