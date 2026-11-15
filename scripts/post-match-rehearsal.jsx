import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {I18nProvider} from '../src/i18n/I18nProvider.jsx';
import {PermissionContext} from '../src/components/auth/permissionContext.js';
import {useTeamData} from '../src/hooks/useTeamData.js';
import SaveStatus from '../src/components/ui/SaveStatus.jsx';
import PostMatch from '../src/pages/PostMatch.jsx';
import '../src/index.css';
import '../src/styles/design-system.css';
import '../src/styles/product-refinement.css';

if(location.hostname!=='127.0.0.1'||!['4182','4183'].includes(location.port)||!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(import.meta.env.VITE_SUPABASE_URL)) throw new Error('Solo pilot locale');
const teamId='247a6550-5fdc-4f13-a1a8-817fabc33b5e',matchId='e1e4eb36-30c1-4e3f-a5a2-a21aa9026115';
export default function Rehearsal(){
  const data=useTeamData({teamId});
  const canManage=new URLSearchParams(location.search).get('readOnly')!=='1';
  return <I18nProvider><PermissionContext.Provider value={{canManage,canView:true}}>
    <SaveStatus loading={data.loading} source={data.storageSource} error={data.storageError} saving={data.remoteSaving} lastSyncedAt={data.lastSyncedAt}/>
    {data.loading?<p>Caricamento…</p>:<MemoryRouter initialEntries={['/post-match/'+matchId]}><Routes><Route path="/post-match/:id" element={<PostMatch matches={data.state.matches} players={data.state.players} sessions={data.state.sessions} appSettings={data.state.appSettings} teamId={teamId} setMatches={data.setMatches} setStaffTasks={data.setStaffTasks}/>}/></Routes></MemoryRouter>}
  </PermissionContext.Provider></I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Rehearsal/>);
