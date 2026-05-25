/**
 * useSeasonGoals — persistenza obiettivi stagione in localStorage.
 * Struttura: { teamGoals: [...], playerGoals: [...] }
 */
import { useState, useCallback } from "react";
import { createId } from "../utils/helpers";

const STORAGE_KEY = "calciolab_season_goals_v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { teamGoals: [], playerGoals: [] };
    return JSON.parse(raw);
  } catch {
    return { teamGoals: [], playerGoals: [] };
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* no-op — localStorage unavailable (private mode or quota exceeded) */ }
}

export function useSeasonGoals() {
  const [data, setData] = useState(() => load());

  const update = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      save(next);
      return next;
    });
  }, []);

  // ── Team goals ──────────────────────────────────────────────────────────────
  function addTeamGoal(goal) {
    update((prev) => ({
      ...prev,
      teamGoals: [...prev.teamGoals, { id: createId("tg"), ...goal }],
    }));
  }

  function updateTeamGoal(id, patch) {
    update((prev) => ({
      ...prev,
      teamGoals: prev.teamGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function deleteTeamGoal(id) {
    update((prev) => ({
      ...prev,
      teamGoals: prev.teamGoals.filter((g) => g.id !== id),
    }));
  }

  // ── Player goals ────────────────────────────────────────────────────────────
  function addPlayerGoal(goal) {
    update((prev) => ({
      ...prev,
      playerGoals: [...prev.playerGoals, { id: createId("pg"), current: 0, ...goal }],
    }));
  }

  function updatePlayerGoal(id, patch) {
    update((prev) => ({
      ...prev,
      playerGoals: prev.playerGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function deletePlayerGoal(id) {
    update((prev) => ({
      ...prev,
      playerGoals: prev.playerGoals.filter((g) => g.id !== id),
    }));
  }

  return {
    teamGoals: data.teamGoals,
    playerGoals: data.playerGoals,
    addTeamGoal,
    updateTeamGoal,
    deleteTeamGoal,
    addPlayerGoal,
    updatePlayerGoal,
    deletePlayerGoal,
  };
}
