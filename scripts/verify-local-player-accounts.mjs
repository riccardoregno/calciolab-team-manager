import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";
const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
assert.match(config.url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const fixture = JSON.parse(readFileSync(join(dirname(configPath), "calciolab-player-fixture.json"), "utf8"));
process.env.VITE_SUPABASE_URL = config.url;
process.env.VITE_SUPABASE_ANON_KEY = config.publicKey;
process.env.VITE_TEAM_BILLING_LOCAL_TEST = "false";
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { supabase } = await server.ssrLoadModule("/src/lib/supabaseClient.js");
  const { ensureDefaultTeam } = await server.ssrLoadModule("/src/services/auth.js");
  for (const account of fixture.accounts) {
    await supabase.auth.signOut();
    const login = await supabase.auth.signInWithPassword({ email: account.email, password: "CalcioLab-QA!2026" });
    if (login.error) throw new Error(login.error.message);
    const result = await ensureDefaultTeam(login.data.user, fixture.teamId);
    if (result.error) throw new Error(result.error.message);
    assert.equal(result.team.id, fixture.teamId);
    assert.equal(result.team.role, "player");
    assert.equal(result.team.playerId, account.playerId);
    console.log(account.name ? "PASS account -> " + account.name : "PASS account without player -> no fallback profile");
  }
} finally {
  await server.close();
}

