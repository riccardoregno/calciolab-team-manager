import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export async function upsertWellness({ teamId, playerId, date, sleep, fatigue, mood }) {
  if (!isSupabaseConfigured) return { error: "not configured" };
  return supabase
    .from("player_wellness")
    .upsert(
      { team_id: teamId, player_id: String(playerId), date, sleep, fatigue, mood },
      { onConflict: "team_id,player_id,date" }
    );
}

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

export async function getTeamWellnessToday({ teamId }) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from("player_wellness")
    .select("player_id,sleep,fatigue,mood")
    .eq("team_id", teamId)
    .eq("date", today);
}
