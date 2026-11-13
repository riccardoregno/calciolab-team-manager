import { getAgendaDateKey } from './coachAgenda.js';

export function getRosterWeekPath(value) {
  const date = getAgendaDateKey(value);
  if (!date) return '/statistics?roster=1';
  const monday = new Date(date + 'T12:00:00');
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return '/statistics?' + new URLSearchParams({ roster: '1', rosterWeek: getAgendaDateKey(monday) });
}

export function getRegisterReturnPath(state) {
  const path = state?.registerReturn;
  return typeof path === 'string' && /^\/attendance-register(?:\?[^#]*)?$/.test(path) ? path : null;
}

export function getRegisterRosterPath(month, events, now = new Date()) {
  const today = getAgendaDateKey(now);
  const dates = events.map(event => getAgendaDateKey(event.date))
    .filter(date => date && date.startsWith(month + '-') && date <= today).sort();
  return getRosterWeekPath(dates.at(-1) || (today.startsWith(month + '-') ? today : month + '-01'));
}

// Keep the complete roster context when opening an event and returning to it.
export function getRosterReturnPath(state) {
  if (typeof state?.rosterReturn === "string" && state.rosterReturn.startsWith('/statistics?') &&
    !state.rosterReturn.includes('#') && new URLSearchParams(state.rosterReturn.split('?')[1]).get('roster') === '1') return state.rosterReturn;
  if (!state?.rosterWeek) return null;
  const params = new URLSearchParams({ roster: "1", rosterWeek: state.rosterWeek });
  if (state.rosterView === "4") params.set("rosterView", "4");
  if (state.rosterPending) params.set("rosterPending", "1");
  return "/statistics?" + params.toString();
}
