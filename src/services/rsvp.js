import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const rsvpFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/rsvp-match`;

async function callRsvpFunction(payload, { auth = false } = {}) {
  if (!isSupabaseConfigured || !rsvpFunctionUrl) {
    return { data: null, error: new Error("Supabase non configurato") };
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  };

  if (auth) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) {
      return { data: null, error: sessionError || new Error("Sessione non disponibile") };
    }
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(rsvpFunctionUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    return { data: null, error: new Error(data?.error || "Operazione RSVP non riuscita") };
  }

  return { data, error: null };
}

export async function createRsvpLink({ teamId, matchId, playerId }) {
  const { data, error } = await callRsvpFunction({
    action: "create",
    teamId,
    matchId,
    playerId,
  }, { auth: true });

  if (error) return { link: "", token: "", error };

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://calciolab.org";
  return {
    link: `${baseUrl}/rsvp?t=${encodeURIComponent(data.token)}`,
    token: data.token,
    expiresAt: data.expiresAt,
    response: data.response,
    error: null,
  };
}

export async function getRsvpPayload(token) {
  return callRsvpFunction({ action: "get", token });
}

export async function submitRsvpResponse({ token, response }) {
  return callRsvpFunction({ action: "respond", token, response });
}

export async function sendMatchConvocationEmail({
  to, playerName, teamName, opponent, matchDate, matchTime, matchVenue, rsvpUrl,
}) {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase non configurato") };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (sessionError || !accessToken) {
    return { error: sessionError || new Error("Sessione non disponibile") };
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/send-email`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({
      type: "match_convocation",
      to,
      playerName,
      teamName,
      opponent,
      matchDate,
      matchTime,
      matchVenue,
      rsvpUrl,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    return { error: new Error(data?.error || "Invio email non riuscito") };
  }
  return { error: null };
}

export async function fetchMatchRsvps({ teamId, matchId }) {
  if (!isSupabaseConfigured || !teamId || !matchId) {
    return { rsvps: [], error: null };
  }

  const { data, error } = await supabase
    .from("rsvp_tokens")
    .select("player_id, response, responded_at, expires_at")
    .eq("team_id", teamId)
    .eq("match_id", String(matchId));

  if (error) return { rsvps: [], error };
  return { rsvps: data || [], error: null };
}
