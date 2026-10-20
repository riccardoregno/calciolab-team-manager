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

/** @param {string} teamId
 * @param {string} playerId
 * @returns {Promise<{data: any[], error: any}>} */
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

/** @param {string} teamId
 * @param {string} season
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadAllPlayerStats(teamId, season) {
  if (!isSupabaseConfigured || !teamId) return { data: {}, error: null };

  let query = supabase
    .from("player_stats")
    .select("player_id, season, goals, assists, minutes_played, yellow_cards, red_cards, appearances, updated_at")
    .eq("team_id", teamId);
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

/** @param {string} teamId
 * @param {number} [lastN]
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadTeamRecentRatings(teamId, lastN = 5) {
  if (!isSupabaseConfigured || !teamId) return { data: {}, error: null };

  const { data, error } = await supabase
    .from("player_matches")
    .select("player_id, rating, matches(date)")
    .eq("team_id", teamId)
    .not("rating", "is", null)
    .limit(500);

  if (error) {
    if (import.meta.env.DEV) console.error("[playerProfile] loadTeamRecentRatings:", error.message);
    return { data: {}, error };
  }

  const grouped = {};
  (data || []).forEach((row) => {
    const r = parseFloat(row.rating);
    if (isNaN(r) || r <= 0) return;
    const key = String(row.player_id);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ rating: r, date: row.matches?.date || "" });
  });

  const map = {};
  Object.keys(grouped).forEach((key) => {
    map[key] = grouped[key]
      .sort((a, b) => (b.date > a.date ? 1 : -1))
      .slice(0, lastN)
      .map((x) => x.rating);
  });

  return { data: map, error: null };
}

/** @param {string} teamId
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadAllPlayerAvgRatings(teamId) {
  if (!isSupabaseConfigured || !teamId) return { data: {}, error: null };

  const { data, error } = await supabase
    .from("player_matches")
    .select("player_id, rating")
    .eq("team_id", teamId)
    .not("rating", "is", null)
    .limit(500);

  if (error) {
    if (import.meta.env.DEV) console.error("[playerProfile] loadAllPlayerAvgRatings:", error.message);
    return { data: {}, error };
  }

  const sums = {};
  const counts = {};
  (data || []).forEach(({ player_id, rating }) => {
    const r = parseFloat(rating);
    if (isNaN(r) || r <= 0) return;
    const key = String(player_id);
    sums[key] = (sums[key] || 0) + r;
    counts[key] = (counts[key] || 0) + 1;
  });

  const map = {};
  Object.keys(sums).forEach((key) => {
    map[key] = Math.round((sums[key] / counts[key]) * 10) / 10;
  });

  return { data: map, error: null };
}

/** @param {string} teamId
 * @param {string} playerId
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadPlayerStats(teamId, playerId) {
  if (!isSupabaseConfigured || !teamId || !playerId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("player_stats")
    .select("player_id, season, goals, assists, minutes_played, yellow_cards, red_cards, appearances, updated_at")
    .eq("team_id", teamId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error && import.meta.env.DEV) console.error("[playerProfile] loadPlayerStats:", error.message);
  return { data, error };
}

/** @param {string} teamId
 * @param {string[]} matchIds
 * @returns {Promise<{data: any[], error: any}>} */
async function readMatchRows(teamId, matchIds = null, playerId = null) {
  if (!isSupabaseConfigured || !teamId) return { data: [], error: null };
  const ids = matchIds === null ? null : [...new Set(matchIds.map(String).filter(Boolean))];
  if (ids?.length === 0) return { data: [], error: null };
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from("player_matches")
      .select("player_id, match_id, goals, assists, minutes_played, yellow_cards, red_cards, rating, goals_conceded")
      .eq("team_id", teamId);
    if (ids) query = query.in("match_id", ids);
    if (playerId !== null) query = query.eq("player_id", String(playerId));
    query = query.order("match_id");
    if (playerId === null) query = query.order("player_id");
    const { data, error } = await query
      .range(offset, offset + pageSize - 1);
    // An interrupted download must never masquerade as a complete season.
    if (error) return { data: [], error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

export async function loadPlayerMatchesForPeriod(teamId, matchIds) {
  return readMatchRows(teamId, matchIds || []);
}

/** @param {string} teamId
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadTeamPlayerMatches(teamId) {
  return readMatchRows(teamId);
}

/** @param {string} teamId
 * @param {string} playerId
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadPlayerMatches(teamId, playerId) {
  if (!playerId) return { data: [], error: null };
  return readMatchRows(teamId, null, playerId);
}

/** @param {string} teamId
 * @param {string} matchId
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadMatchStats(teamId, matchId) {
  return readMatchRows(teamId, matchId ? [matchId] : []);
}

/** @param {string} teamId
 * @param {string[]} matchIds
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadMatchStatsMatrix(teamId, matchIds = []) {
  return readMatchRows(teamId, matchIds);
}

// FIX #4: savePlayerMatchStats ora usa la DB function increment_player_stats se disponibile,
// con fallback al read-modify-write originale (per ambienti senza la funzione SQL creata).
/** @param {string} teamId
 * @param {string} playerId
 * @param {string} matchId
 * @param {object} newStats
 * @param {object} oldStats
 * @param {string} [season]
 * @returns {Promise<{data: any[], error: any}>} */
export async function savePlayerMatchStats(teamId, playerId, matchId, newStats, oldStats, season = "2025/2026") {
  if (!isSupabaseConfigured || !teamId || !playerId || !matchId) return { error: null };

  const pid = String(playerId);
  const mid = String(matchId);
  const matchStatsPayload = {
    goals:          newStats.goals ?? 0,
    assists:        newStats.assists ?? 0,
    minutes_played: newStats.minutes_played ?? 0,
    yellow_cards:   newStats.yellow_cards ?? 0,
    red_cards:      newStats.red_cards ?? 0,
    rating:         newStats.rating ?? null,
  };
  if (Object.hasOwn(newStats, "goals_conceded")) {
    matchStatsPayload.goals_conceded = newStats.goals_conceded;
  }

  // 1. Salva/aggiorna player_matches
  const { error: matchError } = await supabase
    .from("player_matches")
    .upsert(
      { team_id: teamId, player_id: pid, match_id: mid, ...matchStatsPayload },
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

  // player_matches è la fonte affidabile per le schermate di statistica.
  // L'aggregato player_stats accelera alcune viste, ma non deve bloccare
  // l'inserimento dei dati gara se la funzione RPC non è disponibile.
  if (rpcError) {
    if (import.meta.env.DEV) {
      console.error("[playerProfile] increment_player_stats RPC fallito:", rpcError.message);
    }
    return { error: null, aggregateError: rpcError };
  }

  return { error: null };
}

/** @param {string} teamId
 * @param {string} playerId
 * @param {string} matchId
 * @param {object} fields
 * @returns {Promise<{data: any[], error: any}>} */
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
