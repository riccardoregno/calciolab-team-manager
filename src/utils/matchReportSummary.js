import { getMatchCompletionPlayerIds, parseMatchResult, resolveMatchMinutes } from './helpers.js';
import { getRecordedLineupRole } from './matchDayHelpers.js';
import { getMatchParticipation } from './matchTimeline.js';
import { it } from '../i18n/locales/it.js';
import { en } from '../i18n/locales/en.js';

export function buildMatchReportSummary({ match, players = [], rows = [], statsUnavailable = false, teamName = 'CalcioLab' }) {
  const currentRows = rows.filter(row => String(row.match_id) === String(match.id));
  const byPlayer = new Map(currentRows.map(row => [String(row.player_id), row]));
  const byId = new Map(players.map(player => [String(player.id), player]));
  const events = (match.liveEvents || []).filter(event => ['substitution','red_card','player_exit'].includes(event.type));
  const participation = getMatchParticipation(match);
  const ids = [...new Set([...getMatchCompletionPlayerIds(match), ...participation.starters,
    ...Object.keys(match.attendance || {}), ...currentRows.map(row => row.player_id),
    ...events.flatMap(event => [event.playerId,event.playerOutId])].filter(id => id != null && id !== '').map(String))];
  const entries = ids.map(id => {
    const row = byPlayer.get(id);
    return { id, name: byId.get(id)?.name || [byId.get(id)?.firstName,byId.get(id)?.lastName].filter(Boolean).join(' '),
      role: getRecordedLineupRole(match,id), unresolved: !byId.has(id),
      minutes: statsUnavailable ? null : resolveMatchMinutes(row?.minutes_played,match.attendance?.[id]?.minutes,row?.minutes_cleared) };
  });
  const known = entries.filter(entry => entry.minutes !== null);
  const changes = [...events].sort((a,b) => Number(a.minute) - Number(b.minute)).map(event => ({
    id:event.id,type:event.type,minute:event.minute ?? '',
    incoming: entries.find(entry => entry.id === String(event.playerId)),
    outgoing: entries.find(entry => entry.id === String(event.playerOutId)),
  }));
  const away = match.location === 'Trasferta';
  return { homeTeam:away ? match.opponent || '-' : teamName, awayTeam:away ? teamName : match.opponent || '-',
    score:parseMatchResult(match.result,match), entries, changes, statsUnavailable,
    totalMinutes:known.reduce((sum,entry)=>sum+entry.minutes,0), knownCount:known.length,
    pendingCount:entries.length-known.length, unresolvedCount:entries.filter(entry=>entry.unresolved).length };
}

// Uses the same translation catalogs for screen, clipboard and non-React PDF rendering.
export function formatMatchReportSummary(summary, language = 'it') {
  const labels = (language === 'en' ? en : it).matchReport;
  const text = (key,params={}) => Object.entries(params).reduce((value,[name,replacement])=>value.replaceAll('{{'+name+'}}',String(replacement)),labels[key]);
  const name = entry => entry?.name || text('unknownPlayer') + (entry?.id ? ' ('+entry.id.slice(0,8)+')' : '');
  const entries = summary.entries.map(entry=>({...entry,name:name(entry),roleLabel:text(entry.role === 'starter' ? 'starter' : entry.role === 'bench' ? 'bench' : 'unknownRole'),
    minutesLabel:summary.statsUnavailable ? text('unverified') : entry.minutes === null ? text('pending') : entry.minutes === 0 ? text('unused') : text('recorded',{count:entry.minutes})}));
  return { labels, title:summary.homeTeam+' vs '+summary.awayTeam,
    scoreLabel:summary.score ? summary.score.homeGoals+' - '+summary.score.awayGoals : text('resultPending'),
    countLabel:entries.length ? text('registeredCount',{known:summary.knownCount,total:entries.length}) : text('noPlayers'),
    totalLabel:summary.statsUnavailable ? text('unavailable') : summary.knownCount ? text('totalMinutes',{count:summary.totalMinutes}) : text('noRecorded'),
    pendingLabel:summary.pendingCount ? text('pendingCount',{count:summary.pendingCount}) : '', entries,
    changes:summary.changes.map(change=>({id:change.id,label:text(change.type === 'substitution' ? 'substitution' : change.type === 'red_card' ? 'redCard' : 'exit',{
      minute:String(change.minute).trim() || '?',incoming:name(change.incoming),outgoing:name(change.outgoing),
    })})),
  };
}
