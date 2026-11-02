import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { normalizeExtractedPlayers } from "../utils/opponentLineupImport.js";

export async function extractOpponentLineup({ teamId, attachment }) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Servizio di lettura non disponibile.");
  const { data, error } = await supabase.functions.invoke("extract-opponent-lineup", {
    body: { teamId, path: attachment.path },
  });
  if (error) {
    let message = "Lettura automatica non disponibile. Puoi riprovare o inserire i giocatori manualmente.";
    try { message = (await error.context?.json())?.error || message; } catch { /* Keep fallback. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  const players = normalizeExtractedPlayers(data?.players);
  if (!players.length) throw new Error("Nessun giocatore leggibile. Prova una foto più nitida oppure inseriscili manualmente.");
  return { players, teamName: typeof data.teamName === "string" ? data.teamName : "" };
}

