import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export async function loadPlayerById(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("players")
    .select("id, data")
    .eq("team_id", teamId)
    .eq("id", playerId)
    .maybeSingle();

  if (error) console.error("[playerProfile] loadPlayerById:", error.message);
  if (!data) return { data: null, error };

  return { data: { id: data.id, ...(data.data || {}) }, error };
}

export async function loadPlayerStats(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("player_stats")
    .select("*")
    .eq("team_id", teamId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) console.error("[playerProfile] loadPlayerStats:", error.message);
  return { data, error };
}

export async function loadPlayerMatches(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("player_matches")
    .select("*")
    .eq("team_id", teamId)
    .eq("player_id", playerId);

  if (error) console.error("[playerProfile] loadPlayerMatches:", error.message);
  return { data: data || [], error };
}

export async function upsertPlayerStats(teamId, playerId, fields, season = "2025/2026") {
  if (!isSupabaseConfigured || !teamId || !playerId) return { error: null };

  const { error } = await supabase
    .from("player_stats")
    .upsert({ team_id: teamId, player_id: playerId, season, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "team_id,player_id,season" });

  if (error) console.error("[playerProfile] upsertPlayerStats:", error.message);
  return { error };
}

export async function upsertPlayerMatch(teamId, playerId, matchId, fields) {
  if (!isSupabaseConfigured || !teamId || !playerId || !matchId) return { error: null };

  const { error } = await supabase
    .from("player_matches")
    .upsert({ team_id: teamId, player_id: playerId, match_id: matchId, ...fields },
      { onConflict: "team_id,player_id,match_id" });

  if (error) console.error("[playerProfile] upsertPlayerMatch:", error.message);
  return { error };
}
