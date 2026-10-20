/**
 * useSeasonGoals — obiettivi condivisi nelle impostazioni della squadra.
 * Struttura: { teamGoals: [...], playerGoals: [...] }
 */
import { useState, useCallback } from "react";
import { createId, normalizeAppSettings } from "../utils/helpers";

const STORAGE_KEY = "calciolab_season_goals_v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { teamGoals: [], playerGoals: [] };
    const data = JSON.parse(raw);
    return {
      teamGoals: Array.isArray(data?.teamGoals) ? data.teamGoals.filter((goal) => goal?.id) : [],
      playerGoals: Array.isArray(data?.playerGoals) ? data.playerGoals.filter((goal) => goal?.id) : [],
    };
  } catch {
    return { teamGoals: [], playerGoals: [] };
  }
}

export function useSeasonGoals(appSettings, setAppSettings, players = []) {
  const data = normalizeAppSettings(appSettings).seasonGoals;
  const [legacyData] = useState(load);
  const playerIds = new Set(players.map((player) => String(player.id)));
  const legacyTeamGoals = legacyData.teamGoals.filter((goal) => !data.teamGoals.some((item) => String(item.id) === String(goal.id)));
  const legacyPlayerGoals = legacyData.playerGoals.filter((goal) => playerIds.has(String(goal.playerId)) && !data.playerGoals.some((item) => String(item.id) === String(goal.id)));

  const update = useCallback((updater) => {
    setAppSettings((prev) => {
      const settings = normalizeAppSettings(prev);
      const next = typeof updater === "function" ? updater(settings.seasonGoals) : updater;
      return { ...settings, seasonGoals: next };
    });
  }, [setAppSettings]);

  function importLegacyGoals() {
    update((prev) => ({
      teamGoals: [...prev.teamGoals, ...legacyTeamGoals.filter((goal) => !prev.teamGoals.some((item) => String(item.id) === String(goal.id)))],
      playerGoals: [...prev.playerGoals, ...legacyPlayerGoals.filter((goal) => !prev.playerGoals.some((item) => String(item.id) === String(goal.id)))],
    }));
  }

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
    hasLegacyGoals: legacyTeamGoals.length + legacyPlayerGoals.length > 0,
    importLegacyGoals,
    addTeamGoal,
    updateTeamGoal,
    deleteTeamGoal,
    addPlayerGoal,
    updatePlayerGoal,
    deletePlayerGoal,
  };
}
