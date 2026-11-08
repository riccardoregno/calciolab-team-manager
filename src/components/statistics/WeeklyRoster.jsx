import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { getAgendaDateKey } from "../../utils/coachAgenda";
import { hasTrainingEnded } from "../../utils/trainingArchive";
import { comparePlayersByName, formatDate, isTrainingStatsEvent, getPlayerMatchEntries, getRecordedTrainingStatus, getTrainingAttendanceSummary, localDateString, parseMatchResult } from "../../utils/helpers";

function moveDate(date, days) {
  const shifted = new Date(date + "T12:00:00");
  shifted.setDate(shifted.getDate() + days);
  return localDateString(shifted);
}

function monday(date) {
  const day = new Date(date + "T12:00:00").getDay();
  return moveDate(date, -((day + 6) % 7));
}

function getWeekEvents(events, start, now) {
  const today = localDateString(now);
  const end = moveDate(start, 6);
  const week = events.filter((event) => {
    const date = getAgendaDateKey(event.date);
    return date >= start && date <= end;
  });
  const sessions = week.filter((event) => isTrainingStatsEvent(event) && hasTrainingEnded(event, now));
  const matches = week.filter((event) => {
    const date = getAgendaDateKey(event.date);
    return event.type === "Partita" && !event.attendanceOnly &&
      (date < today || (date === today && (event.completed || parseMatchResult(event.result, event))));
  });

  return { sessions, matches };
}

function FourWeekComparison({ events, players, selectedPlayer, onSelectPlayer, rows, start, now, loading, statsError }) {
  const comparisonPlayers = selectedPlayer ? [selectedPlayer] : players;
  const weeks = [3, 2, 1, 0].map((offset) => {
    const date = moveDate(start, -7 * offset);
    const { sessions, matches } = getWeekEvents(events, date, now);
    const totals = { presences: 0, absences: 0, pending: 0, minutes: 0, recorded: 0, missing: 0, unverifiable: 0 };
    for (const player of comparisonPlayers) {
      const attendance = getTrainingAttendanceSummary(player, sessions);
      totals.presences += attendance.trainingPresences;
      totals.absences += attendance.absences;
      totals.pending += attendance.pendingTrainings;
      if (loading || statsError) continue;
      const entries = getPlayerMatchEntries(player, matches, rows, false);
      const byMatch = new Map(entries.map(({ event, data }) => [event.id, data]));
      for (const match of matches) {
        const data = byMatch.get(match.id);
        if (data) {
          if (data.minutes === null) totals.missing++;
          else {
            totals.minutes += data.minutes;
            totals.recorded++;
          }
        } else if (!(match.convocazione?.published && Array.isArray(match.convocazione.playerIds))) {
          totals.unverifiable++;
        }
      }
    }
    return { date, sessions, matches, ...totals };
  });

  return <>
    <label style={{ display: "grid", gap: 6, maxWidth: 360, marginTop: 8 }}>
      Giocatore
      <select value={selectedPlayer ? String(selectedPlayer.id) : ""} onChange={(event) => onSelectPlayer(event.target.value)}
        style={{ width: "100%", minWidth: 0, minHeight: 44, padding: "8px 12px", border: "1px solid #334155", borderRadius: 8, background: "#182334", color: "#e2e8f0" }}>
        <option value="">Tutta la prima squadra</option>
        {[...players].sort(comparePlayersByName).map((player) => <option key={player.id} value={String(player.id)}>{player.name}</option>)}
      </select>
    </label>
    <p>Settimana selezionata e tre precedenti. Le presenze includono parziali e recuperi. Le assenze includono i permessi.</p>
    <div aria-live="polite" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
      {weeks.map((week) => <article key={week.date} style={{ padding: 12, border: "1px solid #334155", borderRadius: 12 }}>
        <strong>{formatDate(week.date)} – {formatDate(moveDate(week.date, 6))}</strong>
        <div>{week.sessions.length} sedute · {week.matches.length} gare</div>
        <p>{week.presences} presenze · {week.absences} assenze<br />{week.pending} presenze da registrare</p>
        {!week.matches.length ? <p>Nessuna gara</p> : loading ? <p>Caricamento minutaggio…</p> : statsError ? <p>Minutaggio non verificabile</p> : <>
          <p>{week.recorded
            ? week.minutes + (selectedPlayer && week.minutes === 0 && !week.missing && !week.unverifiable ? " min · non impiegato" : " min registrati")
            : selectedPlayer && !week.missing && !week.unverifiable ? "Non convocato" : "Nessun minuto registrato"}
            <br />{week.missing} minutaggi da completare</p>
          {week.unverifiable > 0 && <p>{week.unverifiable} convocazioni non verificabili</p>}
        </>}
      </article>)}
    </div>
  </>;
}

