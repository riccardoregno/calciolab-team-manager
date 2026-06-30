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

// Entità salvate come array di record con id (vedi ENTITY_TABLES in teamData.js).
// Tenute qui in sync manualmente: sono le stesse chiavi usate per il merge
// pre-salvataggio che evita di perdere modifiche fatte da un'altra scheda/
// dispositivo aperto in contemporanea (vedi commento sull'effetto di sync sotto).
const ARRAY_ENTITY_KEYS = [
  "players", "exercises", "sessions", "matches",
  "physicalTests", "gpsSessions", "staffTasks", "injuryRecords",
];

// Merge a 3 vie per id: confronta lo stato locale con l'ultimo stato
// sincronizzato (baseline) per capire SOLO quali record sono stati davvero
// aggiunti/modificati/eliminati in questa scheda, poi applica solo quella
// differenza sopra al remoto fresco. Usare "locale vince sempre" sarebbe
// sbagliato: lo stato locale contiene comunque TUTTI i record (anche quelli
// mai toccati in questa scheda), quindi sovrascriverebbe alla cieca le
// modifiche fatte nel frattempo da un'altra scheda/dispositivo su record
// diversi da quello appena modificato qui.
function diffEntityArray(baselineArr = [], localArr = []) {
  const baselineById = new Map((baselineArr || []).map((item) => [String(item.id), item]));
  const localById = new Map((localArr || []).filter((item) => item?.id != null).map((item) => [String(item.id), item]));

  const changedOrAdded = [];
  localById.forEach((item, id) => {
    const baselineItem = baselineById.get(id);
    if (!baselineItem || JSON.stringify(baselineItem) !== JSON.stringify(item)) {
      changedOrAdded.push(item);
    }
  });

  const deletedIds = [];
  baselineById.forEach((_item, id) => {
    if (!localById.has(id)) deletedIds.push(id);
  });

  return { changedOrAdded, deletedIds };
}

function mergeEntityArrayWithRemote(baselineArr, localArr, remoteArr) {
  const { changedOrAdded, deletedIds } = diffEntityArray(baselineArr, localArr);
  const byId = new Map((remoteArr || []).map((item) => [String(item.id), item]));
  changedOrAdded.forEach((item) => byId.set(String(item.id), item));
  deletedIds.forEach((id) => byId.delete(id));
  return Array.from(byId.values());
}

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
  const hasUnsyncedLocalChanges = useRef(false);
  const stateRef = useRef(state);
  // Ultimo stato conosciuto come sincronizzato (da hydration o refresh remoto):
  // baseline per il merge a 3 vie nel salvataggio debounced, vedi sopra.
  const lastSyncedSnapshotRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyLoadedState = useCallback(({ state: loadedState, source, error }) => {
    setState(loadedState);
    lastSyncedSnapshotRef.current = loadedState;
    setStorageSource(source);
    setStorageError(error?.message || null);
    const canSyncRemote = (source === "supabase" || source === "pending-upload") && !error;
    remoteSyncReady.current = canSyncRemote;
    skipNextRemoteSave.current = source === "supabase" && !error;
    if (source === "supabase" && !error) {
      hasUnsyncedLocalChanges.current = false;
      setLastSyncedAt(new Date().toISOString());
    }
    hydrated.current = true;
  }, []);

  const refreshTeamData = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) return { source: "local" };

    setRefreshing(true);
    if (hasUnsyncedLocalChanges.current) {
      const retryResult = await saveTeamTablesState(stateRef.current, teamId);
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

      hasUnsyncedLocalChanges.current = false;
      setLastSyncedAt(new Date().toISOString());
    }

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

    loadRemoteState({ teamId }).then((result) => {
      if (!active) return;
      applyLoadedState(result);
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
      if (!active || refreshing) return;
      // Skip refresh while a debounced Supabase save is pending — the local
      // state is newer than what remote would return.
      if (pendingSaveCount.current > 0) return;
      if (hasUnsyncedLocalChanges.current) return;
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
    hasUnsyncedLocalChanges.current = true;
    pendingSaveCount.current += 1;
    const timeoutId = window.setTimeout(async () => {
      // Prima di sovrascrivere la tabella remota, rilegge lo stato attuale e
      // unisce le modifiche locali sopra: se un'altra scheda/dispositivo ha
      // salvato nel frattempo (es. un'altra seduta modificata), quei record
      // restano invece di essere cancellati dal salvataggio di questa scheda.
      let toSave = normalized;
      try {
        const remoteResult = await loadRemoteState({ teamId });
        if (remoteResult?.state) {
          const baseline = lastSyncedSnapshotRef.current;
          const merged = { ...normalized };
          ARRAY_ENTITY_KEYS.forEach((key) => {
            merged[key] = mergeEntityArrayWithRemote(baseline?.[key], normalized[key], remoteResult.state[key]);
          });
          toSave = merged;
        }
      } catch {
        // Se il refresh fallisce si procede comunque con il solo stato locale,
        // come accadeva prima di questa modifica.
      }
      const result = await saveTeamTablesState(toSave, teamId);
      pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
      if (result.source === "supabase" && !result.error) {
        hasUnsyncedLocalChanges.current = false;
        lastSyncedSnapshotRef.current = toSave;
        setLastSyncedAt(new Date().toISOString());
      } else {
        hasUnsyncedLocalChanges.current = true;
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
