import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import MetricStrip from "../components/ui/MetricStrip";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { formatDate, RPE_BY_MATCH_DAY } from "../utils/helpers";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";

const MICRO_DAYS = [
  { key: "MD+1", offset: -6, focusKey: "pages.microcycle.focusMDp1" },
  { key: "MD-4", offset: -4, focusKey: "pages.microcycle.focusMDm4" },
  { key: "MD-3", offset: -3, focusKey: "pages.microcycle.focusMDm3" },
  { key: "MD-2", offset: -2, focusKey: "pages.microcycle.focusMDm2" },
  { key: "MD-1", offset: -1, focusKey: "pages.microcycle.focusMDm1" },
  { key: "MD",   offset: 0,  focusKey: "pages.microcycle.focusMD" },
];

function toDateOnly(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getEventLoad(session) {
  const attendance = Object.values(session.attendance || {});
  const rpeValues = attendance.map((item) => Number(item.rpe || 0)).filter(Boolean);
  const avgRpe = rpeValues.length
    ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length
    : 0;
  const duration = Number(session.duration || 0);
  return Math.round(duration * avgRpe);
}

function getGpsDayLoad(gpsSessions = [], dayKey) {
  const daySessions = gpsSessions.filter((session) => toDateOnly(session.date) === dayKey);
  const totalLoad = daySessions.reduce((sum, session) => {
    return sum + (session.rows || []).reduce((rowSum, row) => rowSum + Number(row.playerLoad || 0), 0);
  }, 0);
  const totalDistance = daySessions.reduce((sum, session) => {
    return sum + (session.rows || []).reduce((rowSum, row) => rowSum + Number(row.totalDistance || 0), 0);
  }, 0);
  return {
    sessions: daySessions.length,
    load: Math.round(totalLoad),
    distance: Math.round(totalDistance),
  };
}

function getPlayerName(player, fallback = "—") {
  return [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || fallback;
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function getPostMatchMicrocycleFocus(match) {
  const report = match?.postMatch || {};
  const rows = [
    { labelKey: "pages.microcycle.focusRowNextWeek",       value: report.nextWeekFocus },
    { labelKey: "pages.microcycle.focusRowTrainingActions", value: report.trainingActions },
    { labelKey: "pages.microcycle.focusRowRecovery",        value: report.recoveryPlan || report.physicalAlerts },
    { labelKey: "pages.microcycle.focusRowTactical",        value: report.tacticalCorrections || report.notWorked },
    { labelKey: "pages.microcycle.focusRowSetPieces",       value: report.setPiecesReview },
  ].filter((row) => hasText(row.value));

  if (!rows.length) return null;

  return {
    match,
    rows,
    nextWeekFocus: report.nextWeekFocus,
    trainingActions: report.trainingActions,
    recoveryPlan: report.recoveryPlan || report.physicalAlerts,
    tacticalCorrections: report.tacticalCorrections || report.notWorked,
    setPiecesReview: report.setPiecesReview,
  };
}

function getPostMatchDaySuggestion(dayKey, focus) {
  if (!focus) return "";
  const suggestions = {
    "MD+1": focus.recoveryPlan,
    "MD-4": focus.nextWeekFocus || focus.trainingActions,
    "MD-3": focus.trainingActions || focus.tacticalCorrections,
    "MD-2": focus.tacticalCorrections || focus.setPiecesReview,
    "MD-1": focus.setPiecesReview || focus.nextWeekFocus,
  };
  return suggestions[dayKey] || "";
}

function getTrainingThemeFromDay(dayKey) {
  if (dayKey === "MD+1") return "Recupero";
  if (dayKey === "MD-4") return "Possesso";
  if (dayKey === "MD-3") return "Transizione";
  if (dayKey === "MD-2") return "Fase difensiva";
  if (dayKey === "MD-1") return "Palla inattiva";
  return "Costruzione";
}

function buildTrainingDraft(day, focus, match, t) {
  const suggestion = getPostMatchDaySuggestion(day.key, focus);
  const focusRows = focus?.rows || [];
  const sourceRows = focusRows
    .map((row) => `${t ? t(row.labelKey) : row.labelKey}: ${row.value}`)
    .join("\n");
  const sessionLabel = day.planned?.label || (t ? t("pages.microcycle.sessionFallback") : "Seduta");

  return {
    title: `${day.key} · ${sessionLabel}${match?.opponent ? ` vs ${match.opponent}` : ""}`,
    date: day.dateKey,
    type: "Allenamento",
    theme: getTrainingThemeFromDay(day.key),
    matchDayDistance: day.key,
    objective: suggestion || focus?.nextWeekFocus || "",
    notes: sourceRows ? `${t ? t("pages.microcycle.noteFromReport") : "Da report post-gara:"}\n${sourceRows}` : "",
    exercises: [],
    attendance: {},
    sourceType: focus ? "postMatch" : "",
    sourceMatchId: focus?.match?.id ? String(focus.match.id) : "",
    sourceMatchLabel: match?.opponent || match?.title || "",
    sourceMatchDate: match?.date || "",
    sourceSummary: suggestion || focus?.nextWeekFocus || "",
  };
}

export default function Microcycle({
  sessions = [], matches = [], players = [], gpsSessions = [] }) {

  const { t } = useTranslation();
  const isMobile = useIsMobile(760);
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const nextMatch = useMemo(() => {
    return [...matches]
      .filter((match) => match.date && new Date(match.date) >= new Date(today.toDateString()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  }, [matches, today]);

  const lastMatch = useMemo(() => {
    return [...matches]
      .filter((match) => match.date && new Date(match.date) < new Date(today.toDateString()))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  }, [matches, today]);

  const anchorMatch = nextMatch || lastMatch;
  const postMatchFocus = useMemo(() => getPostMatchMicrocycleFocus(lastMatch), [lastMatch]);

  const microDays = useMemo(() => {
    if (!anchorMatch?.date) return [];
    const matchDate = new Date(anchorMatch.date);
    return MICRO_DAYS.map((day) => {
      const date = addDays(matchDate, day.offset);
      const dateKey = toDateOnly(date);
      const daySessions = sessions.filter((session) => toDateOnly(session.date) === dateKey);
      const dayMatches = matches.filter((match) => toDateOnly(match.date) === dateKey);
      const gps = getGpsDayLoad(gpsSessions, dateKey);
      const planned = RPE_BY_MATCH_DAY[day.key] || null;
      const realLoad = daySessions.reduce((sum, session) => sum + getEventLoad(session), 0);
      const totalMinutes = daySessions.reduce((sum, session) => sum + Number(session.duration || 0), 0);

      return {
        ...day,
        date,
        dateKey,
        sessions: daySessions,
        matches: dayMatches,
        gps,
        planned,
        realLoad,
        totalMinutes,
      };
    });
  }, [anchorMatch, gpsSessions, matches, sessions]);

  const unavailablePlayers = players.filter((player) =>
    ["Infortunato", "Recupero", "Differenziato", "Squalificato"].includes(player.status || "")
  );

  const weeklyMinutes = microDays.reduce((sum, day) => sum + day.totalMinutes, 0);
  const weeklyLoad = microDays.reduce((sum, day) => sum + day.realLoad, 0);
  const gpsDistance = microDays.reduce((sum, day) => sum + day.gps.distance, 0);

  function createTrainingFromDay(day) {
    const draftTraining = buildTrainingDraft(day, postMatchFocus, anchorMatch, t);
    sessionStorage.setItem("trainings_draft", JSON.stringify(draftTraining));
    navigate("/trainings", { state: { draftTraining } });
  }

  if (!anchorMatch) {
    return (
      <div style={styles.page}>
        <PageHeader
          title={t("pages.microcycle.title")}
          subtitle={t("pages.microcycle.subtitle")}
          badge={t("pages.microcycle.badge")}
        />
        <EmptyState
          icon="📆"
          title={t("pages.microcycle.emptyTitle")}
          text={t("pages.microcycle.emptyText")}
          action={<Button onClick={() => navigate("/matches")}>{t("pages.microcycle.emptyAction")}</Button>}
        />
      </div>
    );
  }

  return (
    <div style={mc.page}>
      <PageHeader
        title={t("pages.microcycle.title")}
        subtitle={t("pages.microcycle.pageSubtitle", {
          opponent: anchorMatch.opponent || t("pages.microcycle.defaultOpponent"),
          date: formatDate(anchorMatch.date),
        })}
        badge={nextMatch ? t("pages.microcycle.nextMatchBadge") : t("pages.microcycle.lastMatchBadge")}
        action={
          <div style={mc.headerActions}>
            <Button variant="ghost" onClick={() => navigate("/calendar")}>{t("pages.microcycle.btnCalendar")}</Button>
            <Button onClick={() => navigate("/trainings")}>{t("pages.microcycle.btnCreateSession")}</Button>
          </div>
        }
      />

      <MetricStrip className="mobile-scroll-x" items={[
        { key: "minutes",     label: t("pages.microcycle.kpiMinutes"),     value: `${weeklyMinutes}′`,                                        color: "#3b82f6" },
        { key: "load",        label: t("pages.microcycle.kpiLoad"),        value: weeklyLoad || "—",                                          color: "#fb923c" },
        { key: "gps",         label: t("pages.microcycle.kpiGps"),         value: gpsDistance ? `${Math.round(gpsDistance / 1000)} km` : "—", color: "#22c55e" },
        { key: "unavailable", label: t("pages.microcycle.kpiUnavailable"), value: unavailablePlayers.length,                                  color: "#ef4444" },
      ]} />

      <div style={{ ...mc.mainGrid, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(280px, 360px)" }}>
        <section style={mc.timeline}>
          {microDays.map((day) => (
            <MicroDayCard
              key={day.key}
              day={day}
              postMatchSuggestion={getPostMatchDaySuggestion(day.key, postMatchFocus)}
              onOpenSession={(id) => navigate(`/session-attendance/${id}`)}
              onOpenMatch={(id) => navigate(`/match-day/${id}`)}
              onCreateSession={() => createTrainingFromDay(day)}
            />
          ))}
        </section>

        <aside style={mc.side}>
          {postMatchFocus && (
            <AppCard>
              <div style={mc.cardHead}>
                <div>
                  <p style={mc.eyebrow}>{t("pages.microcycle.postMatchEyebrow")}</p>
                  <h3 style={mc.sideTitle}>{t("pages.microcycle.microcycleGoals")}</h3>
                </div>
                <Badge tone="purple">{t("pages.microcycle.reportBadge")}</Badge>
              </div>

              <div style={mc.focusList}>
                {postMatchFocus.rows.map((row) => (
                  <div key={row.labelKey} style={mc.focusRow}>
                    <span>{t(row.labelKey)}</span>
                    <p>{row.value}</p>
                  </div>
                ))}
              </div>

              <div style={mc.sideActions}>
                <Button variant="ghost" onClick={() => navigate(`/post-match/${postMatchFocus.match.id}`)}>
                  {t("pages.microcycle.btnOpenPostMatch")}
                </Button>
                <Button onClick={() => createTrainingFromDay(microDays[1] || microDays[0])}>
                  {t("pages.microcycle.btnCreateSession")}
                </Button>
              </div>
            </AppCard>
          )}

          <AppCard>
            <div style={mc.cardHead}>
              <div>
                <p style={mc.eyebrow}>{t("pages.microcycle.staffEyebrow")}</p>
                <h3 style={mc.sideTitle}>{t("pages.microcycle.weekAlerts")}</h3>
              </div>
              <Badge tone={unavailablePlayers.length ? "orange" : "green"}>
                {unavailablePlayers.length ? t("pages.microcycle.toManageBadge") : t("pages.microcycle.rosterOkBadge")}
              </Badge>
            </div>

            {unavailablePlayers.length ? (
              <div style={mc.playerList}>
                {unavailablePlayers.slice(0, 8).map((player) => (
                  <button
                    type="button"
                    key={player.id}
                    onClick={() => navigate(`/players/${player.id}`)}
                    style={mc.playerRow}
                  >
                    <span style={mc.playerName}>{getPlayerName(player, t("pages.microcycle.playerFallback"))}</span>
                    <Badge tone={player.status === "Infortunato" ? "red" : "orange"}>
                      {player.status}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p style={mc.muted}>{t("pages.microcycle.noUnavailable")}</p>
            )}

            <div style={mc.sideActions}>
              <Button variant="ghost" onClick={() => navigate("/availability")}>{t("pages.microcycle.btnAvailability")}</Button>
              <Button variant="ghost" onClick={() => navigate("/gps-load")}>{t("pages.microcycle.btnGpsLoad")}</Button>
            </div>
          </AppCard>

          <AppCard>
            <p style={mc.eyebrow}>{t("pages.microcycle.matchPlanEyebrow")}</p>
            <h3 style={mc.sideTitle}>{anchorMatch.opponent || t("pages.microcycle.defaultOpponent")}</h3>
            <p style={mc.muted}>
              {anchorMatch.location || t("pages.microcycle.defaultLocation")} · {anchorMatch.formation || t("pages.microcycle.defaultFormation")}
            </p>
            <div style={mc.sideActions}>
              <Button onClick={() => navigate(`/match-day/${anchorMatch.id}`)}>{t("pages.microcycle.btnOpenMatchDay")}</Button>
              <Button variant="ghost" onClick={() => navigate("/set-plays")}>{t("pages.microcycle.btnSetPieces")}</Button>
            </div>
          </AppCard>
        </aside>
      </div>
    </div>
  );
}

function MicroDayCard({ day, postMatchSuggestion, onOpenSession, onOpenMatch, onCreateSession }) {
  const { t } = useTranslation();
  const hasWork = day.sessions.length || day.matches.length;
  return (
    <AppCard>
      <div style={mc.dayCard}>
        <div style={mc.dayBadge}>
          <strong>{day.key}</strong>
          <span>{formatDate(day.date)}</span>
        </div>

        <div style={mc.dayBody}>
          <div style={mc.dayTop}>
            <div>
              <h3 style={mc.dayTitle}>{day.planned?.label || t("pages.microcycle.staffDay")}</h3>
              <p style={mc.muted}>{t(day.focusKey)}</p>
            </div>
            <Badge tone={day.planned?.color || "blue"}>
              RPE {day.planned ? `${day.planned.min}-${day.planned.max}` : "—"}
            </Badge>
          </div>

          <div className="no-mobile-override" style={mc.metricsRow}>
            <MiniMetric label={t("pages.microcycle.metricSessions")} value={day.sessions.length} />
            <MiniMetric label={t("pages.microcycle.metricMinutes")} value={day.totalMinutes ? `${day.totalMinutes}′` : "—"} />
            <MiniMetric label={t("pages.microcycle.metricLoad")} value={day.realLoad || "—"} />
            <MiniMetric label={t("pages.microcycle.metricGps")} value={day.gps.distance ? `${Math.round(day.gps.distance / 1000)} km` : "—"} />
          </div>

          {postMatchSuggestion && (
            <div style={mc.suggestionBox}>
              <Badge tone="purple">{t("pages.microcycle.postMatchBadge")}</Badge>
              <span>{postMatchSuggestion}</span>
            </div>
          )}

          {hasWork ? (
            <div style={mc.eventList}>
              {day.sessions.map((session) => (
                <button key={session.id} type="button" style={mc.eventRow} onClick={() => onOpenSession(session.id)}>
                  <span>📋 {session.title || t("pages.microcycle.sessionFallback")}</span>
                  <small>{session.theme || t("pages.microcycle.trainingFallback")} · {session.duration || 0}′</small>
                </button>
              ))}
              {day.matches.map((match) => (
                <button key={match.id} type="button" style={mc.eventRow} onClick={() => onOpenMatch(match.id)}>
                  <span>⚽ {match.opponent || t("pages.microcycle.matchFallback")}</span>
                  <small>{match.location || t("pages.microcycle.locationFallback")} · Match Day</small>
                </button>
              ))}
            </div>
          ) : (
            <div style={mc.emptyDay}>
              <span>{t("pages.microcycle.noActivity")}</span>
              <Button variant="ghost" onClick={onCreateSession}>{t("pages.microcycle.btnAddSession")}</Button>
            </div>
          )}
        </div>
      </div>
    </AppCard>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div style={mc.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const mc = {
  page: { display: "grid", gap: 22 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
    gap: 18,
    alignItems: "start",
  },
  timeline: { display: "grid", gap: 14, minWidth: 0 },
  side: { display: "grid", gap: 14, minWidth: 0 },
  dayCard: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 16,
    alignItems: "stretch",
  },
  dayBadge: {
    borderRadius: 16,
    padding: 14,
    display: "grid",
    alignContent: "center",
    gap: 5,
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.28)",
    color: "#bfdbfe",
  },
  dayBody: { display: "grid", gap: 14, minWidth: 0 },
  dayTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  dayTitle: { margin: "0 0 5px", fontSize: 20, lineHeight: 1.15 },
  muted: { margin: 0, color: "#94a3b8", lineHeight: 1.45 },
  eyebrow: {
    margin: "0 0 5px",
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
    gap: 10,
  },
  miniMetric: {
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 5,
  },
  eventList: { display: "grid", gap: 8 },
  suggestionBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(168,85,247,0.10)",
    border: "1px solid rgba(168,85,247,0.24)",
    color: "#e9d5ff",
    lineHeight: 1.4,
  },
  eventRow: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(15,23,42,0.65)",
    color: "#e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    cursor: "pointer",
    textAlign: "left",
  },
  emptyDay: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    color: "#64748b",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    paddingTop: 12,
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sideTitle: { margin: 0, fontSize: 20 },
  playerList: { display: "grid", gap: 8 },
  playerRow: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    color: "#e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    cursor: "pointer",
  },
  playerName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sideActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 },
  focusList: { display: "grid", gap: 10 },
  focusRow: {
    borderRadius: 14,
    padding: "11px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
};
