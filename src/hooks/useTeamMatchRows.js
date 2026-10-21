import { useCallback, useEffect, useState } from "react";
import { loadTeamPlayerMatches } from "../services/playerProfile";
import { isSupabaseConfigured } from "../lib/supabaseClient";

const EMPTY = [];
export function useTeamMatchRows(teamId) {
  const [state, setState] = useState({ teamId: null, rows: null, error: null });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!teamId || !isSupabaseConfigured) return;
    let active = true;
    let fetching = false;
    async function refresh() {
      if (!active || fetching) return;
      fetching = true;
      try {
        const { data, error } = await loadTeamPlayerMatches(teamId);
        if (active) setState((previous) => ({ teamId, rows: error ? (previous.teamId === teamId ? previous.rows : null) : data || [], error }));
      } catch (error) {
        if (active) setState((previous) => ({ teamId, rows: previous.teamId === teamId ? previous.rows : null, error }));
      } finally { fetching = false; }
    }
    function refreshVisible() { if (document.visibilityState === "visible") refresh(); }
    refresh();
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("online", refreshVisible);
    window.addEventListener("player-match-stats-updated", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(refreshVisible, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("online", refreshVisible);
      window.removeEventListener("player-match-stats-updated", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [teamId, revision]);
  const current = teamId && isSupabaseConfigured && state.teamId === teamId ? state : null;
  const needsRemote = Boolean(teamId && isSupabaseConfigured);
  return { rows: current?.rows || EMPTY, loading: needsRemote && !current?.rows && !current?.error,
    unavailable: needsRemote && !current?.rows, error: current?.error || null, retry };
}
