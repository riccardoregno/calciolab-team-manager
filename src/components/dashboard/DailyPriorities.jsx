import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck2, CheckCircle2, ChevronDown, ClipboardList } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatDate } from '../../utils/helpers';

export default function DailyPriorities({ attendance = [], matches = [], loading = false, checkingMinutes = false, minutesError = false, canManage = true }) {
  const { t } = useTranslation();
  const text = (key, values) => t('homePriorities.' + key, values);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const tasks = [
    ...attendance.map(task => ({ ...task, kind:'attendance' })),
    ...matches.map(task => ({ id:'match:'+task.match.id, kind:'match', event:task.match, task,
      to:'/match-completion/'+encodeURIComponent(task.match.id),
      state:{fromDashboard:true,missingMinutesOnly:!task.missingResult && !task.missingFormation} })),
  ].sort((a,b) => String(b.event.date).localeCompare(String(a.event.date)) || a.id.localeCompare(b.id));
  const visible = expanded ? tasks : tasks.slice(0,3);
  const minutesUnknown = checkingMinutes || minutesError;
  const pendingStates = attendance.reduce((total,task)=>total+task.count,0);
  return <section className="daily-actions daily-priorities" aria-label={t('dailyUi.dailyTitle')}>
    <h2>{t('dailyUi.dailyTitle')}</h2>
    <div className="daily-actions-grid">
      <Link to="/statistics?roster=1" className="daily-action-primary"><strong>{t('dailyUi.openQuadro')}</strong><span>{t('dailyUi.quadroHint')}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
    </div>
    {canManage && <div className="daily-priorities-work">
      <h3>{text('title')}</h3>
      <p className="daily-priorities-scope">{text('scope')}</p>
      {loading ? <p role="status">{text('loading')}</p> : <>
        <div className="daily-priorities-totals">
          <div><CalendarCheck2 size={18} aria-hidden="true" /><span><strong>{text(attendance.length===1?'session':'sessions',{count:attendance.length})}</strong><small>{text(pendingStates===1?'state':'states',{count:pendingStates})}</small></span></div>
          <div><ClipboardList size={18} aria-hidden="true" /><span><strong>{minutesUnknown ? text(minutesError?'matchesUnavailable':'matchesUnknown') : text(matches.length===1?'match':'matches',{count:matches.length})}</strong><small>{text(minutesError?'minutesError':checkingMinutes?'checkingMinutes':'matchHint')}</small></span></div>
        </div>
        {!tasks.length && !minutesUnknown && <p className="daily-priorities-empty" role="status"><CheckCircle2 size={18} aria-hidden="true" />{text('empty')}</p>}
        {!!tasks.length && <ul id={listId} className="daily-priorities-list">{visible.map(task=><li key={task.id}>
          <Link to={task.to} state={task.state}>
            <span><strong>{task.kind==='attendance' ? t('dailyUi.attendanceAction',{count:task.count}) : t('dailyUi.completeMatchAction')}</strong>
              <span className="daily-priorities-event">{task.event.opponent || task.event.title || t('common.session')}</span>
              <small>{formatDate(task.event.date)}{task.kind==='match' && ' · '+[
                task.task.missingResult?t('dailyUi.pendingMatchResult'):'',
                task.task.missingFormation?t('dailyUi.pendingMatchFormation'):'',
                task.task.missingMinutes?t(task.task.missingMinutes===1?'dailyUi.pendingMatchMinute':'dailyUi.pendingMatchMinutes',{count:task.task.missingMinutes}):'',
              ].filter(Boolean).join(' · ')}</small>
            </span><ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </li>)}</ul>}
        {tasks.length>3 && <button type="button" className="daily-priorities-toggle" aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(value=>!value)}>
          {text(expanded?'less':tasks.length===4?'moreOne':'more',{count:tasks.length-3})}<ChevronDown size={16} aria-hidden="true" />
        </button>}
      </>}
    </div>}
    <div className="daily-priorities-shortcuts">
      <Link to="/attendance-register">{t('dailyUi.register')}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      <Link to="/statistics?roster=1&rosterView=4&rosterSort=continuity">{t('dailyUi.openContinuity')}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
  </section>;
}
