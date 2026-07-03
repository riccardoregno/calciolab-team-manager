import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import MetricStrip from "../components/ui/MetricStrip";
import { SkeletonStatCard } from "../components/ui/Skeleton";
import { fetchMatchRsvps } from "../services/rsvp";
import { useAuth } from "../hooks/useAuth";
import { loadAllPlayerStats, loadAllPlayerAvgRatings } from "../services/playerProfile";
import { getTeamWellnessToday } from "../services/wellness";
import { useTranslation } from "../i18n";
import { getObjectiveStatusMeta } from "../constants/objectiveStatus";

import {
  formatDate,
  formatShortDate,
  getBillingStatus,
  getCoachAlerts,
  getCoachRewardProfile,
  getCurrentUserRole,
  getPhysicalReference,
  getPlayerSummary,
  getSeasonRecord,
  getSetupProgress,
  getSubscriptionPlan,
  normalizeAppSettings,
} from "../utils/helpers";

// TONE_LABEL is now built inside each component that uses it via t()

const DASHBOARD_SECTION_KEYS = ["nextEvent", "kpis", "leaderboard", "rosterStatus", "weeklyLoad", "wellnessToday", "weekFocus", "coachAlerts", "recentActivities", "quickActions", "rewardCenter"];
const DEFAULT_SECTION_ORDER = DASHBOARD_SECTION_KEYS;
const PLAYER_STATUS_LABEL_KEYS = {
  Disponibile: "pages.players.statusAvailable",
  Infortunato: "pages.players.statusInjured",
  Squalificato: "pages.players.statusSuspended",
  Recupero: "pages.dashboard.statusRecovery",
  Differenziato: "pages.dashboard.statusDifferentiated",
};
const TRAINING_THEME_LABEL_KEYS = {
  Costruzione: "pages.trainings.themeCostruzione",
  Possesso: "pages.trainings.themePossesso",
  Pressing: "pages.trainings.themePressing",
  Transizione: "pages.trainings.themeTransizione",
  Finalizzazione: "pages.trainings.themeFinalizzazione",
  "Fase difensiva": "pages.trainings.themeFaseDifensiva",
  "Palla inattiva": "pages.trainings.themePallaInattiva",
  Recupero: "pages.trainings.themeRecupero",
};

function getDashboardEventTypeLabel(type, t) {
  if (type === "Partita") return t("pages.dashboard.eventTypeMatch");
  if (type === "Seduta" || type === "Allenamento") return t("pages.dashboard.eventTypeSession");
  return type || t("pages.dashboard.widgetEvent");
}

function getPlayerStatusLabel(status, t) {
  if (!status) return t("pages.dashboard.athleteProfile");
  return t(PLAYER_STATUS_LABEL_KEYS[status] || "pages.dashboard.athleteProfile");
}

function getTrainingThemeLabel(theme, t) {
  if (!theme) return t("common.session");
  return t(TRAINING_THEME_LABEL_KEYS[theme] || "pages.trainings.themeFallback");
}

