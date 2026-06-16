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
  players:       "players",
  exercises:     "exercises",
  sessions:      "sessions",
  matches:       "matches",
  physicalTests: "physical_tests",
  gpsSessions:   "gps_sessions",
  staffTasks:    "staff_tasks",
  injuryRecords: "injury_records",
};
const STORAGE_BACKUP_KEY = `${STORAGE_KEY}:backup`;
const EMPTY_ENTITY_INTENT_KEY = `${STORAGE_KEY}:empty-entities`;

// FIX #7: regex che ammette solo caratteri sicuri negli ID usati nelle query Supabase.
// Previene injection nella lista passata a .not("id","in", rawString).
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-.:]+$/;
const UUID_ID_TABLES = new Set(["players", "exercises"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getInitialState() {
  return normalizeAppState({
    players:       initialPlayers,
    exercises:     initialExercises,
    sessions:      initialSessions,
    matches:       initialMatches,
    physicalTests: initialPhysicalTests,
    gpsSessions:   [],
    staffTasks:    [],
    injuryRecords: [],
  });
}

export function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
    if (!saved) return backup ? normalizeAppState(JSON.parse(backup)) : getInitialState();

    const state = normalizeAppState(JSON.parse(saved));
    if (!backup) return state;

    const backupState = normalizeAppState(JSON.parse(backup));
    return recoverMissingLocalEntities(state, backupState, loadEmptyEntityIntents());
  } catch (error) {
    if (import.meta.env.DEV) console.error("Errore caricamento dati locali:", error);
    return getInitialState();
  }
}

// Last serialized state — flushed synchronously on pagehide
let _lastSerialized = null;

export function saveLocalState(state) {
  const normalized = normalizeAppState(state);
  const serialized  = JSON.stringify(normalized);
  _lastSerialized   = serialized;
  let previous = null;

  try {
    previous = localStorage.getItem(STORAGE_KEY);
    const previousState = parseStoredState(previous);
    if (previousState) updateEmptyEntityIntents(normalized, previousState);
  } catch {
    previous = null;
  }

  function write() {
    try {
      if (previous) {
        localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      }
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Errore salvataggio localStorage:", error);
    }
  }

  // Write during browser idle time when available — falls back to sync write.
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(write, { timeout: 2000 });
  } else {
    write();
  }
}

// Flush the latest state synchronously when the tab is about to be hidden/closed
// so we never lose a pending requestIdleCallback write.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (!_lastSerialized) return;
    try {
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== _lastSerialized) {
        localStorage.setItem(STORAGE_BACKUP_KEY, previous);
        const nextState = parseStoredState(_lastSerialized);
        const previousState = parseStoredState(previous);
        if (nextState && previousState) updateEmptyEntityIntents(nextState, previousState);
      }
      localStorage.setItem(STORAGE_KEY, _lastSerialized);
    } catch {
      // Best-effort on pagehide
    }
  });
}

export async function loadRemoteState({ teamId } = {}) {
  if (!isSupabaseConfigured || !teamId) {
    return { state: loadLocalState(), source: "local" };
  }
  return loadTeamTablesState(teamId);
}

// FIX #6: questa funzione è ora esportata e chiamata direttamente da useTeamData
// per il sync Supabase (debounced), separato dal saveLocalState (immediato).
export async function saveTeamTablesState(state, teamId) {
  try {
    const normalized = normalizeAppState(state);

    const entityResults = await Promise.allSettled(
      Object.entries(ENTITY_TABLES).map(async ([stateKey, table]) => {
        await syncEntityTable(table, teamId, normalized[stateKey] || [], {
          allowEmptyDelete: hasEmptyEntityIntent(stateKey),
        });
        return { key: stateKey, table };
      })
    );

    // Salva appSettings nella colonna `settings` e setPlays nella colonna `set_plays`.
    const settingsResults = await Promise.allSettled([
      syncAppSettings(teamId, normalized.appSettings || {}).then(() => ({ key: "appSettings", table: "teams.settings" })),
      syncSetPlays(teamId, normalized.setPlays || {}).then(() => ({ key: "setPlays", table: "teams.set_plays" })),
    ]);

    const failures = collectSyncFailures([...entityResults, ...settingsResults]);
    if (failures.length > 0) {
      const error = new Error(`Sync parziale: ${failures.map((failure) => failure.table).join(", ")}`);
      if (import.meta.env.DEV) {
        console.warn("[teamData] Sync parziale Supabase:", failures);
      }
      return { source: "partial", error, failures };
    }

    return { source: "supabase" };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Sync tabelle Supabase fallita, mantenuto localStorage:", error.message);
    }
    return { source: "local", error };
  }
}

