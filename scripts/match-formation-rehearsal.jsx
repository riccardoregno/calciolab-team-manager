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
const matchId = '9ee2e414-9d2d-43f5-a46b-4979358ebb61';
export default function Rehearsal() {
  const data = useTeamData({ teamId });
  const isMobile = useIsMobile();
  const match = data.state.matches.find(item => item.id === matchId);
  return <>
    <h1>Formazione · solo squadra fittizia locale</h1>
    <SaveStatus source={data.storageSource} error={data.storageError} saving={data.remoteSaving} lastSyncedAt={data.lastSyncedAt} />
    {data.loading ? <p>Caricamento…</p> : !match ? <p>Accedi prima con l'account QA locale.</p> :
      <MatchFormationPlanner match={match} lineup={getLineup(match)} players={data.state.players} isMobile={isMobile}
        onChange={patch => data.setMatches(items => items.map(item => item.id === matchId
          ? { ...item, lineup: syncFormationLineup({ ...getLineup(item), ...patch }) } : item))} />}
  </>;
}
createRoot(document.getElementById('root')).render(<I18nProvider><Rehearsal /></I18nProvider>);
