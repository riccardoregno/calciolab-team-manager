import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { reconcileAttendanceRecord } from '../../utils/syncHelpers';
import AppCard from './AppCard';
import Button from './Button';

export default function AttendanceSyncConflicts({ conflicts = [], sessions = [], players = [], onResolve, busy = false }) {
  return conflicts.map(conflict => <ConflictReview key={conflict.id+':'+conflict.online._updatedAt}
    conflict={conflict} local={sessions.find(item=>String(item.id)===String(conflict.id))}
    players={players} onResolve={onResolve} busy={busy} />);
}

function ConflictReview({ conflict, local, players, onResolve, busy }) {
  const { t } = useTranslation();
  const [choices,setChoices] = useState({});
  const [error,setError] = useState(false);
  const text = (key,values) => t('attendanceSync.'+key,values);
  const review = reconcileAttendanceRecord(conflict.baseline,local,conflict.online);
  const entries = review?.conflicts || [];
  function description(entry) {
    if (entry == null) return text('notRecorded');
    const record = typeof entry === 'string' ? {status:entry} : entry;
    return [record.status ? t('pages.attendanceRegister.status.'+record.status) : text('notRecorded'),
      record.partialMinutes != null ? text('minutes',{count:record.partialMinutes}) : '',
      record.rpe != null && record.rpe !== '' ? 'RPE '+record.rpe : ''].filter(Boolean).join(' · ');
  }
  return <AppCard>
    <section id={'attendance-sync-review-'+conflict.id} aria-label={text('title')} style={{display:'grid',gap:12,minWidth:0,scrollMarginTop:160}}>
      <h2 style={{fontSize:18,margin:0}}>{text('title')}</h2>
      <strong style={{overflowWrap:'anywhere'}}>{local?.title || text('session')}</strong>
      <p style={{margin:0,lineHeight:1.6}}>{text('help')}</p>
      {entries.map(entry=>{
        const player=players.find(item=>String(item.id)===entry.playerId);
        const name=player?.name || [player?.firstName,player?.lastName].filter(Boolean).join(' ') || text('unknownPlayer');
        return <fieldset key={entry.playerId} style={{border:'1px solid #526279',borderRadius:10,padding:12,minWidth:0,display:'grid',gap:8}}>
          <legend style={{overflowWrap:'anywhere'}}>{name}</legend>
          {['local','online'].map(choice=><label key={choice} style={{display:'flex',gap:8,alignItems:'center',minHeight:44,overflowWrap:'anywhere'}}>
            <input type="radio" name={'attendance-conflict-'+conflict.id+'-'+entry.playerId} value={choice}
              checked={choices[entry.playerId]===choice} disabled={busy}
              onChange={()=>setChoices(previous=>({...previous,[entry.playerId]:choice}))} />
            <span><strong>{text(choice)}</strong><br />{description(entry[choice])}</span>
          </label>)}
        </fieldset>;
      })}
      {!review && <p role="alert">{text('changed')}</p>}
      {error && <p role="alert">{text('retry')}</p>}
      <Button disabled={busy || !review || entries.some(entry=>!choices[entry.playerId])}
        onClick={()=>setError(!onResolve?.(conflict,choices))}>{text('apply')}</Button>
    </section>
  </AppCard>;
}
