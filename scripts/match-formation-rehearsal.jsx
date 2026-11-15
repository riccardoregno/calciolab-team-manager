// Development-only browser exercise of the real planner and local persistence hook.
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../src/i18n/I18nProvider.jsx';
import { useTeamData } from '../src/hooks/useTeamData.js';
import { useIsMobile } from '../src/hooks/useIsMobile.js';
import { getLineup } from '../src/utils/helpers.js';
import { syncFormationLineup } from '../src/utils/matchDayHelpers.js';
import MatchFormationPlanner from '../src/components/matchday/MatchFormationPlanner.jsx';
import SaveStatus from '../src/components/ui/SaveStatus.jsx';

if (location.hostname !== '127.0.0.1' || location.port !== '4182' ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(import.meta.env.VITE_SUPABASE_URL)) throw new Error('Solo pilot locale');

const teamId = '247a6550-5fdc-4f13-a1a8-817fabc33b5e';
const matchId = new URLSearchParams(location.search).get('flow') === '1'
  ? 'e1e4eb36-30c1-4e3f-a5a2-a21aa9026115' : '9ee2e414-9d2d-43f5-a46b-4979358ebb61';
export default function Rehearsal() {
  const data = useTeamData({ teamId });
  const isMobile = useIsMobile();
  const match = data.state.matches.find(item => item.id === matchId);
  return <>
    <h1>Formazione · solo squadra fittizia locale</h1>
    <p><a href={'/match-live/' + matchId}>Registra cambi e uscite</a></p>
    <SaveStatus source={data.storageSource} error={data.storageError} saving={data.remoteSaving} lastSyncedAt={data.lastSyncedAt} />
    {data.loading ? <p>Caricamento…</p> : !match ? <p>Accedi prima con l'account QA locale.</p> :
      <MatchFormationPlanner match={match} lineup={getLineup(match)} players={data.state.players} isMobile={isMobile}
        onChange={patch => data.setMatches(items => items.map(item => item.id === matchId
          ? { ...item, lineup: syncFormationLineup({ ...getLineup(item), ...patch }) } : item))} />}
  </>;
}
function AlignmentPreview() {
  const mobile = useIsMobile();
  const players = ['Portiere', 'Difensore sinistro', 'Difensore centrale', 'Difensore destro',
    'Esterno sinistro', 'Mediano sinistro', 'Mediano destro', 'Esterno destro', 'Trequartista', 'Punta sinistra', 'Punta destra']
    .map((name, i) => ({ id: String(i + 1), name, shirtNumber: String(i + 1) }));
  const plan = { formation: '3-4-1-2', slots: Object.fromEntries(players.map((player, i) => [i, player.id])) };
  return <><h1>Prova fittizia · allineamento difesa</h1><MatchFormationPlanner match={{ formation: '3-4-1-2' }}
    lineup={{ calledUpIds: players.map(player => player.id), formationPlans: { firstHalf: plan, secondHalf: plan } }}
    players={players} isMobile={mobile} onChange={() => {}} /></>;
}
createRoot(document.getElementById('root')).render(<I18nProvider>{new URLSearchParams(location.search).get('layout') === '3412'
  ? <AlignmentPreview /> : <Rehearsal />}</I18nProvider>);