// Kept for backward compatibility (chiamato da useTeamData v.precedente)
export async function saveRemoteState(state, { teamId } = {}) {
  const normalizedState = normalizeAppState(state);
  saveLocalState(normalizedState);

  if (!isSupabaseConfigured || !teamId) {
    return { source: "local" };
  }

  return saveTeamTablesState(normalizedState, teamId);
}

// ─── Sync appSettings su teams.settings ───────────────────────────────────
async function syncAppSettings(teamId, appSettings) {
  const { error } = await supabase
    .from("teams")
    .update({ settings: appSettings })
    .eq("id", teamId);

  if (error) throw error;
}

// ─── Sync setPlays su teams.set_plays ─────────────────────────────────────
// setPlays è un oggetto singolo per team (palle inattive), non un array di entità.
async function syncSetPlays(teamId, setPlays) {
  const { error } = await supabase
    .from("teams")
    .update({ set_plays: setPlays })
    .eq("id", teamId);

  if (error) throw error;
}

// ─── Load ──────────────────────────────────────────────────────────────────
async function loadTeamTablesState(teamId) {
  try {
    const tableResults = await Promise.allSettled(
      Object.entries(ENTITY_TABLES).map(async ([stateKey, table]) => {
        // FIX #2: seleziona anche updated_at per conflict detection futura
        const { data, error } = await supabase
          .from(table)
          .select("id, data, updated_at")
          .eq("team_id", teamId);

        if (error) throw error;

        return [
          stateKey,
          (data || []).map((row) => ({
            ...(row.data || {}),
            id: row.id,
            // Conserva _updatedAt per future conflict detection (non visibile all'utente)
            _updatedAt: row.updated_at,
          })),
        ];
      })
    );

    const successfulEntries = tableResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failures = collectSyncFailures(tableResults);

    if (successfulEntries.length === 0 && failures.length > 0) {
      throw new Error(`Lettura Supabase fallita: ${failures.map((failure) => failure.table).join(", ")}`);
    }

    // Carica appSettings e setPlays dalla colonna teams
    const { data: teamRow, error: teamRowError } = await supabase
      .from("teams")
      .select("settings, set_plays")
      .eq("id", teamId)
      .maybeSingle();

    if (teamRowError) {
      failures.push({ table: "teams.settings", error: teamRowError });
    }

    const localState = loadLocalState();
    const emptyIntents = loadEmptyEntityIntents();
    const remoteEntityState = Object.fromEntries(successfulEntries);
    const retainedLocalEntityKeys = [];
    const entityState = Object.fromEntries(
      Object.keys(ENTITY_TABLES).map((stateKey) => {
        const remoteRecords = remoteEntityState[stateKey];
        const localRecords = localState[stateKey] || [];

        if (!Array.isArray(remoteRecords)) {
          return [stateKey, localRecords];
        }

        // Protezione perdita dati: se Supabase risponde vuoto ma il browser ha dati,
        // non sovrascriviamo la sorgente locale. Succede facilmente dopo primo login,
        // cambio team o sync remoto non ancora completato.
        //
        // ECCEZIONE: se esiste un emptyEntityIntent per questa chiave, l'utente ha
        // intenzionalmente svuotato l'entità (es. cancellato l'ultima partita).
        // In quel caso rispettiamo il risultato remoto (vuoto = corretto) anche se
        // localStorage è ancora stale perché requestIdleCallback non ha ancora scritto.
        if (
          remoteRecords.length === 0 &&
          hasUserLocalRecords(stateKey, localRecords) &&
          !emptyIntents[stateKey]
        ) {
          retainedLocalEntityKeys.push(stateKey);
          return [stateKey, localRecords];
        }

        return [stateKey, remoteRecords];
      })
    );
    const state = normalizeAppState({
      ...entityState,
      // Usa settings remoti solo se contengono dati reali. Un JSONB vuoto ({})
      // non deve cancellare profilo societa', logo e campi salvati in locale.
      appSettings: resolveAppSettings(teamRow?.settings, localState.appSettings),
      // setPlays: preferisce remoto se presente, altrimenti locale (stessa logica di appSettings)
      setPlays: resolveSetPlays(teamRow?.set_plays, localState.setPlays),
    });

    saveLocalState(state);
    const hasPendingUpload = failures.length === 0 && retainedLocalEntityKeys.length > 0;

    return {
      state,
      source: failures.length > 0 ? "partial" : hasPendingUpload ? "pending-upload" : "supabase",
      error: failures.length > 0
        ? new Error(`Sync parziale: ${failures.map((failure) => failure.table).join(", ")}`)
        : null,
      failures,
      pendingUpload: hasPendingUpload,
      retainedLocalEntityKeys,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Lettura tabelle Supabase fallita, uso localStorage:", error.message);
    }
    return { state: loadLocalState(), source: "local", error };
  }
}

