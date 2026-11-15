import assert from 'node:assert/strict';
import { buildMatchReportSummary,formatMatchReportSummary } from '../src/utils/matchReportSummary.js';
import { it } from '../src/i18n/locales/it.js';
import { en } from '../src/i18n/locales/en.js';
const players=['starter','bench','pending','cleared'].map(id=>({id,name:id}));
const match={id:'m',location:'Trasferta',opponent:'Avversario',result:'1-2',goalsScored:9,goalsConceded:0,
  lineup:{starterIds:['stale'],benchIds:['bench'],formationPlans:{firstHalf:{slots:{0:'starter'}},secondHalf:{slots:{0:'bench'}}}},
  convocazione:{playerIds:['starter','bench','pending','cleared']},attendance:{starter:{minutes:10},bench:{minutes:20},cleared:{minutes:90}},
  liveEvents:[{id:'change',type:'substitution',minute:'0',playerId:'bench',playerOutId:'starter'}]};
const rows=[{match_id:'other',player_id:'pending',minutes_played:90},{match_id:'m',player_id:'starter',minutes_played:65},
  {match_id:'m',player_id:'bench',minutes_played:0},{match_id:'m',player_id:'cleared',minutes_played:90,minutes_cleared:true}];
const summary=buildMatchReportSummary({match,players,rows,teamName:'Club'});
const view=formatMatchReportSummary(summary);
assert.equal(summary.homeTeam,'Avversario');assert.equal(summary.awayTeam,'Club');assert.equal(view.scoreLabel,'1 - 2');
assert.equal(summary.entries.find(row=>row.id==='starter').role,'starter');
assert.equal(summary.entries.find(row=>row.id==='starter').minutes,65);
assert.equal(summary.entries.find(row=>row.id==='bench').minutes,0,'Recorded zero wins over legacy 20');
assert.equal(summary.entries.find(row=>row.id==='pending').minutes,null,'Other match rows cannot complete this match');
assert.equal(summary.entries.find(row=>row.id==='cleared').minutes,null,'Explicitly cleared minutes stay unknown');
assert.equal(summary.pendingCount,3,'Unresolved historical player stays visible too');
assert.equal(summary.unresolvedCount,1);assert.equal(summary.totalMinutes,65);
assert.match(view.changes[0].label,/^0'/,'Minute zero is not lost');
assert.match(view.entries.find(row=>row.id==='bench').minutesLabel,/non impiegato/);
assert.equal(view.entries.find(row=>row.id==='pending').minutesLabel,'Da completare');
const unavailable=buildMatchReportSummary({match,players,rows,statsUnavailable:true});
assert.equal(unavailable.knownCount,0);assert.match(formatMatchReportSummary(unavailable).totalLabel,/non verificabili/);
const empty=buildMatchReportSummary({match:{id:'empty'},players:[]});
assert.match(formatMatchReportSummary(empty).countLabel,/Nessun giocatore/);
assert.equal(formatMatchReportSummary(empty).scoreLabel,'Risultato da inserire');
assert.deepEqual(Object.keys(it.matchReport).sort(),Object.keys(en.matchReport).sort());
for(const [key,value] of Object.entries(it.matchReport)) assert.deepEqual(value.match(/\{\{\w+\}\}/g)?.sort(),en.matchReport[key].match(/\{\{\w+\}\}/g)?.sort());
console.log('Match report: canonical home/away, saved first-half field, cloud minutes, zero/unknown/cleared, missing references and IT/EN passed');
