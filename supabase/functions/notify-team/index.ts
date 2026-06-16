/**
 * notify-team — Supabase Edge Function
 *
 * Proxy autenticato: accetta JWT utente, verifica che abbia un ruolo di
 * gestione nel team, poi invia una push notification a tutti i device del
 * team tramite la funzione send-push (service role).
 *
 * Body atteso:
 * {
 *   teamId: string,
 *   type: "match_update" | "new_session",
 *   payload: {
 *     // match_update: opponent, date, time, venue
 *     // new_session:  title, date
 *   }
 * }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

const MANAGER_ROLES = new Set(["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"]);

function buildMessage(type: string, payload: Record<string, string>): { title: string; body: string; data: Record<string, string> } {
  if (type === "match_update") {
    const parts: string[] = [];
    if (payload.date) parts.push(new Date(payload.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }));
    if (payload.time) parts.push(payload.time);
    if (payload.venue) parts.push(payload.venue);
    return {
      title: `Partita aggiornata: ${payload.opponent ?? "avversario"}`,
      body:  parts.length ? parts.join(" · ") : "Dettagli modificati dallo staff",
      data:  { path: "/matches" },
    };
  }
  if (type === "new_session") {
    const dateStr = payload.date
      ? new Date(payload.date).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit" })
      : "";
    return {
      title: `Nuova seduta: ${payload.title ?? "Allenamento"}`,
      body:  dateStr || "Controlla il programma",
      data:  { path: "/sessions" },
    };
  }
  return { title: "Aggiornamento CalcioLab", body: "Novità dal tuo staff", data: { path: "/" } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  // Verifica JWT utente
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
  const jwt = authHeader.slice(7);

  // Client autenticato con JWT utente per verificare il ruolo
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Token non valido" }, 401);

  let body: { teamId?: string; type?: string; payload?: Record<string, string> };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  const { teamId, type, payload = {} } = body;
  if (!teamId || !type) return json({ error: "teamId e type sono obbligatori" }, 400);

  // Verifica ruolo nel team con service role client
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: member, error: memberError } = await adminClient
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !member) return json({ error: "Non sei membro di questo team" }, 403);
  if (!MANAGER_ROLES.has(member.role)) return json({ error: "Ruolo non autorizzato" }, 403);

  const { title, body: msgBody, data } = buildMessage(type, payload);

  // Chiama send-push con service role
  const pushUrl = `${SUPABASE_URL}/functions/v1/send-push`;
  const pushRes = await fetch(pushUrl, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ teamId, title, body: msgBody, data }),
  });

  const result = await pushRes.json().catch(() => ({}));
  if (!pushRes.ok) return json({ error: result?.error ?? "Errore invio push" }, 500);

  return json({ ok: true, ...result });
});
