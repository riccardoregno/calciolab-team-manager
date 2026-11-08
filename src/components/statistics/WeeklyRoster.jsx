import { Link, useSearchParams } from "react-router-dom";
import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { getAgendaDateKey } from "../../utils/coachAgenda";
import { comparePlayersByName, formatDate, getCompletedTrainingEvents, getPlayerMatchEntries, getRecordedTrainingStatus, localDateString } from "../../utils/helpers";

function moveDate(date, days) {
  const shifted = new Date(date + "T12:00:00");
  shifted.setDate(shifted.getDate() + days);
  return localDateString(shifted);
}

function monday(date) {
  const day = new Date(date + "T12:00:00").getDay();
  return moveDate(date, -((day + 6) % 7));
}

function PendingEvents({ label, children }) {
  return <details>
    <summary style={{ cursor: "pointer", color: "#fbbf24" }}>{label}</summary>
    <ul style={{ margin: "8px 0 0", paddingLeft: 18, whiteSpace: "normal" }}>{children}</ul>
  </details>;
}

export default function WeeklyRoster({ events, players, rows, loading }) {
  const today = localDateString();
  const [params, setParams] = useSearchParams();
  const requestedWeek = getAgendaDateKey(params.get("rosterWeek"));
  const currentWeek = monday(today);
  const start = requestedWeek && requestedWeek <= today ? monday(requestedWeek) : currentWeek;
  const setStart = (date) => {
    const next = new URLSearchParams(params);
    next.set("rosterWeek", date);
    setParams(next, { replace: true });
  };
  const end = moveDate(start, 6);
  const week = events.filter((event) => {
    const date = getAgendaDateKey(event.date);
    return date >= start && date <= end;
  });
  const sessions = getCompletedTrainingEvents(week);
  const matches = week.filter((event) => event.type === "Partita" && !event.attendanceOnly &&
    (getAgendaDateKey(event.date) < today || (getAgendaDateKey(event.date) === today && (event.completed || event.result))));
  const columns = ["Giocatore", "Presenti", "Parziali", "Recupero", "Altri stati", "Da confermare", "Minuti gara"];
  const cell = { padding: "8px 10px", whiteSpace: "nowrap", textAlign: "left", borderBottom: "1px solid #334155" };

  return <AppCard>
    <details open={Boolean(requestedWeek) || undefined}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Riepilogo settimanale della rosa</summary>
      <p>Prima squadra · sedute già svolte e gare della competizione selezionata</p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, -7))}>Settimana precedente</Button>
        <strong aria-live="polite">{formatDate(start)} – {formatDate(end)}</strong>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, 7))} disabled={start >= currentWeek}>Settimana successiva</Button>
      </div>
      <p>{sessions.length} sedute · {matches.length} gare</p>
      {!sessions.length && !matches.length ? <p>Nessuna seduta svolta o gara da riepilogare in questa settimana.</p> :
        <div style={{ overflowX: "auto" }}>
          <table aria-label="Presenze e minutaggio della prima squadra" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{columns.map((label) => <th key={label} scope="col" style={cell}>{label}</th>)}</tr></thead>
            <tbody>{[...players].sort(comparePlayersByName).map((player) => {
              const statuses = sessions.map((session) => getRecordedTrainingStatus(player, session));
              const pendingSessions = sessions.filter((_, index) => statuses[index] === null);
              const count = (status) => statuses.filter((value) => value === status).length;
              const present = count("Presente");
              const partial = count("Parziale");
              const recovery = count("Recupero");
              const pending = pendingSessions.length;
              const other = statuses.length - present - partial - recovery - pending;
              const entries = getPlayerMatchEntries(player, matches, rows, false);
              const known = entries.filter(({ data }) => data.minutes !== null);
              const missing = entries.filter(({ data }) => data.minutes === null);
              const minutes = known.reduce((sum, { data }) => sum + data.minutes, 0);
              return <tr key={player.id}>
                <th scope="row" style={cell}>{player.name}</th>
                {[present, partial, recovery, other].map((value, index) => <td key={columns[index + 1]} style={cell}>{value}</td>)}
                <td style={cell}>{pending === 0 ? 0 : <PendingEvents label={pending + " da confermare"}>
                  {pendingSessions.map((session) => <li key={session.id}>
                    <Link to={"/session-attendance/" + encodeURIComponent(session.id)} state={{ pendingOnly: true, rosterWeek: start }}>
                      {formatDate(session.date)} · {session.title || session.opponent || "Seduta"}
                    </Link>
                  </li>)}
                </PendingEvents>}</td>
                <td style={cell}>{loading && matches.length ? "Caricamento…" : <>
                  {known.length ? minutes + " min" : "—"}
                  {missing.length > 0 && <PendingEvents label={missing.length + " da completare"}>
                    {missing.map(({ event }) => <li key={event.id}>
                      <Link to={"/match-completion/" + encodeURIComponent(event.id)} state={{ minutesPlayerId: String(player.id), rosterWeek: start }}>
                        {formatDate(event.date)} · {event.opponent || event.title || "Partita"}
                      </Link>
                    </li>)}
                  </PendingEvents>}
                </>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </details>
  </AppCard>;
}
