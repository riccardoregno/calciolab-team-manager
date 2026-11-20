import assert from "node:assert/strict";
import { getRosterReturnPath, getRosterWeekPath, getRegisterReturnPath, getRegisterRosterPath, withRosterContext } from "../src/utils/rosterNavigation.js";
import { buildCoachTasks } from "../src/utils/coachTasks.js";
import { buildCoachAnalysis } from "../src/utils/coachAnalysis.js";
import { confirmUnrecordedTrainingPresences } from "../src/utils/helpers.js";
import { it } from "../src/i18n/locales/it.js";
import { en } from "../src/i18n/locales/en.js";
import { getAttendanceWorklistPlayers, filterAttendancePlayers } from '../src/utils/attendanceWorklist.js';

const path = "/statistics?roster=1&rosterView=4&rosterWeek=2026-11-02&rosterPending=1&rosterSort=minutes";
const searchable = [{ id: 1, name: 'Nicolò Della Valle' }, { id: 2, firstName: 'Andrea', lastName: 'Rossi' }, { id: 3, name: 'Nicolò Della Valle' }];
assert.deepEqual(filterAttendancePlayers(searchable, '1').map(p => p.id), [1], 'Quadro selects the identity, including homonyms');
assert.deepEqual(filterAttendancePlayers(searchable, null, ' VALLE nicolo ').map(p => p.id), [1, 3], 'Search supports accents, whitespace and reversed name order');
assert.deepEqual(filterAttendancePlayers(searchable, null, 'andrea rossi').map(p => p.id), [2]);
assert.deepEqual(filterAttendancePlayers(searchable, 'unknown'), [], 'A stale player link does not silently select someone else');
assert.equal(filterAttendancePlayers(searchable, null, '').length, 3);
assert.equal(getRosterReturnPath({ rosterReturn: path }), path, "Correction returns to the same view, week, pending filter and order");
assert.equal(getRosterReturnPath({ rosterReturn: "https://example.com" }), null);
assert.equal(getRosterReturnPath({ rosterReturn: '/statistics?competition=league&roster=1&rosterView=4' }), '/statistics?competition=league&roster=1&rosterView=4', 'Return does not depend on query parameter order');
assert.equal(getRosterReturnPath({ rosterWeek: "2026-11-02", rosterView: "4", rosterPending: true }), "/statistics?roster=1&rosterWeek=2026-11-02&rosterView=4&rosterPending=1");
assert.equal(getRosterWeekPath('2026-10-04'), '/statistics?roster=1&rosterWeek=2026-09-28', 'Sunday correction opens the week spanning two months');
assert.equal(getRosterWeekPath('2026-10-05'), '/statistics?roster=1&rosterWeek=2026-10-05');
assert.equal(getRosterWeekPath('2026-02-30'), '/statistics?roster=1', 'Invalid calendar dates do not invent a week');
assert.equal(getRegisterReturnPath({ registerReturn: '/attendance-register?month=2026-10&group=prima&search=Rossi' }), '/attendance-register?month=2026-10&group=prima&search=Rossi');
assert.equal(getRegisterReturnPath({ registerReturn: 'https://example.com/attendance-register' }), null);
assert.equal(getRegisterReturnPath({ registerReturn: '/attendance-register-other' }), null);
const correctionPath=withRosterContext('/session-attendance/session%20%2F%20qa',{playerId:'player / qa',rosterReturn:path});
const correctionQuery=correctionPath.slice(correctionPath.indexOf('?'));
assert.equal(new URLSearchParams(correctionQuery).get('player'),'player / qa');
assert.equal(getRosterReturnPath(undefined,correctionQuery),path,'A copied correction URL retains its complete four-week context without history state');
assert.equal(getRosterReturnPath({rosterReturn:'/statistics?roster=1'},correctionQuery),path,'The explicit URL takes precedence over stale history state');
const registerPath=withRosterContext('/attendance-register?month=2026-10&search=Della+Valle',{rosterReturn:path});
const sessionFromRegister=withRosterContext('/session-attendance/session',{registerReturn:registerPath});
const recoveredRegister=getRegisterReturnPath(undefined,sessionFromRegister.slice(sessionFromRegister.indexOf('?')));
assert.equal(recoveredRegister,registerPath,'Month, search and nested Quadro return survive opening a register correction in a new tab');
assert.equal(getRosterReturnPath(undefined,recoveredRegister.slice(recoveredRegister.indexOf('?'))),path);
assert.equal(getRosterReturnPath(undefined,'?rosterReturn='+encodeURIComponent('https://example.com/statistics?roster=1')),null);
assert.equal(getRegisterReturnPath(undefined,'?registerReturn='+encodeURIComponent('//example.com/attendance-register')),null);
assert.equal(getRosterReturnPath(undefined,'?rosterReturn='+encodeURIComponent('/statistics?roster=1#other')),null);
assert.equal(withRosterContext('/session-attendance/session',{rosterReturn:'https://example.com'}),'/session-attendance/session');
const registerEvents = [{ date: '2026-10-05' }, { date: '2026-10-20' }, { date: '2026-11-10' }];
assert.equal(getRegisterRosterPath('2026-10', registerEvents, new Date(2026,10,13)), '/statistics?roster=1&rosterWeek=2026-10-19', 'Past month uses its latest session rather than the current week');
assert.equal(getRegisterRosterPath('2026-10', [], new Date(2026,10,13)), '/statistics?roster=1&rosterWeek=2026-09-28', 'Empty past month opens its first week');

