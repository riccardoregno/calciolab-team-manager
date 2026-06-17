import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export async function touchPlayerPortalActivity({ teamId, playerId, increment = false }) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase.rpc("touch_player_portal_activity", {
    p_team_id: teamId,
    p_player_id: String(playerId),
    p_increment: Boolean(increment),
  });

  return { data, error };
}

export async function fetchPlayerPortalActivity({ teamId, playerId }) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("player_portal_activity")
    .select("visit_count, first_seen_at, last_seen_at, online_until, updated_at")
    .eq("team_id", teamId)
    .eq("player_id", String(playerId))
    .maybeSingle();

  return { data, error };
}

export function isPlayerPortalOnline(activity, now = Date.now()) {
  if (!activity?.online_until) return false;
  const until = new Date(activity.online_until).getTime();
  return Number.isFinite(until) && until > now;
}