function SortableSection({ id, children }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.55 : 1,
        position: "relative",
        marginBottom: 18,
      }}
    >
      {/* drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="mobile-hide"
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 20,
          cursor: isDragging ? "grabbing" : "grab",
          color: "#475569",
          fontSize: 18,
          lineHeight: 1,
          userSelect: "none",
          padding: "2px 6px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
        title={t("pages.dashboard.dragHandle")}
      >
        ⠿
      </div>
      {children}
    </div>
  );
}

function getOpenPostMatchCorrections(sessions = [], matches = []) {
  return sessions
    .filter((session) =>
      session.sourceType === "postMatch" && (session.objectiveStatus || "todo") !== "solved"
    )
    .map((session) => {
      const match = matches.find((item) => String(item.id) === String(session.sourceMatchId));
      return { ...session, sourceMatch: match };
    })
    .sort((a, b) => {
      const statusWeight = { todo: 0, worked: 1, solved: 2 };
      const byStatus = (statusWeight[a.objectiveStatus || "todo"] ?? 0) - (statusWeight[b.objectiveStatus || "todo"] ?? 0);
      if (byStatus !== 0) return byStatus;
      return new Date(a.date || 0) - new Date(b.date || 0);
    });
}

function Dashboard({
  players: rawPlayers = [],
  exercises: rawExercises = [],
  sessions: rawSessions = [],
  matches: rawMatches = [],
  physicalTests: rawPhysicalTests = [],
  appSettings = {},
  setAppSettings,
  teamId = null,
  loading = false,
}) {
  const players = useMemo(() => Array.isArray(rawPlayers) ? rawPlayers : [], [rawPlayers]);
  const exercises = useMemo(() => Array.isArray(rawExercises) ? rawExercises : [], [rawExercises]);
  const sessions = useMemo(() => Array.isArray(rawSessions) ? rawSessions : [], [rawSessions]);
  const matches = useMemo(() => Array.isArray(rawMatches) ? rawMatches : [], [rawMatches]);
  const physicalTests = useMemo(() => Array.isArray(rawPhysicalTests) ? rawPhysicalTests : [], [rawPhysicalTests]);

  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();

  const [playerStatsMap, setPlayerStatsMap] = useState({});
  const [playerRatingsMap, setPlayerRatingsMap] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [teamWellnessToday, setTeamWellnessToday] = useState([]);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [pendingRsvpMatches, setPendingRsvpMatches] = useState([]);
  const [dashTab, setDashTab] = useState("oggi");
  const [simpleView, setSimpleView] = useState(() => {
    try { return localStorage.getItem("dash_simple_view") === "1"; } catch { return false; }
  });
  const isMobile = useIsMobile();

  function toggleSimpleView() {
    setSimpleView((v) => {
      const next = !v;
      try { localStorage.setItem("dash_simple_view", next ? "1" : "0"); } catch (_e) { /* ignore */ }
      return next;
    });
  }

  // Memoize settings so derived useMemo hooks don't re-run on every render
  const settings = useMemo(() => normalizeAppSettings(appSettings), [appSettings]);
  const widgets = settings.dashboardWidgets;
  const currentRole = getCurrentUserRole(settings);

  const reward = useMemo(() => getCoachRewardProfile({
    players, exercises, sessions, matches, physicalTests,
  }), [players, exercises, sessions, matches, physicalTests]);

  const plan = getSubscriptionPlan(settings);

  const setup = useMemo(() => getSetupProgress({
    players, exercises, sessions, matches, appSettings: settings,
  }), [players, exercises, sessions, matches, settings]);

  const billing = getBillingStatus(settings);
  // FIX: i piani concessi via codice promo arrivano ora da
  // subscription_plan/billing_status (aggiornati server-side da
  // redeem-promo-code), quindi billing.billingStatus è già "active" per chi
  // ha riscattato un codice — non serve più un controllo promo separato per
  // sopprimere il prompt di billing.
  const showBillingPrompt = (
    billing.trialActive ||
    billing.trialExpired ||
    billing.billingStatus === "free"
  );

  useEffect(() => {
    if (!auth.team?.id) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatsLoading(true);
    setStatsError(null);
    Promise.all([
      loadAllPlayerStats(auth.team.id),
      loadAllPlayerAvgRatings(auth.team.id),
    ]).then(([{ data, error }, { data: ratingsData }]) => {
      if (!active) return;
      if (error) setStatsError(error.message || t("pages.dashboard.statsLoadError"));
      setPlayerStatsMap(data || {});
      setPlayerRatingsMap(ratingsData || {});
      setStatsLoading(false);
    });
    return () => { active = false; };
  }, [auth.team?.id, t]);

  useEffect(() => {
    if (!auth.team?.id) return;
    let active = true;
    getTeamWellnessToday({ teamId: auth.team.id }).then(({ data }) => {
      if (active) setTeamWellnessToday(data || []);
    });
    return () => { active = false; };
  }, [auth.team?.id]);

  const primaPlayers = useMemo(
    () => players.filter((player) => (player.gruppo || "prima") === "prima"),
    [players]
  );

  const playerStats = useMemo(() => {
    return primaPlayers.map((player) => {
      const stat = playerStatsMap[String(player.id)] || {};
      const avgRating = playerRatingsMap[String(player.id)] ?? null;

      return {
        id: player.id,
        name: player.name,
        role: player.role || "",
        goals: Number(stat.goals || 0),
        assists: Number(stat.assists || 0),
        minutes: Number(stat.minutes_played || 0),
        appearances: Number(stat.appearances || 0),
        yellowCards: Number(stat.yellow_cards || 0),
        redCards: Number(stat.red_cards || 0),
        avgRating,
      };
    });
  }, [primaPlayers, playerStatsMap, playerRatingsMap]);

  const totalGoals = playerStats.reduce((sum, p) => sum + p.goals, 0);
  const totalAssists = playerStats.reduce((sum, p) => sum + p.assists, 0);
  const totalMinutes = playerStats.reduce((sum, p) => sum + p.minutes, 0);

  const realTopScorer = [...playerStats].sort((a, b) => b.goals - a.goals)[0];
  const realTopAssistman = [...playerStats].sort((a, b) => b.assists - a.assists)[0];
  const realTopMinutes = [...playerStats].sort((a, b) => b.minutes - a.minutes)[0];
  const realTopPresence = [...playerStats].sort((a, b) => b.appearances - a.appearances)[0];
  const realTopRating = [...playerStats]
    .filter((p) => p.avgRating !== null)
    .sort((a, b) => b.avgRating - a.avgRating)[0] ?? null;

  const today = todayStart();
  const todayTime = today.getTime();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const events = [...sessions, ...matches].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const nextEvent = events.find((event) => new Date(event.date) >= today);
  const nextTraining = sessions.find((s) => new Date(s.date) >= today);
  const nextMatch = [...matches]
    .filter((m) => new Date(m.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const [nextMatchRsvpState, setNextMatchRsvpState] = useState({ matchId: "", rsvps: [] });
  const nextMatchId = String(nextMatch?.id || "");
  const nextMatchRsvps = useMemo(
    () => nextMatchRsvpState.matchId === nextMatchId ? nextMatchRsvpState.rsvps : [],
    [nextMatchId, nextMatchRsvpState]
  );
  useEffect(() => {
    if (!auth.team?.id || !nextMatchId) return;
    let active = true;
    fetchMatchRsvps({ teamId: auth.team.id, matchId: nextMatchId }).then(({ rsvps }) => {
      if (!active) return;
      setNextMatchRsvpState({ matchId: nextMatchId, rsvps: rsvps || [] });
    });
    return () => { active = false; };
  }, [auth.team?.id, nextMatchId]);

  const nextMatchRsvpSummary = useMemo(() => {
    const convocatiIds = Array.isArray(nextMatch?.convocazione?.playerIds)
      ? nextMatch.convocazione.playerIds.map(String)
      : [];
    if (!convocatiIds.length) return null;

    const byPlayer = new Map(nextMatchRsvps.map((r) => [String(r.player_id), r.response]));
    let available = 0, unavailable = 0, pending = 0;
    for (const id of convocatiIds) {
      const response = byPlayer.get(id);
      if (response === "yes") available += 1;
      else if (response === "no") unavailable += 1;
      else pending += 1;
    }
    return { total: convocatiIds.length, available, unavailable, pending };
  }, [nextMatch, nextMatchRsvps]);

  const effectiveTeamId = teamId || auth.team?.id || null;
  useEffect(() => {
    let active = true;

    const futureMatches = matches
      .filter((match) => {
        const matchDate = new Date(match.date);
        const hasConvocati = Array.isArray(match.convocazione?.playerIds) && match.convocazione.playerIds.length > 0;
        return effectiveTeamId && hasConvocati && matchDate.getTime() >= todayTime;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    const pendingRequest = futureMatches.length
      ? Promise.all(
        futureMatches.map(async (match) => {
          const { rsvps } = await fetchMatchRsvps({ teamId: effectiveTeamId, matchId: match.id });
          const pending = (rsvps || []).filter((rsvp) => !rsvp.response).length;
          return pending > 0 ? { match, pending } : null;
        })
      )
      : Promise.resolve([]);

    pendingRequest.then((items) => {
      if (!active) return;
      setPendingRsvpMatches(items.filter(Boolean).slice(0, 3));
    }).catch(() => {
      if (active) setPendingRsvpMatches([]);
    });

    return () => { active = false; };
  }, [effectiveTeamId, matches, todayTime]);

  const todayEvents = events.filter((event) => {
    const date = new Date(event.date);
    return date >= today && date < new Date(today.getTime() + 24 * 60 * 60 * 1000);
  });
  const upcomingWeekAgenda = events.filter((event) => {
    const date = new Date(event.date);
    return date >= today && date <= weekEnd;
  }).slice(0, 5);
  const upcomingWeekEvents = upcomingWeekAgenda.length;
  const openCorrections = getOpenPostMatchCorrections(sessions, matches);

  const availablePlayers = primaPlayers.filter(
    (p) => !p.status || p.status === "Disponibile"
  ).length;
  const unavailablePlayers = Math.max(0, primaPlayers.length - availablePlayers);

  const recentActivities = [...events]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const seasonRecord = getSeasonRecord(matches);

  const coachAlerts = useMemo(() => [
    ...getMatchOperationalAlerts(nextMatch, t),
    ...getCoachAlerts({ players: primaPlayers, matches, physicalTests, sessions, playerStatsMap, teamWellnessToday, t }),
  ], [primaPlayers, matches, physicalTests, sessions, playerStatsMap, teamWellnessToday, nextMatch, t]);

  const sectionOrder = Array.isArray(settings.dashboardSectionOrder)
    ? settings.dashboardSectionOrder.filter((key) => DASHBOARD_SECTION_KEYS.includes(key))
    : DEFAULT_SECTION_ORDER;
  const safeSectionOrder = sectionOrder.length ? sectionOrder : DEFAULT_SECTION_ORDER;

  function updateSectionOrder(newOrder) {
    setAppSettings?.({ ...settings, dashboardSectionOrder: newOrder });
  }

  function handleSectionDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = safeSectionOrder.indexOf(String(active.id));
    const newIndex = safeSectionOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    updateSectionOrder(arrayMove([...safeSectionOrder], oldIndex, newIndex));
  }

  function toggleWidget(key) {
    setAppSettings?.({
      ...settings,
      dashboardWidgets: {
        ...widgets,
        [key]: !widgets[key],
      },
    });
  }

  function openAgendaEvent(event) {
    if (event.type === "Partita" || event.opponent) {
      navigate(event.id ? `/match-day/${event.id}` : "/matches");
      return;
    }

    navigate("/trainings");
  }

  function renderSectionContent(sectionId) {
    switch (sectionId) {
      case "nextEvent":
        if (!widgets.hero && !widgets.nextEvent) return null;
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.4fr 0.8fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            {widgets.hero && (
              <CoachControlRoom
                nextEvent={nextEvent}
                nextTraining={nextTraining}
                nextMatch={nextMatch}
                todayEvents={todayEvents}
                upcomingWeekEvents={upcomingWeekEvents}
                availablePlayers={availablePlayers}
                unavailablePlayers={unavailablePlayers}
                playersCount={primaPlayers.length}
                coachAlerts={coachAlerts}
                setup={setup}
                navigate={navigate}
                isMobile={isMobile}
              />
            )}

            {widgets.nextEvent && (
              <AppCard>
                {nextEvent?.type === "Partita" ? (
                  <NextMatchCard match={nextEvent} navigate={navigate} clubName={settings.workspaceProfile?.clubName || t("common.appName")} rsvpSummary={nextMatchRsvpSummary} />
                ) : (
                  <>
                    <h3 style={{ marginTop: 0 }}>{t("pages.dashboard.nextEvent")}</h3>
                    {nextEvent ? (
                      <div>
                        <Badge tone="green">{getDashboardEventTypeLabel(nextEvent.type, t)}</Badge>
                        <h2 style={{ marginBottom: 8 }}>{nextEvent.title}</h2>
                        <p style={{ color: "#94a3b8" }}>{formatDate(nextEvent.date)}</p>
                        <p style={{ color: "#cbd5e1" }}>
                          {nextEvent.theme || t("pages.dashboard.scheduledSession")}
                        </p>
                        <Button
                          variant="ghost"
                          style={{ marginTop: 14 }}
                          onClick={() => navigate("/trainings")}
                        >
                          {t("pages.dashboard.goToSessions")}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p style={{ color: "#94a3b8" }}>{t("pages.dashboard.noScheduledEvent")}</p>
                        <Button
                          variant="ghost"
                          style={{ marginTop: 10 }}
                          onClick={() => navigate("/calendar")}
                        >
                          {t("pages.dashboard.openCalendar")}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </AppCard>
            )}
          </div>
        );

      case "kpis":
        if (!widgets.kpis) return null;
        return (
          <div>
            {statsError && (
              <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13 }}>
                ⚠️ {statsError} — {t("pages.dashboard.statsWarning")}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: 18,
                marginBottom: 24,
              }}
            >
              {statsLoading ? (
                <>
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                </>
              ) : (
                <>
                  <KpiCard
                    label={t("pages.dashboard.teamPlayers")}
                    value={primaPlayers.length}
                    icon="👥"
                    note={`${availablePlayers} ${t("pages.dashboard.available")}`}
                  />
                  <KpiCard
                    label={t("pages.dashboard.teamGoals")}
                    value={totalGoals}
                    icon="⚽"
                    note={realTopScorer?.goals ? t("pages.dashboard.topPlayerNote", { name: realTopScorer.name }) : t("pages.dashboard.noGoals")}
                  />
                  <KpiCard
                    label={t("pages.dashboard.teamAssists")}
                    value={totalAssists}
                    icon="🅰️"
                    note={
                      realTopAssistman?.assists
                        ? t("pages.dashboard.topPlayerNote", { name: realTopAssistman.name })
                        : t("pages.dashboard.noAssists")
                    }
                  />
                  <KpiCard
                    label={t("pages.dashboard.totalMinutes")}
                    value={totalMinutes}
                    icon="⏱️"
                    note={realTopMinutes?.minutes ? t("pages.dashboard.topPlayerNote", { name: realTopMinutes.name }) : t("pages.dashboard.noMinutes")}
                  />
                </>
              )}
            </div>

            {seasonRecord.played > 0 && (
              <AppCard style={{ marginBottom: 24 }}>
                <SectionTitle
                  title={t("pages.dashboard.seasonRecord")}
                  subtitle={`${seasonRecord.played} ${t("pages.dashboard.matchesPlayed")} · ${seasonRecord.goalsFor} ${t("pages.dashboard.goalsMade")} · ${seasonRecord.goalsAgainst} ${t("pages.dashboard.goalsConceeded")}`}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 14 }}>
                  <SeasonRecordStat label={t("pages.dashboard.wins")} value={seasonRecord.wins} tone="green" />
                  <SeasonRecordStat label={t("pages.dashboard.draws")} value={seasonRecord.draws} tone="blue" />
                  <SeasonRecordStat label={t("pages.dashboard.losses")} value={seasonRecord.losses} tone="red" />
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>{t("pages.dashboard.goalsScoredLabel")}</span>
                    <strong style={{ ...srStyles.pillValue, color: "#22c55e" }}>{seasonRecord.goalsFor}</strong>
                  </div>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>{t("pages.dashboard.goalsConcededLabel")}</span>
                    <strong style={{ ...srStyles.pillValue, color: "#f87171" }}>{seasonRecord.goalsAgainst}</strong>
                  </div>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>{t("pages.dashboard.goalDifference")}</span>
                    <strong style={{
                      ...srStyles.pillValue,
                      color: seasonRecord.goalsFor - seasonRecord.goalsAgainst >= 0 ? "#22c55e" : "#f87171",
                    }}>
                      {seasonRecord.goalsFor - seasonRecord.goalsAgainst >= 0 ? "+" : ""}
                      {seasonRecord.goalsFor - seasonRecord.goalsAgainst}
                    </strong>
                  </div>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>{t("pages.dashboard.winPercentage")}</span>
                    <strong style={srStyles.pillValue}>
                      {seasonRecord.played > 0
                        ? Math.round((seasonRecord.wins / seasonRecord.played) * 100)
                        : 0}%
                    </strong>
                  </div>
                </div>
              </AppCard>
            )}

            <AppCard>
              <SectionTitle
                title={t("pages.dashboard.topPerformers")}
                subtitle={t("pages.dashboard.topPerformersSubtitle")}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 14,
                }}
              >
                <TopPerformer
                  label={t("pages.dashboard.topScorer")}
                  value={realTopScorer?.goals || 0}
                  name={realTopScorer?.goals ? realTopScorer.name : t("pages.dashboard.noData")}
                  tone="green"
                  onClick={() =>
                    realTopScorer?.id && navigate(`/players/${realTopScorer.id}`)
                  }
                />

                <TopPerformer
                  label={t("pages.dashboard.topAssist")}
                  value={realTopAssistman?.assists || 0}
                  name={
                    realTopAssistman?.assists
                      ? realTopAssistman.name
                      : t("pages.dashboard.noData")
                  }
                  tone="blue"
                  onClick={() =>
                    realTopAssistman?.id && navigate(`/players/${realTopAssistman.id}`)
                  }
                />

                <TopPerformer
                  label={t("pages.dashboard.mostMinutes")}
                  value={realTopMinutes?.minutes || 0}
                  name={realTopMinutes?.minutes ? realTopMinutes.name : t("pages.dashboard.noData")}
                  tone="orange"
                  onClick={() =>
                    realTopMinutes?.id && navigate(`/players/${realTopMinutes.id}`)
                  }
                />

                <TopPerformer
                  label={t("pages.dashboard.mostPresences")}
                  value={realTopPresence?.appearances || 0}
                  name={
                    realTopPresence?.appearances
                      ? realTopPresence.name
                      : t("pages.dashboard.noData")
                  }
                  tone="purple"
                  onClick={() =>
                    realTopPresence?.id && navigate(`/players/${realTopPresence.id}`)
                  }
                />

                {realTopRating && (
                  <TopPerformer
                    label={t("pages.dashboard.topRating")}
                    value={`${realTopRating.avgRating.toFixed(1)}/10`}
                    name={realTopRating.name}
                    tone="green"
                    onClick={() => navigate(`/players/${realTopRating.id}`)}
                  />
                )}
              </div>
            </AppCard>
          </div>
        );

      case "leaderboard": {
        const top3Scorers   = [...playerStats].sort((a, b) => b.goals - a.goals).filter((p) => p.goals > 0).slice(0, 3);
        const top3Assists   = [...playerStats].sort((a, b) => b.assists - a.assists).filter((p) => p.assists > 0).slice(0, 3);
        const top3Minutes   = [...playerStats].sort((a, b) => b.minutes - a.minutes).filter((p) => p.minutes > 0).slice(0, 3);
        if (!top3Scorers.length && !top3Assists.length && !top3Minutes.length) return null;
        const LeaderCol = ({ title, icon, rows, valueKey, unit = "" }) => (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{icon} {title}</p>
            {rows.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: i === 0 ? "#fbbf24" : "#475569", minWidth: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                <span style={{ flex: 1, fontSize: 13, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <strong style={{ fontSize: 14, color: "#f1f5f9" }}>{p[valueKey]}{unit}</strong>
              </div>
            ))}
          </div>
        );
        return (
          <div key="leaderboard">
            <AppCard title={t("pages.dashboard.leaderboardTitle") || "Classifica stagionale"}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="no-mobile-override">
                <LeaderCol title={t("pages.dashboard.leaderboardGoals") || "Gol"} icon="⚽" rows={top3Scorers} valueKey="goals" />
                <LeaderCol title={t("pages.dashboard.leaderboardAssists") || "Assist"} icon="🎯" rows={top3Assists} valueKey="assists" />
                <LeaderCol title={t("pages.dashboard.leaderboardMinutes") || "Minuti"} icon="⏱️" rows={top3Minutes} valueKey="minutes" unit="'" />
              </div>
            </AppCard>
          </div>
        );
      }

      case "rosterStatus":
        if (!widgets.rosterStatus) return null;
        return (
          <AppCard>
            <SectionTitle
              title={t("pages.dashboard.rosterStatus")}
              subtitle={t("pages.dashboard.rosterAvailability")}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <MiniStatus
                label={t("pages.dashboard.availableCount")}
                value={availablePlayers}
                tone="green"
              />
              <MiniStatus
                label={t("pages.dashboard.injuredCount")}
                value={primaPlayers.filter((p) => p.status === "Infortunato").length}
                tone="red"
              />
              <MiniStatus
                label={t("pages.dashboard.suspendedCount")}
                value={primaPlayers.filter((p) => p.status === "Squalificato").length}
                tone="purple"
              />
              <MiniStatus
                label={t("pages.dashboard.recoveringCount")}
                value={primaPlayers.filter((p) => p.status === "Recupero" || p.status === "Differenziato").length}
                tone="orange"
              />
            </div>

            <RosterGrid players={primaPlayers} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                {t("pages.dashboard.totalRoster")} {primaPlayers.length}
              </span>
              <Button variant="ghost" onClick={() => navigate("/players")}>
                {t("pages.dashboard.goToRoster")}
              </Button>
            </div>
          </AppCard>
        );

      case "weeklyLoad":
        if (!widgets.weeklyLoad) return null;
        return <WeeklyLoadWidget sessions={sessions} />;

      case "wellnessToday": {
        if (!teamWellnessToday.length) return null;
        const WELLNESS_EMOJIS = {
          sleep:   ["😴","😪","😐","😊","🌟"],
          fatigue: ["🏃","😤","😐","😓","🥱"],
          mood:    ["😁","🙂","😐","😕","😞"],
        };
        const teamAvg = (key) => {
          const vals = teamWellnessToday.filter((r) => r[key] > 0).map((r) => r[key]);
          return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
        };
        return (
          <AppCard key="wellnessToday">
            <SectionTitle title="Wellness squadra oggi" subtitle={`${teamWellnessToday.length} giocator${teamWellnessToday.length === 1 ? "e" : "i"} hanno compilato il check-in`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
              {[
                { key: "sleep",   label: "Sonno",     color: "#38bdf8" },
                { key: "fatigue", label: "Stanchezza", color: "#fb923c" },
                { key: "mood",    label: "Umore",     color: "#a78bfa" },
              ].map(({ key, label, color }) => {
                const avg = teamAvg(key);
                return (
                  <div key={key} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: avg ? color : "#475569" }}>{avg ?? "—"}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>/ 5</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {teamWellnessToday.map((row) => {
                const p = players.find((pl) => String(pl.id) === String(row.player_id));
                if (!p) return null;
                return (
                  <div key={row.player_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ flex: "1 1 100px", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {["sleep","fatigue","mood"].map((k) => (
                      <span key={k} style={{ fontSize: 16 }} title={k}>
                        {WELLNESS_EMOJIS[k][(row[k] || 1) - 1]}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </AppCard>
        );
      }

      case "weekFocus":
        if (!widgets.weekFocus) return null;
        return (
          <AppCard>
            <SectionTitle
              title={t("pages.dashboard.weekFocus")}
              subtitle={`${upcomingWeekEvents} ${t("pages.dashboard.weekEvents")}`}
            />

            {upcomingWeekAgenda.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {upcomingWeekAgenda.map((event) => {
                  const isMatch = event.type === "Partita" || event.opponent;

                  return (
                    <FocusItem
                      key={`${event.type}-${event.id}-${event.date}`}
                      label={isMatch ? t("common.match") : getDashboardEventTypeLabel(event.type, t)}
                      title={isMatch ? `${settings.workspaceProfile?.clubName || t("common.appName")} - ${event.opponent || t("pages.matches.opponentPlaceholder")}` : event.title || t("common.session")}
                      meta={`${formatDate(event.date)}${event.theme ? ` · ${event.theme}` : ""}`}
                      tone={isMatch ? "orange" : "green"}
                      action={isMatch ? t("pages.dashboard.openMatch") : t("pages.dashboard.openSession")}
                      onClick={() => openAgendaEvent(event)}
                    />
                  );
                })}
              </div>
            ) : (
              <div>
                <EmptyState
                  icon="📅"
                  title={t("pages.dashboard.emptyWeek")}
                  text={t("pages.dashboard.emptyWeekText")}
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <Button onClick={() => navigate("/trainings")}>{t("pages.dashboard.newSession")}</Button>
                  <Button variant="ghost" onClick={() => navigate("/matches")}>{t("pages.dashboard.newMatch")}</Button>
                </div>
              </div>
            )}
          </AppCard>
        );

      case "coachAlerts":
        if (!widgets.coachAlerts) return null;
        return (
          <AppCard>
            <SectionTitle
              title={t("pages.dashboard.coachAlerts")}
              subtitle={t("pages.dashboard.coachAlertsSubtitle")}
            />

            {coachAlerts.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {coachAlerts.map((alert, index) => {
                  const toneLabels = { red: t("pages.dashboard.toneUrgent"), orange: t("pages.dashboard.toneWarning"), green: t("pages.dashboard.toneOk"), blue: t("pages.dashboard.toneInfo"), purple: t("pages.dashboard.toneNote") };
                  return (
                  <div
                    key={`${alert.text}-${index}`}
                    onClick={alert.path ? () => navigate(alert.path) : undefined}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      cursor: alert.path ? "pointer" : "default",
                    }}
                  >
                    <Badge tone={alert.tone}>{toneLabels[alert.tone] || alert.tone}</Badge>
                    <span>{alert.text}</span>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "#94a3b8" }}>{t("pages.dashboard.noAlerts")}</p>
            )}
          </AppCard>
        );

      case "recentActivities":
        if (!widgets.recentActivities) return null;
        return (
          <AppCard>
            <SectionTitle
              title={t("pages.dashboard.recentActivities")}
              subtitle={t("pages.dashboard.recentActivitiesSubtitle")}
            />

            {recentActivities.length === 0 ? (
              <EmptyState
                icon="📭"
                title={t("pages.dashboard.noActivity")}
                text={t("pages.dashboard.noActivityText")}
              />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {recentActivities.map((activity) => (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <strong>{activity.title}</strong>

                      <Badge tone={activity.type === "Partita" ? "orange" : "green"}>
                        {getDashboardEventTypeLabel(activity.type, t)}
                      </Badge>
                    </div>

                    <p style={{ color: "#94a3b8", margin: "8px 0 0" }}>
                      {formatDate(activity.date)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </AppCard>
        );

      case "quickActions":
        if (!widgets.quickActions) return null;
        return (
          <AppCard>
            <SectionTitle
              title={t("pages.dashboard.quickActions")}
              subtitle={t("pages.dashboard.quickActionsSubtitle")}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
              }}
            >
              <QuickAction
                label={t("navigation.items.roster")}
                icon="👥"
                onClick={() => navigate("/players")}
              />
              <QuickAction
                label={t("navigation.items.exerciseLibrary")}
                icon="📚"
                onClick={() => navigate("/exercise-library")}
              />
              <QuickAction
                label={t("navigation.items.trainings")}
                icon="📋"
                onClick={() => navigate("/trainings")}
              />
              <QuickAction
                label={t("navigation.items.matchDay")}
                icon="⚽"
                onClick={() => navigate("/match-day")}
              />
              <QuickAction
                label={t("navigation.items.physicalWorkouts")}
                icon="🏃"
                onClick={() => navigate("/physical-workouts")}
              />
              <QuickAction
                label={t("navigation.items.calendar")}
                icon="📅"
                onClick={() => navigate("/calendar")}
              />
              <QuickAction
                label={t("navigation.items.aiBuilder")}
                icon="✨"
                onClick={() => navigate("/ai-session-builder")}
              />
            </div>
          </AppCard>
        );

      case "rewardCenter":
        if (!widgets.rewardCenter) return null;
        return (
          <AppCard>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div>
                <Badge tone="purple">{t("pages.premium.activePlanBadge", { plan: plan.name })}</Badge>

                <h2 style={{ margin: "12px 0 6px" }}>
                  {t("pages.premium.levelLabel", { level: reward.level, title: reward.title })}
                </h2>

                <p style={{ color: "#94a3b8", margin: 0 }}>
                  {reward.points} {t("pages.premium.activityPoints")} · {t("pages.premium.potentialDiscount")} {reward.discount}%
                </p>

                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                    marginTop: 14,
                  }}
                >
                  <div
                    style={{
                      width: `${reward.progress}%`,
                      height: "100%",
                      background: "linear-gradient(135deg,#22c55e,#38bdf8)",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Button variant="ghost" onClick={() => navigate("/premium")}>
                  {t("pages.dashboard.rewardAndPremium")}
                </Button>

                {plan.id === "free" && (
                  <Button onClick={() => navigate("/premium")}>
                    {t("pages.dashboard.unlockFeatures")}
                  </Button>
                )}
              </div>
            </div>
          </AppCard>
        );

      default:
        return null;
    }
  }

  if (currentRole === "player") {
    return (
      <PlayerRoleDashboard
        players={players}
        sessions={sessions}
        matches={matches}
        physicalTests={physicalTests}
        appSettings={settings}
      />
    );
  }

  if (currentRole === "sponsor") {
    return <SponsorRoleDashboard appSettings={settings} matches={matches} />;
  }

  if (currentRole === "athleticTrainer") {
    return (
      <PhysicalRoleDashboard
        players={players}
        matches={matches}
        physicalTests={physicalTests}
        coachAlerts={coachAlerts}
      />
    );
  }

  return (
    <div>
      {/* Header + gear button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <PageHeader
          title={t("pages.dashboard.title")}
          subtitle={t("pages.dashboard.subtitle")}
        />
        <button
          type="button"
          onClick={() => setShowPersonalize((p) => !p)}
          style={{
            marginTop: 4,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            background: showPersonalize ? "rgba(56,189,248,0.14)" : "rgba(255,255,255,0.05)",
            color: showPersonalize ? "#38bdf8" : "#94a3b8",
            padding: "9px 14px",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          ⚙️ {t("pages.dashboard.personalize")}
        </button>
      </div>

      {/* Pannello personalizzazione (collapsible) */}
      {showPersonalize && (
        <AppCard style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <p style={{ color: "#94a3b8", margin: 0, fontWeight: 700 }}>
                {t("pages.dashboard.personalizeHint")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="ghost" onClick={() => navigate("/settings")}>
                {t("pages.dashboard.settings")}
              </Button>
              <button
                type="button"
                onClick={() => updateSectionOrder(DEFAULT_SECTION_ORDER)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.045)",
                  color: "#94a3b8",
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {t("pages.dashboard.resetOrder")}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["hero", t("pages.dashboard.widgetIntro")],
              ["nextEvent", t("pages.dashboard.widgetEvent")],
              ["kpis", t("pages.dashboard.widgetKpi")],
              ["weekFocus", t("pages.dashboard.widgetWeek")],
              ["rosterStatus", t("pages.dashboard.widgetRoster")],
              ["weeklyLoad", "Carico settimanale"],
              ["coachAlerts", t("pages.dashboard.widgetAlerts")],
              ["recentActivities", t("pages.dashboard.widgetActivities")],
              ["quickActions", t("pages.dashboard.widgetActions")],
              ["rewardCenter", t("pages.dashboard.widgetReward")],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleWidget(key)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: widgets[key]
                    ? "rgba(56,189,248,0.18)"
                    : "rgba(255,255,255,0.045)",
                  color: "white",
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </AppCard>
      )}

      {/* Sezioni fisse non-draggable */}
      {showBillingPrompt && (
        <AppCard style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <Badge
                tone={
                  billing.trialActive
                    ? "orange"
                    : billing.trialExpired
                    ? "red"
                    : "blue"
                }
              >
                {billing.trialActive
                  ? t("pages.dashboard.badgeTrial")
                  : billing.trialExpired
                  ? t("pages.dashboard.trialExpired")
                  : t("pages.dashboard.badgeFree")}
              </Badge>

              <h2 style={{ margin: "12px 0 6px" }}>
                {billing.trialActive
                  ? t("pages.dashboard.trialDaysLeft", { days: billing.trialDaysLeft, plan: billing.effectivePlan.name })
                  : billing.trialExpired
                  ? t("pages.dashboard.reactivatePlan")
                  : t("pages.dashboard.startTrialText")}
              </h2>

              <p style={{ color: "#94a3b8", margin: 0 }}>
                {billing.trialActive
                  ? t("pages.dashboard.trialActiveText")
                  : billing.trialExpired
                  ? t("pages.dashboard.trialExpiredText")
                  : t("pages.dashboard.upgradeText")}
              </p>
            </div>

            <Button onClick={() => navigate("/premium")}>{t("pages.dashboard.managePlan")}</Button>
          </div>
        </AppCard>
      )}

      {/* ── First-run welcome card: visibile solo quando l'utente non ha ancora dati ── */}
      {!loading && players.length === 0 && sessions.length === 0 && matches.length === 0 ? (
        <AppCard style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, lineHeight: 1.12 }}>
              {t("pages.dashboard.firstRunTitle")}
            </h2>
            <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              {t("pages.dashboard.firstRunSubtitle")}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {[
              { icon: "👥", titleKey: "firstRunStep1Title", textKey: "firstRunStep1Text", btnKey: "firstRunStep1Btn", path: "/players", tone: "blue" },
              { icon: "📋", titleKey: "firstRunStep2Title", textKey: "firstRunStep2Text", btnKey: "firstRunStep2Btn", path: "/trainings", tone: "green" },
              { icon: "⚽", titleKey: "firstRunStep3Title", textKey: "firstRunStep3Text", btnKey: "firstRunStep3Btn", path: "/matches", tone: "orange" },
            ].map(({ icon, titleKey, textKey, btnKey, path, tone }) => (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className="cl-card-btn"
                style={{
                  textAlign: "left", padding: "18px 16px", borderRadius: 16, cursor: "pointer",
                  background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)",
                  color: "white",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <h3 style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.2 }}>
                  {t(`pages.dashboard.${titleKey}`)}
                </h3>
                <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
                  {t(`pages.dashboard.${textKey}`)}
                </p>
                <Badge tone={tone}>{t(`pages.dashboard.${btnKey}`)}</Badge>
              </button>
            ))}
          </div>
        </AppCard>
      ) : (
        /* ── Setup progress card: visibile dopo il primo dato inserito ── */
        <AppCard style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <Badge tone={setup.percent >= 70 ? "green" : "orange"}>
                {t("pages.dashboard.setupPercent", { percent: setup.percent })}
              </Badge>

              <h2 className="setup-progress-title" style={{ margin: "12px 0 6px" }}>
                {setup.next ? t(setup.next.labelKey) : t("pages.dashboard.workspaceReady")}
              </h2>

              <p className="mobile-hide" style={{ color: "#94a3b8", margin: 0 }}>
                {t("pages.dashboard.setupStepsCompleted", { completed: setup.completed, total: setup.total })}
              </p>

              <div
                className="setup-progress-bar"
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    width: `${setup.percent}%`,
                    height: "100%",
                    background: "linear-gradient(135deg,#22c55e,#38bdf8)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {!settings.onboarding?.completed && (
                <Button variant="ghost" onClick={() => navigate("/onboarding")}>
                  {t("pages.dashboard.onboarding")}
                </Button>
              )}

              <Button onClick={() => navigate(setup.next?.path || "/settings")}>
                {t("pages.dashboard.nextStep")}
              </Button>
            </div>
          </div>
        </AppCard>
      )}

      {openCorrections.length > 0 && (
        <OpenCorrectionsCard
          corrections={openCorrections}
          navigate={navigate}
          t={t}
        />
      )}

      {pendingRsvpMatches.length > 0 && (
        <PendingRsvpMatchesCard
          items={pendingRsvpMatches}
          navigate={navigate}
          t={t}
        />
      )}

      {/* Tab switcher mobile + toggle vista semplice */}
      {isMobile && (
        <>
          {/* Toggle vista semplice */}
          <button
            onClick={toggleSimpleView}
            style={{
              width: "100%", marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 16px", borderRadius: 12, border: "none",
              background: simpleView ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)",
              outline: simpleView ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: simpleView ? "#38bdf8" : "#94a3b8",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18 }}>{simpleView ? "🔍" : "📋"}</span>
            {simpleView ? "Vista semplice attiva — tocca per vedere tutto" : "Vuoi una vista più semplice?"}
          </button>

          {/* Tab switcher (nascosto in vista semplice) */}
          {!simpleView && (
            <div style={{
              display: "flex", gap: 0, marginBottom: 14,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: 3, overflow: "hidden",
            }}>
              {[
                { id: "oggi",    label: "🗓️ Oggi" },
                { id: "squadra", label: "👥 Squadra" },
                { id: "carico",  label: "📈 Carico" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDashTab(tab.id)}
                  style={{
                    flex: 1, border: "none", borderRadius: 10, padding: "10px 4px",
                    fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "0.15s",
                    background: dashTab === tab.id ? "rgba(56,189,248,0.18)" : "transparent",
                    color: dashTab === tab.id ? "#38bdf8" : "#64748b",
                    outline: dashTab === tab.id ? "1px solid rgba(56,189,248,0.3)" : "none",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Sezioni draggable (desktop) / filtrate per tab (mobile) */}
      <DndContext onDragEnd={handleSectionDragEnd} collisionDetection={closestCenter}>
        <SortableContext items={safeSectionOrder} strategy={verticalListSortingStrategy}>
          {safeSectionOrder
            .filter((id) => {
              if (!isMobile) return true;
              if (simpleView) return new Set(["nextEvent", "coachAlerts", "rosterStatus"]).has(id);
              const DASH_TAB_SECTIONS = {
                oggi:    new Set(["nextEvent", "coachAlerts", "quickActions", "weekFocus"]),
                squadra: new Set(["leaderboard", "rosterStatus", "wellnessToday", "recentActivities", "rewardCenter"]),
                carico:  new Set(["kpis", "weeklyLoad"]),
              };
              return DASH_TAB_SECTIONS[dashTab]?.has(id) ?? true;
            })
            .map((id) => {
            let content;
            try {
              content = renderSectionContent(id);
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error(`[Dashboard] Errore sezione "${id}":`, error);
              }
              return null;
            }
            if (!content) return null;
            return (
              <SortableSection key={id} id={id}>
                {content}
              </SortableSection>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function PlayerRoleDashboard({
  players,
  sessions,
  matches,
  physicalTests,
  appSettings,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const player = players[0];
  const summary = getPlayerSummary(player, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const reference = getPhysicalReference(latestTest, appSettings.coachParameters);
  const nextEvents = [...sessions, ...matches]
    .filter((event) => new Date(event.date) >= todayStart())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  const program = player ? (appSettings?.playerPortal?.programs?.[player.id] ?? "") : "";

  return (
    <div>
      <PageHeader
        title={t("pages.dashboard.playerDashboardTitle")}
        subtitle={t("pages.dashboard.playerDashboardSubtitle")}
        badge={t("pages.dashboard.playerView")}
      />

      <div style={roleDashboardStyles.heroGrid}>
        <AppCard>
          <Badge tone={player?.status === "Disponibile" ? "green" : "orange"}>
            {getPlayerStatusLabel(player?.status, t)}
          </Badge>

          <h2 style={roleDashboardStyles.heroTitle}>
            {player?.name || t("common.player")}
          </h2>

          <p style={roleDashboardStyles.muted}>
            {player?.role || t("pages.dashboard.undefinedRole")}{" "}
            {player?.shirtNumber ? `· #${player.shirtNumber}` : ""}
          </p>

          <div style={roleDashboardStyles.kpiGrid}>
            <MiniStatus label={t("common.minutes")} value={summary.stats.minutes} tone="blue" />
            <MiniStatus label={t("common.goals")} value={summary.stats.goals} tone="green" />
            <MiniStatus label={t("common.assists")} value={summary.stats.assists} tone="purple" />
          </div>
        </AppCard>

        <AppCard>
          <SectionTitle
            title={t("pages.dashboard.personalProgram")}
            subtitle={t("pages.dashboard.personalProgramSubtitle")}
          />

          <p style={roleDashboardStyles.bodyText}>
            {program || t("pages.dashboard.noProgramAssigned")}
          </p>

          <Button onClick={() => navigate("/player-portal")}>
            {t("pages.dashboard.openPlayerArea")}
          </Button>
        </AppCard>
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle
            title={t("pages.dashboard.physicalProfile")}
            subtitle={t("pages.dashboard.physicalProfileSubtitle")}
          />

          <InfoRows
            rows={[
              [t("pages.dashboard.lastTest"), latestTest ? formatShortDate(latestTest.date) : t("pages.dashboard.toBeTested")],
              [t("pages.dashboard.group"), reference.group],
              ["MAS", reference.mas ? `${reference.mas} km/h` : "-"],
            ]}
          />
        </AppCard>

        <AppCard>
          <SectionTitle title={t("pages.dashboard.upcomingEvents")} subtitle={t("pages.dashboard.personalCalendar")} />
          <EventList events={nextEvents} emptyText={t("pages.dashboard.noUpcomingEvents")} />
        </AppCard>
      </div>
    </div>
  );
}

function SponsorRoleDashboard({ appSettings, matches }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hub = appSettings.sponsorHub;
  const activeSponsors = hub.sponsors.filter((sponsor) => sponsor.active);
  const mainSponsor = hub.sponsors.find(
    (sponsor) => String(sponsor.id) === String(hub.mainSponsorId)
  );
  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        title={t("pages.dashboard.sponsorDashboardTitle")}
        subtitle={t("pages.dashboard.sponsorDashboardSubtitle")}
        badge={t("pages.dashboard.sponsorView")}
      />

      <div style={roleDashboardStyles.heroGrid}>
        <AppCard>
          <Badge tone="purple">{t("pages.dashboard.partnerClub")}</Badge>

          <h2 style={roleDashboardStyles.heroTitle}>
            {mainSponsor?.name || t("pages.dashboard.noMainSponsor")}
          </h2>

          <p style={roleDashboardStyles.muted}>
            {t("pages.dashboard.activeSponsorsCount", { count: activeSponsors.length })}
          </p>

          <Button onClick={() => navigate("/sponsors")}>{t("pages.dashboard.openSponsorHub")}</Button>
        </AppCard>

        <AppCard>
          <SectionTitle
            title={t("pages.dashboard.communityOffer")}
            subtitle={t("pages.dashboard.communityOfferSubtitle")}
          />

          <p style={roleDashboardStyles.bodyText}>
            {mainSponsor?.offer ||
              activeSponsors[0]?.offer ||
              t("pages.dashboard.noSponsorOffer")}
          </p>
        </AppCard>
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle
            title={t("pages.dashboard.promisedVisibility")}
            subtitle={t("pages.dashboard.promisedVisibilitySubtitle")}
          />

          <p style={roleDashboardStyles.bodyText}>
            {mainSponsor?.visibility ||
              t("pages.dashboard.defaultVisibility")}
          </p>
        </AppCard>

        <AppCard>
          <SectionTitle
            title={t("pages.dashboard.recentMatchesTitle")}
            subtitle={t("pages.dashboard.recentMatchesSubtitle")}
          />

          <EventList events={recentMatches} emptyText={t("pages.dashboard.noMatchesRecorded")} />
        </AppCard>
      </div>
    </div>
  );
}

function OpenCorrectionsCard({ corrections, navigate, t }) {
  const todoCount = corrections.filter((item) => (item.objectiveStatus || "todo") === "todo").length;
  const workedCount = corrections.filter((item) => item.objectiveStatus === "worked").length;

  return (
    <AppCard style={{ marginBottom: 18 }}>
      <div style={correctionStyles.head}>
        <div>
          <Badge tone={todoCount ? "orange" : "blue"}>
            {t("pages.dashboard.openCorrectionsBadge", { count: corrections.length })}
          </Badge>
          <h2 style={correctionStyles.title}>{t("pages.dashboard.openCorrectionsTitle")}</h2>
          <p style={correctionStyles.muted}>{t("pages.dashboard.openCorrectionsSubtitle")}</p>
        </div>

        <div style={correctionStyles.stats}>
          <MiniStatus label={t("pages.dashboard.objectiveTodo")} value={todoCount} tone="orange" />
          <MiniStatus label={t("pages.dashboard.objectiveWorked")} value={workedCount} tone="blue" />
        </div>
      </div>

      <div style={correctionStyles.list}>
        {corrections.slice(0, 4).map((session) => {
          const status = getObjectiveStatusMeta(session.objectiveStatus);
          const matchLabel = session.sourceMatchLabel || session.sourceMatch?.opponent || session.sourceMatch?.title || t("pages.dashboard.sourceReport");
          return (
            <div key={session.id} style={correctionStyles.row}>
              <div style={{ minWidth: 0 }}>
                <div style={correctionStyles.rowTop}>
                  <strong>{session.sourceSummary || session.objective || session.title}</strong>
                  <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
                </div>
                <p style={correctionStyles.meta}>
                  {matchLabel} · {formatDate(session.date)} · {getTrainingThemeLabel(session.theme, t)}
                </p>
                {session.objectiveReview && (
                  <p style={correctionStyles.review}>{session.objectiveReview}</p>
                )}
              </div>

              <div style={correctionStyles.actions}>
                {session.sourceMatchId && (
                  <Button variant="ghost" onClick={() => navigate(`/post-match/${session.sourceMatchId}`)}>
                    {t("navigation.items.postMatch")}
                  </Button>
                )}
                <Button onClick={() => navigate("/trainings")}>
                  {t("pages.dashboard.openSession")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </AppCard>
  );
}

function PendingRsvpMatchesCard({ items, navigate, t }) {
  return (
    <AppCard style={{ marginBottom: 18 }}>
      <SectionTitle
        title={t("pages.dashboard.pendingRsvpTitle")}
        subtitle={t("pages.dashboard.pendingRsvpSubtitle")}
      />

      <div style={{ display: "grid", gap: 10 }}>
        {items.map(({ match, pending }) => (
          <button
            key={match.id}
            type="button"
            onClick={() => navigate(`/match-convocation/${match.id}`)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.045)",
              color: "white",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {match.opponent || t("pages.matches.opponentPlaceholder")}
              </strong>
              <span style={{ display: "block", marginTop: 3, color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
                {formatDate(match.date)}
              </span>
            </span>

            <Badge tone="orange">
              {t("pages.dashboard.pendingRsvpBadge", { count: pending })}
            </Badge>
          </button>
        ))}
      </div>
    </AppCard>
  );
}

function PhysicalRoleDashboard({ players, matches, physicalTests, coachAlerts }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const testedPlayerIds = new Set(
    physicalTests.map((test) => String(test.playerId))
  );
  const untestedPlayers = players.filter(
    (player) => !testedPlayerIds.has(String(player.id))
  );
  const latestTests = [...physicalTests]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const nextMatch = matches
    .filter((match) => new Date(match.date) >= todayStart())
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  return (
    <div>
      <PageHeader
        title={t("pages.dashboard.physicalDashboardTitle")}
        subtitle={t("pages.dashboard.physicalDashboardSubtitle")}
        badge={t("pages.dashboard.physicalView")}
      />

      <div style={roleDashboardStyles.kpiGrid}>
        <KpiCard
          label={t("common.players")}
          value={players.length}
          icon="👥"
          note={t("pages.dashboard.monitoredRoster")}
        />
        <KpiCard
          label={t("pages.dashboard.registeredTests")}
          value={physicalTests.length}
          icon="⏱️"
          note={t("pages.dashboard.toBeTested2", { count: untestedPlayers.length })}
        />
        <KpiCard
          label={t("pages.dashboard.nextMatch")}
          value={nextMatch ? formatShortDate(nextMatch.date) : "-"}
          icon="⚽"
          note={nextMatch?.opponent || t("pages.dashboard.toBeScheduled")}
        />
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle
            title={t("pages.dashboard.latestTests")}
            subtitle={t("pages.dashboard.latestTestsSubtitle")}
          />

          {latestTests.length ? (
            <InfoRows
              rows={latestTests.map((test) => {
                const player = players.find(
                  (item) => String(item.id) === String(test.playerId)
                );
                const reference = getPhysicalReference(test);
                return [
                  player?.name || t("common.player"),
                  `${reference.group} · ${reference.mas || "-"} km/h`,
                ];
              })}
            />
          ) : (
            <p style={roleDashboardStyles.muted}>{t("pages.dashboard.noPhysicalTests")}</p>
          )}

          <Button onClick={() => navigate("/physical-tests")}>{t("pages.dashboard.updateTests")}</Button>
        </AppCard>

        <AppCard>
          <SectionTitle title={t("pages.dashboard.physicalAlerts")} subtitle={t("pages.dashboard.physicalAlertsSubtitle")} />

          {coachAlerts.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {coachAlerts.slice(0, 5).map((alert, index) => {
                const toneLabels = { red: t("pages.dashboard.toneUrgent"), orange: t("pages.dashboard.toneWarning"), green: t("pages.dashboard.toneOk"), blue: t("pages.dashboard.toneInfo"), purple: t("pages.dashboard.toneNote") };
                return (
                <div
                  key={`${alert.text}-${index}`}
                  onClick={alert.path ? () => navigate(alert.path) : undefined}
                  style={{ ...roleDashboardStyles.alertRow, cursor: alert.path ? "pointer" : "default" }}
                >
                  <Badge tone={alert.tone}>{toneLabels[alert.tone] || alert.tone}</Badge>
                  <span>{alert.text}</span>
                </div>
                );
              })}
            </div>
          ) : (
            <p style={roleDashboardStyles.muted}>{t("pages.dashboard.noAlerts")}</p>
          )}
        </AppCard>
      </div>
    </div>
  );
}

function CoachControlRoom({
  nextEvent,
  nextTraining,
  nextMatch,
  todayEvents,
  upcomingWeekEvents,
  availablePlayers,
  unavailablePlayers,
  playersCount,
  coachAlerts,
  setup,
  navigate,
  isMobile = false,
}) {
  const { t } = useTranslation();
  const toneLabels = { red: t("pages.dashboard.toneUrgent"), orange: t("pages.dashboard.toneWarning"), green: t("pages.dashboard.toneOk"), blue: t("pages.dashboard.toneInfo"), purple: t("pages.dashboard.toneNote") };

  const primaryStatus = todayEvents.length
    ? t("pages.dashboard.eventsToday", { count: todayEvents.length })
    : nextEvent
    ? t("pages.dashboard.nextEventDate", { date: formatShortDate(nextEvent.date) })
    : t("pages.dashboard.noEvent");

  const actions = [
    !nextTraining && {
      label: t("pages.dashboard.planSchedule"),
      path: "/trainings",
      variant: "primary",
    },
    !nextMatch && {
      label: t("pages.dashboard.insertMatch"),
      path: "/matches",
      variant: "ghost",
    },
    coachAlerts.length > 0 && {
      label: t("pages.dashboard.checkAlerts"),
      path: coachAlerts[0]?.path || "/players",
      variant: "ghost",
    },
    setup.next && {
      label: t("pages.dashboard.completeSetup"),
      path: setup.next.path,
      variant: "ghost",
    },
    {
      label: t("pages.dashboard.newSession"),
      path: "/trainings",
      variant: "primary",
    },
  ].filter(Boolean).slice(0, 3);

  const controlMetricItems = [
    {
      key: "today",
      label: t("pages.dashboard.today"),
      value: todayEvents.length,
      color: todayEvents.length ? "#86efac" : "#7dd3fc",
    },
    {
      key: "week",
      label: t("pages.dashboard.days7"),
      value: upcomingWeekEvents,
      color: "#7dd3fc",
    },
    {
      key: "available",
      label: t("pages.dashboard.availableCount"),
      value: `${availablePlayers}/${playersCount}`,
      color: "#86efac",
    },
    {
      key: "monitor",
      label: t("pages.dashboard.monitor"),
      value: unavailablePlayers,
      color: unavailablePlayers ? "#fdba74" : "#86efac",
    },
  ];

  return (
    <AppCard>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.25fr) minmax(280px,0.75fr)", gap: 22, alignItems: "stretch" }}>
        <div>
          <Badge tone={coachAlerts.length ? "orange" : "green"}>
            {coachAlerts.length ? t("pages.dashboard.alertsOpen", { count: coachAlerts.length }) : t("pages.dashboard.underControl")}
          </Badge>

          <h2 style={{ fontSize: 30, margin: "16px 0 8px", lineHeight: 1.08 }}>
            {primaryStatus}
          </h2>

          <p style={{ color: "#94a3b8", maxWidth: 640, lineHeight: 1.55, margin: 0 }}>
            {nextEvent
              ? `${nextEvent.title || nextEvent.opponent || t("pages.dashboard.widgetEvent")} · ${formatDate(nextEvent.date)}`
              : t("pages.dashboard.noOperationalUrgencyHint")}
          </p>

          <MetricStrip items={controlMetricItems} min={130} style={{ marginTop: 18 }} />
        </div>

        <div style={{ display: "grid", gap: 10, alignContent: "space-between" }}>
          <div style={{ display: "grid", gap: 8 }}>
            {(coachAlerts.length ? coachAlerts.slice(0, 2) : [
              { text: t("pages.dashboard.noOperationalUrgency"), tone: "green" },
            ]).map((alert, index) => (
              <div
                key={`${alert.text}-${index}`}
                style={{ ...controlRoomStyles.alert, cursor: alert.path ? "pointer" : "default" }}
                onClick={alert.path ? () => navigate(alert.path) : undefined}
              >
                <Badge tone={alert.tone || "blue"}>{toneLabels[alert.tone] || alert.tone || t("common.info")}</Badge>
                <span>{alert.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {actions.map((action) => (
              <Button
                key={`${action.label}-${action.path}`}
                variant={action.variant === "ghost" ? "ghost" : undefined}
                onClick={() => navigate(action.path)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </AppCard>
  );
}

const controlRoomStyles = {
  alert: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    lineHeight: 1.35,
  },
};

function KpiCard({ label, value, icon, note }) {
  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div>
          <p style={{ color: "#94a3b8", margin: 0, fontWeight: 800, lineHeight: 1.25 }}>{label}</p>

          <span style={{ fontSize: "clamp(20px, 7vw, 32px)", lineHeight: 1, margin: "9px 0 8px", display: "block" }}>{value}</span>

          <p style={{ color: "#64748b", margin: 0, lineHeight: 1.35 }}>{note}</p>
        </div>

        <div
          style={{
            width: 48,
            height: 48,
            flex: "0 0 auto",
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            background: "rgba(56,189,248,0.12)",
            border: "1px solid rgba(125,211,252,0.14)",
            fontSize: 23,
          }}
        >
          {icon}
        </div>
      </div>
    </AppCard>
  );
}

function TopPerformer({ label, value, name, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={onClick ? "cl-card-btn" : undefined}
      style={{
        borderRadius: 12,
        padding: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "white",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        minWidth: 0,
      }}
    >
      <Badge tone={tone}>{label}</Badge>

      <span style={{ margin: "12px 0 4px", lineHeight: 1, fontSize: "inherit", display: "block" }}>{value}</span>

      <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>{name}</p>
    </button>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.2 }}>{title}</h3>
      <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>{subtitle}</p>
    </div>
  );
}

function FocusItem({ label, title, meta, tone, action, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={onClick ? "cl-card-btn" : undefined}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 12,
        padding: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "white",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <Badge tone={tone}>{label}</Badge>
        {action && <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 900 }}>{action}</span>}
      </div>
      <h3 style={{ margin: "12px 0 6px", lineHeight: 1.2 }}>{title}</h3>
      <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>{meta}</p>
    </button>
  );
}

function MiniStatus({ label, value, tone }) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Badge tone={tone}>{label}</Badge>

      <span style={{ margin: "12px 0 0", lineHeight: 1, display: "block" }}>{value}</span>
    </div>
  );
}

// ─── RosterGrid — griglia individuale status giocatori ───────────────
function playerStatusDot(status) {
  if (!status || status === "Disponibile") return { color: "#4ade80", bg: "rgba(34,197,94,0.15)" };
  if (status === "Infortunato")            return { color: "#f87171", bg: "rgba(248,113,113,0.15)" };
  if (status === "Squalificato")           return { color: "#c084fc", bg: "rgba(192,132,252,0.15)" };
  return                                          { color: "#fb923c", bg: "rgba(251,146,60,0.15)" };
}

function RosterGrid({ players }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...players].sort((a, b) => {
    const order = { "Infortunato": 0, "Squalificato": 1, "Recupero": 2, "Differenziato": 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });
  const visible = expanded ? sorted : sorted.slice(0, 12);

  if (!players.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 6 }}>
        {visible.map((p) => {
          const dot = playerStatusDot(p.status);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 8, background: dot.bg, border: `1px solid ${dot.color}33` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e2e8f0" }}>
                {p.name}
              </span>
            </div>
          );
        })}
      </div>
      {players.length > 12 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 8, background: "none", border: "none", color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
        >
          {expanded ? "Mostra meno ▲" : `+${players.length - 12} altri ▼`}
        </button>
      )}
    </div>
  );
}

// ─── WeeklyLoadWidget — grafico a barre carico settimanale ───────────
function WeeklyLoadWidget({ sessions }) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 13);

  const recent = sessions
    .filter((s) => s.date && new Date(s.date) >= cutoff && new Date(s.date) < new Date(new Date().toDateString() + " 23:59"))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const bars = recent.map((s) => {
    const att = s.attendance || {};
    const vals = Object.values(att)
      .map((v) => Number(v?.rpe || 0))
      .filter((v) => v > 0);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { date: s.date, title: s.title || "Seduta", avg: Math.round(avg * 10) / 10, count: vals.length };
  }).filter((b) => b.avg > 0);

  if (!bars.length) return null;

  const maxVal = Math.max(...bars.map((b) => b.avg), 1);
  const BAR_H = 80;

  const barColor = (v) => {
    if (v <= 4) return "#4ade80";
    if (v <= 6) return "#facc15";
    if (v <= 8) return "#fb923c";
    return "#f87171";
  };

  return (
    <AppCard>
      <SectionTitle
        title="Carico settimanale"
        subtitle="RPE medio della squadra per seduta (ultimi 14 giorni)"
      />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {bars.map((b, i) => {
          const h = Math.max(8, Math.round((b.avg / maxVal) * BAR_H));
          const color = barColor(b.avg);
          const d = new Date(b.date);
          const label = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 42, flex: "1 1 42px" }}>
              <span style={{ fontSize: 11, fontWeight: 900, color }}>{b.avg}</span>
              <div
                title={`${b.title} — RPE medio ${b.avg} (${b.count} giocatori)`}
                style={{ width: "100%", height: h, borderRadius: "5px 5px 0 0", background: color, opacity: 0.85, transition: "height 0.3s ease", minHeight: 8 }}
              />
              <span style={{ fontSize: 10, color: "#475569", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        {[["≤4 Leggero","#4ade80"],["5-6 Moderato","#facc15"],["7-8 Intenso","#fb923c"],["9-10 Massimale","#f87171"]].map(([l,c]) => (
          <div key={l} style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{l}</span>
          </div>
        ))}
      </div>
    </AppCard>
  );
}

function QuickAction({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cl-card-btn"
      style={{
        borderRadius: 12,
        padding: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "white",
        cursor: "pointer",
        textAlign: "left",
        minHeight: 92,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 10, lineHeight: 1 }}>{icon}</div>
      <strong style={{ lineHeight: 1.25 }}>{label}</strong>
    </button>
  );
}

function InfoRows({ rows }) {
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} style={roleDashboardStyles.infoRow}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function EventList({ events, emptyText }) {
  const { t } = useTranslation();
  if (!events.length) {
    return <p style={roleDashboardStyles.muted}>{emptyText}</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {events.map((event) => (
        <div key={`${event.type}-${event.id}`} style={roleDashboardStyles.eventRow}>
          <div>
            <strong>{event.title}</strong>
            <p style={roleDashboardStyles.muted}>{formatShortDate(event.date)}</p>
          </div>

          <Badge tone={event.type === "Partita" ? "orange" : "green"}>
            {getDashboardEventTypeLabel(event.type, t)}
          </Badge>
        </div>
      ))}
    </div>
  );
}

const roleDashboardStyles = {
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: 22,
    marginBottom: 22,
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: 22,
    marginTop: 22,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 18,
    marginBottom: 22,
  },
  heroTitle: {
    margin: "12px 0 6px",
    fontSize: 32,
    letterSpacing: 0,
  },
  muted: {
    color: "#94a3b8",
    margin: 0,
  },
  bodyText: {
    color: "#cbd5e1",
    lineHeight: 1.6,
    marginTop: 0,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    alignItems: "center",
    lineHeight: 1.35,
  },
  eventRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  alertRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
};

const correctionStyles = {
  head: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 18,
    alignItems: "start",
  },
  title: {
    margin: "12px 0 6px",
    lineHeight: 1.12,
  },
  muted: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.45,
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(90px, 1fr))",
    gap: 10,
    minWidth: 210,
  },
  list: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  rowTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    minWidth: 0,
  },
  meta: {
    margin: "6px 0 0",
    color: "#94a3b8",
    lineHeight: 1.35,
    fontSize: 13,
  },
  review: {
    margin: "8px 0 0",
    color: "#c4b5fd",
    lineHeight: 1.35,
    fontSize: 13,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
};

function SeasonRecordStat({ label, value, tone }) {
  const colors = {
    green:  { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  text: "#22c55e" },
    blue:   { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.2)", text: "#38bdf8" },
    red:    { bg: "rgba(248,113,113,0.1)",border: "rgba(248,113,113,0.2)",text: "#f87171" },
    purple: { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.2)", text: "#a855f7" },
  };
  const c = colors[tone] || colors.blue;
  return (
    <div style={{
      borderRadius: 12,
      padding: "18px 14px",
      background: c.bg,
      border: `1px solid ${c.border}`,
      textAlign: "center",
    }}>
      <p style={{ color: "#94a3b8", margin: "0 0 8px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0, lineHeight: 1.2 }}>{label}</p>
      <span style={{ margin: 0, fontSize: "clamp(26px, 9vw, 42px)", fontWeight: 900, color: c.text, letterSpacing: 0, lineHeight: 1, display: "block" }}>{value}</span>
    </div>
  );
}

const srStyles = {
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  pillLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  pillValue: {
    fontSize: 15,
    color: "#e2e8f0",
  },
};

/* ─── NextMatchCard ─────────────────────────────────────────── */
function NextMatchCard({ match, navigate, clubName, rsvpSummary }) {
  const { t } = useTranslation();
  const starterCount = (match.lineup?.starterIds || []).length;
  const benchCount   = (match.lineup?.benchIds   || []).length;
  const lineupReady  = match.lineup?.ready;
  const checklistProgress = getMatchChecklistProgress(match);

  const daysUntil = Math.ceil((new Date(match.date) - new Date(new Date().toDateString())) / 86400000);
  const countdownLabel = daysUntil === 0 ? "OGGI" : daysUntil === 1 ? "DOMANI" : `${daysUntil} giorni`;
  const countdownColor = daysUntil === 0 ? "#f87171" : daysUntil <= 2 ? "#fb923c" : "#38bdf8";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <Badge tone="orange">{t("pages.dashboard.nextMatchLabel")}</Badge>
          <h2 style={{ margin: "10px 0 4px", lineHeight: 1.15 }}>
            {clubName} <span style={{ color: "#64748b" }}>vs</span> {match.opponent}
          </h2>
          <p style={{ color: "#94a3b8", margin: 0 }}>
            {formatDate(match.date)}
            {match.location ? ` · ${match.location}` : ""}
            {match.formation ? ` · ${match.formation}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ textAlign: "center", padding: "6px 14px", borderRadius: 10, background: "rgba(0,0,0,0.25)", border: `1px solid ${countdownColor}44` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: countdownColor, lineHeight: 1 }}>{countdownLabel}</div>
            {daysUntil > 1 && <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>alla partita</div>}
          </div>
          <Badge tone={lineupReady ? "green" : "orange"}>
            {lineupReady ? t("pages.dashboard.lineupReady") : t("pages.dashboard.lineupDraft")}
          </Badge>
        </div>
      </div>

      {rsvpSummary && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Badge tone="green">{t("pages.dashboard.rsvpAvailable", { count: rsvpSummary.available })}</Badge>
          <Badge tone="red">{t("pages.dashboard.rsvpUnavailable", { count: rsvpSummary.unavailable })}</Badge>
          <Badge tone="orange">{t("pages.dashboard.rsvpPending", { count: rsvpSummary.pending })}</Badge>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 16 }}>
        {[
          { label: t("pages.dashboard.starters"), value: `${starterCount}/11` },
          { label: t("pages.dashboard.bench"), value: benchCount },
          { label: t("pages.matches.formation"),   value: match.formation || "—" },
          { label: t("pages.dashboard.logistics"), value: `${checklistProgress.done}/${checklistProgress.total}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ borderRadius: 10, padding: "10px 8px", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
            <p style={{ color: "#64748b", margin: "0 0 4px", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}</p>
            <strong style={{ fontSize: 18 }}>{value}</strong>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8 }}>
        <button
          type="button"
          onClick={() => navigate(`/match-convocation/${match.id}`)}
          style={nmcBtn}
        >
          {t("pages.matches.convocation")}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/match-day/${match.id}`)}
          style={{ ...nmcBtn, background: "linear-gradient(135deg,rgba(56,189,248,0.22),rgba(37,99,235,0.16))", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}
        >
          {t("pages.matches.matchSheet")}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/match-stats/${match.id}`)}
          style={nmcBtn}
        >
          {t("pages.matches.statistics")}
        </button>
      </div>
    </div>
  );
}

const nmcBtn = {
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
  textAlign: "center",
  lineHeight: 1.2,
};

const MATCH_CHECKLIST_KEYS = [
  "documents",
  "kits",
  "water",
  "medical",
  "field",
  "referee",
  "opponentLineup",
  "warmup",
];

function getMatchChecklistProgress(match = {}) {
  const items = match.preMatchChecklist?.items || {};
  const done = MATCH_CHECKLIST_KEYS.filter((key) => items[key]).length;
  return {
    done,
    total: MATCH_CHECKLIST_KEYS.length,
    complete: done === MATCH_CHECKLIST_KEYS.length,
  };
}

function getMatchOperationalAlerts(match, t) {
  if (!match) return [];

  const progress = getMatchChecklistProgress(match);
  if (progress.complete) return [];

  return [
    {
      tone: "orange",
      text: t("pages.dashboard.matchChecklistAlert", {
        opponent: match.opponent || t("pages.dashboard.matchChecklistAlertFallback"),
        done: progress.done,
        total: progress.total,
      }),
      path: `/match-day/${match.id}`,
    },
  ];
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default Dashboard;
