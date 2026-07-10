import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { localDateString } from "../utils/helpers";

// Fetch all availability records for a team (staff view) or for a single player
/** @param {{ teamId: string, playerId?: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function fetchPlayerAvailability({ teamId, playerId = null }) {
  if (!isSupabaseConfigured || !teamId) return { data: [], error: null };

  let query = supabase
    .from("player_availability")
    .select("id, player_id, status, reason, date_from, date_to, created_at")
    .eq("team_id", teamId)
    .order("date_from", { ascending: false })
    .limit(200);

  if (playerId) query = query.eq("player_id", String(playerId));

  const { data, error } = await query;
  return { data: data || [], error };
}

// Upsert: replaces the active record for player+team covering today.
// Simple model: one "current" availability entry per player (date_from = today, date_to = null).
/** @param {{ teamId: string, playerId: string, status: string, reason?: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function setPlayerAvailability({ teamId, playerId, status, reason = "" }) {
  if (!isSupabaseConfigured || !teamId || !playerId) {
    return { error: new Error("Parametri mancanti") };
  }
  if (!["available", "unavailable", "doubtful"].includes(status)) {
    return { error: new Error("Status non valido") };
  }

  const today = localDateString();

  const { data: existing } = await supabase
    .from("player_availability")
    .select("id")
    .eq("team_id", teamId)
    .eq("player_id", String(playerId))
    .eq("date_from", today)
    .is("date_to", null)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("player_availability")
      .update({ status, reason: reason || null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { error };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;

  const { error } = await supabase.from("player_availability").insert({
    team_id:   teamId,
    player_id: String(playerId),
    status,
    reason:    reason || null,
    date_from: today,
    date_to:   null,
    created_by: userId,
  });
  return { error };
}

/** @param {{ id: string }} params
 * @returns {Promise<{data: any[], error: any}>} */
export async function deletePlayerAvailability({ id }) {
  if (!isSupabaseConfigured || !id) return { error: new Error("ID mancante") };
  const { error } = await supabase.from("player_availability").delete().eq("id", id);
  return { error };
}
