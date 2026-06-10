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
import { isSupabaseConfigured } from "../lib/supabaseClient";

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
  const hydrated = useRef(false);
  const remoteSyncReady = useRef(false);
  const skipNextRemoteSave = useRef(false);
  // Tracks in-flight debounced saves — remote refresh is blocked while > 0
  // to prevent stale Supabase state from overwriting unsaved local changes.
  const pendingSaveCount = useRef(0);

  const applyLoadedState = useCallback(({ state: loadedState, source, error }) => {
    setState(loadedState);
    setStorageSource(source);
    setStorageError(error?.message || null);
    const canSyncRemote = (source === "supabase" || source === "pending-upload") && !error;
    remoteSyncReady.current = canSyncRemote;
    skipNextRemoteSave.current = source === "supabase" && !error;
    if (source === "supabase" && !error) {
      setLastSyncedAt(new Date().toISOString());
    }
    hydrated.current = true;
  }, []);

  const refreshTeamData = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) return { source: "local" };

    setRefreshing(true);
    const result = await loadRemoteState({ teamId });
    if (result.pendingUpload && !result.error) {
      const saveResult = await saveTeamTablesState(result.state, teamId);
      applyLoadedState({
        ...result,
        source: saveResult.source,
        error: saveResult.error,
        failures: saveResult.failures || result.failures,
        pendingUpload: false,
      });
      if (saveResult.source === "supabase" && !saveResult.error) {
        setLastSyncedAt(new Date().toISOString());
      }
      setRefreshing(false);
      return saveResult;
    }
    applyLoadedState(result);
    setRefreshing(false);
    return result;
  }, [teamId, applyLoadedState]);

  // Carica dati al mount / cambio team
  useEffect(() => {
    let active = true;

    // CRITICO: reset hydrated PRIMA del fetch — impedisce che il secondo useEffect
    // salvi lo stato del team precedente sul team nuovo durante la finestra di caricamento.
    hydrated.current = false;
    remoteSyncReady.current = false;
    skipNextRemoteSave.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    loadRemoteState({ teamId }).then((result) => {
      if (!active) return;

      applyLoadedState(result);
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
      if (!active || refreshing) return;
      // Skip refresh while a debounced Supabase save is pending — the local
      // state is newer than what remote would return.
      if (pendingSaveCount.current > 0) return;
      refreshing = true;
      const result = await loadRemoteState({ teamId });
      if (active) applyLoadedState(result);
      refreshing = false;
    }

    function handleVisibleRefresh() {
      if (document.visibilityState === "visible") {
        refreshFromRemote();
      }
    }

    window.addEventListener("focus", refreshFromRemote);
    document.addEventListener("visibilitychange", handleVisibleRefresh);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshFromRemote();
      }
    }, 30000);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshFromRemote);
      document.removeEventListener("visibilitychange", handleVisibleRefresh);
      window.clearInterval(intervalId);
    };
  }, [teamId, applyLoadedState]);

  // Persistenza: localStorage IMMEDIATAMENTE (previene perdita dati su chiusura tab),
  // Supabase con debounce 300ms.
  useEffect(() => {
    if (!hydrated.current) return;

    // Salvataggio localStorage sincrono — non perdiamo nulla se il tab chiude ora
    saveLocalState(state);

    // Supabase debounced
    if (!isSupabaseConfigured || !teamId) return;
    if (!remoteSyncReady.current) return;
    if (skipNextRemoteSave.current) {
      skipNextRemoteSave.current = false;
      return;
    }

    const normalized = normalizeAppState(state);
    pendingSaveCount.current += 1;
    const timeoutId = window.setTimeout(async () => {
      const result = await saveTeamTablesState(normalized, teamId);
      pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
      if (result.source === "supabase" && !result.error) {
        setLastSyncedAt(new Date().toISOString());
      }
      // Aggiorna solo se il valore cambia — React esce comunque se uguale (Object.is),
      // ma la forma funzionale evita closure stale e rende l'intento esplicito.
      setStorageSource((prev) => result.source !== prev ? result.source : prev);
      setStorageError((prev) => {
        const next = result.error?.message || null;
        return next !== prev ? next : prev;
      });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
    };
  }, [state, teamId]);

  const actions = useMemo(
    () => ({
      setPlayers(players) {
        setState((prev) => {
          const raw = typeof players === "function" ? players(prev.players) : players;
          return { ...prev, players: (raw || []).map(normalizePlayer) };
        });
      },
      setExercises(exercises) {
        setState((prev) => {
          const raw = typeof exercises === "function" ? exercises(prev.exercises) : exercises;
          return { ...prev, exercises: (raw || []).map(normalizeExercise) };
        });
      },
      setSessions(sessions) {
        setState((prev) => {
          const raw = typeof sessions === "function" ? sessions(prev.sessions) : sessions;
          return { ...prev, sessions: (raw || []).map(normalizeSession) };
        });
      },
      setMatches(matches) {
        setState((prev) => {
          const raw = typeof matches === "function" ? matches(prev.matches) : matches;
          return { ...prev, matches: (raw || []).map(normalizeMatch) };
        });
      },
      setPhysicalTests(physicalTests) {
        setState((prev) => {
          const raw = typeof physicalTests === "function" ? physicalTests(prev.physicalTests) : physicalTests;
          return { ...prev, physicalTests: (raw || []).map(normalizePhysicalTest) };
        });
      },
      setGpsSessions(gpsSessions) {
        setState((prev) => {
          const raw = typeof gpsSessions === "function" ? gpsSessions(prev.gpsSessions) : gpsSessions;
          return { ...prev, gpsSessions: (raw || []).map(normalizeGpsSession) };
        });
      },
      setStaffTasks(staffTasks) {
        setState((prev) => {
          const raw = typeof staffTasks === "function" ? staffTasks(prev.staffTasks) : staffTasks;
          return { ...prev, staffTasks: (raw || []).map(normalizeStaffTask) };
        });
      },
      setInjuryRecords(injuryRecords) {
        setState((prev) => {
          const raw = typeof injuryRecords === "function" ? injuryRecords(prev.injuryRecords) : injuryRecords;
          return { ...prev, injuryRecords: (raw || []).map(normalizeInjuryRecord) };
        });
      },
      setAppSettings(appSettings) {
        setState((prev) => {
          const raw = typeof appSettings === "function" ? appSettings(prev.appSettings) : appSettings;
          return { ...prev, appSettings: normalizeAppSettings(raw || {}) };
        });
      },
      setSetPlays(setPlays) {
        setState((prev) => {
          const raw = typeof setPlays === "function" ? setPlays(prev.setPlays) : setPlays;
          return { ...prev, setPlays: normalizeSetPlays(raw || {}) };
        });
      },
      setState(updater) {
        setState((prev) =>
          normalizeAppState(typeof updater === "function" ? updater(prev) : updater)
        );
      },
    }),
    []
  );

  return {
    state,
    loading,
    refreshing,
    storageSource,
    storageError,
    lastSyncedAt,
    refreshTeamData,
    teamId,
    ...actions,
  };
}
