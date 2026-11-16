import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,Link} from 'react-router-dom';
import {I18nProvider} from '../src/i18n/I18nProvider';
import CoachAnalysisDashboard from '../src/components/dashboard/CoachAnalysisDashboard';
import MatchCompletion from '../src/pages/MatchCompletion';
import WeeklyRoster from '../src/components/statistics/WeeklyRoster';
import '../src/index.css';
import '../src/styles/design-system.css';
import '../src/styles/product-refinement.css';
if(location.hostname!=='127.0.0.1'||location.port!=='4184') throw new Error('Solo collaudo locale');
const players=Array.from({length:25},(_,i)=>({id:String(i+1),name:i===0?'Luca Della Valle Castiglioni':`Giocatore fittizio ${i+1}`,role:i===0?'Portiere':'Centrocampista',gruppo:'prima',status:'Disponibile'}));
const ids=players.slice(0,11).map(p=>p.id);
const match={id:'home-sheet-fixture',date:'2026-11-15',type:'Partita',completed:true,matchKind:'Campionato',opponent:'AS Collaudo risultato',location:'Casa',result:'',
  lineup:{starterIds:[],calledUpIds:ids,formationPlans:{firstHalf:{slots:Object.fromEntries(ids.map((id,i)=>[i,id]))}}},convocazione:{published:true,playerIds:ids},attendance:Object.fromEntries(ids.map(id=>[id,{minutes:0}]))};
export default function Rehearsal(){
  const [matches,setMatches]=useState([match]);
  return <I18nProvider><MemoryRouter><main style={{maxWidth:1100,margin:'auto',padding:16,color:'#e2e8f0'}}>
    <p>Prova fittizia in memoria · nessuna scrittura su database</p>
    <nav style={{display:'flex',flexWrap:'wrap',gap:16,marginBottom:16}}><Link to="/">Home</Link><Link to="/match-completion/home-sheet-fixture">Riapri gara fittizia</Link></nav>
    <Routes><Route path="/" element={<CoachAnalysisDashboard players={players} matches={matches} profile={{teamName:'Squadra fittizia'}} now={new Date(2026,10,16,12)}/>}/>
      <Route path="/match-completion/:id" element={<MatchCompletion matches={matches} players={players} setMatches={setMatches} clubName="Squadra fittizia"/>}/>
      <Route path="/statistics" element={<WeeklyRoster events={matches} players={players} rows={[]} standalone/>}/>
    </Routes>
  </main></MemoryRouter></I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Rehearsal/>);
