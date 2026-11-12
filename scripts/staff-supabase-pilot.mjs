import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const productionRef = "sglevvqhlzpllrjrgbod";
const ref = process.env.CALCIOLAB_TEST_REF;
const publicKey = process.env.CALCIOLAB_TEST_PUBLIC_KEY;
const password = process.env.CALCIOLAB_TEST_PASSWORD;
const mode = process.argv[2];
if (!["seed", "verify"].includes(mode)) throw new Error("Usa seed oppure verify.");
if (!ref || !/^[a-z0-9]{20}$/.test(ref) || ref === productionRef) {
  throw new Error("CALCIOLAB_TEST_REF deve essere il riferimento di un progetto Supabase separato.");
}
if (!publicKey || !password) throw new Error("Imposta CALCIOLAB_TEST_PUBLIC_KEY e CALCIOLAB_TEST_PASSWORD.");
const jwtRole = (token) => {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role; }
  catch { return null; }
};
if (!publicKey.startsWith("sb_publishable_") && jwtRole(publicKey) !== "anon") {
  throw new Error("CALCIOLAB_TEST_PUBLIC_KEY deve essere una chiave pubblica Supabase.");
}
const url = `https://${ref}.supabase.co`;
const client = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const ownerEmail = "calciolab-pilot-mister@example.com";
const assistantEmail = "calciolab-pilot-assistente@example.com";
const ids = {
  a: "f1110000-0000-4000-8000-000000000001",
  b: "f1110000-0000-4000-8000-000000000002",
  playerA: "f1110000-0000-4000-8000-000000000003",
  playerB: "f1110000-0000-4000-8000-000000000004",
};

function checked(result, step) {
  if (result.error) throw new Error(`${step}: ${result.error.code || ""} ${result.error.message}`);
  return result.data;
}

async function login(email, admin) {
  const db = client(publicKey);
  const signIn = () => db.auth.signInWithPassword({ email, password });
  let result = await signIn();
  if (admin && result.error?.code === "invalid_credentials") {
    checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "Crea account fittizio");
    result = await signIn();
  }
  const data = checked(result, "Accedi come " + email);
  assert.equal(jwtRole(data.session?.access_token || ""), "authenticated", "Attesa una sessione Auth utente.");
  return { db, user: data.user };
}

function previousWeek() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => Number(parts.find((entry) => entry.type === type).value);
  const monday = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 7);
  const startYear = monday.getUTCFullYear() - (monday.getUTCMonth() < 6 ? 1 : 0);
  return {
    season: startYear + "/" + String(startYear + 1).slice(-2),
    dates: [0, 2, 4].map((offset) => new Date(monday.getTime() + offset * 86400000).toISOString().slice(0, 10)),
  };
}

const sessionId = (team, number) => `calciolab-pilot-${team}-${number}`;
const sessionRows = (teamId, tag, playerId, statuses, dates) => statuses.map((status, index) => {
  const id = sessionId(tag, index + 1);
  return {
    id, team_id: teamId, data: {
      id, type: "Allenamento", title: `Seduta prova ${tag}${index + 1}`, date: dates[index],
      completed: true, duration: 75, attendance: status ? { [playerId]: { status } } : {},
    },
  };
});

