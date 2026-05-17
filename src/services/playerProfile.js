import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

// FIX #4: RACE CONDITION player_stats
// Il pattern read-modify-write è NON atomico: due salvataggi concorrenti producono totali sbagliati.
//
// SOLUZIONE: eseguire questo SQL su Supabase prima del go-live:
//
//   CREATE OR REPLACE FUNCTION increment_player_stats(
//     p_team_id      uuid,
//     p_player_id    text,
//     p_season       text,
//     p_delta_goals         int DEFAULT 0,
//     p_delta_assists       int DEFAULT 0,
//     p_delta_minutes       int DEFAULT 0,
//     p_delta_yellow        int DEFAULT 0,
//     p_delta_red           int DEFAULT 0,
//     p_new_appearance      bool DEFAULT false
//   ) RETURNS void LANGUAGE plpgsql AS $$
//   BEGIN
//     INSERT INTO player_stats
//       (team_id, player_id, season, goals, assists, minutes_played,
//        yellow_cards, red_cards, appearances, updated_at)
//     VALUES
//       (p_team_id, p_player_id, p_season,
//        GREATEST(0, p_delta_goals),
//        GREATEST(0, p_delta_assists),
//        GREATEST(0, p_delta_minutes),
//        GREATEST(0, p_delta_yellow),
//        GREATEST(0, p_delta_red),
//        CASE WHEN p_new_appearance THEN 1 ELSE 0 END,
//        now())
//     ON CONFLICT (team_id, player_id, season) DO UPDATE SET
//       goals          = GREATEST(0, player_stats.goals          + p_delta_goals),
//       assists        = GREATEST(0, player_stats.assists        + p_delta_assists),
//       minutes_played = GREATEST(0, player_stats.minutes_played + p_delta_minutes),
//       yellow_cards   = GREATEST(0, player_stats.yellow_cards   + p_delta_yellow),
//       red_cards      = GREATEST(0, player_stats.red_cards      + p_delta_red),
//       appearances    = player_stats.appearances + CASE WHEN p_new_appearance THEN 1 ELSE 0 END,
//       updated_at     = now();
//   END;
//   $$;
//
// Una volta creata la funzione, savePlayerMatchStats userà automaticamente supabase.rpc()
// invece del pattern read-modify-write. L'upsert atomico è serializzato dal database.

export async function loadPlayerById(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("players")
    .select("id, data")
    .eq("team_id", teamId)
    .eq("id", playerId)
    .maybeSingle();

  if (error && import.meta.env.DEV) console.error("[playerProfile] loadPlayerById:", error.message);
  if (!data) return { data: null, error };

  return { data: { id: data.id, ...(data.data || {}) }, error };
}

export async function loadAllPlayerStats(teamId, season) {
  if (!isSupabaseConfigured || !teamId) return { data: {}, error: null };

  let query = supabase.from("player_stats").select("*").eq("team_id", teamId);
  if (season) query = query.eq("season", season);

  const { data, error } = await query;

  if (error) {
    if (import.meta.env.DEV) console.error("[playerProfile] loadAllPlayerStats:", error.message);
    return { data: {}, error };
  }

  const map = {};
  (data || []).forEach((row) => {
    map[String(row.player_id)] = row;
  });

  return { data: map, error: null };
}

export async function loadPlayerStats(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("player_stats")
    .select("*")
    .eq("team_id", teamId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error && import.meta.env.DEV) console.error("[playerProfile] loadPlayerStats:", error.message);
  return { data, error };
}

export async function loadPlayerMatches(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("player_matches")
    .select("*")
    .eq("team_id", teamId)
    .eq("player_id", playerId);

  if (error && import.meta.env.DEV) console.error("[playerProfile] loadPlayerMatches:", error.message);
  return { data: data || [], error };
}

