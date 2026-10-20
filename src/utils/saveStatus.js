export function getSaveStatus({ loading, source, error, localError, saving, refreshing } = {}) {
  if (loading) return "loading";
  if (localError) return source === "supabase" && !error && !saving && !refreshing ? "onlineNoLocal" : "localError";
  if (saving || refreshing) return "saving";
  if (source === "supabase" && !error) return "online";
  if (error || source === "partial") return "retry";
  if (source === "pending-upload") return "pending";
  return "device";
}