const now = new Date(2026, 10, 11, 12);
const missingScoreTask=buildCoachTasks({matches:[{id:'score / missing',date:'2026-11-10',type:'Partita'}],now}).find(task=>task.kind==='result');
assert.equal(missingScoreTask.to,'/match-completion/score%20%2F%20missing','A result task opens the editable match sheet, not the narrative report');
assert.equal(missingScoreTask.state.fromDashboard,true);
const players = ["present", "pending", "missing", "absent", "injured", "transferred", "future"].map(id => ({ id, status: "Disponibile", gruppo: "prima", ...(id === "transferred" ? { transferDate: "2026-11-09" } : id === "future" ? { transferDate: "2026-11-20" } : {}) }));
const session = { id: "session", type: "Allenamento", date: "2026-11-10", completed: true, attendance: {
  present: { status: "Presente" }, pending: { status: "Da confermare" }, absent: { status: "Assente" }, injured: { status: "Infortunato" }, future: { status: "Presente" },
} };
const tasks = buildCoachTasks({ players, sessions: [session], now });
assert.equal(tasks.length, 1);
assert.equal(tasks[0].count, 1, "Only an explicitly saved pending status requires confirmation; missing records follow the calendar rule");
assert.equal(tasks[0].to, "/session-attendance/session");
const confirmed = confirmUnrecordedTrainingPresences(session, players);
const after = buildCoachTasks({ players, sessions: [confirmed], now });
const candidates=players.filter(player=>player.id!=='transferred');
const reviewed={sessionId:'session',ids:['missing','transferred']};
assert.deepEqual(getAttendanceWorklistPlayers(candidates,['pending'],reviewed,'session').map(player=>player.id),['pending','missing'],'A just-confirmed row remains reviewable; ineligible players do not reappear');
assert.deepEqual(getAttendanceWorklistPlayers(candidates,['pending'],{sessionId:'session',ids:[]},'session').map(player=>player.id),['pending'],'Explicit refresh removes completed rows without changing saved exceptions');
assert.deepEqual(getAttendanceWorklistPlayers(candidates,['pending'],reviewed,'other-session').map(player=>player.id),['pending'],'Reviewed rows cannot leak into another session');
assert.equal(after[0].count, 1, "Collective confirmation preserves explicitly saved pending status");
assert.equal(confirmed.attendance.absent.status, "Assente");
assert.equal(confirmed.attendance.injured.status, "Infortunato");
assert.equal(confirmed.attendance.missing.status, "Presente");

const model = buildCoachAnalysis({ players, now });
assert.equal(model.roster.length, 6, "Current dashboard roster excludes effective transfers");
assert.ok(model.roster.some(player => player.id === "future"), "Future transfer remains active");
assert.deepEqual(Object.keys(it.dailyUi).sort(), Object.keys(en.dailyUi).sort());
for (const [key, value] of Object.entries(it.dailyUi)) {
  assert.ok(value && en.dailyUi[key]);
  assert.deepEqual(value.match(/\{\{\w+\}\}/g)?.sort(), en.dailyUi[key].match(/\{\{\w+\}\}/g)?.sort(), `Translation parameters: ${key}`);
}
console.log("Daily workflow: correction context, attendance exceptions, effective transfers and IT/EN translations passed.");
