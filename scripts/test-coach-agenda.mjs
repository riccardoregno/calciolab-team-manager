import assert from "node:assert/strict";
import { buildCoachAgenda, getAgendaDateKey, completeSectionOrder, prioritizeCoachAlerts } from "../src/utils/coachAgenda.js";
const now = new Date(2026, 9, 24, 12);
const sessions = [
 { id:"late",date:"2026-10-26",time:"18:00" },
 { id:"today-late",date:"2026-10-24",time:"19:00" },
 { id:"today-early",date:"2026-10-24",time:"09:00" },
 { id:"invalid",date:"2026-02-30" },
 { id:"before",date:"2026-10-23" },
 { id:"boundary",date:"2026-10-30" },
 { id:"outside",date:"2026-10-31" },
 { id:"finished",date:"2026-10-24",completed:true },
 { id:"tomorrow",date:"2026-10-25" },
 { id:"no-time",date:"2026-10-24" },
];
const matches = [{id:"match",date:"2026-10-24",time:"17:00",opponent:"Ospiti"}];
const original = JSON.stringify(sessions);
const agenda = buildCoachAgenda(sessions,matches,now);
assert.equal(agenda.nextEvent.id,"match");
assert.equal(agenda.nextMatch.type,"Partita");
assert.equal(agenda.nextTraining.id,"today-late");
assert.equal(agenda.todayEvents.length,5);
assert.equal(agenda.weekEvents.length,8,"seven-day count must include more than five events");
assert.equal(agenda.weekEvents.some(e=>e.id==="boundary"),true);
assert.equal(agenda.weekEvents.some(e=>e.id==="outside"),false);
assert.deepEqual(agenda.pastEvents.map(e=>e.id),["finished","today-early","before"]);
assert.equal(agenda.events.some(e=>e.id==="invalid"),false);
assert.equal(JSON.stringify(sessions),original,"sorting and normalization must not change source data");
assert.equal(buildCoachAgenda([],[],now).nextEvent,null);
assert.equal(getAgendaDateKey("2028-02-29"),"2028-02-29");
assert.equal(getAgendaDateKey("2026-02-29"),"");
assert.equal(getAgendaDateKey(new Date(NaN)),"");
assert.equal(getAgendaDateKey("2026-10-24T00:00:00Z"),"2026-10-24");
assert.equal(getAgendaDateKey(""),"");
const year = buildCoachAgenda([{id:1,date:"2027-01-03"},{id:2,date:"2027-01-04"}],[],new Date(2026,11,28,12));
assert.deepEqual(year.weekEvents.map(e=>e.id),[1]);
assert.deepEqual(completeSectionOrder(["b","b","gone"],["a","b","c"]),["b","a","c"]);
assert.deepEqual(completeSectionOrder(null,["a","b"]),["a","b"]);
const alerts=[{tone:"green",text:"OK"},{tone:"orange",text:"Review",path:"/a"},{tone:"red",text:"Urgent"},{tone:"orange",text:"Review",path:"/a"},{text:""}];
assert.deepEqual(prioritizeCoachAlerts(alerts).map(a=>a.text),["Urgent","Review","OK"]);
assert.equal(alerts.length,5);

assert.equal(prioritizeCoachAlerts([{text:"Same",tone:"green"},{text:"Same",tone:"red"}])[0].tone,"red");

console.log("Coach agenda tests passed");
