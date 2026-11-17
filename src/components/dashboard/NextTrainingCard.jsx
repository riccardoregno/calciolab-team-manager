import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatDate } from '../../utils/helpers';
import { getAgendaDateKey, getAgendaEventTime } from '../../utils/coachAgenda';
import { getTrainingDuration } from '../../utils/trainingArchive';

export default function NextTrainingCard({ session, loading = false, canManage = false }) {
  const { t } = useTranslation();
  const text = (key, values) => t('dailyUi.' + key, values);
  const time = session ? getAgendaEventTime(session) : '';
  const duration = session ? getTrainingDuration(session) : null;
  return <section className="analysis-panel daily-next-training" aria-label={text('nextSessionTitle')}>
    <div className="analysis-panel-head"><span className="analysis-overline">{text('nextSessionTitle')}</span><CalendarDays size={18} aria-hidden="true" /></div>
    {loading ? <p role="status" className="analysis-muted">{text('loadingNextSession')}</p> : !session ? <>
      <h2>{text('noNextSession')}</h2>
      <p className="analysis-muted">{text(canManage ? 'noNextSessionHint' : 'noNextSessionReadHint')}</p>
      <div className="daily-next-training-actions">
        {canManage && <Link className="analysis-primary-link" to="/trainings" state={{ newSession: true }}>{text('createNextSession')}</Link>}
        <Link className="analysis-text-link" to="/trainings">{text('sessionArchive')}</Link>
      </div>
    </> : <>
      <h2>{session.title || t('common.session')}</h2>
      <p className="daily-next-training-date"><time dateTime={getAgendaDateKey(session.date) + (time ? 'T' + time : '')}>{formatDate(session.date)} · {time || text('sessionTimeUnknown')}</time></p>
      <p className="analysis-muted">{[session.theme, duration ? text('plannedSessionMinutes', { count: duration }) : text('sessionDurationUnknown')].filter(Boolean).join(' · ')}</p>
      <div className="daily-next-training-actions">
        {canManage && <Link className="analysis-primary-link" to="/trainings" state={{ editSessionId: session.id }}>{text('openSessionPlan')}</Link>}
        <Link className={canManage ? 'analysis-text-link' : 'analysis-primary-link'} to={'/session-attendance/' + encodeURIComponent(session.id)} state={{ fromDashboard: true }}>{text('openSessionAttendance')}</Link>
        <Link className="analysis-text-link" to="/trainings">{text('sessionArchive')}</Link>
      </div>
    </>}
  </section>;
}
