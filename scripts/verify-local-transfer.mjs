import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";
import { createClient } from "@supabase/supabase-js";

const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
if (!configPath) throw new Error("Set CALCIOLAB_LOCAL_PUBLIC_CONFIG to the local public configuration file.");
const config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
assert.match(config.url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
assert.ok(config.publicKey);
process.env.VITE_SUPABASE_URL = config.url;
process.env.VITE_SUPABASE_ANON_KEY = config.publicKey;
process.env.VITE_TEAM_BILLING_LOCAL_TEST = "false";
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const checked = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
try {
  const { supabase } = await server.ssrLoadModule("/src/lib/supabaseClient.js");
  const { ensureDefaultTeam } = await server.ssrLoadModule("/src/services/auth.js");
  const { saveTeamTablesState, loadRemoteState } = await server.ssrLoadModule("/src/services/teamData.js");
  const { normalizeAppState, hasPlayerTransferred, getTrainingAttendanceSummary, getPlayerMatchEntries, localDateString } =
    await server.ssrLoadModule("/src/utils/helpers.js");
  const { buildEntityChanges } = await server.ssrLoadModule("/src/utils/syncHelpers.js");
  const email = "qa-transfer-" + Date.now() + "@example.com";
  const password = "CalcioLab-QA!2026";
  const registration = checked(await supabase.auth.signUp({
    email, password, options: { data: { first_name: "QA", last_name: "Transfer" } },
  }));
  assert.ok(registration.session, "Local Auth must return a confirmed test session.");
  const ensured = await ensureDefaultTeam(registration.user);
  if (ensured.error) throw new Error(ensured.error.message);
  const team = ensured.team;
  assert.ok(team?.id);
  checked(await supabase.from("teams").update({ name: "QA Trasferimento", onboarding_completed: true }).eq("id", team.id));
  const today = localDateString();
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const futureDate = localDateString(future);
  const past = new Date();
  past.setDate(past.getDate() - 7);
  const pastDate = localDateString(past);
  const players = Array.from({ length: 25 }, (_, i) => ({
    id: crypto.randomUUID(), firstName: "Giocatore", lastName: "QA" + String(i + 1).padStart(2, "0"),
    name: "Giocatore QA" + String(i + 1).padStart(2, "0"), role: "Centrocampista", gruppo: "prima", status: "Disponibile",
  }));
  const firstId = players[0].id;
  const seed = normalizeAppState({
    players,
    sessions: [{ id: crypto.randomUUID(), type: "Allenamento", date: pastDate, completed: true,
      attendance: { [firstId]: { status: "Presente" } } }],
    matches: [{ id: crypto.randomUUID(), type: "Partita", matchKind: "Campionato", date: pastDate,
      attendance: { [firstId]: { minutes: 65, goals: 1 } } }],
  });
  const initial = await saveTeamTablesState(seed, team.id, { keys: ["players", "sessions", "matches"] });
  assert.equal(initial.source, "supabase", initial.error?.message);
  let baseline = (await loadRemoteState({ teamId: team.id })).state;
  assert.equal(baseline.players.length, 25);
  const changed = { ...baseline, players: baseline.players.map((p) => ({
    ...p, transferDate: p.id === firstId ? today : p.id === players[1].id ? futureDate : "",
  })) };
  const changes = buildEntityChanges(baseline, changed, ["players"]);
  const saved = await saveTeamTablesState(changed, team.id, { keys: ["players"], entityChanges: changes });
  assert.equal(saved.source, "supabase", saved.error?.message);
  // Independent second Auth session and a fresh database read.
  const second = createClient(config.url, config.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  checked(await second.auth.signInWithPassword({ email, password }));
  const rows = checked(await second.from("players").select("id,data,updated_at").eq("team_id", team.id));
  assert.equal(rows.length, 25);
  const reread = rows.map((row) => ({ ...row.data, id: row.id }));
  assert.equal(reread.filter((p) => !hasPlayerTransferred(p, today)).length, 24);
  assert.equal(reread.filter((p) => hasPlayerTransferred(p, today)).length, 1);
  assert.equal(reread.filter((p) => !hasPlayerTransferred(p, futureDate)).length, 23);
  const transferred = reread.find((p) => p.id === firstId);
  assert.equal(getTrainingAttendanceSummary(transferred, baseline.sessions, { requireConfirmedPresence: true }).trainingPresences, 1);
  const games = getPlayerMatchEntries(transferred, baseline.matches, [], false);
  assert.equal(games.length, 1);
  assert.equal(games[0].data.minutes, 65);
  const replay = await saveTeamTablesState(changed, team.id, { keys: ["players"], entityChanges: changes });
  assert.equal(replay.source, "supabase", replay.error?.message);
  writeFileSync(join(dirname(configPath), "calciolab-transfer-fixture.json"), JSON.stringify({
    email, teamId: team.id, transferredPlayerId: firstId, futurePlayerId: players[1].id,
  }, null, 2));
  console.log("PASS local transfer: online save, fresh Auth session, 24 active / 1 archived, future date and 65 historical minutes.");
  console.log("Fixture account: " + email);
} finally {
  await server.close();
}

