// Calendar dates stay local and are compared as YYYY-MM-DD, never as 24-hour offsets.
function localKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
export function getAgendaDateKey(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : localKey(value);
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12);
  return localKey(date) === y + "-" + m + "-" + d ? localKey(date) : "";
}
function clock(event) {
  const match = String(event.time || event.startTime || "").match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? match[1] + ":" + match[2] : "24:00";
}
export function buildCoachAgenda(sessions = [], matches = [], now = new Date()) {
  const today = localKey(now);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 12);
  const end = localKey(endDate);
  const nowClock = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const events = [
    ...sessions.map((event) => ({ ...event, type: event.type || "Allenamento" })),
    ...matches.map((event) => ({ ...event, type: event.type || "Partita" })),
  ].filter((event) => getAgendaDateKey(event.date))
    .sort((a, b) => getAgendaDateKey(a.date).localeCompare(getAgendaDateKey(b.date)) || clock(a).localeCompare(clock(b)));
  const upcoming = events.filter((event) => getAgendaDateKey(event.date) >= today);
  const futureEvents = upcoming.filter((event) => !event.completed && (getAgendaDateKey(event.date) > today || clock(event) > nowClock));
  return {
    events,
    futureEvents,
    todayEvents: upcoming.filter((event) => getAgendaDateKey(event.date) === today),
    weekEvents: upcoming.filter((event) => getAgendaDateKey(event.date) <= end),
    nextEvent: futureEvents[0] || null,
    nextTraining: futureEvents.find((event) => event.type !== "Partita") || null,
    nextMatch: futureEvents.find((event) => event.type === "Partita") || null,
    pastEvents: events.filter((event) => {
      const date = getAgendaDateKey(event.date);
      return date < today || (date === today && (event.completed || clock(event) <= nowClock));
    }).reverse(),
  };
}
export function completeSectionOrder(savedOrder, knownKeys) {
  return [...new Set([...(Array.isArray(savedOrder) ? savedOrder : []), ...knownKeys])].filter((key) => knownKeys.includes(key));
}

export function prioritizeCoachAlerts(alerts = []) {
  const rank = { red: 0, orange: 1, blue: 2, purple: 3, green: 4 };
  const seen = new Set();
  return [...alerts].sort((a, b) => (rank[a.tone] ?? 2) - (rank[b.tone] ?? 2)).filter((alert) => {
    const key = String(alert.text || "") + "\0" + String(alert.path || "");
    if (!alert.text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
