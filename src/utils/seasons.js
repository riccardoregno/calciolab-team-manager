import { sameSyncData } from "./syncHelpers.js";
import { normalizeSeason } from "./matchScope.js";

export function canonicalSeasonDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(text + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === text ? text : "";
}

// Explicit identity wins. Legacy labels and dates must agree with each other.
export function resolveEventSeason(event, seasons) {
  const date = canonicalSeasonDate(event.date);
  if (!date) return { season: null, reason: "date" };
  if (event.seasonId) {
    const season = seasons.find(item => item.id === event.seasonId);
    return season && date >= season.start_date && date <= season.end_date
      ? { season, reason: null } : { season: null, reason: "identity" };
  }
  const candidates = seasons.filter(item => date >= item.start_date && date <= item.end_date);
  const label = normalizeSeason(event.season);
  if (label) {
    const named = seasons.filter(item => normalizeSeason(item.name) === label);
    if (named.length === 1 && candidates.includes(named[0])) return { season: named[0], reason: null, inferred: true };
    return { season: null, reason: "label" };
  }
  return candidates.length === 1 ? { season: candidates[0], reason: null, inferred: true }
    : { season: null, reason: candidates.length ? "overlap" : "outside" };
}

export function auditSeasonData({ players = [], sessions = [], matches = [], seasons = [] }) {
  const ids = new Set(players.map(player => String(player.id)));
  return [...sessions, ...matches].flatMap(event => {
    const references = new Set([
      ...Object.keys(event.attendance || {}), ...(event.convocazione?.playerIds || []),
      ...(event.lineup?.starterIds || []), ...(event.lineup?.benchIds || []), ...(event.lineup?.calledUpIds || []),
    ].map(String));
    const orphanIds = [...references].filter(id => !ids.has(id));
    const resolved = resolveEventSeason(event, seasons);
    return resolved.reason || orphanIds.length ? [{ id: event.id, title: event.title || event.opponent || event.id, date: event.date || "", reason: orphanIds.length ? "orphans" : resolved.reason, orphanIds }] : [];
  });
}

export function getSeasonPlayers(players, memberships, seasonId) {
  const masters = new Map(players.map(player => [String(player.id), player]));
  return memberships.filter(row => row.seasonId === seasonId && masters.has(String(row.playerId)))
    .map(row => ({ ...row.profile, id: String(row.playerId), _updatedAt: row._updatedAt }));
}

function profileData(player) {
  const { id: _id, _updatedAt: _version, ...profile } = player;
  return profile;
}

export function changeSeasonRoster({ players, memberships, seasonId, update, createId }) {
  const previous = getSeasonPlayers(players,memberships,seasonId);
  const next = typeof update === "function" ? update(previous) : update;
  const masterIds = new Set(players.map(player => String(player.id)));
  const rows = new Map(memberships.filter(row => row.seasonId === seasonId).map(row => [String(row.playerId),row]));
  return {
    players: [...players, ...next.filter(player => !masterIds.has(String(player.id)))],
    seasonPlayers: [...memberships.filter(row => row.seasonId !== seasonId), ...next.map(player => ({
      ...(rows.get(String(player.id)) || { id: createId(), seasonId, playerId: String(player.id) }),
      profile: profileData(player),
    }))],
  };
}

export function changeSeasonEvents(all, season, seasons, update) {
  const selected = all.filter(event => resolveEventSeason(event,seasons).season?.id === season.id);
  const next = typeof update === "function" ? update(selected) : update;
  if (next.some(event => !canonicalSeasonDate(event.date) || event.date < season.start_date || event.date > season.end_date)) throw new Error("SEASON_EVENT_DATE");
  const selectedIds = new Set(selected.map(event => String(event.id)));
  if (next.some(event => all.some(existing => String(existing.id) === String(event.id) && !selectedIds.has(String(existing.id))))) throw new Error("SEASON_EVENT_ID");
  return [...all.filter(event => !selectedIds.has(String(event.id))), ...next.map(event => {
    const original = selected.find(item => String(item.id) === String(event.id));
    return original && sameSyncData(original,event) ? original : { ...event, seasonId: season.id, season: season.name };
  })];
}

export function defaultSeasonDate(bounds, today) {
  return !bounds ? today : today < bounds.start_date ? bounds.start_date : today > bounds.end_date ? bounds.end_date : today;
}
