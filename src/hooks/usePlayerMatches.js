import { useEffect, useState } from "react";
import { loadPlayerMatches } from "../services/playerProfile";
import { isSupabaseConfigured } from "../lib/supabaseClient";

const EMPTY_ROWS = [];

export function usePlayerMatches(teamId, playerId, matches) {
  const [state, setState] = useState({ key: "", rows: null, error: null });
  const key = JSON.stringify([teamId || "", String(playerId || "")]);

  useEffect(() => {
    if (!teamId || !playerId || !isSupabaseConfigured) return;
    let active = true;
    let fetching = false;

    async function refresh() {
      if (!active || fetching) return;
      fetching = true;
      try {
        const { data, error } = await loadPlayerMatches(teamId, String(playerId));
        if (active) {
          setState((prev) => ({
            key,
            rows: error ? (prev.key === key ? prev.rows : null) : data,
            error,
          }));
        }
      } catch (error) {
        if (active) setState((prev) => ({ key, rows: prev.key === key ? prev.rows : null, error }));
      } finally {
        fetching = false;
      }
    }

    function refreshVisible() {
      if (document.visibilityState === "visible") refresh();
    }

    refresh();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("online", refreshVisible);
    window.addEventListener("player-match-stats-updated", refreshVisible);
    const interval = window.setInterval(refreshVisible, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("online", refreshVisible);
      window.removeEventListener("player-match-stats-updated", refreshVisible);
    };
  }, [teamId, playerId, key, matches]);

  const current = state.key === key ? state : null;
  return {
    rows: current?.rows || EMPTY_ROWS,
    loading: Boolean(teamId && playerId && isSupabaseConfigured && !current?.rows && !current?.error),
    error: current?.error || null,
  };
}
