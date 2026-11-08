import { Link, useSearchParams } from "react-router-dom";
import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { getAgendaDateKey } from "../../utils/coachAgenda";
import { getTrainingDuration } from "../../utils/trainingArchive";
import { comparePlayersByName, formatDate, getCompletedTrainingEvents, getPlayerMatchEntries, getRecordedTrainingStatus, localDateString, parseMatchResult } from "../../utils/helpers";

function moveDate(date, days) {
  const shifted = new Date(date + "T12:00:00");
  shifted.setDate(shifted.getDate() + days);
  return localDateString(shifted);
}

function monday(date) {
  const day = new Date(date + "T12:00:00").getDay();
  return moveDate(date, -((day + 6) % 7));
}

export default function WeeklyRoster({ events, players, rows, loading, standalone = false }) {
  const now = new Date();
  const today = localDateString(now);
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
  const sessions = getCompletedTrainingEvents(week).filter((session) => {
    if (session.date < today || session.completed) return true;
    const time = String(session.time || session.startTime || session.start_time || "").match(/^(\d{1,2}):(\d{2})/);
    const duration = getTrainingDuration(session);
    if (!time || !duration) return false;
    const endMinute = Number(time[1]) * 60 + Number(time[2]) + duration;
    return endMinute <= now.getHours() * 60 + now.getMinutes();
  });
  const matches = week.filter((event) => {
    const date = getAgendaDateKey(event.date);
    return event.type === "Partita" && !event.attendanceOnly &&
      (date < today || (date === today && (event.completed || parseMatchResult(event.result, event))));
  });

  return <AppCard>
    <details open={standalone || Boolean(requestedWeek) || undefined}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>{standalone ? "Settimana della prima squadra" : "Quadro settimanale della rosa"}</summary>
      <p aria-live="polite"><strong>{formatDate(start)} – {formatDate(end)}</strong></p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, -7))}>Settimana precedente</Button>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, 7))} disabled={start >= currentWeek}>Settimana successiva</Button>
      </div>
      <p>{sessions.length} sedute svolte · {matches.length} gare</p>
      {!players.length ? <p>Nessun giocatore della prima squadra.</p> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: 12 }}>
          {[...players].sort(comparePlayersByName).map((player) => {
            const statuses = sessions.map((event) => ({ event, status: getRecordedTrainingStatus(player, event) }));
            const pending = statuses.filter(({ status }) => status === null);
            const training = ["Presente", "Assente", "Recupero", "Parziale", "Permesso", "Infortunato", "Squalificato"]
              .map((status) => [status, statuses.filter((entry) => entry.status === status).length])
              .filter(([, count]) => count > 0);
            const entries = new Map(getPlayerMatchEntries(player, matches, rows, false).map(({ event, data }) => [event.id, data]));
            const games = matches.map((event) => {
              const data = entries.get(event.id);
              const publishedList = event.convocazione?.published && Array.isArray(event.convocazione.playerIds);
              const status = data?.status ?? (publishedList ? "Non convocato" : "Convocazione non verificabile");
              return { event, status, minutes: data?.minutes ?? null };
            });
            const known = games.filter(({ minutes }) => minutes !== null);
            const missing = games.filter(({ status }) => status === "Minutaggio da completare");
            const totalMinutes = known.reduce((sum, { minutes }) => sum + minutes, 0);
            const matchSummary = !games.length ? "Nessuna gara" : known.length ?
              (totalMinutes === 0 && !missing.length ? "0 min · non impiegato" : totalMinutes + " min registrati") :
              missing.length ? "Minutaggio da completare" : games.every(({ status }) => status === "Non convocato") ? "Non convocato" : "Convocazione non verificabile";
            const trainingLabels = { Presente: "presenti", Assente: "assenze", Recupero: "recuperi", Parziale: "parziali", Permesso: "permessi", Infortunato: "infortuni", Squalificato: "squalifiche" };
            const trainingSummary = training.map(([status, count]) => count + " " + trainingLabels[status]);
            if (pending.length) trainingSummary.push(pending.length + " da confermare");
            return <article key={player.id} style={{ minWidth: 0, padding: 12, border: "1px solid #334155", borderRadius: 12 }}>
              <h3 style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}>{player.name}</h3>
              <div><strong>Allenamenti</strong><div>{trainingSummary.join(" · ") || "Nessuna seduta svolta"}</div></div>
              <div style={{ marginTop: 8 }}><strong>Partite</strong><div>
                {loading && matches.length ? "Caricamento…" : <>
                  {matchSummary}{missing.length > 0 && (known.length > 0 || missing.length > 1) &&
                    " · " + missing.length + (missing.length === 1 ? " gara da completare" : " gare da completare")}
                </>}
              </div></div>
              {(pending.length > 0 || (!loading && games.length > 0)) && <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", padding: "6px 0" }}>Dettaglio eventi</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, overflowWrap: "anywhere" }}>
                  {pending.map(({ event }) => <li key={"session-" + event.id}>
                    <Link to={"/session-attendance/" + encodeURIComponent(event.id)} state={{ pendingOnly: true, rosterWeek: start }}>
                      {formatDate(event.date)} · {event.title || "Seduta"} · Da confermare
                    </Link>
                  </li>)}
                  {!loading && games.map(({ event, status, minutes }) => {
                    const label = formatDate(event.date) + " · " + (event.opponent || event.title || "Partita") + " · " +
                      (minutes === 0 ? "0 min · non impiegato" : minutes !== null ? minutes + " min" : status);
                    return <li key={"match-" + event.id}>{status === "Minutaggio da completare" ?
                      <Link to={"/match-completion/" + encodeURIComponent(event.id)} state={{ minutesPlayerId: String(player.id), rosterWeek: start }}>{label}</Link> : label}
                    </li>;
                  })}
                </ul>
              </details>}
            </article>;
          })}
        </div>}
    </details>
  </AppCard>;
}
