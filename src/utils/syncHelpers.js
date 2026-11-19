export const ARRAY_ENTITY_KEYS = [
  "players", "exercises", "sessions", "matches",
  "physicalTests", "gpsSessions", "staffTasks", "injuryRecords", "seasonPlayers",
];

function withoutSyncMetadata(item) {
  if (!item || typeof item !== "object") return item;
  const { _updatedAt: _ignored, ...data } = item;
  void _ignored;
  return data;
}

export function sameSyncData(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) =>
    Object.hasOwn(right, key) && sameSyncData(left[key], right[key]));
}

export function diffEntityArray(baselineArr = [], localArr = []) {
  const baselineById = new Map((baselineArr || []).map((item) => [String(item.id), item]));
  const localById = new Map(
    (localArr || []).filter((item) => item?.id != null).map((item) => [String(item.id), item])
  );
  const changedOrAdded = [];

  localById.forEach((item, id) => {
    const baselineItem = baselineById.get(id);
    if (!baselineItem || !sameSyncData(withoutSyncMetadata(baselineItem), withoutSyncMetadata(item))) {
      // The UI may still carry metadata from before our last successful save.
      // Compare against the latest acknowledged version, not that stale copy.
      changedOrAdded.push(baselineItem ? { ...item, _updatedAt: baselineItem._updatedAt } : item);
    }
  });

  const deleted = [];
  baselineById.forEach((item, id) => {
    if (!localById.has(id)) deleted.push({ id, _updatedAt: item?._updatedAt });
  });

  return { changedOrAdded, deleted };
}

export function mergeEntityArrayWithRemote(baselineArr, localArr, remoteArr) {
  const { changedOrAdded, deleted } = diffEntityArray(baselineArr, localArr);
  const byId = new Map((remoteArr || []).map((item) => [String(item.id), item]));
  changedOrAdded.forEach((item) => byId.set(String(item.id), item));
  deleted.forEach(({ id }) => byId.delete(id));
  return Array.from(byId.values());
}

export function buildEntityChanges(baseline, localState, keys) {
  return Object.fromEntries(
    keys
      .filter((key) => ARRAY_ENTITY_KEYS.includes(key))
      .map((key) => {
        const changes = diffEntityArray(baseline?.[key], localState[key]);
        const changedIds = new Set(changes.changedOrAdded.map(item => String(item.id)));
        return [key, { ...changes, ...(key === 'sessions' ? { baseRecords: (baseline?.[key] || []).filter(item => changedIds.has(String(item.id))) } : {}) }];
      })
  );
}

// Acknowledge the exact snapshot sent, with versions from the write response.
// Rows from another device must not enter the baseline before the UI sees them.
export function acknowledgeEntityVersions(snapshot, versions = {}, mergedRecords = {}) {
  return { ...snapshot, ...Object.fromEntries(Object.entries(versions).map(([key, byId]) => [
    key, snapshot[key].map((item) => byId.has(String(item.id))
      ? { ...(mergedRecords[key]?.get(String(item.id)) || item), _updatedAt: byId.get(String(item.id)) } : item),
  ])) };
}

export function acknowledgeSavedKeys(baseline, snapshot, result) {
  const acknowledged = acknowledgeEntityVersions(snapshot, result.versions, result.mergedRecords);
  return { ...baseline, ...Object.fromEntries((result.savedKeys || []).map((key) => [key, acknowledged[key]])) };
}

// A player attendance entry is atomic: status, partial minutes and RPE travel together.
// Only attendance-only local edits are eligible; never merge a formation or session plan.
export function reconcileAttendanceRecord(base, local, remote, choices = {}) {
  if (!base || !local || !remote) return null;
  const clean = value => JSON.parse(JSON.stringify(withoutSyncMetadata(value)));
  const [before, mine, online] = [base, local, remote].map(clean);
  const { attendance: baseAttendance = {}, ...baseFields } = before;
  const { attendance: localAttendance = {}, ...localFields } = mine;
  if (!sameSyncData(baseFields, localFields)) return null;
  const old = baseAttendance || {}, edited = localAttendance || {}, latest = online.attendance || {};
  const merged = { ...latest }, conflicts = [];
  const same = (left, right, id) => Object.hasOwn(left,id) === Object.hasOwn(right,id) && sameSyncData(left[id],right[id]);
  for (const id of new Set([...Object.keys(old), ...Object.keys(edited)])) {
    if (same(old, edited, id)) continue;
    if (!same(old, latest, id) && !same(edited, latest, id)) {
      if (choices[id] === 'online') continue;
      if (choices[id] !== 'local') { conflicts.push({ playerId:id, local:edited[id], online:latest[id] }); continue; }
    }
    if (Object.hasOwn(edited,id)) merged[id] = edited[id];
    else delete merged[id];
  }
  return { data:{...online,attendance:merged}, conflicts };
}

// A merged remote row must reach the UI before its version can become the baseline.
// If another edit happened during the request, retry from the old baseline instead.
export function acknowledgeUnchangedWrite(result, unchanged) {
  if (unchanged || !Object.keys(result.mergedRecords || {}).length) return result;
  const mergedKeys = new Set(Object.keys(result.mergedRecords));
  return { ...result, savedKeys:(result.savedKeys || []).filter(key=>!mergedKeys.has(key)),
    versions:Object.fromEntries(Object.entries(result.versions || {}).filter(([key])=>!mergedKeys.has(key))), mergedRecords:{} };
}

export function applyMergedRecords(state, mergedRecords = {}) {
  if (!Object.keys(mergedRecords).length) return state;
  return { ...state, ...Object.fromEntries(Object.entries(mergedRecords).map(([key, byId]) => [
    key, state[key].map(item => byId.get(String(item.id)) || item),
  ])) };
}
