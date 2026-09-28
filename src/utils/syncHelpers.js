export const ARRAY_ENTITY_KEYS = [
  "players", "exercises", "sessions", "matches",
  "physicalTests", "gpsSessions", "staffTasks", "injuryRecords",
];

function withoutSyncMetadata(item) {
  if (!item || typeof item !== "object") return item;
  const { _updatedAt: _ignored, ...data } = item;
  void _ignored;
  return data;
}

export function diffEntityArray(baselineArr = [], localArr = []) {
  const baselineById = new Map((baselineArr || []).map((item) => [String(item.id), item]));
  const localById = new Map(
    (localArr || []).filter((item) => item?.id != null).map((item) => [String(item.id), item])
  );
  const changedOrAdded = [];

  localById.forEach((item, id) => {
    const baselineItem = baselineById.get(id);
    if (!baselineItem || JSON.stringify(withoutSyncMetadata(baselineItem)) !== JSON.stringify(withoutSyncMetadata(item))) {
      changedOrAdded.push(item);
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
