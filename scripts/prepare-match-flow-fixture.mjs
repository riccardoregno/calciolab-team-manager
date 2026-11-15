import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
const configPath = process.env.CALCIOLAB_LOCAL_PUBLIC_CONFIG;
const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
assert.match(config.url, /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
const fixture = JSON.parse(readFileSync(join(dirname(configPath), 'calciolab-daily-ui-fixture.json'), 'utf8'));
assert.match(fixture.email, /^qa-percorso-\d+@example\.com$/);
const client = createClient(config.url, config.publicKey, { auth: { persistSession:false, autoRefreshToken:false } });
try {
  const auth = await client.auth.signInWithPassword({ email:fixture.email, password:process.env.CALCIOLAB_QA_PASSWORD || 'CalcioLab-QA!2026' });
  assert.ifError(auth.error);
  const roster = await client.from('players').select('data').eq('team_id', fixture.teamId);
  assert.ifError(roster.error);
  const players = roster.data.map(row=>row.data).filter(player=>!player.transferDate && player.status === 'Disponibile').slice(0,14);
  assert.equal(players.length,14);
  const matchId = 'e1e4eb36-30c1-4e3f-a5a2-a21aa9026115';
  const existing = await client.from('matches').select('id,data').eq('team_id',fixture.teamId).eq('id',matchId).maybeSingle();
  assert.ifError(existing.error);
  if (!existing.data) {
    const ids = players.map(player=>String(player.id));
    const data = { id:matchId, type:'Partita', title:'Collaudo cambi e minuti', opponent:'AS Cronaca fittizia',
      date:'2026-11-14', location:'Casa', matchKind:'Amichevole', formation:'3-4-1-2', result:'1-0', completed:true,
      convocazione:{playerIds:ids,published:false},
      lineup:{calledUpIds:ids,starterIds:ids.slice(0,11),benchIds:ids.slice(11),formationPlans:{firstHalf:{formation:'3-4-1-2',slots:Object.fromEntries(ids.slice(0,11).map((id,i)=>[i,id]))}}},
      liveEvents:[], attendance:{ [ids[0]]:{minutes:65} } };
    const inserted = await client.from('matches').insert({id:matchId,team_id:fixture.teamId,data});
    assert.ifError(inserted.error);
  } else assert.equal(existing.data.data.opponent,'AS Cronaca fittizia');
  writeFileSync(join(dirname(configPath),'calciolab-match-flow-fixture.json'),JSON.stringify({teamId:fixture.teamId,email:fixture.email,matchId,players:players.map(player=>({id:player.id,name:player.name})),savedMinutes:65},null,2));
  console.log('PASS fixture cambi: gara fittizia separata, 11 titolari e 3 riserve; minutaggio preesistente da conservare.');
} finally { await client.auth.signOut(); }
