export const teamBillingTestEnabled = import.meta.env?.VITE_TEAM_BILLING_LOCAL_TEST === "true" &&
  /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(import.meta.env.VITE_SUPABASE_URL ?? "");

export function getTeamBillingTestState(billing, now = Date.now()) {
  if (!billing) return "free";
  if (billing.status === "active" && !(Date.parse(billing.period_end) > now)) return "canceled";
  return billing.status;
}
