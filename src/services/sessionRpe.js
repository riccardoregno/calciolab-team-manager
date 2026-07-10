import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

/** @param {{ teamId: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function fetchTeamRpe({ teamId }) {
  if (!isSupabaseConfigured || !teamId) return { data: [] };
  const { data, error } = await supabase
    .from("session_rpe")
    .select("player_id, event_id, event_type, rpe_value, notes, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(300);
  return { data: data || [], error };
}

/** @param {{ teamId: string, playerId: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function fetchPlayerRpe({ teamId, playerId }) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: [] };
  const { data, error } = await supabase
    .from("session_rpe")
    .select("player_id, event_id, event_type, rpe_value, notes, created_at")
    .eq("team_id", teamId)
    .eq("player_id", String(playerId))
    .order("created_at", { ascending: false })
    .limit(100);
  return { data: data || [], error };
}

/** @param {{ teamId: string, playerId: string, eventId: string, eventType: string, rpeValue: number, notes?: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function upsertRpe({ teamId, playerId, eventId, eventType, rpeValue, notes = "" }) {
  if (!isSupabaseConfigured || !teamId || !playerId || !eventId) return { error: new Error("missing params") };
  const { data, error } = await supabase
    .from("session_rpe")
    .upsert({
      team_id:    teamId,
      player_id:  String(playerId),
      event_id:   String(eventId),
      event_type: eventType,
      rpe_value:  rpeValue,
      notes:      notes || "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,player_id,event_id" })
    .select()
    .single();
  return { data, error };
}
