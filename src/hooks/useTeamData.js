import { useEffect, useMemo, useRef, useState } from "react";
import {
  getInitialState,
  loadRemoteState,
  saveLocalState,
  saveTeamTablesState,
} from "../services/teamData";
import { normalizeAppState } from "../utils/helpers";
import { isSupabaseConfigured } from "../lib/supabaseClient";

export function useTeamData({ teamId } = {}) {
  const [state, setState] = useState(getInitialState);
  const [loading, setLoading] = useState(true);
  const [storageSource, setStorageSource] = useState("local");
  const [storageError, setStorageError] = useState(null);
  const hydrated = useRef(false);

  // Carica dati al mount / cambio team
  useEffect(() => {
    let active = true;

    // CRITICO: reset hydrated PRIMA del fetch — impedisce che il secondo useEffect
    // salvi lo stato del team precedente sul team nuovo durante la finestra di caricamento.
    hydrated.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    loadRemoteState({ teamId }).then(({ state: loadedState, source, error }) => {
      if (!active) return;

      setState(loadedState);
      setStorageSource(source);
      setStorageError(error?.message || null);
      hydrated.current = true;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [teamId]);

  // Persistenza: localStorage IMMEDIATAMENTE (previene perdita dati su chiusura tab),
  // Supabase con debounce 300ms.
  useEffect(() => {
    if (!hydrated.current) return;

    // Salvataggio localStorage sincrono — non perdiamo nulla se il tab chiude ora
    saveLocalState(state);

    // Supabase debounced
    if (!isSupabaseConfigured || !teamId) return;

    const normalized = normalizeAppState(state);
    const timeoutId = window.setTimeout(async () => {
      const result = await saveTeamTablesState(normalized, teamId);
      setStorageSource(result.source);
      setStorageError(result.error?.message || null);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [state, teamId]);

  const actions = useMemo(
    () => ({
      setPlayers(players) {
        setState((prev) => normalizeAppState({ ...prev, players }));
      },
      setExercises(exercises) {
        setState((prev) => normalizeAppState({ ...prev, exercises }));
      },
      setSessions(sessions) {
        setState((prev) => normalizeAppState({ ...prev, sessions }));
      },
      setMatches(matches) {
        setState((prev) => normalizeAppState({ ...prev, matches }));
      },
      setPhysicalTests(physicalTests) {
        setState((prev) => normalizeAppState({ ...prev, physicalTests }));
      },
      setGpsSessions(gpsSessions) {
        setState((prev) => normalizeAppState({ ...prev, gpsSessions }));
      },
      setAppSettings(appSettings) {
        setState((prev) => normalizeAppState({ ...prev, appSettings }));
      },
      setState(updater) {
        setState((prev) =>
          normalizeAppState(
            typeof updater === "function" ? updater(prev) : updater
          )
        );
      },
    }),
    []
  );

  return {
    state,
    loading,
    storageSource,
    storageError,
    teamId,
    ...actions,
  };
}
