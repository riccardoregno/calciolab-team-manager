import { strToU8, strFromU8, zlibSync, unzlibSync } from "fflate";
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
import { sameSyncData } from "../utils/syncHelpers";

const ENTITY_TABLES = {
  players:       "players",
  exercises:     "exercises",
  sessions:      "sessions",
  matches:       "matches",
  physicalTests: "physical_tests",
  gpsSessions:   "gps_sessions",
  staffTasks:    "staff_tasks",
  injuryRecords: "injury_records",
  seasonPlayers: "team_season_players",
};
function storageKeys(teamId) {
  const primary = teamId ? STORAGE_KEY + ":team:" + encodeURIComponent(teamId) : STORAGE_KEY;
  return { primary, backup: primary + ":backup", emptyIntent: primary + ":empty-entities" };
}

// FIX #7: regex che ammette solo caratteri sicuri negli ID usati nelle query Supabase.
// Previene injection nella lista passata a .not("id","in", rawString).
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-.:]+$/;
const UUID_ID_TABLES = new Set(["players", "exercises"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @returns {object} */
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

/** @returns {object} */
export function loadLocalState(teamId) {
  const { primary, backup } = storageKeys(teamId);
  const fallback = () => teamId
    ? normalizeAppState(Object.fromEntries(Object.keys(ENTITY_TABLES).map((key) => [key, []])))
    : getInitialState();
  try {
    const state = parseStoredState(localStorage.getItem(primary));
    const backupState = parseStoredState(localStorage.getItem(backup));
    if (!state) return backupState || fallback();
    if (!backupState) return state;
    return recoverMissingLocalEntities(state, backupState, loadEmptyEntityIntents(teamId));
  } catch (error) {
    if (import.meta.env.DEV) console.error("Errore caricamento dati locali:", error);
    return fallback();
  }
}

const COMPRESSED_PREFIX = "calciolab:zlib:v1:";
const COMPRESS_AT = 128 * 1024;

function compactSnapshot(json) {
  if (json.startsWith(COMPRESSED_PREFIX)) return json;
  const bytes = zlibSync(strToU8(json), { level: 1 });
  const packed = COMPRESSED_PREFIX + btoa(strFromU8(bytes, true));
  return packed.length < json.length ? packed : json;
}

export function saveLocalState(state, teamId) {
  const { primary, backup } = storageKeys(teamId);
  const normalized = normalizeAppState(state);
  const json = JSON.stringify(normalized);
  let serialized = json.length >= COMPRESS_AT ? compactSnapshot(json) : json;
  let previous = null;

  try {
    previous = localStorage.getItem(primary);
    const previousState = parseStoredState(previous);
    if (previousState) updateEmptyEntityIntents(normalized, previousState, teamId);
  } catch { /* The write below reports storage access failures. */ }

  try {
    localStorage.setItem(primary, serialized);
  } catch {
    try {
      serialized = compactSnapshot(json);
      localStorage.setItem(primary, serialized);
    } catch {
      try {
        // Preserve the primary if both attempts fail. The old backup is expendable.
        localStorage.removeItem(backup);
        localStorage.setItem(primary, serialized);
      } catch (error) {
        if (import.meta.env.DEV) console.error("Errore salvataggio localStorage:", error);
        return { saved: false, error };
      }
    }
  }

  if (previous && previous !== serialized) {
    try {
      localStorage.setItem(backup, previous.length >= COMPRESS_AT ? compactSnapshot(previous) : previous);
    } catch {
      try { localStorage.removeItem(backup); } catch { /* The primary was saved. */ }
    }
  }
  return { saved: true, error: null };
}

/** @param {{ teamId?: string }} [params]
 * @returns {Promise<{data: any[], error: any}>} */
export async function loadRemoteState({ teamId, entityKeys } = {}) {
  if (!isSupabaseConfigured || !teamId) {
    return { state: loadLocalState(teamId), source: "local" };
  }
  return loadTeamTablesState(teamId, { entityKeys });
}

// FIX #6: questa funzione è ora esportata e chiamata direttamente da useTeamData
// per il sync Supabase (debounced), separato dal saveLocalState (immediato).
/** @param {object} state
 * @param {string} teamId
 * @returns {Promise<{data: any[], error: any}>} */
export async function saveTeamTablesState(state, teamId, { keys, entityChanges } = {}) {
  try {
    const normalized = normalizeAppState(state);
    const selectedKeys = Array.isArray(keys) && keys.length > 0 ? new Set(keys) : null;
    const shouldSyncKey = (key) => !selectedKeys || selectedKeys.has(key);

    const writes = new Map();
    for (const [stateKey, table] of Object.entries(ENTITY_TABLES).filter(([key]) => shouldSyncKey(key))) {
      const playerWrite = stateKey === "seasonPlayers" ? writes.get("players") : null;
      const job = (async () => {
        try {
          // An imported/new identity must exist before its seasonal membership.
          if (playerWrite) await playerWrite;
          const versions = await syncEntityTable(table, teamId, normalized[stateKey] || [], {
            allowEmptyDelete: hasEmptyEntityIntent(stateKey, teamId), changes: entityChanges?.[stateKey],
          });
          return { key: stateKey, table, versions };
        } catch (error) {
          const failure = new Error(error.message); failure._syncTable = table;
          throw failure;
        }
      })();
      writes.set(stateKey,job);
    }
    const entityResults = await Promise.allSettled([...writes.values()]);

    // Salva appSettings nella colonna `settings` e setPlays nella colonna `set_plays`.
    const settingsSyncs = [];
    if (shouldSyncKey("appSettings")) {
      settingsSyncs.push(syncAppSettings(teamId, normalized.appSettings || {})
        .then(() => ({ key: "appSettings", table: "teams.settings" }))
        .catch((error) => {
          error._syncTable = "teams.settings";
          throw error;
        }));
    }
    if (shouldSyncKey("setPlays")) {
      settingsSyncs.push(syncSetPlays(teamId, normalized.setPlays || {})
        .then(() => ({ key: "setPlays", table: "teams.set_plays" }))
        .catch((error) => {
          error._syncTable = "teams.set_plays";
          throw error;
        }));
    }
    const settingsResults = await Promise.allSettled(settingsSyncs);

    const settled = [...entityResults, ...settingsResults];
    const versions = Object.fromEntries(entityResults.flatMap(({ value }) =>
      value?.versions ? [[value.key, value.versions]] : []));
    const savedKeys = settled.filter((result) => result.status === "fulfilled").map(({ value }) => value.key);
    const failures = collectSyncFailures(settled);
    if (failures.length > 0) {
      const error = new Error(`Sync parziale: ${failures.map((failure) => failure.table).join(", ")}`);
      if (import.meta.env.DEV) {
        console.warn("[teamData] Sync parziale Supabase:", failures);
      }
      return { source: "partial", error, failures, versions, savedKeys };
    }

    return { source: "supabase", versions, savedKeys };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Sync tabelle Supabase fallita, mantenuto localStorage:", error.message);
    }
    return { source: "local", error };
  }
}

// Kept for backward compatibility (chiamato da useTeamData v.precedente)
/** @param {object} state
 * @param {{ teamId?: string }} [params]
 * @returns {Promise<{data: any[], error: any}>} */
export async function saveRemoteState(state, { teamId } = {}) {
  const normalizedState = normalizeAppState(state);
  saveLocalState(normalizedState, teamId);

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
async function loadTeamTablesState(teamId, { entityKeys } = {}) {
  try {
    const selectedEntityEntries = Array.isArray(entityKeys) && entityKeys.length > 0
      ? Object.entries(ENTITY_TABLES).filter(([stateKey]) => entityKeys.includes(stateKey))
      : Object.entries(ENTITY_TABLES);

    const tableResults = await Promise.allSettled(
      selectedEntityEntries.map(async ([stateKey, table]) => {
        const data = [];
        const pageSize = 500;
        let cursor;
        for (;;) {
          let query = supabase.from(table).select("id, data, updated_at")
            .eq("team_id", teamId).order("id").limit(pageSize);
          if (cursor !== undefined) query = query.gt("id", cursor);
          const { data: page, error } = await query;
          if (error) {
            // Older installations keep the legacy model until the additive migration is installed.
            if (stateKey === "seasonPlayers" && ["42P01", "PGRST205"].includes(error.code)) return [stateKey, []];
            error._syncTable = table;
            throw error;
          }
          data.push(...page);
          if (page.length < pageSize) break;
          cursor = page.at(-1).id;
        }

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

    // Carica appSettings e setPlays dalla colonna teams solo nei full refresh
    // o quando una di queste sezioni serve davvero.
    const shouldLoadTeamSettings =
      !Array.isArray(entityKeys) ||
      entityKeys.includes("appSettings") ||
      entityKeys.includes("setPlays");
    let teamRow = null;
    let teamRowError = null;
    if (shouldLoadTeamSettings) {
      const teamResult = await supabase
        .from("teams")
        .select("settings, set_plays")
        .eq("id", teamId)
        .maybeSingle();
      teamRow = teamResult.data;
      teamRowError = teamResult.error;
    }

    if (teamRowError) {
      failures.push({ table: "teams.settings", error: teamRowError });
    }

    const localState = loadLocalState(teamId);
    const emptyIntents = loadEmptyEntityIntents(teamId);
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
      appSettings: shouldLoadTeamSettings ? resolveAppSettings(teamRow?.settings, localState.appSettings) : localState.appSettings,
      // setPlays: preferisce remoto se presente, altrimenti locale (stessa logica di appSettings)
      setPlays: shouldLoadTeamSettings ? resolveSetPlays(teamRow?.set_plays, localState.setPlays) : localState.setPlays,
    });

    // The caller persists only after accepting this result. A stale or partial
    // read used during sync must not overwrite unsaved local edits.
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
    return { state: loadLocalState(teamId), source: "local", error };
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
      const table = result.reason?._syncTable || tableEntry?.[1] || (index === Object.keys(ENTITY_TABLES).length ? "teams.settings" : "teams.set_plays");
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
async function syncEntityTable(table, teamId, records, { allowEmptyDelete = false, changes } = {}) {
  if (changes) {
    return syncEntityChanges(table, teamId, changes);
  }

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

      const { _updatedAt: _ignoredUpdatedAt, ...recordData } = record;
      void _ignoredUpdatedAt;
      const data = dbId === id ? recordData : { ...recordData, id: dbId };

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

  // Un salvataggio completo viene usato solo per bootstrap/ripristino e non
  // implica più che tutto ciò che manca localmente debba essere cancellato.
  // Le cancellazioni ordinarie passano da syncEntityChanges con ID espliciti.
}

async function syncEntityChanges(table, teamId, { changedOrAdded = [], deleted = [] } = {}) {
  const versions = new Map();
  for (const record of changedOrAdded) {
    const originalId = String(record?.id || "");
    const id = normalizeRecordIdForTable(table, originalId);
    if (!id || !SAFE_ID_REGEX.test(id)) throw new Error(`ID non valido per ${table}`);

    const { _updatedAt, ...recordData } = record;
    const data = id === originalId ? recordData : { ...recordData, id };
    const updatedAt = new Date().toISOString();
    const row = { id, team_id: teamId, data, updated_at: updatedAt };

    if (_updatedAt) {
      const { data: updated, error } = await supabase
        .from(table)
        .update({ data: row.data, updated_at: row.updated_at })
        .eq("team_id", teamId)
        .eq("id", id)
        .eq("updated_at", _updatedAt)
        .select("updated_at");
      if (error) throw error;
      const version = updated?.[0]?.updated_at ?? await acknowledgeRepeatedWrite(table, teamId, id, data);
      versions.set(originalId, version);
    } else {
      const { data: inserted, error } = await supabase.from(table).insert(row).select("updated_at").single();
      if (error) {
        if (error.code === "23505") {
          versions.set(originalId, await acknowledgeRepeatedWrite(table, teamId, id, data));
          continue;
        }
        throw error;
      }
      versions.set(originalId, inserted.updated_at);
    }
  }

  for (const deletedRecord of deleted) {
    const id = normalizeRecordIdForTable(table, String(deletedRecord?.id || ""));
    if (!id || !SAFE_ID_REGEX.test(id)) throw new Error(`ID non valido per ${table}`);
    let query = supabase.from(table).delete().eq("team_id", teamId).eq("id", id);
    if (deletedRecord?._updatedAt) query = query.eq("updated_at", deletedRecord._updatedAt);
    const { data: removed, error } = await query.select("id");
    if (error) throw error;
    if (deletedRecord?._updatedAt && !removed?.length) {
      throw new Error(`Conflitto di sincronizzazione su ${table}:${id}`);
    }
  }
  return versions;
}

async function acknowledgeRepeatedWrite(table, teamId, id, data) {
  const { data: remote, error } = await supabase
    .from(table)
    .select("data, updated_at")
    .eq("team_id", teamId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const expected = JSON.parse(JSON.stringify(data));
  if (remote?.updated_at && sameSyncData(remote.data, expected)) return remote.updated_at;
  throw new Error(`Conflitto di sincronizzazione su ${table}:${id}`);
}

function loadEmptyEntityIntents(teamId) {
  if (typeof localStorage === "undefined") return {};

  try {
    const parsed = JSON.parse(localStorage.getItem(storageKeys(teamId).emptyIntent) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveEmptyEntityIntents(intents, teamId) {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(storageKeys(teamId).emptyIntent, JSON.stringify(intents));
  } catch {
    /* best-effort local marker */
  }
}

function parseStoredState(serialized) {
  if (!serialized) return null;

  try {
    const json = serialized.startsWith(COMPRESSED_PREFIX)
      ? strFromU8(unzlibSync(strToU8(atob(serialized.slice(COMPRESSED_PREFIX.length)), true)))
      : serialized;
    return normalizeAppState(JSON.parse(json));
  } catch {
    return null;
  }
}

function hasEmptyEntityIntent(stateKey, teamId) {
  return Boolean(loadEmptyEntityIntents(teamId)[stateKey]);
}

function updateEmptyEntityIntents(nextState, previousState, teamId) {
  const intents = loadEmptyEntityIntents(teamId);
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

  if (changed) saveEmptyEntityIntents(intents, teamId);
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
