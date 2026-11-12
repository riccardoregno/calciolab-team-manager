import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { auditSeasonData } from "../src/utils/seasons.js";
const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath,"utf8").replace(/^\uFEFF/,""));
assert.match(config.url,/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const fixture = JSON.parse(readFileSync(join(dirname(configPath),"calciolab-daily-ui-fixture.json"),"utf8"));
const client = createClient(config.url,config.publicKey,{auth:{persistSession:false}});
const auth = await client.auth.signInWithPassword({email:fixture.email,password:"CalcioLab-QA!2026"});
assert.ifError(auth.error);
const state = {};
for(const key of ["players","sessions","matches"]) {
  const result = await client.from(key).select("id,data").eq("team_id",fixture.teamId);
  assert.ifError(result.error);
  state[key] = result.data.map(row=>({...row.data,id:row.id}));
}
const seasons = [{id:"proposed",name:"2026/27",start_date:"2026-07-01",end_date:"2027-06-30"}];
const audit = auditSeasonData({...state,seasons});
writeFileSync(join(dirname(configPath),"calciolab-season-audit-local.json"),JSON.stringify({teamId:fixture.teamId,counts:Object.fromEntries(Object.entries(state).map(([key,rows])=>[key,rows.length])),proposedSeasons:seasons,issues:audit},null,2));
console.log(`Audit in sola lettura del pilot: ${audit.length} casi da verificare. Nessun dato aggiornato.`);
