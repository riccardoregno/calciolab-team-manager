import assert from 'node:assert/strict';
import { analyzeMatchTimeline, proposeMinutesDraft, editMinutesDraft, getMatchParticipation } from '../src/utils/matchTimeline.js';
import { it } from '../src/i18n/locales/it.js';
import { en } from '../src/i18n/locales/en.js';
assert.deepEqual(Object.keys(it.matchFlow).sort(), Object.keys(en.matchFlow).sort());
for (const [key,value] of Object.entries(it.matchFlow)) assert.deepEqual(value.match(/\{\{\w+\}\}/g)?.sort(), en.matchFlow[key].match(/\{\{\w+\}\}/g)?.sort());
const starters = Array.from({ length: 11 }, (_, i) => String(i + 1));
const match = { lineup: { starterIds: starters, calledUpIds: [...starters, '12', '13', '14'] }, liveEvents: [
  { id: 'a', type: 'substitution', minute: '60', playerId: '12', playerOutId: '9' },
  { id: 'b', type: 'substitution', minute: '75', playerId: '13', playerOutId: '12' },
] };
const result = analyzeMatchTimeline(match, 90);
assert.equal(result.valid, true);
assert.equal(result.minutes['9'], 60);
assert.equal(result.minutes['12'], 15, 'A substitute who is later substituted has only their interval');
assert.equal(result.minutes['13'], 15);
assert.equal(result.minutes['14'], 0, 'Only a confirmed complete timeline permits unused bench zero');
assert.equal(Object.values(result.minutes).reduce((a,b) => a+b,0), 990);
assert.equal(analyzeMatchTimeline({ ...match, liveEvents: [] }, 80).minutes['1'], 80);
assert.equal(analyzeMatchTimeline({ ...match, liveEvents: [{type:'player_exit',playerId:'1',minute:'60'}] },90).minutes['1'],60);
assert.equal(analyzeMatchTimeline({ ...match, liveEvents: [{type:'injury',playerId:'1',minute:'60'}] },90).minutes['1'],90,'An injury note alone does not prove an exit');
assert.equal(analyzeMatchTimeline({ ...match, liveEvents: [...match.liveEvents,
  { type:'red_card', minute:'80', playerId:'1' }] }, 90).minutes['1'], 80);
for (const event of [
  { type:'substitution', minute:'', playerId:'12', playerOutId:'9' },
  { type:'substitution', minute:'45+2', playerId:'12', playerOutId:'9' },
  { type:'substitution', minute:'91', playerId:'12', playerOutId:'9' },
  { type:'substitution', minute:'60', playerId:'1', playerOutId:'9' },
  { type:'substitution', minute:'60', playerId:'unknown', playerOutId:'9' },
  { type:'substitution', minute:'60', playerId:'12', playerOutId:'14' },
]) assert.deepEqual(analyzeMatchTimeline({ ...match, liveEvents:[event] },90).minutes, {});
assert.equal(analyzeMatchTimeline({ ...match, liveEvents:[...match.liveEvents, { type:'substitution', minute:'80', playerId:'9', playerOutId:'13' }] },90).issues[0].code,'reentry');
assert.equal(analyzeMatchTimeline({ ...match, liveEvents:[match.liveEvents[0],match.liveEvents[0]] },90).valid,false);
assert.equal(analyzeMatchTimeline({ lineup: { starterIds:['1'] } },90).valid,false);
assert.equal(analyzeMatchTimeline(match,'').valid,false);
assert.equal(analyzeMatchTimeline(match,90,starters).valid,false,'Unresolved player references cannot produce totals');
const field = { ...match, lineup: { ...match.lineup, starterIds:['stale'], formationPlans: { firstHalf:{ slots:Object.fromEntries(starters.map((id,i)=>[i,id])) }, secondHalf:{slots:{0:'14'}} } } };
assert.deepEqual(getMatchParticipation(field).starters, starters, 'Saved first-half field defines the starters, never the second-half field');
const draft = proposeMinutesDraft({ score:{},starters:[],minutes:{'2':'44','3':''} },result,{'1':0,'9':65});
assert.equal(draft.minutes['1'],undefined,'Saved zero is preserved');
assert.equal(draft.minutes['9'],undefined,'Saved nonzero is preserved');
assert.equal(draft.minutes['2'],'44','Manual edits are preserved');
assert.equal(draft.minutes['3'],'','Explicitly cleared input is not overwritten');
assert.equal(draft.minutes['14'],'0');
const manual = editMinutesDraft(draft,'12','17');
assert.ok(!manual.minutesProposal.ids.includes('12'));
assert.equal(proposeMinutesDraft(manual,analyzeMatchTimeline(match,80),{}).minutes['12'],'17');
assert.notEqual(result.fingerprint,analyzeMatchTimeline(match,80).fingerprint);
assert.notEqual(result.fingerprint,analyzeMatchTimeline({ ...match,liveEvents:[] },90).fingerprint);
console.log('Match timeline: starters, substitutions, exits, unknowns, manual/saved protection and stale draft fingerprint passed');