export async function loadMatchStats(teamId, matchId) {
  if (!isSupabaseConfigured || !teamId || !matchId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("player_matches")
    .select("*")
    .eq("team_id", teamId)
    .eq("match_id", String(matchId));

  if (error && import.meta.env.DEV) console.error("[playerProfile] loadMatchStats:", error.message);
  return { data: data || [], error };
}

// FIX #4: savePlayerMatchStats ora usa la DB function increment_player_stats se disponibile,
// con fallback al read-modify-write originale (per ambienti senza la funzione SQL creata).
export async function savePlayerMatchStats(teamId, playerId, matchId, newStats, oldStats, season = "2025/2026") {
  if (!isSupabaseConfigured || !teamId || !playerId || !matchId) return { error: null };

  const pid = String(playerId);
  const mid = String(matchId);

  // 1. Salva/aggiorna player_matches
  const { error: matchError } = await supabase
    .from("player_matches")
    .upsert(
      { team_id: teamId, player_id: pid, match_id: mid, ...newStats },
      { onConflict: "team_id,player_id,match_id" }
    );

  if (matchError) {
    if (import.meta.env.DEV) console.error("[playerProfile] savePlayerMatchStats upsert:", matchError.message);
    return { error: matchError };
  }

  // 2. Calcola delta
  const prev = oldStats || {};
  const STAT_FIELDS = ["goals", "assists", "minutes_played", "yellow_cards", "red_cards"];
  const delta = {};
  for (const field of STAT_FIELDS) {
    delta[field] = (newStats[field] ?? 0) - (prev[field] ?? 0);
  }
  const isNew = !oldStats;

  // 3. Tenta prima la DB function atomica (FIX #4)
  const { error: rpcError } = await supabase.rpc("increment_player_stats", {
    p_team_id:         teamId,
    p_player_id:       pid,
    p_season:          season,
    p_delta_goals:     delta.goals,
    p_delta_assists:   delta.assists,
    p_delta_minutes:   delta.minutes_played,
    p_delta_yellow:    delta.yellow_cards,
    p_delta_red:       delta.red_cards,
    p_new_appearance:  isNew,
  });

  // 4. Fallback read-modify-write se la DB function non esiste ancora
  if (rpcError) {
    if (import.meta.env.DEV) {
      console.warn("[playerProfile] increment_player_stats RPC non disponibile, uso fallback:", rpcError.message);
    }
    return savePlayerMatchStatsFallback(teamId, pid, season, delta, isNew);
  }

  return { error: null };
}

// Fallback read-modify-write (NON atomico — da rimuovere dopo deploy SQL function)
async function savePlayerMatchStatsFallback(teamId, pid, season, delta, isNew) {
  const { data: currentStats } = await supabase
    .from("player_stats")
    .select("*")
    .eq("team_id", teamId)
    .eq("player_id", pid)
    .maybeSingle();

  const base = currentStats || {};
  const updated = {
    team_id:        teamId,
    player_id:      pid,
    season,
    goals:          Math.max(0, (base.goals          ?? 0) + delta.goals),
    assists:        Math.max(0, (base.assists         ?? 0) + delta.assists),
    minutes_played: Math.max(0, (base.minutes_played  ?? 0) + delta.minutes_played),
    yellow_cards:   Math.max(0, (base.yellow_cards    ?? 0) + delta.yellow_cards),
    red_cards:      Math.max(0, (base.red_cards       ?? 0) + delta.red_cards),
    appearances:    Math.max(0, (base.appearances     ?? 0) + (isNew ? 1 : 0)),
    updated_at:     new Date().toISOString(),
  };

  const { error: statsError } = await supabase
    .from("player_stats")
    .upsert(updated, { onConflict: "team_id,player_id,season" });

  if (statsError && import.meta.env.DEV) {
    console.error("[playerProfile] fallback stats:", statsError.message);
  }
  return { error: statsError };
}

export async function upsertPlayerMatch(teamId, playerId, matchId, fields) {
  if (!isSupabaseConfigured || !teamId || !playerId || !matchId) return { error: null };

  const { error } = await supabase
    .from("player_matches")
    .upsert(
      { team_id: teamId, player_id: String(playerId), match_id: String(matchId), ...fields },
      { onConflict: "team_id,player_id,match_id" }
    );

  if (error && import.meta.env.DEV) console.error("[playerProfile] upsertPlayerMatch:", error.message);
  return { error };
}
