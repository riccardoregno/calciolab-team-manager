import { ARRAY_ENTITY_KEYS, buildEntityChanges, diffEntityArray } from "../utils/syncHelpers";

const journalKey = (teamId) => `calciolab-pending-v1:${teamId}`;

// sessionStorage survives reloads and isolates drafts from other open tabs.
export function persistPendingChanges(teamId, baseline, state, keys) {
  if (!teamId || !baseline || !keys.length) return null;
  const changes = buildEntityChanges(baseline, state, keys);
  const previous = {};
  const values = {};
  for (const key of keys) {
    if (ARRAY_ENTITY_KEYS.includes(key)) {
      const ids = new Set([
        ...changes[key].changedOrAdded.map((item) => String(item.id)),
        ...changes[key].deleted.map((item) => String(item.id)),
      ]);
      previous[key] = (baseline[key] || []).filter((item) => ids.has(String(item.id)));
    } else {
      values[key] = state[key];
      previous[key] = baseline[key];
    }
  }
  const token = JSON.stringify({ changes, previous, values });
  sessionStorage.setItem(journalKey(teamId), token);
  return token;
}

export function acknowledgePendingChanges(teamId, token) {
  if (token && sessionStorage.getItem(journalKey(teamId)) === token) {
    sessionStorage.removeItem(journalKey(teamId));
  }
}

export function restorePendingChanges(teamId, result) {
  if (!teamId) return result;
  let journal;
  let token;
  try {
    token = sessionStorage.getItem(journalKey(teamId));
    journal = JSON.parse(token || "null");
  } catch {
    return result;
  }
  if (!journal || typeof journal !== "object" || !journal.previous || !journal.changes) return result;
  const state = { ...result.state };
  const syncBaseline = { ...result.state };
  const pendingKeys = [];
  const remoteConfirmed = result.source === "supabase" && !result.error;
  for (const [key, changes] of Object.entries(journal.changes || {})) {
    if (!ARRAY_ENTITY_KEYS.includes(key)) continue;
    const records = new Map((state[key] || []).map((item) => [String(item.id), item]));
    const baseline = new Map(records);
    const previous = new Map((journal.previous[key] || []).map((item) => [String(item.id), item]));
    let pending = false;
    for (const item of changes.changedOrAdded || []) {
      const id = String(item.id);
      const remote = records.get(id);
      // A save may have completed just before the page was closed.
      if (remoteConfirmed && remote && !diffEntityArray([remote], [item]).changedOrAdded.length) continue;
      records.set(id, item);
      if (previous.has(id)) baseline.set(id, previous.get(id));
      else baseline.delete(id);
      pending = true;
    }
    for (const item of changes.deleted || []) {
      const id = String(item.id);
      if (remoteConfirmed && !records.has(id)) continue;
      records.delete(id);
      if (previous.has(id)) baseline.set(id, previous.get(id));
      pending = true;
    }
    if (pending) pendingKeys.push(key);
    state[key] = Array.from(records.values());
    syncBaseline[key] = Array.from(baseline.values());
  }
  for (const [key, value] of Object.entries(journal.values || {})) {
    if (!["appSettings", "setPlays"].includes(key)) continue;
    if (remoteConfirmed && JSON.stringify(state[key]) === JSON.stringify(value)) continue;
    state[key] = value;
    syncBaseline[key] = journal.previous[key];
    pendingKeys.push(key);
  }
  if (remoteConfirmed && !pendingKeys.length) acknowledgePendingChanges(teamId, token);
  return {
    ...result, state, syncBaseline, pendingKeys,
    source: pendingKeys.length && !result.error ? "pending-upload" : result.source,
  };
}
