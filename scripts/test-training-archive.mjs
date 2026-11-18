import assert from "node:assert/strict";
import { buildTrainingArchive, getTrainingDuration, getTrainingStatus, hasTrainingEnded } from "../src/utils/trainingArchive.js";
import { getAgendaEventTime, getEventTimeUpdate } from '../src/utils/coachAgenda.js';

const today = "2026-11-05";
const legacyTime = { id:'legacy-time',date:'2026-11-06',time:'',startTime:'9:05',start_time:'19:30:00',attendance:{qa:{status:'Assente'}},sessionBlocks:[{duration:30}] };
const originalTime = JSON.stringify(legacyTime);
assert.equal(getAgendaEventTime(legacyTime),'09:05');
const changedTime = {...legacyTime,...getEventTimeUpdate('20:15')};
assert.equal(getAgendaEventTime(changedTime),'20:15');
assert.deepEqual(changedTime.attendance,legacyTime.attendance);
assert.deepEqual(changedTime.sessionBlocks,legacyTime.sessionBlocks);
const clearedTime = JSON.parse(JSON.stringify({...changedTime,...getEventTimeUpdate('')}));
assert.equal(getAgendaEventTime(clearedTime),'','Clearing time cannot resurrect either legacy alias after a saved round trip');
assert.equal(clearedTime.startTime,null);
assert.equal(clearedTime.start_time,null);
assert.equal(JSON.stringify(legacyTime),originalTime,'Only explicitly saved event updates may change time data');
assert.equal(getEventTimeUpdate('9:05:00').time,'09:05');
const timedSession = {date:today,duration:75,...getEventTimeUpdate('19:30')};
assert.equal(hasTrainingEnded(timedSession,new Date(2026,10,5,20,44)),false,'A 75 minute session at 19:30 is still underway at 20:44');
assert.equal(hasTrainingEnded(timedSession,new Date(2026,10,5,20,45)),true);
const withoutTime = {...timedSession,...getEventTimeUpdate('')};
assert.equal(hasTrainingEnded(withoutTime,new Date(2026,10,5,23,59)),false,'Cleared time cannot silently retain the old end time');
assert.equal(hasTrainingEnded(withoutTime,new Date(2026,10,6,0,1)),true,'Past calendar sessions still follow the established attendance rule');
const sessions = [
  { id: "old", title: "Possesso", date: "2026-10-28", completed: true, duration: 90 },
  { id: "tomorrow", title: "Intensità", date: "2026-11-06", duration: 75 },
  { id: "today", title: "Rifinitura", date: today, time: "18:00" },
  { id: "past-pending", title: "Recupero", date: "2026-11-03" },
  { id: "future-done", date: "2026-11-10", completed: true },
  { id: "bad-date", date: "2026-02-30" },
  { id: "friendly", title: "Amichevole", date: "2026-11-02", isFriendlyMatch: true, location: "Trasferta", result: "0-2" },
];
const before = JSON.stringify(sessions);
const auto = buildTrainingArchive(sessions, { today });
assert.equal(auto.activeView, "upcoming");
assert.deepEqual(auto.items.map((s) => s.id), ["today", "tomorrow"]);
assert.deepEqual(auto.counts, { upcoming: 2, history: 4, all: 7 });
assert.deepEqual(buildTrainingArchive(sessions, { today, view: "history" }).items.map((s) => s.id), ["future-done", "past-pending", "friendly", "old"]);
assert.equal(buildTrainingArchive(sessions, { today, view: "all" }).items.at(-1).id, "bad-date");
assert.equal(buildTrainingArchive(sessions, { today, view: "all", search: "intensita" }).items[0].id, "tomorrow");
assert.equal(buildTrainingArchive(sessions.filter((s) => s.date < today), { today }).activeView, "history");
assert.equal(buildTrainingArchive([{ id: "unknown", date: "2026-02-30" }], { today }).activeView, "all", "Undated or invalid sessions must remain discoverable");
assert.equal(getTrainingStatus(sessions[3], today), "completed", "Past training is complete without a manual flag");
assert.equal(getTrainingStatus(sessions[6], today), "completed");
assert.equal(getTrainingStatus({ ...sessions[6], result: "" }, today), "toCheck");
assert.equal(getTrainingDuration({ duration: 90 }), 90, "Legacy sessions without a detailed plan keep their saved duration");
assert.equal(getTrainingDuration({ plannedDuration: "75" }), 75, "A session can have duration without exercises or blocks");
assert.equal(getTrainingDuration({ duration: 90, sessionBlocks: [{ duration: 30 }], exercises: [{ customDuration: 15 }] }), 45);
assert.equal(getTrainingDuration({ duration: "" }), null, "Missing duration is not a displayed zero-minute session");
assert.equal(getTrainingDuration({ duration: -3 }), null);
assert.equal(getTrainingDuration({ duration: Infinity }), null);
assert.equal(JSON.stringify(sessions), before, "Sorting must not modify session data");
console.log("Training archive: future/history filters, completed state, search and legacy/manual duration passed");
