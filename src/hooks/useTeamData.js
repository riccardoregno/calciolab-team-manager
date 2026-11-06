import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadRemoteState,
  saveLocalState,
  saveTeamTablesState,
} from "../services/teamData";
import {
  normalizeAppState,
  normalizeAppSettings,
  normalizeExercise,
  normalizeGpsSession,
  normalizeInjuryRecord,
  normalizeMatch,
  normalizePhysicalTest,
  normalizePlayer,
  normalizeSession,
  normalizeSetPlays,
  normalizeStaffTask,
} from "../utils/helpers";
import { classifyLocalSaveError } from "../utils/saveStatus";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { persistPendingChanges, restorePendingChanges, acknowledgePendingChanges } from "../services/pendingChanges";
import {
  acknowledgeEntityVersions,
  buildEntityChanges,
} from "../utils/syncHelpers";

const REMOTE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_FOCUS_REFRESH_INTERVAL_MS = 60 * 1000;
const REMOTE_SAVE_DEBOUNCE_MS = 1500;

export function useTeamData({ teamId } = {}) {
  const [state, setState] = useState(() => normalizeAppState({
    players: [],
    exercises: [],
    sessions: [],
    matches: [],
    physicalTests: [],
    gpsSessions: [],
    staffTasks: [],
    injuryRecords: [],
  }));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageSource, setStorageSource] = useState("local");
  const [storageError, setStorageError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [localSaveError, setLocalSaveError] = useState(null);
  const [remoteSaving, setRemoteSaving] = useState(false);
  const hydrated = useRef(false);
  const remoteSyncReady = useRef(false);
  const skipNextRemoteSave = useRef(false);
  // Tracks in-flight debounced saves — remote refresh is blocked while > 0
  // to prevent stale Supabase state from overwriting unsaved local changes.
  const pendingSaveCount = useRef(0);
  const hasUnsyncedLocalChanges = useRef(false);
  const stateRef = useRef(state);
  const dirtyKeysRef = useRef(new Set());
  const lastRemoteRefreshAtRef = useRef(0);
  // Ultimo stato conosciuto come sincronizzato (da hydration o refresh remoto):
  // baseline per il merge a 3 vie nel salvataggio debounced, vedi sopra.
  const lastSyncedSnapshotRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const editRevisionRef = useRef(0);
  const teamIdRef = useRef(teamId);
  useEffect(() => {
    teamIdRef.current = teamId;
  }, [teamId]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyLoadedState = useCallback(({ state: loadedState, source, error, syncBaseline, pendingKeys = [] }) => {
    setState(loadedState);
    lastSyncedSnapshotRef.current = syncBaseline || loadedState;
    dirtyKeysRef.current = new Set(pendingKeys);
    hasUnsyncedLocalChanges.current = pendingKeys.length > 0;
    setStorageSource(source);
    setStorageError(error?.message || null);
    const canSyncRemote = (source === "supabase" || source === "pending-upload") && !error;
    remoteSyncReady.current = canSyncRemote;
    skipNextRemoteSave.current = source === "supabase" && !error;
    if (source === "supabase" && !error) {
      hasUnsyncedLocalChanges.current = false;
      setLastSyncedAt(new Date().toISOString());
      lastRemoteRefreshAtRef.current = Date.now();
    }
    hydrated.current = true;
  }, []);

  const markDirty = useCallback((key) => {
    if (key) dirtyKeysRef.current.add(key);
    editRevisionRef.current += 1;
  }, []);

  const refreshTeamData = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) return { source: "local" };
    if (pendingSaveCount.current > 0) return { source: "pending-upload" };

    setRefreshing(true);
    try {
    await saveQueueRef.current.catch(() => {});
    if (teamIdRef.current !== teamId) {
      setRefreshing(false);
      return { source: "local" };
    }
    const revision = editRevisionRef.current;
    if (hasUnsyncedLocalChanges.current) {
      const retryKeys = Array.from(dirtyKeysRef.current);
      let token = null;
      try { token = persistPendingChanges(teamId, lastSyncedSnapshotRef.current, stateRef.current, retryKeys); } catch { /* Keep the cloud retry available. */ }
      const retryChanges = buildEntityChanges(lastSyncedSnapshotRef.current, stateRef.current, retryKeys);
      const retryResult = await saveTeamTablesState(stateRef.current, teamId, {
        keys: retryKeys,
        entityChanges: retryChanges,
      });
      setStorageSource((prev) => retryResult.source !== prev ? retryResult.source : prev);
      setStorageError((prev) => {
        const next = retryResult.error?.message || null;
        return next !== prev ? next : prev;
      });

      if (retryResult.source !== "supabase" || retryResult.error) {
        hasUnsyncedLocalChanges.current = true;
        setRefreshing(false);
        return retryResult;
      }
      if (revision !== editRevisionRef.current || teamIdRef.current !== teamId) {
        setRefreshing(false);
        return { source: "pending-upload" };
      }
      try { acknowledgePendingChanges(teamId, token); } catch { /* Keep the recovery copy. */ }

      hasUnsyncedLocalChanges.current = false;
      retryKeys.forEach((key) => dirtyKeysRef.current.delete(key));
      setLastSyncedAt(new Date().toISOString());
    }

    const result = await loadRemoteState({ teamId });
    if (revision !== editRevisionRef.current || teamIdRef.current !== teamId) {
      setRefreshing(false);
      return { source: "pending-upload" };
    }
    if (result.pendingUpload && !result.error) {
      const saveResult = await saveTeamTablesState(result.state, teamId);
      if (revision !== editRevisionRef.current || teamIdRef.current !== teamId) {
        setRefreshing(false);
        return { source: "pending-upload" };
      }
      applyLoadedState({
        ...result,
        source: saveResult.source,
        error: saveResult.error,
        failures: saveResult.failures || result.failures,
        pendingUpload: false,
      });
      if (saveResult.source === "supabase" && !saveResult.error) {
        hasUnsyncedLocalChanges.current = false;
        setLastSyncedAt(new Date().toISOString());
      } else {
        hasUnsyncedLocalChanges.current = true;
      }
      setRefreshing(false);
      return saveResult;
    }
    applyLoadedState(result);
    setRefreshing(false);
    return result;
    } catch (error) {
      if (teamIdRef.current === teamId) {
        setStorageSource("partial");
        setStorageError(error.message || "Sincronizzazione non riuscita");
      }
      return { source: "partial", error };
    } finally {
      if (teamIdRef.current === teamId) setRefreshing(false);
    }
  }, [teamId, applyLoadedState]);

  // Carica dati al mount / cambio team
  useEffect(() => {
    let active = true;

    // CRITICO: reset hydrated PRIMA del fetch — impedisce che il secondo useEffect
    // salvi lo stato del team precedente sul team nuovo durante la finestra di caricamento.
    hydrated.current = false;
    remoteSyncReady.current = false;
    skipNextRemoteSave.current = false;
    hasUnsyncedLocalChanges.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setRemoteSaving(false);
    setLocalSaveError(null);
    setLastSyncedAt(null);

    loadRemoteState({ teamId }).then((result) => {
      if (!active) return;
      applyLoadedState(restorePendingChanges(teamId, result));
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [teamId, applyLoadedState]);

  useEffect(() => {
    if (!isSupabaseConfigured || !teamId) return undefined;

    let active = true;
    let refreshing = false;

    async function refreshFromRemote() {
      if (!active || refreshing || !hydrated.current) return;
      // Skip refresh while a debounced Supabase save is pending — the local
      // state is newer than what remote would return.
      if (pendingSaveCount.current > 0) return;
      if (hasUnsyncedLocalChanges.current) return;
      if (dirtyKeysRef.current.size) return;
      const revision = editRevisionRef.current;
      refreshing = true;
      try {
        const result = await loadRemoteState({ teamId });
        if (active && revision === editRevisionRef.current && !hasUnsyncedLocalChanges.current) applyLoadedState(result);
      } catch (error) {
        if (active) { setStorageSource("partial"); setStorageError(error.message); }
      } finally { refreshing = false; }
    }

    function handleVisibleRefresh() {
      const refreshIsStale = Date.now() - lastRemoteRefreshAtRef.current > MIN_FOCUS_REFRESH_INTERVAL_MS;
      if (document.visibilityState === "visible" && refreshIsStale) {
        refreshFromRemote();
      }
    }

    const handleOnline = () => { refreshTeamData().catch(() => {}); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleVisibleRefresh);
    document.addEventListener("visibilitychange", handleVisibleRefresh);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshFromRemote();
      }
    }, REMOTE_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleVisibleRefresh);
      document.removeEventListener("visibilitychange", handleVisibleRefresh);
      window.clearInterval(intervalId);
    };
  }, [teamId, applyLoadedState, refreshTeamData]);

  const retryLocalSave = useCallback(() => {
    if (!hydrated.current) return;
    const result = saveLocalState(stateRef.current, teamId);
    setLocalSaveError(result.saved ? null : classifyLocalSaveError(result.error));
  }, [teamId]);

  // Persistenza: localStorage IMMEDIATAMENTE (previene perdita dati su chiusura tab),
  // Supabase con debounce; the per-tab journal protects unacknowledged edits.
  useEffect(() => {
    if (!hydrated.current) return;

    // Salvataggio localStorage sincrono — non perdiamo nulla se il tab chiude ora
    const localResult = saveLocalState(state, teamId);
    setLocalSaveError(localResult.saved ? null : classifyLocalSaveError(localResult.error));
    const keysToSave = Array.from(dirtyKeysRef.current);
    if (teamId && keysToSave.length) {
      try {
        persistPendingChanges(teamId, lastSyncedSnapshotRef.current, state, keysToSave);
      } catch {
        // Report failure of the browser storage operation to the user.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStorageError("Backup delle modifiche non disponibile: non ricaricare prima del salvataggio cloud.");
        setStorageSource("partial");
      }
    }

    // Supabase debounced
    if (!isSupabaseConfigured || !teamId) return;
    if (!remoteSyncReady.current) return;
    if (skipNextRemoteSave.current) {
      skipNextRemoteSave.current = false;
      if (!keysToSave.length) return;
    }

    if (keysToSave.length === 0) return;
    hasUnsyncedLocalChanges.current = true;
    setStorageSource("pending-upload");
    pendingSaveCount.current += 1;
    const savePending = async () => {
      if (teamIdRef.current !== teamId) return;
      const snapshot = stateRef.current;
      const revision = editRevisionRef.current;
      const normalized = normalizeAppState(snapshot);
      const keysToSave = Array.from(dirtyKeysRef.current);
      if (!keysToSave.length) return;
      let journalToken = null;
      try { journalToken = persistPendingChanges(teamId, lastSyncedSnapshotRef.current, snapshot, keysToSave); } catch { /* Cloud save can still succeed. */ }
      const entityChanges = buildEntityChanges(lastSyncedSnapshotRef.current, normalized, keysToSave);
      const result = await saveTeamTablesState(normalized, teamId, { keys: keysToSave, entityChanges });
      if (teamIdRef.current !== teamId) return;
      if (result.source === "supabase" && !result.error) {
        lastSyncedSnapshotRef.current = acknowledgeEntityVersions(normalized, result.versions);
        const unchanged = revision === editRevisionRef.current;
        hasUnsyncedLocalChanges.current = !unchanged;
        if (unchanged) {
          keysToSave.forEach((key) => dirtyKeysRef.current.delete(key));
          try { acknowledgePendingChanges(teamId, journalToken); } catch { /* Retain recovery data. */ }
        }
        setLastSyncedAt(new Date().toISOString());
      } else {
        hasUnsyncedLocalChanges.current = true;
      }
      // Aggiorna solo se il valore cambia — React esce comunque se uguale (Object.is),
      // ma la forma funzionale evita closure stale e rende l'intento esplicito.
      setStorageSource(hasUnsyncedLocalChanges.current && !result.error ? "pending-upload" : result.source);
      setStorageError((prev) => {
        const next = result.error?.message || null;
        return next !== prev ? next : prev;
      });
    };
    let started = false;
    const timeoutId = window.setTimeout(() => {
      started = true;
      saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
        if (teamIdRef.current !== teamId) return;
        setRemoteSaving(true);
        try { await savePending(); }
        finally { if (teamIdRef.current === teamId) setRemoteSaving(false); }
      }).catch((error) => {
        if (teamIdRef.current !== teamId) return;
        hasUnsyncedLocalChanges.current = true;
        setStorageSource("partial");
        setStorageError(error.message);
      }).finally(() => {
        pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
      });
    }, REMOTE_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (!started) pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
    };
  }, [state, teamId]);

  const actions = useMemo(
    () => ({
      setPlayers(players) {
        markDirty("players");
        setState((prev) => {
          const raw = typeof players === "function" ? players(prev.players) : players;
          return { ...prev, players: (raw || []).map(normalizePlayer) };
        });
      },
      setExercises(exercises) {
        markDirty("exercises");
        setState((prev) => {
          const raw = typeof exercises === "function" ? exercises(prev.exercises) : exercises;
          return { ...prev, exercises: (raw || []).map(normalizeExercise) };
        });
      },
      setSessions(sessions) {
        markDirty("sessions");
        setState((prev) => {
          const raw = typeof sessions === "function" ? sessions(prev.sessions) : sessions;
          return { ...prev, sessions: (raw || []).map(normalizeSession) };
        });
      },
      setMatches(matches) {
        markDirty("matches");
        setState((prev) => {
          const raw = typeof matches === "function" ? matches(prev.matches) : matches;
          return { ...prev, matches: (raw || []).map(normalizeMatch) };
        });
      },
      setPhysicalTests(physicalTests) {
        markDirty("physicalTests");
        setState((prev) => {
          const raw = typeof physicalTests === "function" ? physicalTests(prev.physicalTests) : physicalTests;
          return { ...prev, physicalTests: (raw || []).map(normalizePhysicalTest) };
        });
      },
      setGpsSessions(gpsSessions) {
        markDirty("gpsSessions");
        setState((prev) => {
          const raw = typeof gpsSessions === "function" ? gpsSessions(prev.gpsSessions) : gpsSessions;
          return { ...prev, gpsSessions: (raw || []).map(normalizeGpsSession) };
        });
      },
      setStaffTasks(staffTasks) {
        markDirty("staffTasks");
        setState((prev) => {
          const raw = typeof staffTasks === "function" ? staffTasks(prev.staffTasks) : staffTasks;
          return { ...prev, staffTasks: (raw || []).map(normalizeStaffTask) };
        });
      },
      setInjuryRecords(injuryRecords) {
        markDirty("injuryRecords");
        setState((prev) => {
          const raw = typeof injuryRecords === "function" ? injuryRecords(prev.injuryRecords) : injuryRecords;
          return { ...prev, injuryRecords: (raw || []).map(normalizeInjuryRecord) };
        });
      },
      setAppSettings(appSettings) {
        markDirty("appSettings");
        setState((prev) => {
          const raw = typeof appSettings === "function" ? appSettings(prev.appSettings) : appSettings;
          return { ...prev, appSettings: normalizeAppSettings(raw || {}) };
        });
      },
      setSetPlays(setPlays) {
        markDirty("setPlays");
        setState((prev) => {
          const raw = typeof setPlays === "function" ? setPlays(prev.setPlays) : setPlays;
          return { ...prev, setPlays: normalizeSetPlays(raw || {}) };
        });
      },
      setState(updater) {
        [
          "players", "exercises", "sessions", "matches",
          "physicalTests", "gpsSessions", "staffTasks", "injuryRecords",
          "appSettings", "setPlays",
        ].forEach(markDirty);
        setState((prev) =>
          normalizeAppState(typeof updater === "function" ? updater(prev) : updater)
        );
      },
    }),
    [markDirty]
  );

  return {
    state,
    loading,
    refreshing,
    storageSource,
    storageError,
    lastSyncedAt,
    localSaveError,
    remoteSaving,
    refreshTeamData,
    retryLocalSave,
    teamId,
    ...actions,
  };
}