async function seed() {
  const key = process.env.CALCIOLAB_TEST_ADMIN_KEY;
  if (!key || key === publicKey) throw new Error("Imposta CALCIOLAB_TEST_ADMIN_KEY per il solo seed.");
  const admin = client(key);
  for (const table of ["teams", "team_members", "players", "sessions", "matches", "player_matches"]) {
    checked(await admin.from(table).select("*", { head: true }).limit(1), "Schema di test: " + table);
  }
  const { user: owner } = await login(ownerEmail, admin);
  const { user: assistant } = await login(assistantEmail, admin);
  const existing = checked(await admin.from("teams").select("id,owner_id").in("id", [ids.a, ids.b]), "Controlla squadre fixture");
  assert.ok(existing.every((row) => row.owner_id === owner.id), "Le squadre fixture devono appartenere al mister fittizio.");
  const { season, dates } = previousWeek();
  const teams = ["A", "B"].map((tag) => ({
    id: tag === "A" ? ids.a : ids.b, name: "CalcioLab Pilot " + tag, season,
    owner_id: owner.id, onboarding_completed: true,
    settings: {
      workspaceProfile: { clubName: "CalcioLab Pilot " + tag, currentSeason: season },
      members: tag === "B" ? [{
        id: "member-" + assistant.id, email: assistantEmail, name: "Assistente di prova", role: "assistantCoach",
        status: "Attivo", customAreas: { sessions: "manage" },
      }] : [],
    },
  }));
  checked(await admin.from("teams").upsert(teams), "Salva squadre fittizie");
  checked(await admin.from("team_members").upsert([
    { team_id: ids.a, user_id: owner.id, role: "owner" },
    { team_id: ids.b, user_id: owner.id, role: "owner" },
    { team_id: ids.b, user_id: assistant.id, role: "assistantCoach" },
  ], { onConflict: "team_id,user_id" }), "Salva assegnazioni staff");
  checked(await admin.from("players").upsert([[ids.a, ids.playerA, "A"], [ids.b, ids.playerB, "B"]].map(([team_id, id, tag]) => ({
    id, team_id, data: { id, firstName: "Giocatore", lastName: "Prova " + tag, name: "Giocatore Prova " + tag, gruppo: "prima", role: "Centrocampista" },
  }))), "Salva giocatori fittizi");
  checked(await admin.from("sessions").upsert([
    ...sessionRows(ids.a, "A", ids.playerA, ["Presente", "Assente", "Presente"], dates),
    ...sessionRows(ids.b, "B", ids.playerB, ["Presente", "Presente", null], dates),
  ], { onConflict: "team_id,id" }), "Salva le sedute fittizie");
  console.log("Fixture pronta. A: 2 presenti e 1 assenza. B: 2 presenti e 1 da registrare.");
}

async function verify() {
  const { db: owner } = await login(ownerEmail);
  const { db: assistant, user } = await login(assistantEmail);
  const membership = checked(await assistant.from("team_members").select("team_id,role").eq("user_id", user.id), "Membership assistente");
  assert.deepEqual(membership, [{ team_id: ids.b, role: "assistantCoach" }]);
  assert.deepEqual(checked(await assistant.from("teams").select("id").eq("id", ids.a), "Lettura squadra A come assistente"), []);
  assert.deepEqual(checked(await assistant.from("players").select("id").eq("team_id", ids.a), "Lettura rosa A come assistente"), []);
  const select = (db, teamId, id) => db.from("sessions").select("id,data").eq("team_id", teamId).eq("id", id);
  const update = (db, teamId, id, data) => db.from("sessions").update({ data }).eq("team_id", teamId).eq("id", id).select("id,data");
  const targetA = sessionId("A", 3);
  const targetB = sessionId("B", 3);
  const [originalA] = checked(await select(owner, ids.a, targetA), "Controllo positivo A come mister");
  const [originalB] = checked(await select(assistant, ids.b, targetB), "Lettura B come assistente");
  assert.ok(originalA && originalB, "Esegui seed prima della verifica.");
  assert.equal(originalB.data.attendance[ids.playerB], undefined, "La presenza B3 deve partire mancante.");
  assert.deepEqual(checked(await select(assistant, ids.a, targetA), "Lettura A come assistente"), []);
  const denied = await update(assistant, ids.a, targetA, { ...originalA.data, title: "Tentativo RLS fittizio" });
  if (denied.error) assert.equal(denied.error.code, "42501", "Atteso rifiuto RLS.");
  else assert.deepEqual(denied.data, [], "RLS deve impedire la modifica di A.");
  assert.deepEqual(checked(await select(owner, ids.a, targetA), "Ricontrolla A"), [originalA]);

  const updated = { ...originalB.data, attendance: { ...originalB.data.attendance, [ids.playerB]: { status: "Presente" } } };
  try {
    const rows = checked(await update(assistant, ids.b, targetB, updated), "Scrittura B come assistente");
    assert.equal(rows.length, 1);
    const sessions = checked(await owner.from("sessions").select("data").eq("team_id", ids.b)
      .in("id", [1, 2, 3].map((index) => sessionId("B", index))), "Lettura B come mister");
    assert.equal(sessions.filter(({ data }) => data.attendance[ids.playerB]?.status === "Presente").length, 3);
    console.log("PASS: assistente legge e modifica B, non legge né modifica A; il mister vede 3 presenze in B.");
  } finally {
    const reset = checked(await update(owner, ids.b, targetB, originalB.data), "Ripristina la presenza mancante per i telefoni");
    assert.equal(reset.length, 1);
  }
}

await (mode === "seed" ? seed() : verify());