export default function WeeklyRoster({ events, players, rows, loading, statsError, standalone = false }) {
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPlayerId, setComparisonPlayerId] = useState("");
  const comparisonPlayer = players.find((player) => String(player.id) === comparisonPlayerId);
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
  const { sessions, matches } = getWeekEvents(events, start, now);

  const rosterRows = [...players].sort(comparePlayersByName).map((player) => {
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
    if (pending.length) trainingSummary.push(pending.length + " da registrare");
    return { player, pending, trainingSummary, games, known, missing, matchSummary };
  });
  const pendingOnly = params.get("rosterPending") === "1";
  const pendingRows = rosterRows.filter(({ pending, missing }) => pending.length > 0 || (!loading && !statsError && missing.length > 0));
  const visibleRows = pendingOnly ? pendingRows : rosterRows;
  const checkingMinutes = loading && matches.length > 0;
  const togglePending = () => {
    const next = new URLSearchParams(params);
    if (pendingOnly) next.delete("rosterPending");
    else next.set("rosterPending", "1");
    setParams(next, { replace: true });
  };

  return <AppCard>
    <details open={standalone || Boolean(requestedWeek) || pendingOnly || undefined}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>{standalone ? "Settimana della prima squadra" : "Quadro settimanale della rosa"}</summary>
      <p aria-live="polite"><strong>{formatDate(start)} – {formatDate(end)}</strong></p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, -7))}>Settimana precedente</Button>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, 7))} disabled={start >= currentWeek}>Settimana successiva</Button>
      </div>
      <p>{sessions.length} sedute svolte · {matches.length} gare</p>
      {standalone && players.length > 0 && <details onToggle={(event) => setShowComparison(event.currentTarget.open)} style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", padding: "10px 0" }}>Confronta quattro settimane</summary>
        {showComparison && <FourWeekComparison {...{ events, players, rows, start, now, loading, statsError }}
          selectedPlayer={comparisonPlayer} onSelectPlayer={setComparisonPlayerId} />}
      </details>}
      {players.length > 0 && <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: "pointer" }}>
        <input type="checkbox" checked={pendingOnly} onChange={togglePending} />
        Solo da completare
      </label>}
      {pendingOnly && players.length > 0 && <p aria-live="polite">
        {checkingMinutes
          ? "Verifica del minutaggio in corso…"
          : statsError && matches.length > 0
            ? "Minutaggio non verificabile. Il filtro mostra le presenze da confermare."
          : pendingRows.length === 0
            ? "Nessuna presenza o minutaggio da completare."
            : pendingRows.length + (pendingRows.length === 1 ? " giocatore da verificare" : " giocatori da verificare")}
      </p>}
      {!players.length ? <p>Nessun giocatore della prima squadra.</p> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: 12 }}>
          {visibleRows.map(({ player, pending, trainingSummary, games, known, missing, matchSummary }) => (
            <article key={player.id} style={{ minWidth: 0, padding: 12, border: "1px solid #334155", borderRadius: 12 }}>
              <h3 style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}>{player.name}</h3>
              <div><strong>Allenamenti</strong><div>{trainingSummary.join(" · ") || "Nessuna seduta svolta"}</div></div>
              <div style={{ marginTop: 8 }}><strong>Partite</strong><div>
                {loading && matches.length ? "Caricamento…" : statsError && matches.length ? "Minutaggio non verificabile" : <>
                  {matchSummary}{missing.length > 0 && (known.length > 0 || missing.length > 1) &&
                    " · " + missing.length + (missing.length === 1 ? " gara da completare" : " gare da completare")}
                </>}
              </div></div>
              {(pending.length > 0 || (!loading && !statsError && games.length > 0)) && <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", padding: "6px 0" }}>Dettaglio eventi</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, overflowWrap: "anywhere" }}>
                  {pending.map(({ event }) => <li key={"session-" + event.id}>
                    <Link to={"/session-attendance/" + encodeURIComponent(event.id)} state={{ pendingOnly: true, rosterWeek: start, rosterPending: pendingOnly }}>
                      {formatDate(event.date)} · {event.title || "Seduta"} · Da registrare
                    </Link>
                  </li>)}
                  {!loading && !statsError && games.map(({ event, status, minutes }) => {
                    const label = formatDate(event.date) + " · " + (event.opponent || event.title || "Partita") + " · " +
                      (minutes === 0 ? "0 min · non impiegato" : minutes !== null ? minutes + " min" : status);
                    return <li key={"match-" + event.id}>{status === "Minutaggio da completare" ?
                      <Link to={"/match-completion/" + encodeURIComponent(event.id)} state={{ minutesPlayerId: String(player.id), rosterWeek: start, rosterPending: pendingOnly }}>{label}</Link> : label}
                    </li>;
                  })}
                </ul>
              </details>}
            </article>
          ))}
        </div>}
    </details>
  </AppCard>;
}
