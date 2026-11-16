import assert from 'node:assert/strict';
import {getCompletedTrainingEvents,getTrainingAttendanceSummary,getTrainingConfirmationStatus,getRecordedTrainingStatus,formatTrainingAttendance,getPlayerSummary} from '../src/utils/helpers.js';
import {buildCoachTasks} from '../src/utils/coachTasks.js';

const player={id:'calendar-player',name:'Portiere fittizio',gruppo:'prima',status:'Disponibile'};
const sessions=Array.from({length:52},(_,i)=>({id:'calendar-'+i,type:'Allenamento',date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),
  ...(i===0?{attendance:{[player.id]:{status:'Presente'}}}:{})}));
const original=JSON.stringify(sessions);
for(const requireConfirmedPresence of [false,true]){
  const summary=getTrainingAttendanceSummary(player,getCompletedTrainingEvents(sessions,'2026-11-16'),{requireConfirmedPresence});
  assert.equal(summary.trainingPresences,52,'One saved presence plus 51 past calendar sessions must not become 51 pending entries');
  assert.equal(summary.pendingTrainings,0);assert.equal(formatTrainingAttendance(summary),'52 presenti');
  for(const count of [7,28]){
    const period=getTrainingAttendanceSummary(player,sessions.slice(-count),{requireConfirmedPresence});
    assert.equal(period.trainingPresences,count);assert.equal(period.pendingTrainings,0,'Weekly and four-week counts follow the same calendar rule');
  }
}
assert.equal(getPlayerSummary(player,{sessions,matches:[]}).stats.trainingPresences,52);
assert.equal(getRecordedTrainingStatus(player,sessions[1]),null,'Inferred presence does not invent a saved register entry');
assert.equal(JSON.stringify(sessions),original,'Historical records must not be rewritten');
assert.equal(getTrainingConfirmationStatus(player,{date:'2026-07-10',attendance:{[player.id]:'Assente'}}),'Assente');
assert.equal(getTrainingConfirmationStatus({...player,injuries:[{startDate:'2026-07-09',endDate:'2026-07-11'}]},{date:'2026-07-10'}),'Infortunato');
const historicalInjury={...player,injuries:[{dateStart:'2026-07-09',dateEnd:'2026-07-11'}]};
assert.equal(getTrainingConfirmationStatus(historicalInjury,{date:'2026-07-10'}),'Infortunato','Historical injury date aliases must still exclude attendance');
assert.equal(getTrainingConfirmationStatus(historicalInjury,{date:'2026-07-12'}),'Presente','An ended historical injury does not block later sessions');
assert.equal(getTrainingConfirmationStatus({...player,absences:[{dateStart:'2026-07-09',dateEnd:'2026-07-11'}]},{date:'2026-07-10'}),'Permesso');
assert.equal(getTrainingConfirmationStatus(player,{date:'2026-07-10',attendance:{[player.id]:{status:'Da confermare'}}}),'Da confermare','An intentional individual saved status is not silently overwritten');
assert.equal(getTrainingConfirmationStatus({...player,transferDate:'2026-07-10'},{date:'2026-07-10'}),null);
assert.equal(getCompletedTrainingEvents([{date:'2099-01-01'}],'2026-11-16').length,0,'Future sessions are not counted as attended');
assert.equal(buildCoachTasks({players:[player],sessions:sessions.slice(-7),now:new Date(2026,7,22,12)}).filter(task=>task.kind==='attendance').length,0);
console.log('Calendar attendance: screenshot regression 1 + 51, weekly/four-week parity, absences, injury, transfer, future dates and unchanged historical data passed');
