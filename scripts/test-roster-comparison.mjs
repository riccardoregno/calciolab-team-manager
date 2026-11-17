import assert from 'node:assert/strict';
import { getRosterComparisonGroups } from '../src/utils/rosterComparison.js';

const row = (id, presences, sessions, minutes, overrides = {}) => ({
  player: { id, name: id }, trainingPresences: presences, playerSessions: Array(sessions).fill({}),
  totalMinutes: minutes, known: [{ minutes }], missing: [], unverifiable: 0, pendingSessions: [], ...overrides,
});
const rows = [
  row('Poche presenze', 1, 4, 5),
  row('Molte presenze', 4, 4, 5),
  row('Minutaggio incompleto', 4, 4, 0, { missing: [{}] }),
  row('Molte presenze più minuti', 4, 4, 90),
  row('Zero confermato', 4, 4, 0),
  row('Presenza da confermare', 3, 4, 0, { pendingSessions: [{}] }),
  row('Convocazione sconosciuta', 4, 4, 0, { known: [], unverifiable: 1 }),
  row('Non convocato', 4, 4, 0, { known: [] }),
  row('Nessuna seduta', 0, 0, 0),
  row('Quota equivalente', 2, 2, 10),
];
const original = JSON.stringify(rows);
const groups = getRosterComparisonGroups(rows, 'continuity');
const names = group => group.map(item => item.player.id);
assert.deepEqual(names(groups.complete), ['Zero confermato', 'Molte presenze', 'Quota equivalente', 'Molte presenze più minuti', 'Poche presenze']);
assert.deepEqual(names(groups.incomplete), ['Minutaggio incompleto', 'Presenza da confermare', 'Convocazione sconosciuta']);
assert.deepEqual(names(groups.notCalled), ['Non convocato']);
assert.deepEqual(names(groups.noTraining), ['Nessuna seduta']);
assert.equal(JSON.stringify(rows), original, 'Comparison cannot alter attendance, minute totals or input order');
assert.equal(Object.values(groups).flat().length, rows.length, 'Every player appears exactly once');
const minutes = getRosterComparisonGroups(rows, 'minutes');
assert.ok(names(minutes.complete).includes('Presenza da confermare'), 'The existing minute-only view keeps its previous attendance policy');
assert.ok(minutes.complete.every((r, i, all) => i === 0 || all[i - 1].totalMinutes <= r.totalMinutes));
assert.deepEqual(getRosterComparisonGroups([], 'continuity'), { complete: [], incomplete: [], notCalled: [], noTraining: [] });
console.log('Roster comparison: attendance ratios, minute tie-break, confirmed zero, incomplete and unknown data, no sessions and unchanged legacy sorting passed');
