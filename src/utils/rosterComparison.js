import { comparePlayersByName } from './helpers.js';

// Reuse the calculated roster totals; incomplete data never become zeroes.
export function getRosterComparisonGroups(rows, mode) {
  const continuity = mode === 'continuity';
  const groups = { complete: [], incomplete: [], notCalled: [], noTraining: [] };
  const compare = (a, b) => {
    if (continuity) {
      const ratio = row => row.playerSessions.length ? row.trainingPresences / row.playerSessions.length : 0;
      const byAttendance = ratio(b) - ratio(a);
      if (byAttendance) return byAttendance;
    }
    return a.totalMinutes - b.totalMinutes || comparePlayersByName(a.player, b.player);
  };
  for (const row of rows) {
    if (row.missing.length || row.unverifiable || (continuity && row.pendingSessions.length)) groups.incomplete.push(row);
    else if (!row.known.length) groups.notCalled.push(row);
    else if (continuity && !row.playerSessions.length) groups.noTraining.push(row);
    else groups.complete.push(row);
  }
  groups.complete.sort(compare);
  if (continuity) groups.notCalled.sort(compare);
  return groups;
}
