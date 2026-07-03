import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

// FIX #8: rimossi tutti i console.log con teamId e fields — espongono dati sensibili in produzione.
// FIX #1 (parziale): questa funzione NON dovrebbe poter essere chiamata dal client per
// aggiornare subscription_plan / billing_status senza validazione server-side del pagamento.
// Prima del go-live: aggiungere RLS su teams che blocchi UPDATE di questi campi dal client:
//
//   CREATE POLICY "subscription_readonly_from_client"
//   ON teams FOR UPDATE
//   USING (auth.uid() = owner_id)
//   WITH CHECK (
//     -- impedisce di modificare campi billing dal client
//     subscription_plan = (SELECT subscription_plan FROM teams WHERE id = teams.id) AND
//     billing_status    = (SELECT billing_status    FROM teams WHERE id = teams.id)
//   );
//
// Gli aggiornamenti subscription devono passare solo da Edge Function autenticata via webhook Stripe.

/** @param {string} teamId
 * @param {object} fields
 * @returns {Promise<{data: any[], error: any}>} */
export async function updateTeamSubscription(teamId, fields) {
  // Supabase non configurato: restituiamo un errore esplicito per non aggiornare
  // lo stato locale con un billing che non esiste su nessun DB.
  // Nota: in ambiente dev locale senza Supabase, developerUnlocked blocca già i pulsanti
  // billing, ma questo guard rende il comportamento consistente anche se chiamato
  // direttamente (es. test unitari o futuro refactor).
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      console.warn("[subscription] Supabase non configurato — nessuna scrittura billing effettuata");
    }
    return { data: null, error: { message: "Supabase non configurato: questa operazione richiede una connessione al DB" } };
  }

  // teamId mancante: skip silenzioso (utente non ancora autenticato o team non caricato)
  if (!teamId) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from("teams")
    .update(fields)
    .eq("id", teamId)
    .select();

  if (error && import.meta.env.DEV) {
    console.error("[subscription] Errore aggiornamento:", error.message);
  }

  return { data, error };
}
