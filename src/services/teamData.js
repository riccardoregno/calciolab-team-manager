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
};
const STORAGE_BACKUP_KEY = `${STORAGE_KEY}:backup`;

// FIX #7: regex che ammette solo caratteri sicuri negli ID usati nelle query Supabase.
// Previene injection nella lista passata a .not("id","in", rawString).
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-.:]+$/;

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
    return recoverMissingLocalEntities(state, backupState);
  } catch (error) {
    if (import.meta.env.DEV) console.error("Errore caricamento dati locali:", error);
    return getInitialState();
  }
}

export function saveLocalState(state) {
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      localStorage.setItem(STORAGE_BACKUP_KEY, previous);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppState(state)));
  } catch (error) {
    if (import.meta.env.DEV) console.error("Errore salvataggio localStorage:", error);
  }
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

    await Promise.all(
      Object.entries(ENTITY_TABLES).map(([stateKey, table]) =>
        syncEntityTable(table, teamId, normalized[stateKey] || [])
      )
    );

    // FIX #3: salva appSettings nella colonna `settings` della tabella teams.
    // Richiede che la colonna esista: ALTER TABLE teams ADD COLUMN IF NOT EXISTS settings JSONB;
    // Se la colonna non esiste, l'update fallisce silenziosamente (try/catch sopra).
    await syncAppSettings(teamId, normalized.appSettings || {});

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

// ─── FIX #3: sync appSettings su teams.settings ───────────────────────────
async function syncAppSettings(teamId, appSettings) {
  // Tenta di salvare settings nella tabella teams.
  // Fallisce silenziosamente se la colonna `settings` non è stata ancora creata.
  const { error } = await supabase
    .from("teams")
    .update({ settings: appSettings })
    .eq("id", teamId);

  if (error && import.meta.env.DEV) {
    console.warn("[teamData] syncAppSettings fallita (colonna settings mancante?):", error.message);
  }
}

// ─── Load ──────────────────────────────────────────────────────────────────
async function loadTeamTablesState(teamId) {
  try {
    const entries = await Promise.all(
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

    // FIX #3: carica appSettings dalla colonna teams.settings
    const { data: teamRow } = await supabase
      .from("teams")
      .select("settings")
      .eq("id", teamId)
      .maybeSingle();

    const localState = loadLocalState();
    const remoteEntityState = Object.fromEntries(entries);
    const entityState = Object.fromEntries(
      Object.keys(ENTITY_TABLES).map((stateKey) => {
        const remoteRecords = remoteEntityState[stateKey] || [];
        const localRecords = localState[stateKey] || [];

        // Protezione perdita dati: se Supabase risponde vuoto ma il browser ha dati,
        // non sovrascriviamo la sorgente locale. Succede facilmente dopo primo login,
        // cambio team o sync remoto non ancora completato.
        if (remoteRecords.length === 0 && hasUserLocalRecords(stateKey, localRecords)) {
          return [stateKey, localRecords];
        }

        return [stateKey, remoteRecords];
      })
    );
    const state = normalizeAppState({
      ...entityState,
      // GPS & Load resta local-first finché non esiste una tabella Supabase dedicata.
      gpsSessions:   localState.gpsSessions   || [],
      // Azioni staff local-first finché non esiste una tabella Supabase dedicata.
      staffTasks:    localState.staffTasks    || [],
      // Infortuni restano local-first finché non esiste una tabella Supabase dedicata.
      injuryRecords: localState.injuryRecords || [],
      // Usa settings remoti solo se contengono dati reali. Un JSONB vuoto ({})
      // non deve cancellare profilo societa', logo e campi salvati in locale.
      appSettings: resolveAppSettings(teamRow?.settings, localState.appSettings),
    });

    saveLocalState(state);
    return { state, source: "supabase" };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Lettura tabelle Supabase fallita, uso localStorage:", error.message);
    }
    return { state: loadLocalState(), source: "local", error };
  }
}

function hasUserLocalRecords(stateKey, records = []) {
  if (!Array.isArray(records) || records.length === 0) return false;

  if (stateKey === "players") {
    return records.some((record) => record.id !== "player-initial-1");
  }

  if (stateKey === "exercises") {
    const initialIds = new Set(initialExercises.map((item) => item.id));
    return records.some((record) => !initialIds.has(record.id));
  }

  return records.length > 0;
}

