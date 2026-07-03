import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { upsertPlayerMatch } from "./playerProfile";

export { upsertPlayerMatch };

/** @param {{ teamId: string, matchId: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function getMatchPlayerStats({ teamId, matchId }) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  return supabase
    .from("player_matches")
    .select("*")
    .eq("team_id", teamId)
    .eq("match_id", matchId);
}

/** @param {{ teamId: string, matchId: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function deleteMatch({ teamId, matchId }) {
  if (!isSupabaseConfigured) return { data: null, error: null };
  return supabase
    .from("matches")
    .delete()
    .eq("id", matchId)
    .eq("team_id", teamId);
}

/** @param {{ teamId: string, matchId: string, result: any }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function updateMatchResult({ teamId, matchId, result }) {
  if (!isSupabaseConfigured) return { data: null, error: null };
  return supabase
    .from("matches")
    .update({ result })
    .eq("id", matchId)
    .eq("team_id", teamId);
}