function hasUserLocalRecords(stateKey, records = []) {
  if (!Array.isArray(records) || records.length === 0) return false;

  // Players: initialPlayers is now empty, so any record counts as user data.
  if (stateKey === "players") {
    return records.length > 0;
  }

  if (stateKey === "exercises") {
    const initialIds = new Set(initialExercises.map((item) => item.id));
    return records.some((record) => !initialIds.has(record.id));
  }

  return records.length > 0;
}

function recoverMissingLocalEntities(state, backupState, emptyIntents = {}) {
  const appSettings = recoverMissingAppSettings(state.appSettings, backupState.appSettings);

  return normalizeAppState({
    ...state,
    appSettings,
    ...Object.fromEntries(
      Object.keys(ENTITY_TABLES).map((stateKey) => {
        const currentRecords = state[stateKey] || [];
        const backupRecords = backupState[stateKey] || [];
        if (emptyIntents[stateKey]) {
          return [stateKey, currentRecords];
        }
        if (currentRecords.length === 0 && hasUserLocalRecords(stateKey, backupRecords)) {
          return [stateKey, backupRecords];
        }
        return [stateKey, currentRecords];
      })
    ),
  });
}

function resolveAppSettings(remoteSettings = {}, localSettings = {}) {
  if (!hasMeaningfulAppSettings(remoteSettings)) {
    return localSettings || remoteSettings || {};
  }

  return mergeAppSettings(remoteSettings, localSettings);
}

// setPlays è un oggetto semplice: preferisce il remoto se non è vuoto,
// altrimenti usa il locale. Nessun merge complesso — l'ultimo salvataggio vince.
function resolveSetPlays(remoteSetPlays, localSetPlays) {
  const remote = remoteSetPlays && typeof remoteSetPlays === "object" ? remoteSetPlays : {};
  const local  = localSetPlays  && typeof localSetPlays  === "object" ? localSetPlays  : {};
  // Il remoto è "significativo" se ha almeno una chiave con valori non vuoti
  const hasRemoteData = Object.values(remote).some(
    (v) => v && typeof v === "object" && Object.values(v).some((s) => s !== "")
  );
  return hasRemoteData ? remote : (Object.keys(local).length > 0 ? local : remote);
}

function collectSyncFailures(results) {
  return results
    .map((result, index) => {
      if (result.status === "fulfilled") return null;
      const tableEntry = Object.entries(ENTITY_TABLES)[index];
      const table = tableEntry?.[1] || (index === Object.keys(ENTITY_TABLES).length ? "teams.settings" : "teams.set_plays");
      return {
        table,
        message: result.reason?.message || String(result.reason || "Errore sconosciuto"),
      };
    })
    .filter(Boolean);
}

function recoverMissingAppSettings(currentSettings = {}, backupSettings = {}) {
  if (!hasMeaningfulAppSettings(currentSettings) && hasMeaningfulAppSettings(backupSettings)) {
    return backupSettings;
  }

  if (hasMeaningfulAppSettings(backupSettings)) {
    return mergeAppSettings(currentSettings, backupSettings);
  }

  if (
    !hasMeaningfulWorkspaceProfile(currentSettings.workspaceProfile) &&
    hasMeaningfulWorkspaceProfile(backupSettings.workspaceProfile)
  ) {
    return {
      ...backupSettings,
      ...currentSettings,
      workspaceProfile: backupSettings.workspaceProfile,
    };
  }

  return currentSettings;
}

