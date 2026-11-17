// Pending counts follow saved states; edited rows stay until the user refreshes.
export function getAttendanceWorklistPlayers(players, pendingIds, reviewed, sessionId) {
  const visible = new Set(pendingIds.map(String));
  if (String(reviewed.sessionId) === String(sessionId)) {
    for (const id of reviewed.ids) visible.add(String(id));
  }
  return players.filter(player => visible.has(String(player.id)));
}

// Filtering changes the rows shown, never the session's attendance totals.
export function filterAttendancePlayers(players, playerId, query = '') {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return players.filter(player => (!playerId || String(player.id) === String(playerId)) &&
    words.every(word => normalize([player.name, player.firstName, player.lastName].filter(Boolean).join(' ')).includes(word)));
}
