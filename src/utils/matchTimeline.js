const ids = values => (values || []).filter(value => value != null && String(value).trim()).map(String);
const unique = values => [...new Set(values)];
const timedTypes = new Set(['substitution', 'red_card', 'player_exit']);

export function getMatchParticipation(match) {
  const lineup = match.lineup || {};
  const field = ids(Object.values(lineup.formationPlans?.firstHalf?.slots || {}));
  const starters = field.length ? field : ids(lineup.starterIds);
  const called = unique([...ids(lineup.calledUpIds), ...ids(match.convocazione?.playerIds), ...ids(lineup.benchIds), ...starters]);
  return { starters, called };
}

function integer(value) {
  return /^\d+$/.test(String(value).trim()) ? Number(value) : NaN;
}

export function analyzeMatchTimeline(match, duration, knownPlayerIds) {
  const { starters, called } = getMatchParticipation(match);
  const events = (match.liveEvents || []).filter(event => timedTypes.has(event.type));
  const origin = { starters, called, events: events.map(event => [event.id, event.type, event.minute, event.playerId, event.playerOutId]) };
  const timelineFingerprint = JSON.stringify(origin);
  const fingerprint = JSON.stringify({ ...origin, duration: String(integer(duration)) });
  const issues = [];
  const add = (code, event) => issues.push({ code, eventId: event?.id });
  const end = integer(duration);
  if (!Number.isInteger(end) || end < 1 || end > 120) add('invalidDuration');
  if (starters.length !== 11 || unique(starters).length !== 11) add('invalidStarters');
  if (knownPlayerIds && called.some(id => !knownPlayerIds.map(String).includes(id))) add('unknownPlayer');
  const minutes = Object.fromEntries(called.map(id => [id, 0]));
  const active = new Map(starters.map(id => [id, 0]));
  const played = new Set(starters);
  const seenEvents = new Set();
  for (const event of [...events].sort((a, b) => integer(a.minute) - integer(b.minute))) {
    if (event.id && seenEvents.has(event.id)) { add('duplicateEvent', event); continue; }
    if (event.id) seenEvents.add(event.id);
    const minute = integer(event.minute);
    if (!Number.isInteger(minute) || minute < 0 || minute > end) { add('invalidMinute', event); continue; }
    const outgoing = String(event.type === 'substitution' ? event.playerOutId || '' : event.playerId || '');
    const incoming = String(event.playerId || '');
    if (!active.has(outgoing)) { add('notOnPitch', event); continue; }
    if (event.type === 'substitution') {
      if (!called.includes(incoming) || !incoming) { add('notCalled', event); continue; }
      if (active.has(incoming)) { add('alreadyOnPitch', event); continue; }
      if (played.has(incoming)) { add('reentry', event); continue; }
    }
    minutes[outgoing] += minute - active.get(outgoing);
    active.delete(outgoing);
    if (event.type === 'substitution') { active.set(incoming, minute); played.add(incoming); }
  }
  if (!issues.length) for (const [id, start] of active) minutes[id] += end - start;
  return { valid: !issues.length, issues, minutes: issues.length ? {} : minutes, starters, called,
    active: [...active.keys()], played: [...played], fingerprint, timelineFingerprint, duration: end };
}

// Only generated draft values can be refreshed. Saved totals and manual edits win.
export function proposeMinutesDraft(draft, analysis, savedMinutes) {
  if (!analysis.valid) return draft;
  const previous = new Set(draft.minutesProposal?.ids || []);
  const minutes = Object.fromEntries(Object.entries(draft.minutes).filter(([id]) => !previous.has(id)));
  const generated = [];
  for (const [id, value] of Object.entries(analysis.minutes)) {
    const saved = savedMinutes[id];
    if ((saved !== '' && saved != null) || Object.hasOwn(minutes, id)) continue;
    minutes[id] = String(value);
    generated.push(id);
  }
  const { minutesProposal: _previousProposal, ...rest } = draft;
  return { ...rest, minutes, ...(generated.length ? { minutesProposal: {
    ids: generated, fingerprint: analysis.fingerprint, duration: analysis.duration,
  } } : {}) };
}

export function editMinutesDraft(draft, id, value) {
  const proposal = draft.minutesProposal;
  const remaining = proposal?.ids.filter(key => key !== id) || [];
  const { minutesProposal: _previousProposal, ...rest } = draft;
  return { ...rest, minutes: { ...draft.minutes, [id]: value },
    ...(remaining.length ? { minutesProposal: { ...proposal, ids: remaining } } : {}) };
}
