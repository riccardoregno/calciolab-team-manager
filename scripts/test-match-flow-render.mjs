import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';
const server = await createServer({cacheDir:'node_modules/.vite-render-tests',server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
  const { I18nProvider } = await server.ssrLoadModule('/src/i18n/I18nProvider.jsx');
  const { PermissionContext } = await server.ssrLoadModule('/src/components/auth/permissionContext.js');
  const { default: MatchLive } = await server.ssrLoadModule('/src/pages/MatchLive.jsx');
  const { default: MatchMinutesProposal } = await server.ssrLoadModule('/src/components/match/MatchMinutesProposal.jsx');
  const { default: PostMatch } = await server.ssrLoadModule('/src/pages/PostMatch.jsx');
  const { default: CoachAnalysisDashboard } = await server.ssrLoadModule('/src/components/dashboard/CoachAnalysisDashboard.jsx');
  const { default: MatchCompletion } = await server.ssrLoadModule('/src/pages/MatchCompletion.jsx');
  const { default: SessionAttendance } = await server.ssrLoadModule('/src/pages/SessionAttendance.jsx');
  const { default: WeeklyRoster } = await server.ssrLoadModule('/src/components/statistics/WeeklyRoster.jsx');
  const h = React.createElement;
  const players = Array.from({length:14},(_,i)=>({id:String(i+1),name:'Fittizio '+(i+1)}));
  const match = {id:'fixture',date:'2026-11-14',opponent:'QA',lineup:{starterIds:players.slice(0,11).map(p=>p.id),calledUpIds:players.map(p=>p.id)}};
  const render = canManage => renderToStaticMarkup(h(I18nProvider,null,h(PermissionContext.Provider,{value:{canManage}},
    h(MemoryRouter,{initialEntries:['/match-live/fixture']},h(Routes,null,h(Route,{path:'/match-live/:id',element:h(MatchLive,{matches:[match],players,setMatches(){}})}))))));
  const manager=render(true), reader=render(false);
  assert.match(manager,/\+ Sostituzione/);
  assert.match(manager,/match-completion\/fixture/);
  assert.match(manager,/aria-current="page"[^>]*>[\s\S]*?Cambi/);
  assert.doesNotMatch(reader,/\+ Sostituzione|>\+ Evento<|Elimina evento/);
  const proposal = valid => renderToStaticMarkup(h(I18nProvider,null,h(MemoryRouter,null,h(MatchMinutesProposal,{
    matchId:'fixture',analysis:{valid,issues:valid?[]:[{code:'invalidStarters'}]},duration:'90',
    hasTargets:false,canManage:true,onDuration(){},onApply(){},
  }))));
  assert.doesNotMatch(proposal(false),/Tutti i minuti sono già registrati/, 'A match without starters is not complete');
  assert.match(proposal(false),/Servono 11 titolari/);
  assert.match(proposal(true),/Tutti i minuti sono già registrati/);
  const report=renderToStaticMarkup(h(I18nProvider,null,h(PermissionContext.Provider,{value:{canManage:false}},
    h(MemoryRouter,{initialEntries:['/post-match/fixture']},h(Routes,null,h(Route,{path:'/post-match/:id',element:h(PostMatch,{matches:[match],players,setMatches(){},setStaffTasks(){}})}))))));
  assert.match(report,/<fieldset[^>]*disabled/,'Post-match editors honor read-only access');
  assert.doesNotMatch(report,/Modifiche salvate automaticamente/,'No timer-based saved claim');
  assert.doesNotMatch(report,/>Crea attivit|>Crea seduta/,'Read-only users cannot create training or staff tasks');
  assert.match(report,/Riepilogo del tabellino/);
  const missingScore={...match,result:'',location:'Casa',lineup:{formationPlans:{firstHalf:{slots:{0:'1'}}}},attendance:{'1':{minutes:0}}};
  const overview=props=>renderToStaticMarkup(h(I18nProvider,null,h(MemoryRouter,null,h(CoachAnalysisDashboard,{
    matches:[missingScore],players,rows:[],now:new Date(2026,10,16,12),...props,
  }))));
  const resultTask=overview({});
  assert.match(resultTask,/Completa tabellino/,'Home exposes missing result even with no missing minutes');
  assert.match(resultTask,/Risultato da inserire/);
  assert.doesNotMatch(resultTask,/Formazione da registrare/,'Saved field is not advertised as missing formation');
  assert.match(overview({statsError:true}),/Risultato da inserire/,'A failed minute read does not hide the actionable result');
  assert.doesNotMatch(overview({canManage:false}),/Completa tabellino/,'Read-only users do not receive an editing task');
  const completion=renderToStaticMarkup(h(I18nProvider,null,h(MemoryRouter,{initialEntries:['/match-completion/fixture']},h(Routes,null,h(Route,{path:'/match-completion/:id',element:h(MatchCompletion,{matches:[missingScore],players,setMatches(){}})})))));
  assert.match(completion,/1\/11/,'Formation tab counts the saved first-half field');
  assert.match(completion,/value="quadro"/,'Save and open overview submits the same validated form');
  assert.match(completion,/Salva e apri il Quadro/);
  assert.match(completion,/rosterWeek=2026-11-09/,'Sunday match links to its actual week');
  const calendarRegister=renderToStaticMarkup(h(I18nProvider,null,h(MemoryRouter,{initialEntries:['/session-attendance/past']},h(Routes,null,h(Route,{path:'/session-attendance/:id',element:h(SessionAttendance,{sessions:[{id:'past',date:'2020-01-01',completed:true}],players,setSessions(){}})})))));
  assert.match(calendarRegister,/Registra solo le eccezioni/);
  assert.doesNotMatch(calendarRegister,/Conferma presenze mancanti/,'Past calendar sessions must not ask for redundant confirmation');
  const focusedRegister = (playerId, canManage = true) => renderToStaticMarkup(h(I18nProvider,null,h(PermissionContext.Provider,{value:{canManage}},h(MemoryRouter,{initialEntries:[{pathname:'/session-attendance/past',search:'?player='+playerId,state:{rosterReturn:'/statistics?roster=1&rosterView=4'}}]},h(Routes,null,h(Route,{path:'/session-attendance/:id',element:h(SessionAttendance,{sessions:[{id:'past',date:'2020-01-01',completed:true}],players,setSessions(){}})}))))));
  const focused = focusedRegister('12');
  assert.equal((focused.match(/class="attendance-player-card"/g)||[]).length, 1, 'Quadro opens one player rather than requiring another search');
  assert.match(focused,/Presenze di Fittizio 12/);
  assert.match(focused,/Mostra tutti/);
  assert.match(focused,/Torna al Quadro/);
  assert.match(focused,/Prima squadra · 14/, 'Filtering must not change the whole-session roster count');
  assert.match(focusedRegister('unknown'),/Il giocatore non fa parte della rosa/);
  assert.doesNotMatch(focusedRegister('12',false),/<button[^>]*aria-pressed="true"(?![^>]*disabled)/, 'Player focus cannot grant editing rights');
  const rosterLink = renderToStaticMarkup(h(I18nProvider,null,h(MemoryRouter,{initialEntries:['/statistics?roster=1&rosterView=4&rosterWeek=2020-01-06&rosterSort=minutes']},h(WeeklyRoster,{
    events:[{id:'session / qa',type:'Allenamento',date:'2020-01-07',completed:true}],players:[{id:'player / qa',name:'Omonimo QA'}],rows:[],standalone:true,
  }))));
  assert.match(rosterLink,/href="\/session-attendance\/session%20%2F%20qa\?player=player\+%2F\+qa"/, 'Event links carry the exact player identity with encoded IDs');
  const weeklySort = renderToStaticMarkup(h(I18nProvider,null,h(MemoryRouter,{initialEntries:['/statistics?roster=1&rosterWeek=2020-01-06&rosterSort=minutes']},h(WeeklyRoster,{events:[],players,rows:[],standalone:true}))));
  assert.doesNotMatch(weeklySort,/Minuti di gara crescenti/, 'Weekly view cannot advertise a four-week-only sorting rule as active');
  console.log('Match flow rendering: linked stages, active substitutions and read-only controls passed');
} finally { await server.close(); }
