import { useTranslation } from "../../i18n";
import { useAuth } from "../../hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { getAgendaDateKey } from "../../utils/coachAgenda";
import { hasTrainingEnded } from "../../utils/trainingArchive";
import { comparePlayersByName, isTrainingStatsEvent, getPlayerMatchEntries, getTrainingConfirmationStatus, getTrainingAttendanceSummary, hasPlayerTransferred, isTrainingParticipation, localDateString, parseMatchResult, TRAINING_ATTENDANCE_PENDING } from "../../utils/helpers";

function moveDate(date, days) {
  const shifted = new Date(date + "T12:00:00");
  shifted.setDate(shifted.getDate() + days);
  return localDateString(shifted);
}

function monday(date) {
  const day = new Date(date + "T12:00:00").getDay();
  return moveDate(date, -((day + 6) % 7));
}

function getPeriodEvents(events, start, end, now) {
  const today = localDateString(now);
  const period = events.filter((event) => {
    const date = getAgendaDateKey(event.date);
    return date >= start && date <= end;
  });
  const sessions = period.filter((event) => isTrainingStatsEvent(event) && hasTrainingEnded(event, now));
  const matches = period.filter((event) => {
    const date = getAgendaDateKey(event.date);
    return event.type === "Partita" && !event.attendanceOnly &&
      (date < today || (date === today && (event.completed || parseMatchResult(event.result, event))));
  });

  return { sessions, matches };
}

