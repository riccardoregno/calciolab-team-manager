import { getAgendaDateKey, getAgendaEventTime } from "./coachAgenda.js";
import { formatDate, localDateString, parseMatchResult } from "./helpers.js";
import { searchNavigationItems } from "./navigationSearch.js";

export function getTrainingDuration(session = {}) {
  const minutes = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  const detailed = (session.sessionBlocks || []).reduce((sum, block) => sum + minutes(block.duration), 0) +
    (session.exercises || []).reduce((sum, item) => sum + minutes(item.customDuration ?? item.duration), 0);
  return detailed || minutes(session.duration ?? session.plannedDuration) || null;
}

export function hasTrainingEnded(session, now = new Date()) {
  const date = getAgendaDateKey(session.date);
  const today = localDateString(now);
  if (!date || date > today) return false;
  if (date < today || session.completed) return true;
  const time = String(session.time || session.startTime || session.start_time || "").match(/^(\d{1,2}):(\d{2})/);
  const duration = getTrainingDuration(session);
  if (!time || !duration || Number(time[1]) > 23 || Number(time[2]) > 59) return false;
  const endMinute = Number(time[1]) * 60 + Number(time[2]) + duration;
  return endMinute <= now.getHours() * 60 + now.getMinutes();
}

export function getTrainingStatus(session, today = localDateString()) {
  const date = getAgendaDateKey(session.date);
  if (session.isFriendlyMatch && parseMatchResult(session.result, session)) return "completed";
  if (session.completed) return "completed";
  if (!date) return "toCheck";
  if (date < today) return session.isFriendlyMatch ? "toCheck" : "completed";
  return date === today ? "today" : "scheduled";
}

export function getRecentTrainingLoad(sessions, now = new Date()) {
  const today = getAgendaDateKey(now);
  const firstDay = getAgendaDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 12));

  return sessions.flatMap((session) => {
    const date = getAgendaDateKey(session.date);
    if (!date || date < firstDay || date > today) return [];

    const values = Object.values(session.attendance || {})
      .map((entry) => Number(entry?.rpe))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return [];

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [{
      id: session.id,
      title: session.title,
      date,
      time: getAgendaEventTime(session),
      average: Math.round(average * 10) / 10,
      count: values.length,
    }];
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "24:00").localeCompare(b.time || "24:00"));
}

export function buildTrainingArchive(sessions = [], { today = localDateString(), view = "auto", search = "" } = {}) {
  const upcoming = (session) => Boolean(getAgendaDateKey(session.date) && getAgendaDateKey(session.date) >= today && getTrainingStatus(session, today) !== "completed");
  const history = (session) => Boolean((getAgendaDateKey(session.date) && getAgendaDateKey(session.date) < today) || getTrainingStatus(session, today) === "completed");
  const counts = { upcoming: sessions.filter(upcoming).length, history: sessions.filter(history).length, all: sessions.length };
  const activeView = view === "auto" ? (counts.upcoming ? "upcoming" : counts.history ? "history" : "all") : view;
  const filtered = sessions.filter((session) => activeView === "upcoming" ? upcoming(session) : activeView === "history" ? history(session) : true);
  const searched = searchNavigationItems(filtered, search, (session) => [session.title, session.theme, session.objective, session.date, getAgendaDateKey(session.date) ? formatDate(session.date) : ""].filter(Boolean).join(" "));
  const items = [...searched].sort((a, b) => {
    const ad = getAgendaDateKey(a.date), bd = getAgendaDateKey(b.date);
    if (!ad || !bd) return ad ? -1 : bd ? 1 : 0;
    if (activeView === "all" && upcoming(a) !== upcoming(b)) return upcoming(a) ? -1 : 1;
    const chronological = `${ad}T${a.time || ""}`.localeCompare(`${bd}T${b.time || ""}`);
    return activeView === "upcoming" || (activeView === "all" && upcoming(a)) ? chronological : -chronological;
  });
  return { activeView, counts, items };
}