function mergeAppSettings(remoteSettings = {}, localSettings = {}) {
  return {
    ...localSettings,
    ...remoteSettings,
    subscription: mergeSubscriptionSettings(remoteSettings.subscription || {}, localSettings.subscription || {}),
    developmentPreviewPlan: remoteSettings.developmentPreviewPlan || localSettings.developmentPreviewPlan || "",
    developmentPreviewRole: remoteSettings.developmentPreviewRole || localSettings.developmentPreviewRole || "",
    members: hasArrayItems(remoteSettings.members) ? remoteSettings.members : localSettings.members,
    // FIX: con `hasArrayItems`, un remote con pendingInvites = [] (es. invito
    // appena accettato lato Edge Function, che svuota l'array) veniva scartato
    // a favore della cache locale stantia — facendo ricomparire come "in
    // attesa" inviti già accettati. A questo punto mergeAppSettings viene
    // chiamata solo quando il remote è "meaningful" (vedi resolveAppSettings),
    // quindi un array remoto presente — anche vuoto — è lo stato vero e va
    // rispettato; il fallback al locale resta solo per remote senza la chiave.
    pendingInvites: Array.isArray(remoteSettings.pendingInvites) ? remoteSettings.pendingInvites : localSettings.pendingInvites,
    workspaceProfile: mergeWorkspaceProfile(
      remoteSettings.workspaceProfile || {},
      localSettings.workspaceProfile || {}
    ),
  };
}

function mergeWorkspaceProfile(remoteProfile = {}, localProfile = {}) {
  const merged = { ...localProfile, ...remoteProfile };
  const fieldsToProtect = [
    "clubName",
    "teamName",
    "logo",
    "homeFieldName",
    "homeFieldAddress",
    "seasonGoal",
    "currentSeason",
  ];

  fieldsToProtect.forEach((field) => {
    if (isDefaultProfileValue(field, remoteProfile[field]) && !isDefaultProfileValue(field, localProfile[field])) {
      merged[field] = localProfile[field];
    }
  });

  if (
    isDefaultProfileValue("homeFieldSurface", remoteProfile.homeFieldSurface) &&
    !isDefaultProfileValue("homeFieldSurface", localProfile.homeFieldSurface)
  ) {
    merged.homeFieldSurface = localProfile.homeFieldSurface;
  }

  if (!remoteProfile.logoSize && localProfile.logoSize) {
    merged.logoSize = localProfile.logoSize;
  }

  return merged;
}