function FourWeekComparison({ events, players, selectedPlayer, onSelectPlayer, rows, start, now, loading, statsError }) {
  const { t, language } = useTranslation();
  const text = (key, params) => t("dailyUi." + key, params);
  const dateLabel = (date) => new Date(date + "T12:00:00").toLocaleDateString(language === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "short", year: "numeric" });
  const comparisonPlayers = selectedPlayer ? [selectedPlayer] : players;
  const weeks = [3, 2, 1, 0].map((offset) => {
    const date = moveDate(start, -7 * offset);
    const { sessions, matches } = getPeriodEvents(events, date, moveDate(date, 6), now);
    const totals = { presences: 0, absences: 0, pending: 0, minutes: 0, recorded: 0, missing: 0, unverifiable: 0 };
    for (const player of comparisonPlayers) {
      const attendance = getTrainingAttendanceSummary(player, sessions, { requireConfirmedPresence: true });
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
      {text("player")}
      <select value={selectedPlayer ? String(selectedPlayer.id) : ""} onChange={(event) => onSelectPlayer(event.target.value)}
        style={{ width: "100%", minWidth: 0, minHeight: 44, padding: "8px 12px", border: "1px solid #334155", borderRadius: 8, background: "#182334", color: "#e2e8f0" }}>
        <option value="">{text("firstTeam")}</option>
        {[...players].sort(comparePlayersByName).map((player) => <option key={player.id} value={String(player.id)}>{player.name}</option>)}
      </select>
    </label>
    <p>{text("comparisonHint")}</p>
    <div aria-live="polite" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
      {weeks.map((week) => <article key={week.date} style={{ padding: 12, border: "1px solid #334155", borderRadius: 12 }}>
        <strong>{dateLabel(week.date)} – {dateLabel(moveDate(week.date, 6))}</strong>
        <div>{text("sessionsCount", { count: week.sessions.length })} · {text("matchesCount", { count: week.matches.length })}</div>
        <p>{text("presences", { count: week.presences })} · {text("absences", { count: week.absences })}{week.pending > 0 && " · " + text("pendingCount", { count: week.pending })}</p>
        {!week.matches.length ? <p>{text("noGames")}</p> : loading ? <p>{text("loadingMinutes")}</p> : statsError ? <p>{text("unverifiableMinutes")}</p> : <>
          <p>{week.recorded
            ? (selectedPlayer && week.minutes === 0 && !week.missing && !week.unverifiable ? text("zeroMinutes") : text("recordedMinutes", { count: week.minutes }))
            : selectedPlayer && !week.missing && !week.unverifiable ? text("notCalled") : text("noRecordedMinutes")}
            <br />{text("missingMinutesCount", { count: week.missing })}</p>
          {week.unverifiable > 0 && <p>{text("unknownCallups", { count: week.unverifiable })}</p>}
        </>}
      </article>)}
    </div>
  </>;
}

export default function WeeklyRoster({ events, players, rows, loading, statsError, standalone = false, scopeLabel = "", seasonBounds = null }) {
  const { t, language } = useTranslation();
  const text = (key, params) => t("dailyUi." + key, params);
  const dateLabel = (date) => new Date(date + "T12:00:00").toLocaleDateString(language === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "short", year: "numeric" });
  const auth = useAuth();
  const navigate = useNavigate();
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPlayerId, setComparisonPlayerId] = useState("");
  const comparisonPlayer = players.find((player) => String(player.id) === comparisonPlayerId);
  const now = new Date();
  const today = localDateString(now);
  const [params, setParams] = useSearchParams();
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);
  const updateParams = update => {
    const next = new URLSearchParams(paramsRef.current);
    update(next);
    paramsRef.current = next;
    setParams(next, { replace: true });
  };
  const fourWeeks = params.get("rosterView") === "4";
  const sortByMinutes = params.get("rosterSort") === "minutes";
  const setSortByMinutes = (enabled) => {
    updateParams(next => { if (enabled) next.set("rosterSort", "minutes"); else next.delete("rosterSort"); });
  };
  const setFourWeeks = (enabled) => {
    updateParams(next => { if (enabled) next.set("rosterView", "4"); else next.delete("rosterView"); });
  };
  const requestedWeek = getAgendaDateKey(params.get("rosterWeek"));
  const currentWeek = monday(today);
  const defaultWeek = seasonBounds ? monday(today < seasonBounds.start_date ? seasonBounds.start_date : today > seasonBounds.end_date ? seasonBounds.end_date : today) : currentWeek;
  const start = requestedWeek && requestedWeek <= today ? monday(requestedWeek) : defaultWeek;
  const rosterReturn = "/statistics?" + new URLSearchParams({ ...Object.fromEntries(params), roster: "1", rosterWeek: start }).toString();
  const setStart = (date) => {
    updateParams(next => next.set("rosterWeek", date));
  };
  const rawStart = fourWeeks ? moveDate(start, -21) : start;
  const rawEnd = moveDate(start, 6);
  const intersects = !seasonBounds || (rawEnd >= seasonBounds.start_date && rawStart <= seasonBounds.end_date);
  const periodStart = intersects && seasonBounds && rawStart < seasonBounds.start_date ? seasonBounds.start_date : rawStart;
  const end = intersects && seasonBounds && rawEnd > seasonBounds.end_date ? seasonBounds.end_date : rawEnd;
  const { sessions, matches } = getPeriodEvents(events, periodStart, end, now);

  const rosterRows = [...players].sort(comparePlayersByName).map((player) => {
    const playerSessions = sessions.filter((event) => !hasPlayerTransferred(player, event.date));
    const statuses = playerSessions.map((event) => getTrainingConfirmationStatus(player, event));
    const pendingSessions = playerSessions.filter((_, index) => statuses[index] === TRAINING_ATTENDANCE_PENDING);
    const training = ["Presente", "Assente", "Recupero", "Parziale", "Permesso", "Infortunato", "Squalificato"]
      .map((status) => [status, statuses.filter((entry) => entry === status).length])
      .filter(([, count]) => count > 0);
    const entries = new Map(getPlayerMatchEntries(player, matches, rows, false).map(({ event, data }) => [event.id, data]));
    const games = matches.filter((event) => !hasPlayerTransferred(player, event.date)).map((event) => {
      const data = entries.get(event.id);
      const publishedList = event.convocazione?.published && Array.isArray(event.convocazione.playerIds);
      const status = data?.status ?? (publishedList ? "Non convocato" : "Convocazione non verificabile");
      return { event, status, minutes: data?.minutes ?? null };
    });
    const known = games.filter(({ minutes }) => minutes !== null);
    const missing = games.filter(({ status }) => status === "Minutaggio da completare");
    const unverifiable = games.filter(({ status }) => status === "Convocazione non verificabile").length;
    const totalMinutes = known.reduce((sum, { minutes }) => sum + minutes, 0);
    const matchSummary = !games.length ? text("noGames") : known.length ?
      (totalMinutes === 0 && !missing.length && (!fourWeeks || !unverifiable) ? text("zeroMinutes") : text("recordedMinutes", { count: totalMinutes })) :
      missing.length ? (fourWeeks ? text("unknownMinutes") : text("missingMinutes")) :
        unverifiable ? text("unverifiable") : text("notCalled");
    const trainingLabels = { Presente: "confirmedPresences", Assente: "absences", Recupero: "recoveries", Parziale: "partial", Permesso: "permissions", Infortunato: "injuries", Squalificato: "suspensions" };
    const trainingSummary = training
      .filter(([status]) => !fourWeeks || !["Presente", "Parziale", "Recupero"].includes(status))
      .map(([status, count]) => text(count === 1 ? ({ Presente: "confirmedPresence", Assente: "absence", Recupero: "recovery", Parziale: "partialSingle", Permesso: "permission", Infortunato: "injury", Squalificato: "suspension" })[status] : trainingLabels[status], { count }));
    if (fourWeeks && playerSessions.length) {
      const trainingPresences = statuses.filter(isTrainingParticipation).length;
      trainingSummary.unshift(text("presencesRatio", { count: trainingPresences, total: playerSessions.length }));
    }
    if (pendingSessions.length) trainingSummary.push(text("pendingCount", { count: pendingSessions.length }));
    return { player, playerSessions, trainingSummary, pendingSessions, games, known, missing, unverifiable, totalMinutes, matchSummary };
  });
  const pendingOnly = params.get("rosterPending") === "1";
  const pendingRows = rosterRows.filter(({ missing, pendingSessions }) =>
    pendingSessions.length || (!loading && !statsError && missing.length));
  const visibleRows = pendingOnly ? pendingRows : rosterRows;
  const groupedByMinutes = fourWeeks && sortByMinutes && matches.length > 0 && !loading && !statsError;
  const groups = groupedByMinutes ? [
    { label: text("completeMinutes"), rows: visibleRows.filter(({ known, missing, unverifiable }) =>
      known.length && !missing.length && !unverifiable).sort((a, b) => a.totalMinutes - b.totalMinutes) },
    { label: text("incompleteMinutes"), rows: visibleRows.filter(({ missing, unverifiable }) =>
      missing.length || unverifiable) },
    { label: text("notCalledPeriod"), rows: visibleRows.filter(({ known, missing, unverifiable }) =>
      !known.length && !missing.length && !unverifiable) },
  ] : [{ label: "", rows: visibleRows }];
  const checkingMinutes = loading && matches.length > 0;
  const togglePending = () => {
    updateParams(next => { if (next.get('rosterPending') === '1') next.delete("rosterPending"); else next.set("rosterPending", "1"); });
  };

  return <AppCard className="weekly-roster">
    <details open={standalone || Boolean(requestedWeek) || pendingOnly || fourWeeks || undefined}>
      <summary hidden={standalone} style={{ cursor: "pointer", fontWeight: 700 }}>{text(standalone ? "firstTeamWeek" : "quadro")}</summary>
      <div className="weekly-roster-controls">
      <div className="weekly-roster-context"><strong>{auth.team?.name || text("firstTeam")}</strong>{scopeLabel && <span>{scopeLabel}</span>}</div>
      <Button variant="ghost" onClick={() => navigate('/attendance-register?month=' + start.slice(0, 7), { state: { rosterReturn } })}>{text('openRegister')}</Button>
      <div role="group" aria-label={text("period")} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        <Button variant={fourWeeks ? "ghost" : "primary"} aria-pressed={!fourWeeks} onClick={() => setFourWeeks(false)}>{text("week")}</Button>
        <Button variant={fourWeeks ? "primary" : "ghost"} aria-pressed={fourWeeks} onClick={() => setFourWeeks(true)}>{text("fourWeeks")}</Button>
      </div>
      <div className="weekly-roster-week-nav">
        <Button variant="ghost" onClick={() => setStart(moveDate(start, -7))} aria-label={text("previous")}>←</Button>
        <strong aria-live="polite">{dateLabel(periodStart)} – {dateLabel(end)}</strong>
        <Button variant="ghost" onClick={() => setStart(moveDate(start, 7))} disabled={start >= currentWeek} aria-label={text("next")}>→</Button>
      </div>
      {seasonBounds && <p className="season-period-note">{t(intersects ? "seasons.periodNote" : "seasons.outsidePeriod", { name: seasonBounds.name })}</p>}
      <p>{text(sessions.length === 1 ? "sessionCount" : "sessionsCount", { count: sessions.length })} · {text(matches.length === 1 ? "matchCount" : "matchesCount", { count: matches.length })}</p>
      {fourWeeks && players.length > 0 && <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {text("sort")}
        <select value={sortByMinutes ? "minutes" : "name"} onChange={(event) => setSortByMinutes(event.target.value === "minutes")}
          style={{ minHeight: 44, minWidth: 0, maxWidth: "100%", padding: "8px 12px", border: "1px solid #334155", borderRadius: 8, background: "#182334", color: "#e2e8f0" }}>
          <option value="name">{text("sortName")}</option>
          <option value="minutes">{text("sortMinutes")}</option>
        </select>
      </label>}
      {players.length > 0 && <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, cursor: "pointer" }}>
        <input type="checkbox" checked={pendingOnly} onChange={togglePending} />
        {text("onlyPending")}
      </label>}
      {pendingOnly && players.length > 0 && <p aria-live="polite">
        {checkingMinutes
          ? text("checkingMinutes")
          : statsError && matches.length > 0
            ? text("unverifiableMinutes")
          : pendingRows.length === 0
            ? text("nothingPending")
            : text(pendingRows.length === 1 ? "playerPending" : "playersPending", { count: pendingRows.length })}
      </p>}
      </div>
      {standalone && !fourWeeks && players.length > 0 && <details onToggle={(event) => setShowComparison(event.currentTarget.open)} style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", padding: "10px 0" }}>{text("comparison")}</summary>
        {showComparison && <FourWeekComparison {...{ events, players, rows, start, now, loading, statsError }}
          selectedPlayer={comparisonPlayer} onSelectPlayer={setComparisonPlayerId} />}
      </details>}
      {!players.length ? <p>{text("noPlayers")}</p> : groups.filter(({ rows }) => rows.length > 0).map(({ label, rows }) => (
        <section key={label} aria-label={label || undefined} style={{ minWidth: 0, marginTop: label ? 12 : undefined }}>
        {label && <h3 style={{ margin: "0 0 8px" }}>{label}</h3>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: 12 }}>
          {rows.map(({ player, playerSessions, trainingSummary, games, known, missing, unverifiable, matchSummary }) => (
            <article key={player.id} style={{ minWidth: 0, padding: 12, border: "1px solid #334155", borderRadius: 12, overflowWrap: "anywhere" }}>
              <h3 style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}>{player.name}</h3>
              {hasPlayerTransferred(player, today) && <small>{t("pages.playerDetail.profile.transferred")} · {dateLabel(player.transferDate)}</small>}
              <div><strong>{text("training")}</strong><div>{trainingSummary.join(" · ") || text("noTraining")}</div></div>
              <div style={{ marginTop: 8 }}><strong>{text("games")}</strong><div>
                {loading && matches.length ? text("loadingMinutes") : statsError && matches.length ? text("unverifiableMinutes") : <>
                  <span style={!known.length && missing.length ? { color: "#fde68a" } : undefined}>{matchSummary}</span>
                  {missing.length > 0 && (fourWeeks || known.length > 0 || missing.length > 1) && <span style={{ color: "#fde68a" }}>
                    {" · " + text(missing.length === 1 ? "missingGame" : "missingGames", { count: missing.length })}
                  </span>}
                  {fourWeeks && unverifiable > 0 && (known.length > 0 || missing.length > 0 || unverifiable > 1) && <span style={{ color: "#fde68a" }}>
                    {" · " + text(unverifiable === 1 ? "unknownCallup" : "unknownCallups", { count: unverifiable })}
                  </span>}
                </>}
              </div></div>
              {(playerSessions.length > 0 || (!loading && !statsError && games.length > 0)) && <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", padding: "6px 0" }}>{text("details")}</summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, overflowWrap: "anywhere" }}>
                  {playerSessions.map((event) => <li key={"session-" + event.id}>
                    <Link to={"/session-attendance/" + encodeURIComponent(event.id)} state={{ rosterReturn, rosterWeek: start, rosterPending: pendingOnly }}>
                      {dateLabel(event.date)} · {event.title || t("common.session")} · {t("pages.attendanceRegister.status." + getTrainingConfirmationStatus(player, event))}
                    </Link>
                  </li>)}
                  {!loading && !statsError && games.map(({ event, status, minutes }) => {
                    const label = dateLabel(event.date) + " · " + (event.opponent || event.title || t("common.match")) + " · " +
                      (minutes === 0 ? text("zeroMinutes") : minutes !== null ? minutes + " min" : status === "Minutaggio da completare" ? text("missingMinutes") : status === "Convocazione non verificabile" ? text("unverifiable") : text("notCalled"));
                    return <li key={"match-" + event.id}>{status === "Minutaggio da completare" ?
                      <Link to={"/match-completion/" + encodeURIComponent(event.id)} state={{ minutesPlayerId: String(player.id), rosterReturn, rosterWeek: start, rosterPending: pendingOnly }}>{label}</Link> : label}
                    </li>;
                  })}
                </ul>
              </details>}
            </article>
          ))}
        </div>
        </section>
      ))}
    </details>
  </AppCard>;
}
