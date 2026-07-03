import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const NOTIFY_URL = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/notify-team`;

/** @param {{ teamId: string, type: string, payload?: object }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function sendTeamNotification({ teamId, type, payload = {} }) {
  if (!isSupabaseConfigured || !teamId) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return;

  fetch(NOTIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${accessToken}`,
      apikey:          import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({ teamId, type, payload }),
  }).catch(() => {});
}
