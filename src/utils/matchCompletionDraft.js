export const emptyDraft = { score: {}, starters: [], minutes: {} };

export function readDraft(key) {
  try {
    const draft = JSON.parse(localStorage.getItem(key));
    if (draft?.score && Array.isArray(draft.starters) && draft.minutes) return draft;
  } catch {
    // Storage may be unavailable on this device.
  }
  return emptyDraft;
}

export function writeDraft(key, draft) {
  try {
    if (draft === emptyDraft) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function getMatchDraftKey(teamId, matchId) {
  return "calciolab:match-completion:v1:" + JSON.stringify([teamId, matchId]);
}
