export function getSaveStatus({ loading, source, error, localError, saving, refreshing } = {}) {
  if (loading) return "loading";
  if (localError) return source === "supabase" && !error && !saving && !refreshing ? "onlineNoLocal" : "localError";
  if (saving || refreshing) return "saving";
  if (source === "supabase" && !error) return "online";
  if (error || source === "partial") return "retry";
  if (source === "pending-upload") return "pending";
  return "device";
}

export function classifyLocalSaveError(error) {
  if (["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error?.name)) return "space";
  if (["SecurityError", "NotAllowedError"].includes(error?.name)) return "blocked";
  return "unknown";
}
