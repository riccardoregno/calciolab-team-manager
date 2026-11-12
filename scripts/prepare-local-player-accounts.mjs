import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
assert.match(config.url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const secret = process.env.CALCIOLAB_LOCAL_SERVICE_ROLE;
assert.ok(secret, "Local service key required in process environment.");
const admin = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const fixture = JSON.parse(readFileSync(join(dirname(configPath), "calciolab-transfer-fixture.json"), "utf8"));
const check = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
const team = check(await admin.from("teams").select("id,name").eq("id", fixture.teamId).single());
assert.equal(team.name, "QA Trasferimento");
const rows = check(await admin.from("players").select("id,data").eq("team_id", team.id));
const pair = ["Giocatore QA03", "Giocatore QA04"].map((name) => rows.find((p) => p.data.name === name));
assert.ok(pair.every(Boolean));
const suffix = Date.now();
const accounts = [];
for (let index = 0; index < 3; index++) {
  const email = "qa-player-" + suffix + "-" + index + "@example.com";
  const user = check(await admin.auth.admin.createUser({
    email, password: "CalcioLab-QA!2026", email_confirm: true,
    user_metadata: { first_name: "QA", last_name: "Player" + index },
  })).user;
  check(await admin.from("team_members").insert({ team_id: team.id, user_id: user.id, role: "player" }));
  if (index < 2) check(await admin.from("player_accounts").insert({
    team_id: team.id, auth_user_id: user.id, player_id: pair[index].id,
  }));
  accounts.push({ email, playerId: pair[index]?.id ?? null, name: pair[index]?.data.name ?? null });
}
writeFileSync(join(dirname(configPath), "calciolab-player-fixture.json"), JSON.stringify({ teamId: team.id, accounts }, null, 2));
console.log("Fixture locale pronta: due account giocatore collegati e uno senza associazione.");

