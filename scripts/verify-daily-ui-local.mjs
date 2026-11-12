import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";
const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
assert.match(config.url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const fixture = JSON.parse(readFileSync(join(dirname(configPath), "calciolab-daily-ui-fixture.json"), "utf8"));
process.env.VITE_SUPABASE_URL = config.url;
process.env.VITE_SUPABASE_ANON_KEY = config.publicKey;
process.env.VITE_TEAM_BILLING_LOCAL_TEST = "false";
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key,value), removeItem: key => memory.delete(key) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { supabase } = await server.ssrLoadModule("/src/lib/supabaseClient.js");
  const { loadRemoteState } = await server.ssrLoadModule("/src/services/teamData.js");
  const helpers = await server.ssrLoadModule("/src/utils/helpers.js");
  const auth = await supabase.auth.signInWithPassword({ email: fixture.email, password: "CalcioLab-QA!2026" });
  assert.ifError(auth.error);
  const remote = await loadRemoteState({ teamId: fixture.teamId });
  assert.ifError(remote.error);
  const { players, sessions, matches } = remote.state;
  assert.equal(players.length,25);
  const active = players.filter(player => !helpers.hasPlayerTransferred(player));
  assert.equal(active.length,24);
  assert.equal(active.filter(player => player.status === "Disponibile").length,23);
  const session = sessions.find(event => event.id === fixture.sessionId);
  const selected = fixture.players.slice(0,3).map(({ id }) => players.find(player => player.id === id));
  assert.equal(helpers.getRecordedTrainingStatus(selected[0], session), "Presente");
  assert.equal(helpers.getRecordedTrainingStatus(selected[1], session), "Da confermare");
  assert.equal(helpers.getRecordedTrainingStatus(selected[2], session), null);
  for (const period of [[session], sessions]) {
    const summaries = selected.map(player => helpers.getTrainingAttendanceSummary(player,period,{requireConfirmedPresence:true}));
    const previous = period.length-1;
    assert.deepEqual(summaries.map(row=>[row.trainingPresences,row.pendingTrainings]), [[previous+1,0],[previous,1],[previous,1]]);
  }
  const match = matches.find(event => event.id === fixture.matchId);
  const minutes = selected.map(player => helpers.getPlayerMatchEntries(player,[match],[],false)[0].data.minutes);
  assert.deepEqual(minutes,[0,65,null]);
  console.log("PASS Supabase locale: 25 profili, 24 attivi, 23 disponibili; Presente / Da confermare / nessuno stato coerenti in 1 e 4 settimane; minuti 0 / 65 / sconosciuti.");
} finally { await server.close(); }
