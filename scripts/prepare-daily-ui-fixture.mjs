import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";

const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
assert.match(config.url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
process.env.VITE_SUPABASE_URL = config.url;
process.env.VITE_SUPABASE_ANON_KEY = config.publicKey;
process.env.VITE_TEAM_BILLING_LOCAL_TEST = "false";
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: (k) => storage.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { supabase } = await server.ssrLoadModule("/src/lib/supabaseClient.js");
  const { ensureDefaultTeam } = await server.ssrLoadModule("/src/services/auth.js");
  const { saveTeamTablesState } = await server.ssrLoadModule("/src/services/teamData.js");
  const { normalizeAppState, localDateString } = await server.ssrLoadModule("/src/utils/helpers.js");
  const email = `qa-percorso-${Date.now()}@example.com`;
  const signup = await supabase.auth.signUp({ email, password: "CalcioLab-QA!2026", options: { data: { first_name: "Mister", last_name: "Collaudo" } } });
  assert.ifError(signup.error);
  assert.ok(signup.data.session);
  const { team, error } = await ensureDefaultTeam(signup.data.user);
  assert.ifError(error);
  const renamed = await supabase.from("teams").update({ name: "AS Collaudo Â· Prima squadra", onboarding_completed: true }).eq("id", team.id);
  assert.ifError(renamed.error);
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7, 12);
  const day = (offset) => { const d = new Date(monday); d.setDate(d.getDate()+offset); return localDateString(d); };
  const surnames = ["De Santis Monteverde", "Della Valle Castiglioni", "Bianchi della Rovere", "Rossi", "Ferrari", "Esposito", "Conti", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "De Angelis"];
  const players = surnames.map((lastName, i) => ({
    id: crypto.randomUUID(), name: `Luca ${lastName}`, firstName: "Luca", lastName,
    role: i < 2 ? "Portiere" : i < 10 ? "Difensore" : i < 19 ? "Centrocampista" : "Attaccante", gruppo: "prima", status: i === 4 ? "Infortunato" : "Disponibile",
    injuries: i === 4 ? [{ id: crypto.randomUUID(), dateStart: day(-14), dateEnd: day(14), type: "Muscolare" }] : [],
    transferDate: i === 24 ? day(0) : "",
  }));
  const sessionId = crypto.randomUUID();
  const session = (id, offset, incomplete) => ({ id, type: "Allenamento", title: incomplete ? "ContinuitÃ  e possesso" : "Preparazione gara", date: day(offset), time: "18:00", completed: true, duration: 75,
    attendance: Object.fromEntries(players.map((p,i) => incomplete && i === 2 ? null : [p.id, { status: incomplete && i === 1 ? "Da confermare" : i === 4 ? "Infortunato" : incomplete && i === 3 ? "Assente" : "Presente" }]).filter(Boolean)) });
  const matchId = crypto.randomUUID();
  const state = normalizeAppState({ players, sessions: [session(sessionId, 1, true), session(crypto.randomUUID(), -5, false)], matches: [{ id: matchId, type: "Partita", matchKind: "Campionato", title: "Gara di collaudo", opponent: "AS Esempio", date: day(-1), result: "2-1", completed: true,
    convocazione: { published: true, playerIds: players.slice(0,24).map(p=>p.id) },
    attendance: Object.fromEntries(players.slice(0,24).map((p,i)=>[p.id,{ ...(i === 2 ? {} : { minutes: i === 0 ? 0 : i === 1 ? 65 : 30 }), goals: 0 }])) }] });
  const saved = await saveTeamTablesState(state, team.id, { keys: ["players","sessions","matches"] });
  assert.equal(saved.source,"supabase",saved.error?.message);
  writeFileSync(join(dirname(configPath),"calciolab-daily-ui-fixture.json"),JSON.stringify({email,teamId:team.id,sessionId,matchId,week:day(0),players:players.map(p=>({id:p.id,name:p.name}))},null,2));
  console.log("PASS fixture locale: 25 giocatori, un trasferito, un infortunato, presenze e minutaggi incompleti.");
} finally { await server.close(); }
