// Pending counts follow saved states; edited rows stay until the user refreshes.
export function getAttendanceWorklistPlayers(players, pendingIds, reviewed, sessionId) {
  const visible = new Set(pendingIds.map(String));
  if (String(reviewed.sessionId) === String(sessionId)) {
    for (const id of reviewed.ids) visible.add(String(id));
  }
  return players.filter(player => visible.has(String(player.id)));
}
