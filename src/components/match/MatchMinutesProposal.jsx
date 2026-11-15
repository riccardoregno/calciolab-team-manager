import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import Button from '../ui/Button';

export default function MatchMinutesProposal({ matchId, analysis, duration, onDuration, onApply, canManage, proposal, hasTargets }) {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const text = (key, params) => t('matchFlow.' + key, params);
  return <section style={{ padding: 12, border: '1px solid #334155', borderRadius: 10, marginBottom: 16 }}>
    <h3 style={{ marginTop: 0 }}>{text('proposalTitle')}</h3>
    <p>{text('proposalHint')}</p>
    <label style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {text('duration')}
      <input type="number" inputMode="numeric" min="1" max="120" step="1" value={duration}
        onChange={event => { onDuration(event.target.value); setConfirmed(false); }}
        style={{ minHeight: 44, width: 90, padding: 8, borderRadius: 8 }} />
    </label>
    {!analysis.valid && <p role="status">{text('cannotPropose')} {text(analysis.issues[0].code)}</p>}
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBlock: 12 }}>
      <input type="checkbox" checked={confirmed} disabled={!canManage || !analysis.valid}
        onChange={event => setConfirmed(event.target.checked)} style={{ marginTop: 4 }} />
      <span>{text('confirmTimeline')}</span>
    </label>
    <Button type="button" disabled={!canManage || !confirmed || !analysis.valid || !hasTargets} onClick={onApply}>{text('applyMissing')}</Button>
    {!hasTargets && analysis.valid && <p>{text('nothingToPropose')}</p>}
    {proposal && <p role="status">{text(proposal.fingerprint === analysis.fingerprint ? 'proposalApplied' : 'staleProposal', { count: proposal.ids.length, duration: proposal.duration })}</p>}
    <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 0 }}>
      <Link to={'/match-live/' + encodeURIComponent(matchId)}>{text('reviewChanges')}</Link>
      <Link to={'/match-day/' + encodeURIComponent(matchId)}>{text('reviewFormation')}</Link>
    </p>
  </section>;
}
