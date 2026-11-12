import assert from "node:assert/strict";
import { getRosterReturnPath } from "../src/utils/rosterNavigation.js";
import { buildCoachTasks } from "../src/utils/coachTasks.js";
import { buildCoachAnalysis } from "../src/utils/coachAnalysis.js";
import { confirmUnrecordedTrainingPresences } from "../src/utils/helpers.js";
import { it } from "../src/i18n/locales/it.js";
import { en } from "../src/i18n/locales/en.js";

const path = "/statistics?roster=1&rosterView=4&rosterWeek=2026-11-02&rosterPending=1&rosterSort=minutes";
assert.equal(getRosterReturnPath({ rosterReturn: path }), path, "Correction returns to the same view, week, pending filter and order");
assert.equal(getRosterReturnPath({ rosterReturn: "https://example.com" }), null);
assert.equal(getRosterReturnPath({ rosterWeek: "2026-11-02", rosterView: "4", rosterPending: true }), "/statistics?roster=1&rosterWeek=2026-11-02&rosterView=4&rosterPending=1");

const now = new Date(2026, 10, 11, 12);
const players = ["present", "pending", "missing", "absent", "injured", "transferred", "future"].map(id => ({ id, status: "Disponibile", gruppo: "prima", ...(id === "transferred" ? { transferDate: "2026-11-09" } : id === "future" ? { transferDate: "2026-11-20" } : {}) }));
const session = { id: "session", type: "Allenamento", date: "2026-11-10", completed: true, attendance: {
  present: { status: "Presente" }, pending: { status: "Da confermare" }, absent: { status: "Assente" }, injured: { status: "Infortunato" }, future: { status: "Presente" },
} };
const tasks = buildCoachTasks({ players, sessions: [session], now });
assert.equal(tasks.length, 1);
assert.equal(tasks[0].count, 2, "Saved pending and absent record both need confirmation; absence, injury and transfer are exceptions");
assert.equal(tasks[0].to, "/session-attendance/session");
const confirmed = confirmUnrecordedTrainingPresences(session, players);
const after = buildCoachTasks({ players, sessions: [confirmed], now });
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
