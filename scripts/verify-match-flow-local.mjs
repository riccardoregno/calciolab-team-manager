import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/,''));
assert.match(config.url,/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const fixture=JSON.parse(readFileSync(join(dirname(configPath),'calciolab-match-flow-fixture.json'),'utf8'));
assert.match(fixture.email,/^qa-percorso-\d+@example\.com$/);
process.env.VITE_SUPABASE_URL=config.url;
process.env.VITE_SUPABASE_ANON_KEY=config.publicKey;
const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const atomicId='ff016871-0cd4-42eb-af48-73c761902615';
let client;
try {
  ({supabase:client}=await server.ssrLoadModule('/src/lib/supabaseClient.js'));
  const {saveMatchMinutes}=await server.ssrLoadModule('/src/services/playerProfile.js');
  const {resolveMatchMinutes}=await server.ssrLoadModule('/src/utils/helpers.js');
  const auth=await client.auth.signInWithPassword({email:fixture.email,password:process.env.CALCIOLAB_QA_PASSWORD||'CalcioLab-QA!2026'});
  assert.ifError(auth.error);
  const source=await client.from('matches').select('data').eq('team_id',fixture.teamId).eq('id',fixture.matchId).single();
  assert.ifError(source.error);
  assert.equal(source.data.data.opponent,'AS Cronaca fittizia');
  const testMatch={...source.data.data,id:atomicId,opponent:'QA atomic minutes only'};
  const inserted=await client.from('matches').upsert({id:atomicId,team_id:fixture.teamId,data:testMatch});
  assert.ifError(inserted.error);
  const playerId=fixture.players[0].id;
  const row=()=>client.from('player_matches').select('*').eq('team_id',fixture.teamId).eq('match_id',atomicId).eq('player_id',playerId).single();
  const write=value=>saveMatchMinutes(fixture.teamId,playerId,atomicId,value,null,{onlyIfMissing:true});
  assert.ifError((await saveMatchMinutes(fixture.teamId,playerId,atomicId,0,{goals:2,assists:1},{onlyIfMissing:true})).error);
  assert.equal((await write(90)).unchanged,true);
  assert.equal((await row()).data.minutes_played,0,'Recorded zero cannot be replaced by a proposal');
  const cleared=await client.from('player_matches').update({minutes_played:null,minutes_cleared:false}).eq('team_id',fixture.teamId).eq('match_id',atomicId).eq('player_id',playerId);
  assert.ifError(cleared.error);
  const race=await Promise.all([write(15),write(25)]);
  race.forEach(result=>assert.ifError(result.error));
  assert.equal(race.filter(result=>result.unchanged).length,1,'Only one conditional writer fills the missing value');
  const current=await row(); assert.ifError(current.error);
  assert.ok([15,25].includes(current.data.minutes_played));
  assert.equal(current.data.goals,2,'Filling minutes preserves goals');
  assert.equal(current.data.assists,1,'Filling minutes preserves assists');
  if(process.argv.includes('--verify-saved')) {
    const saved=await client.from('player_matches').select('*').eq('team_id',fixture.teamId).eq('match_id',fixture.matchId);
    assert.ifError(saved.error);
    const byId=new Map(saved.data.map(item=>[String(item.player_id),item]));
    const minutes=index=>resolveMatchMinutes(byId.get(fixture.players[index].id)?.minutes_played,
      source.data.data.attendance?.[fixture.players[index].id]?.minutes,byId.get(fixture.players[index].id)?.minutes_cleared);
    assert.equal(minutes(0),65,'Pre-existing total kept');
    assert.equal(minutes(8),60,'Outgoing player');
    assert.equal(minutes(1),44,'Manual draft edit preserved');
    assert.equal(minutes(11),15,'Incoming player subsequently substituted');
    assert.equal(minutes(12),15,'Second incoming player');
    assert.equal(minutes(13),0);
    console.log('PASS saved match: 65 pre-existing and 44 manual minutes preserved; outgoing 60, substitutes 15 and 15, unused bench 0.');
  }
  console.log('PASS local atomic proposals: recorded zero protected, concurrent writers cannot replace a completed value, goals/assists preserved.');
} finally {
  if(client) {
    // Only the disposable atomic fixture is removed; the browser fixture remains.
    const removedRows=await client.from('player_matches').delete().eq('team_id',fixture.teamId).eq('match_id',atomicId);
    assert.ifError(removedRows.error);
    const removedMatch=await client.from('matches').delete().eq('team_id',fixture.teamId).eq('id',atomicId).eq('data->>opponent','QA atomic minutes only');
    assert.ifError(removedMatch.error);
    await client.auth.signOut();
  }
  await server.close();
}
