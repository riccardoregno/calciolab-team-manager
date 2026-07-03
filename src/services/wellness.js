import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

/** @param {{ teamId: string, playerId: string, date: string, sleep: number, fatigue: number, mood: number }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function upsertWellness({ teamId, playerId, date, sleep, fatigue, mood }) {
  if (!isSupabaseConfigured) return { error: "not configured" };
  return supabase
    .from("player_wellness")
    .upsert(
      { team_id: teamId, player_id: String(playerId), date, sleep, fatigue, mood },
      { onConflict: "team_id,player_id,date" }
    );
}

/** @param {{ teamId: string, playerId: string, days?: number }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function getPlayerWellness({ teamId, playerId, days = 14 }) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const since = new Date();
  since.setDate(since.getDate() - days);
  return supabase
    .from("player_wellness")
    .select("date,sleep,fatigue,mood")
    .eq("team_id", teamId)
    .eq("player_id", String(playerId))
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: false });
}

/** @param {{ teamId: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function getTeamWellnessToday({ teamId }) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from("player_wellness")
    .select("player_id,sleep,fatigue,mood")
    .eq("team_id", teamId)
    .eq("date", today);
}

/** @param {{ teamId: string, days?: number }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function getTeamWellnessWeek({ teamId, days = 7 }) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const since = new Date();
  since.setDate(since.getDate() - days);
  return supabase
    .from("player_wellness")
    .select("player_id,date,sleep,fatigue,mood")
    .eq("team_id", teamId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });
}
