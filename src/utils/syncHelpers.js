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
      .map((key) => [key, diffEntityArray(baseline?.[key], localState[key])])
  );
}

// Acknowledge the exact snapshot sent, with versions from the write response.
// Rows from another device must not enter the baseline before the UI sees them.
export function acknowledgeEntityVersions(snapshot, versions = {}) {
  return { ...snapshot, ...Object.fromEntries(Object.entries(versions).map(([key, byId]) => [
    key, snapshot[key].map((item) => byId.has(String(item.id))
      ? { ...item, _updatedAt: byId.get(String(item.id)) } : item),
  ])) };
}

export function acknowledgeSavedKeys(baseline, snapshot, result) {
  const acknowledged = acknowledgeEntityVersions(snapshot, result.versions);
  return { ...baseline, ...Object.fromEntries((result.savedKeys || []).map((key) => [key, acknowledged[key]])) };
}
