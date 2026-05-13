import { useEffect, useMemo, useRef, useState } from "react";
import {
  getInitialState,
  loadRemoteState,
  saveRemoteState,
} from "../services/teamData";
import { normalizeAppState } from "../utils/helpers";

export function useTeamData({ teamId } = {}) {
  const [state, setState] = useState(getInitialState);
  const [loading, setLoading] = useState(true);
  const [storageSource, setStorageSource] = useState("local");
  const [storageError, setStorageError] = useState(null);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;

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

  useEffect(() => {
    if (!hydrated.current) return;

    const timeoutId = window.setTimeout(async () => {
      const result = await saveRemoteState(state, { teamId });
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
