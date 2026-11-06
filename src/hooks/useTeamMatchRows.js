import { useCallback, useEffect, useState } from "react";
import { loadTeamPlayerMatches } from "../services/playerProfile";
import { isSupabaseConfigured } from "../lib/supabaseClient";

const EMPTY = [];
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_FOCUS_INTERVAL_MS = 60 * 1000;
export function useTeamMatchRows(teamId) {
  const [state, setState] = useState({ teamId: null, rows: null, error: null });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!teamId || !isSupabaseConfigured) return;
    let active = true;
    let fetching = false;
    let refreshAfterSave = false;
    let lastRequest = 0;
    async function refresh() {
      if (!active || fetching) return;
      fetching = true;
      lastRequest = Date.now();
      try {
        const { data, error } = await loadTeamPlayerMatches(teamId);
        if (active) setState((previous) => ({ teamId, rows: error ? (previous.teamId === teamId ? previous.rows : null) : data || [], error }));
      } catch (error) {
        if (active) setState((previous) => ({ teamId, rows: previous.teamId === teamId ? previous.rows : null, error }));
      } finally {
        fetching = false;
        if (refreshAfterSave) {
          refreshAfterSave = false;
          refresh();
        }
      }
    }
    function refreshVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastRequest >= MIN_FOCUS_INTERVAL_MS) refresh();
    }
    function refreshAfterUpdate() {
      if (fetching) refreshAfterSave = true;
      else refresh();
    }
    refresh();
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("online", refreshAfterUpdate);
    window.addEventListener("player-match-stats-updated", refreshAfterUpdate);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(refreshVisible, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("online", refreshAfterUpdate);
      window.removeEventListener("player-match-stats-updated", refreshAfterUpdate);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [teamId, revision]);
  const current = teamId && isSupabaseConfigured && state.teamId === teamId ? state : null;
  const needsRemote = Boolean(teamId && isSupabaseConfigured);
  return { rows: current?.rows || EMPTY, loading: needsRemote && !current?.rows && !current?.error,
    unavailable: needsRemote && !current?.rows, error: current?.error || null, retry };
}
