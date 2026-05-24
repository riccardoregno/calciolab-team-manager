/**
 * send-push — Supabase Edge Function
 * Invia push notification via FCM HTTP v1 API a uno o più token.
 *
 * Body atteso:
 * {
 *   teamId?: string,          // invia a tutti i token del team
 *   userId?: string,          // invia a tutti i token dell'utente
 *   tokens?: string[],        // oppure lista diretta di token FCM
 *   title: string,
 *   body: string,
 *   data?: Record<string, string>,  // dati custom (es. { path: "/matches" })
 *   imageUrl?: string
 * }
 *
 * Autenticazione: richiede Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * oppure header interno x-internal-secret.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FCM_SERVICE_ACCOUNT_JSON  = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
const INTERNAL_SECRET           = Deno.env.get("SEND_PUSH_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
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

/* ─── FCM OAuth2 token ────────────────────────────────────────────── */
let _cachedToken: { value: string; expiresAt: number } | null = null;

async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 30_000) {
    return _cachedToken.value;
  }

  const sa = JSON.parse(serviceAccountJson);
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };

  // Encode header.payload
  function b64url(obj: unknown) {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  const unsigned = `${b64url(header)}.${b64url(payload)}`;

  // Import RSA private key from PEM
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${unsigned}.${sigB64}`;

  // Exchange JWT for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = await res.json();
  if (!res.ok || !tokenData.access_token) {
    throw new Error(`FCM token error: ${JSON.stringify(tokenData)}`);
  }

  _cachedToken = { value: tokenData.access_token, expiresAt: now + tokenData.expires_in * 1000 };
  return _cachedToken.value;
}

/* ─── Send one FCM message ────────────────────────────────────────── */
async function sendFcmMessage(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  projectId: string;
  accessToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const message: Record<string, unknown> = {
    token: params.token,
    notification: {
      title: params.title,
      body: params.body,
      ...(params.imageUrl ? { image: params.imageUrl } : {}),
    },
    android: {
      priority: "high",
      notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
      headers: { "apns-priority": "10" },
    },
    ...(params.data ? { data: params.data } : {}),
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${params.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    }
  );

  const result = await res.json();
  if (!res.ok) {
    return { ok: false, error: result?.error?.message || "FCM error" };
  }
  return { ok: true };
}

/* ─── Main handler ────────────────────────────────────────────────── */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  // Auth check — accetta service role oppure internal secret
  const authHeader   = req.headers.get("authorization") ?? "";
  const internalSec  = req.headers.get("x-internal-secret") ?? "";
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const isInternal    = INTERNAL_SECRET && internalSec === INTERNAL_SECRET;
  if (!isServiceRole && !isInternal) {
    return json({ error: "Non autorizzato" }, 401);
  }

  if (!FCM_SERVICE_ACCOUNT_JSON) return json({ error: "FCM_SERVICE_ACCOUNT_JSON non configurato" }, 500);
  if (!supabase)                  return json({ error: "Supabase non configurato" }, 500);

  let body: {
    teamId?: string;
    userId?: string;
    tokens?: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
  };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  const { teamId, userId, tokens: directTokens, title, body: msgBody, data, imageUrl } = body;
  if (!title || !msgBody) return json({ error: "title e body sono obbligatori" }, 400);

  // Raccogli i token dal DB se non passati direttamente
  let fcmTokens: string[] = directTokens ?? [];

  if (!fcmTokens.length && (teamId || userId)) {
    let query = supabase.from("push_tokens").select("token");
    if (teamId) query = query.eq("team_id", teamId);
    if (userId) query = query.eq("user_id", userId);
    const { data: rows, error } = await query;
    if (error) return json({ error: `DB error: ${error.message}` }, 500);
    fcmTokens = (rows ?? []).map((r: { token: string }) => r.token);
  }

  if (!fcmTokens.length) return json({ sent: 0, message: "Nessun token trovato" });

  // Ottieni access token FCM
  let accessToken: string;
  let projectId: string;
  try {
    const sa = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
    projectId = sa.project_id;
    accessToken = await getFcmAccessToken(FCM_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    return json({ error: `Errore configurazione FCM: ${(e as Error).message}` }, 500);
  }

  // Invia a tutti i token (in parallelo, max 500 per chiamata FCM)
  const results = await Promise.allSettled(
    fcmTokens.map((token) =>
      sendFcmMessage({ token, title, body: msgBody, data, imageUrl, projectId, accessToken })
    )
  );

  const sent    = results.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
  const failed  = results.length - sent;
  const errors  = results
    .filter((r) => r.status === "rejected" || !(r as PromiseFulfilledResult<{ ok: boolean }>).value?.ok)
    .map((r) => r.status === "rejected" ? (r as PromiseRejectedResult).reason?.message : (r as PromiseFulfilledResult<{ ok: boolean; error?: string }>).value?.error)
    .filter(Boolean);

  return json({ sent, failed, total: fcmTokens.length, errors: errors.slice(0, 5) });
});
