// Keep the complete roster context when opening an event and returning to it.
export function getRosterReturnPath(state) {
  if (typeof state?.rosterReturn === "string" && /^\/statistics\?roster=1(?:&|$)/.test(state.rosterReturn)) return state.rosterReturn;
  if (!state?.rosterWeek) return null;
  const params = new URLSearchParams({ roster: "1", rosterWeek: state.rosterWeek });
  if (state.rosterView === "4") params.set("rosterView", "4");
  if (state.rosterPending) params.set("rosterPending", "1");
  return "/statistics?" + params.toString();
}