function hasMeaningfulAppSettings(settings = {}) {
  if (!settings || typeof settings !== "object") return false;
  if (hasMeaningfulWorkspaceProfile(settings.workspaceProfile)) return true;
  if (hasArrayItems(settings.members)) return true;
  if (hasActiveSubscription(settings.subscription)) return true;
  return Object.keys(settings).some((key) => {
    if (["workspaceProfile", "subscription"].includes(key)) return false;
    const value = settings[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return !isEmptyProfileValue(value);
  });
}

function hasMeaningfulWorkspaceProfile(profile = {}) {
  if (!profile || typeof profile !== "object") return false;

  return [
    profile.clubName && profile.clubName !== "CalcioLab",
    profile.teamName,
    profile.logo,
    profile.homeFieldName,
    profile.homeFieldAddress,
    profile.seasonGoal,
    profile.currentSeason && profile.currentSeason !== "2025/2026",
    profile.category && profile.category !== "Prima squadra",
    profile.homeFieldSurface && profile.homeFieldSurface !== "Erba naturale",
  ].some(Boolean);
}

function isEmptyProfileValue(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function isDefaultProfileValue(field, value) {
  if (isEmptyProfileValue(value)) return true;

  const defaults = {
    clubName: "CalcioLab",
    currentSeason: "2025/2026",
    category: "Prima squadra",
    homeFieldSurface: "Erba naturale",
  };

  return defaults[field] ? String(value).trim() === defaults[field] : false;
}

function mergeSubscriptionSettings(remoteSubscription = {}, localSubscription = {}) {
  const remoteIsActive = hasActiveSubscription(remoteSubscription);
  const localIsActive = hasActiveSubscription(localSubscription);

  if (!remoteIsActive && localIsActive) {
    return {
      ...remoteSubscription,
      ...localSubscription,
    };
  }

  return {
    ...localSubscription,
    ...remoteSubscription,
  };
}

function hasActiveSubscription(subscription = {}) {
  if (!subscription || typeof subscription !== "object") return false;
  const status = subscription.billingStatus || subscription.billing_status || "";
  const plan = subscription.plan || subscription.subscription_plan || "";
  return ["active", "trialing"].includes(status) && plan && plan !== "free";
}

function hasArrayItems(value) {
  return Array.isArray(value) && value.length > 0;
}

// ─── Sync singola tabella ──────────────────────────────────────────────────
async function syncEntityTable(table, teamId, records, { allowEmptyDelete = false } = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    if (allowEmptyDelete) {
      const { error } = await supabase.from(table).delete().eq("team_id", teamId);
      if (error) throw error;
      return;
    }

    if (import.meta.env.DEV) {
      console.warn(`[teamData] Delete remoto vuoto bloccato per ${table}: nessun record locale da sincronizzare.`);
    }
    return;
  }

  const rows = records
    .map((record) => {
      const id = String(record.id);
      const dbId = normalizeRecordIdForTable(table, id);

      // FIX #7: valida ID prima di usarlo nella query delete.
      // ID non validi vengono skippati con warning in dev.
      if (!dbId || !SAFE_ID_REGEX.test(dbId)) {
        if (import.meta.env.DEV) {
          console.warn(`[teamData] ID non sicuro skippato in ${table}: "${id}"`);
        }
        return null;
      }

      const data = dbId === id ? record : { ...record, id: dbId };

      return {
        id:         dbId,
        team_id:    teamId,
        data,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean); // rimuove i null (ID non validi)

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(rows);
    if (upsertError) throw upsertError;
  }

  if (rows.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(`[teamData] Delete remoto bloccato per ${table}: nessun ID valido dopo la normalizzazione.`);
    }
    return;
  }

  // FIX #7: usa solo ID validati nella lista delete per evitare injection PostgREST
  const safeIds = rows.map((row) => row.id).filter((id) => SAFE_ID_REGEX.test(id));
  let deleteQuery = supabase.from(table).delete().eq("team_id", teamId);

  if (safeIds.length > 0) {
    deleteQuery = deleteQuery.not("id", "in", `(${safeIds.map(escapeSupabaseListValue).join(",")})`);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
}

function loadEmptyEntityIntents() {
  if (typeof localStorage === "undefined") return {};

  try {
    const parsed = JSON.parse(localStorage.getItem(EMPTY_ENTITY_INTENT_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveEmptyEntityIntents(intents) {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(EMPTY_ENTITY_INTENT_KEY, JSON.stringify(intents));
  } catch {
    /* best-effort local marker */
  }
}

function parseStoredState(serialized) {
  if (!serialized) return null;

  try {
    return normalizeAppState(JSON.parse(serialized));
  } catch {
    return null;
  }
}

function hasEmptyEntityIntent(stateKey) {
  return Boolean(loadEmptyEntityIntents()[stateKey]);
}

function updateEmptyEntityIntents(nextState, previousState) {
  const intents = loadEmptyEntityIntents();
  let changed = false;

  Object.keys(ENTITY_TABLES).forEach((stateKey) => {
    const nextRecords = nextState[stateKey] || [];
    const previousRecords = previousState[stateKey] || [];
    const shouldMarkEmpty =
      nextRecords.length === 0 &&
      hasUserLocalRecords(stateKey, previousRecords);

    if (shouldMarkEmpty && !intents[stateKey]) {
      intents[stateKey] = new Date().toISOString();
      changed = true;
    }

    if (nextRecords.length > 0 && intents[stateKey]) {
      delete intents[stateKey];
      changed = true;
    }
  });

  if (changed) saveEmptyEntityIntents(intents);
}

// FIX #7: funzione di escape più sicura — lancia eccezione se l'ID non supera la regex.
// La regex è già applicata prima di arrivare qui, ma aggiungiamo il guard come doppia protezione.
function escapeSupabaseListValue(value) {
  const s = String(value);
  if (!SAFE_ID_REGEX.test(s)) throw new Error(`[teamData] ID non sicuro: "${s}"`);
  return `"${s}"`;
}

function normalizeRecordIdForTable(table, id) {
  const value = String(id || "");
  if (!UUID_ID_TABLES.has(table)) return value;
  if (UUID_REGEX.test(value)) return value;

  const uuidSuffix = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)?.[0];
  // Return null for UUID-table rows with non-recoverable IDs — caller filters them
  // out rather than sending a non-UUID value that would crash the whole upsert.
  return uuidSuffix && UUID_REGEX.test(uuidSuffix) ? uuidSuffix : null;
}
