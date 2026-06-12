import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/requireAuth.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RSVP_TTL_HOURS = 48;
const PUBLIC_RL_MAX = 20;
const PUBLIC_RL_WINDOW_MS = 10 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-.:]+$/;
const STAFF_ROLES = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

function isSafeId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && SAFE_ID_REGEX.test(value);
}

function normalizeResponse(value: unknown) {
  return value === "yes" || value === "no" ? value : "";
}

function publicRateLimit(req: Request, action: string) {
  const key = `rsvp:${action}:${getIp(req)}`;
  return {
    key,
    allowed: checkRateLimit(key, PUBLIC_RL_MAX, PUBLIC_RL_WINDOW_MS),
  };
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function publicPlayerName(playerData: Record<string, unknown> = {}) {
  const parts = [playerData.firstName, playerData.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.join(" ") || String(playerData.name || "Giocatore");
}

function publicMatchPayload(matchData: Record<string, unknown> = {}) {
  return {
    opponent: String(matchData.opponent || ""),
    date: String(matchData.date || ""),
    time: String(matchData.time || ""),
    location: String(matchData.location || ""),
    competition: String(matchData.competition || ""),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase non configurato" }, 500);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "get");

  try {
    if (action === "create") {
      const teamId = String(body.teamId || "");
      const matchId = String(body.matchId || "");
      const playerId = String(body.playerId || "");

      if (!isSafeId(matchId) || !isSafeId(playerId) || !teamId) {
        return json({ error: "Parametri RSVP non validi" }, 400);
      }

      const auth = await requireAuth(req, teamId, STAFF_ROLES);
      if (auth.error) return json({ error: auth.error }, auth.status!);

      const [{ data: matchRow, error: matchError }, { data: playerRow, error: playerError }] = await Promise.all([
        serviceClient.from("matches").select("id").eq("team_id", teamId).eq("id", matchId).maybeSingle(),
        serviceClient.from("players").select("id").eq("team_id", teamId).eq("id", playerId).maybeSingle(),
      ]);

      if (matchError || playerError) return json({ error: "Errore verifica dati RSVP" }, 500);
      if (!matchRow || !playerRow) return json({ error: "Partita o giocatore non trovato" }, 404);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + RSVP_TTL_HOURS * 60 * 60 * 1000).toISOString();
      const { data: existing, error: existingError } = await serviceClient
        .from("rsvp_tokens")
        .select("token, expires_at, response, responded_at")
        .eq("team_id", teamId)
        .eq("match_id", matchId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (existingError) return json({ error: "Errore lettura token RSVP" }, 500);

      if (existing && new Date(existing.expires_at).getTime() > now.getTime()) {
        return json({ token: existing.token, expiresAt: existing.expires_at, response: existing.response });
      }

      const token = createToken();
      const { data: saved, error: saveError } = await serviceClient
        .from("rsvp_tokens")
        .upsert({
          team_id: teamId,
          match_id: matchId,
          player_id: playerId,
          token,
          expires_at: expiresAt,
          response: "pending",
          responded_at: null,
          created_by: auth.user!.id,
        }, { onConflict: "team_id,match_id,player_id" })
        .select("token, expires_at, response")
        .single();

      if (saveError) return json({ error: "Errore creazione token RSVP" }, 500);
      return json({ token: saved.token, expiresAt: saved.expires_at, response: saved.response });
    }

    if (action === "get" || action === "respond") {
      const rl = publicRateLimit(req, action);
      if (!rl.allowed) return rateLimitedResponse(rl.key, CORS);

      const token = String(body.token || "").trim();
      if (token.length < 32 || token.length > 160) {
        return json({ error: "Link RSVP non valido" }, 400);
      }

      const { data: tokenRow, error: tokenError } = await serviceClient
        .from("rsvp_tokens")
        .select("team_id, match_id, player_id, response, expires_at, responded_at")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) return json({ error: "Errore verifica RSVP" }, 500);
      if (!tokenRow) return json({ error: "Link RSVP non valido" }, 404);

      const expired = new Date(tokenRow.expires_at).getTime() < Date.now();
      if (expired) return json({ error: "Link RSVP scaduto" }, 410);

      if (action === "respond") {
        const response = normalizeResponse(body.response);
        if (!response) return json({ error: "Risposta non valida" }, 400);

        const { data: updated, error: updateError } = await serviceClient
          .from("rsvp_tokens")
          .update({ response, responded_at: new Date().toISOString() })
          .eq("token", token)
          .select("response, responded_at")
          .single();

        if (updateError) return json({ error: "Risposta non salvata" }, 500);
        tokenRow.response = updated.response;
        tokenRow.responded_at = updated.responded_at;
      }

      const [{ data: team }, { data: matchRow }, { data: playerRow }] = await Promise.all([
        serviceClient.from("teams").select("name").eq("id", tokenRow.team_id).maybeSingle(),
        serviceClient.from("matches").select("data").eq("team_id", tokenRow.team_id).eq("id", tokenRow.match_id).maybeSingle(),
        serviceClient.from("players").select("data").eq("team_id", tokenRow.team_id).eq("id", tokenRow.player_id).maybeSingle(),
      ]);

      return json({
        teamName: team?.name || "CalcioLab",
        playerName: publicPlayerName(playerRow?.data || {}),
        match: publicMatchPayload(matchRow?.data || {}),
        response: tokenRow.response,
        respondedAt: tokenRow.responded_at,
      });
    }

    return json({ error: "Azione RSVP non valida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    return json({ error: message }, 500);
  }
});
