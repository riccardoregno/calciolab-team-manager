import { getAgendaDateKey } from './coachAgenda.js';

export function getRosterWeekPath(value) {
  const date = getAgendaDateKey(value);
  if (!date) return '/statistics?roster=1';
  const monday = new Date(date + 'T12:00:00');
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return '/statistics?' + new URLSearchParams({ roster: '1', rosterWeek: getAgendaDateKey(monday) });
}

export function getRegisterReturnPath(state, search) {
  return [new URLSearchParams(search).get('registerReturn'), state?.registerReturn].find(path =>
    typeof path === 'string' && /^\/attendance-register(?:\?[^#]*)?$/.test(path)) || null;
}

export function getRegisterRosterPath(month, events, now = new Date()) {
  const today = getAgendaDateKey(now);
  const dates = events.map(event => getAgendaDateKey(event.date))
    .filter(date => date && date.startsWith(month + '-') && date <= today).sort();
  return getRosterWeekPath(dates.at(-1) || (today.startsWith(month + '-') ? today : month + '-01'));
}

// Keep the complete roster context when opening an event and returning to it.
export function getRosterReturnPath(state, search) {
  const path = [new URLSearchParams(search).get('rosterReturn'), state?.rosterReturn].find(value =>
    typeof value === 'string' && value.startsWith('/statistics?') &&
    !value.includes('#') && new URLSearchParams(value.slice('/statistics?'.length)).get('roster') === '1');
  if (path) return path;
  if (!state?.rosterWeek) return null;
  const params = new URLSearchParams({ roster: "1", rosterWeek: state.rosterWeek });
  if (state.rosterView === "4") params.set("rosterView", "4");
  if (state.rosterPending) params.set("rosterPending", "1");
  return "/statistics?" + params.toString();
}

// History state is kept for old links, but copied links and new tabs need the
// same validated return context in the URL. No credentials or player data here.
export function withRosterContext(path, { playerId, ...context } = {}) {
  const index = path.indexOf('?');
  const pathname = index < 0 ? path : path.slice(0,index);
  const params = new URLSearchParams(index < 0 ? '' : path.slice(index+1));
  if (playerId != null) params.set('player',String(playerId));
  const rosterReturn = getRosterReturnPath(context);
  const registerReturn = getRegisterReturnPath(context);
  if (rosterReturn) params.set('rosterReturn',rosterReturn);
  if (registerReturn) params.set('registerReturn',registerReturn);
  return pathname + (params.size ? '?' + params : '');
}
