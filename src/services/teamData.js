import {
  STORAGE_KEY,
  initialExercises,
  initialMatches,
  initialPhysicalTests,
  initialPlayers,
  initialSessions,
} from "../data/initialData";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { normalizeAppState } from "../utils/helpers";

const ENTITY_TABLES = {
  players: "players",
  exercises: "exercises",
  sessions: "sessions",
  matches: "matches",
  physicalTests: "physical_tests",
};

export function getInitialState() {
  return normalizeAppState({
    players: initialPlayers,
    exercises: initialExercises,
    sessions: initialSessions,
    matches: initialMatches,
    physicalTests: initialPhysicalTests,
  });
}

export function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return getInitialState();

    return normalizeAppState(JSON.parse(saved));
  } catch (error) {
    console.error("Errore caricamento dati locali:", error);
    return getInitialState();
  }
}

export function saveLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppState(state)));
}

export async function loadRemoteState({ teamId } = {}) {
  if (!isSupabaseConfigured || !teamId) {
    return { state: loadLocalState(), source: "local" };
  }

  return loadTeamTablesState(teamId);
}

export async function saveRemoteState(state, { teamId } = {}) {
  const normalizedState = normalizeAppState(state);
  saveLocalState(normalizedState);

  if (!isSupabaseConfigured || !teamId) {
    return { source: "local" };
  }

  return saveTeamTablesState(normalizedState, teamId);
}

async function loadTeamTablesState(teamId) {
  try {
    const entries = await Promise.all(
      Object.entries(ENTITY_TABLES).map(async ([stateKey, table]) => {
        const { data, error } = await supabase
          .from(table)
          .select("id, data")
          .eq("team_id", teamId);

        if (error) {
          throw error;
        }

        return [
          stateKey,
          (data || []).map((row) => ({
            id: row.id,
            ...(row.data || {}),
          })),
        ];
      })
    );

    const state = normalizeAppState(Object.fromEntries(entries));
    saveLocalState(state);

    return { state, source: "supabase" };
  } catch (error) {
    console.warn("Lettura tabelle Supabase fallita, uso localStorage:", error.message);
    return { state: loadLocalState(), source: "local", error };
  }
}

async function saveTeamTablesState(state, teamId) {
  try {
    await Promise.all(
      Object.entries(ENTITY_TABLES).map(([stateKey, table]) =>
        syncEntityTable(table, teamId, state[stateKey] || [])
      )
    );

    return { source: "supabase" };
  } catch (error) {
    console.warn("Sync tabelle Supabase fallita, mantenuto localStorage:", error.message);
    return { source: "local", error };
  }
}

async function syncEntityTable(table, teamId, records) {
  const rows = records.map((record) => ({
    id: String(record.id),
    team_id: teamId,
    data: record,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(rows);

    if (upsertError) {
      throw upsertError;
    }
  }

  const ids = rows.map((row) => row.id);
  let deleteQuery = supabase.from(table).delete().eq("team_id", teamId);

  if (ids.length > 0) {
    deleteQuery = deleteQuery.not("id", "in", `(${ids.map(escapeSupabaseListValue).join(",")})`);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    throw deleteError;
  }
}

function escapeSupabaseListValue(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}
