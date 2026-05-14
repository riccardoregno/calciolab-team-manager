import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export async function updateTeamSubscription(teamId, fields) {
  console.log("[subscription] updateTeamSubscription chiamato");
  console.log("[subscription] isSupabaseConfigured:", isSupabaseConfigured);
  console.log("[subscription] teamId:", teamId);
  console.log("[subscription] fields:", fields);

  if (!isSupabaseConfigured || !teamId) {
    console.warn("[subscription] uscita anticipata — isSupabaseConfigured:", isSupabaseConfigured, "teamId:", teamId);
    return { error: null };
  }

  const { data, error } = await supabase.from("teams").update(fields).eq("id", teamId).select();

  console.log("[subscription] risultato update — data:", data, "error:", error);

  if (error) {
    console.error("[subscription] Errore aggiornamento subscription su Supabase:", error.message);
  }

  return { error };
}