function recoverMissingLocalEntities(state, backupState) {
  const appSettings = recoverMissingAppSettings(state.appSettings, backupState.appSettings);

  return normalizeAppState({
    ...state,
    appSettings,
    ...Object.fromEntries(
      Object.keys(ENTITY_TABLES).map((stateKey) => {
        const currentRecords = state[stateKey] || [];
        const backupRecords = backupState[stateKey] || [];
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
    promoCodes: mergePromoCodeSettings(remoteSettings.promoCodes || [], localSettings.promoCodes || []),
    redeemedPromo: pickRedeemedPromo(remoteSettings.redeemedPromo, localSettings.redeemedPromo),
    developmentPreviewPlan: remoteSettings.developmentPreviewPlan || localSettings.developmentPreviewPlan || "",
    developmentPreviewRole: remoteSettings.developmentPreviewRole || localSettings.developmentPreviewRole || "",
    members: hasArrayItems(remoteSettings.members) ? remoteSettings.members : localSettings.members,
    pendingInvites: hasArrayItems(remoteSettings.pendingInvites) ? remoteSettings.pendingInvites : localSettings.pendingInvites,
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
  if (hasMeaningfulPromoCodes(settings.promoCodes)) return true;
  if (hasActiveSubscription(settings.subscription)) return true;
  if (settings.redeemedPromo) return true;
  return Object.keys(settings).some((key) => {
    if (["workspaceProfile", "promoCodes", "subscription", "redeemedPromo"].includes(key)) return false;
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

function pickRedeemedPromo(remotePromo, localPromo) {
  if (isValidRedeemedPromo(remotePromo)) return remotePromo;
  if (isValidRedeemedPromo(localPromo)) return localPromo;
  return remotePromo || localPromo || null;
}

function isValidRedeemedPromo(promo) {
  if (!promo || typeof promo !== "object") return false;
  if (!promo.code || !promo.plan) return false;
  if (promo.permanent === true) return true;
  if (!promo.expiresAt) return false;
  return new Date(promo.expiresAt).getTime() > Date.now();
}

function hasActiveSubscription(subscription = {}) {
  if (!subscription || typeof subscription !== "object") return false;
  const status = subscription.billingStatus || subscription.billing_status || "";
  const plan = subscription.plan || subscription.subscription_plan || "";
  return ["active", "trialing"].includes(status) && plan && plan !== "free";
}

function mergePromoCodeSettings(remoteCodes = [], localCodes = []) {
  const byCode = new Map();

  [...localCodes, ...remoteCodes].forEach((code) => {
    if (!code?.code) return;
    const key = String(code.code).toUpperCase();
    const existing = byCode.get(key);
    byCode.set(key, {
      ...(existing || {}),
      ...code,
      code: key,
      uses: Math.max(Number(existing?.uses || 0), Number(code.uses || 0)),
    });
  });

  return Array.from(byCode.values());
}

function hasMeaningfulPromoCodes(codes = []) {
  if (!Array.isArray(codes)) return false;

  return codes.some((code) => {
    const normalizedCode = String(code?.code || "").toUpperCase();
    if (!normalizedCode) return false;
    if (normalizedCode !== "CALCIOLAB100") return true;
    return Number(code.uses || 0) > 0 || Boolean(code.note && code.note !== "Accesso gratuito riservato a famiglia, amici stretti e test interni.");
  });
}

function hasArrayItems(value) {
  return Array.isArray(value) && value.length > 0;
}

// ─── Sync singola tabella ──────────────────────────────────────────────────
async function syncEntityTable(table, teamId, records) {
  const rows = records
    .map((record) => {
      const id = String(record.id);

      // FIX #7: valida ID prima di usarlo nella query delete.
      // ID non validi vengono skippati con warning in dev.
      if (!SAFE_ID_REGEX.test(id)) {
        if (import.meta.env.DEV) {
          console.warn(`[teamData] ID non sicuro skippato in ${table}: "${id}"`);
        }
        return null;
      }

      return {
        id,
        team_id:    teamId,
        data:       record,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean); // rimuove i null (ID non validi)

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(rows);
    if (upsertError) throw upsertError;
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

// FIX #7: funzione di escape più sicura — lancia eccezione se l'ID non supera la regex.
// La regex è già applicata prima di arrivare qui, ma aggiungiamo il guard come doppia protezione.
function escapeSupabaseListValue(value) {
  const s = String(value);
  if (!SAFE_ID_REGEX.test(s)) throw new Error(`[teamData] ID non sicuro: "${s}"`);
  return `"${s}"`;
}
