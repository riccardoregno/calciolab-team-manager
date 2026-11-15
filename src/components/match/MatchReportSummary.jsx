import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import AppCard from '../ui/AppCard';
import Button from '../ui/Button';
import { formatMatchReportSummary } from '../../utils/matchReportSummary';

export default function MatchReportSummary({ summary, matchId, loading, error, onRetry }) {
  const { t, language } = useTranslation();
  const view = formatMatchReportSummary(summary,language);
  return <AppCard>
    <h3 style={{margin:'0 0 8px'}}>{t('matchReport.title')}</h3>
    {loading ? <p role="status">{t('matchReport.loading')}</p> : <>
      {error && <p role="status">{t('matchReport.unavailable')} <Button variant="ghost" onClick={onRetry}>{t('matchReport.retry')}</Button></p>}
      <p>{view.countLabel}<br /><strong>{view.totalLabel}</strong>{view.pendingLabel && <> · {view.pendingLabel}</>}</p>
      {summary.unresolvedCount > 0 && <p>{t('matchReport.unresolved',{count:summary.unresolvedCount})}</p>}
      <details><summary style={{minHeight:44,cursor:'pointer'}}>{t('matchReport.playerDetail')}</summary>
        <ul style={{listStyle:'none',padding:0,margin:0}}>
          {view.entries.map(entry=><li key={entry.id} style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:8,paddingBlock:10,borderBottom:'1px solid #334155',overflowWrap:'anywhere'}}>
            <span>{entry.name}<small style={{display:'block'}}>{entry.roleLabel}</small></span><strong>{entry.minutesLabel}</strong>
          </li>)}
        </ul>
      </details>
    </>}
    <h4>{t('matchReport.changes')}</h4>
    {view.changes.length ? <ul style={{paddingLeft:18,overflowWrap:'anywhere'}}>{view.changes.map((change,i)=><li key={change.id || i}>{change.label}</li>)}</ul> : <p>{t('matchReport.noChanges')}</p>}
    <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
      <Link to={'/match-completion/'+encodeURIComponent(matchId)}>{t('matchReport.openSheet')}</Link>
      <Link to={'/match-live/'+encodeURIComponent(matchId)}>{t('matchReport.openChanges')}</Link>
    </div>
  </AppCard>;
}
