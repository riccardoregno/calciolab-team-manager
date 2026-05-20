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
import { useAuth } from "../hooks/useAuth";
import { loadAllPlayerStats } from "../services/playerProfile";
import { useTranslation } from "../i18n";

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

const TONE_LABEL = { red: "Urgente", orange: "Attenzione", green: "OK", blue: "Info", purple: "Nota" };

const DASHBOARD_SECTION_KEYS = ["nextEvent", "kpis", "rosterStatus", "weekFocus", "coachAlerts", "recentActivities", "quickActions", "rewardCenter"];
const DEFAULT_SECTION_ORDER = DASHBOARD_SECTION_KEYS;

function SortableSection({ id, children }) {
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
        title="Trascina per riordinare"
      >
        ⠿
      </div>
      {children}
    </div>
  );
}

function Dashboard({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  physicalTests = [],
  appSettings = {},
  setAppSettings,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();

  const [playerStatsMap, setPlayerStatsMap] = useState({});
  const [showPersonalize, setShowPersonalize] = useState(false);
  const isMobile = useIsMobile();

  const settings = normalizeAppSettings(appSettings);
  const widgets = settings.dashboardWidgets;
  const currentRole = getCurrentUserRole(settings);
  const reward = getCoachRewardProfile({
    players,
    exercises,
    sessions,
    matches,
    physicalTests,
  });
  const plan = getSubscriptionPlan(settings);
  const setup = getSetupProgress({
    players,
    exercises,
    sessions,
    matches,
    appSettings: settings,
  });
  const billing = getBillingStatus(settings);

  useEffect(() => {
    if (!auth.team?.id) return;

    loadAllPlayerStats(auth.team.id).then(({ data }) => {
      setPlayerStatsMap(data || {});
    });
  }, [auth.team?.id]);

  const playerStats = useMemo(() => {
    return players.map((player) => {
      const stat = playerStatsMap[String(player.id)] || {};

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
      };
    });
  }, [players, playerStatsMap]);

  const totalGoals = playerStats.reduce((sum, p) => sum + p.goals, 0);
  const totalAssists = playerStats.reduce((sum, p) => sum + p.assists, 0);
  const totalMinutes = playerStats.reduce((sum, p) => sum + p.minutes, 0);

  const realTopScorer = [...playerStats].sort((a, b) => b.goals - a.goals)[0];
  const realTopAssistman = [...playerStats].sort((a, b) => b.assists - a.assists)[0];
  const realTopMinutes = [...playerStats].sort((a, b) => b.minutes - a.minutes)[0];
  const realTopPresence = [...playerStats].sort((a, b) => b.appearances - a.appearances)[0];

  const today = todayStart();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const events = [...sessions, ...matches].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const nextEvent = events.find((event) => new Date(event.date) >= today);
  const nextTraining = sessions.find((s) => new Date(s.date) >= today);
  const nextMatch = matches.find((m) => new Date(m.date) >= today);
  const todayEvents = events.filter((event) => {
    const date = new Date(event.date);
    return date >= today && date < new Date(today.getTime() + 24 * 60 * 60 * 1000);
  });
  const upcomingWeekAgenda = events.filter((event) => {
    const date = new Date(event.date);
    return date >= today && date <= weekEnd;
  }).slice(0, 5);
  const upcomingWeekEvents = upcomingWeekAgenda.length;

  const availablePlayers = players.filter(
    (p) => !p.status || p.status === "Disponibile"
  ).length;
  const unavailablePlayers = Math.max(0, players.length - availablePlayers);

  const recentActivities = [...events]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const seasonRecord = getSeasonRecord(matches);

  const coachAlerts = getCoachAlerts({
    players,
    matches,
    physicalTests,
    sessions,
    playerStatsMap,
  });

  const sectionOrder = settings.dashboardSectionOrder ?? DEFAULT_SECTION_ORDER;

  function updateSectionOrder(newOrder) {
    setAppSettings?.({ ...settings, dashboardSectionOrder: newOrder });
  }

  function handleSectionDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(String(active.id));
    const newIndex = sectionOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    updateSectionOrder(arrayMove([...sectionOrder], oldIndex, newIndex));
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
                playersCount={players.length}
                coachAlerts={coachAlerts}
                setup={setup}
                navigate={navigate}
                isMobile={isMobile}
              />
            )}

            {widgets.nextEvent && (
              <AppCard>
                {nextEvent?.type === "Partita" ? (
                  <NextMatchCard match={nextEvent} navigate={navigate} />
                ) : (
                  <>
                    <h3 style={{ marginTop: 0 }}>Prossimo evento</h3>
                    {nextEvent ? (
                      <div>
                        <Badge tone="green">{nextEvent.type}</Badge>
                        <h2 style={{ marginBottom: 8 }}>{nextEvent.title}</h2>
                        <p style={{ color: "#94a3b8" }}>{formatDate(nextEvent.date)}</p>
                        <p style={{ color: "#cbd5e1" }}>
                          {nextEvent.theme || "Seduta programmata"}
                        </p>
                        <Button
                          variant="ghost"
                          style={{ marginTop: 14 }}
                          onClick={() => navigate("/trainings")}
                        >
                          Vai alle sedute
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p style={{ color: "#94a3b8" }}>Nessun evento programmato.</p>
                        <Button
                          variant="ghost"
                          style={{ marginTop: 10 }}
                          onClick={() => navigate("/calendar")}
                        >
                          Apri calendario
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: 18,
                marginBottom: 24,
              }}
            >
              <KpiCard
                label="Giocatori"
                value={players.length}
                icon="👥"
                note={`${availablePlayers} disponibili`}
              />
              <KpiCard
                label="Gol squadra"
                value={totalGoals}
                icon="⚽"
                note={realTopScorer?.goals ? `Top: ${realTopScorer.name}` : "Nessun gol"}
              />
              <KpiCard
                label="Assist squadra"
                value={totalAssists}
                icon="🅰️"
                note={
                  realTopAssistman?.assists
                    ? `Top: ${realTopAssistman.name}`
                    : "Nessun assist"
                }
              />
              <KpiCard
                label="Minuti totali"
                value={totalMinutes}
                icon="⏱️"
                note={realTopMinutes?.minutes ? `Top: ${realTopMinutes.name}` : "Nessun minuto registrato"}
              />
            </div>

            {seasonRecord.played > 0 && (
              <AppCard style={{ marginBottom: 24 }}>
                <SectionTitle
                  title="Record stagionale"
                  subtitle={`${seasonRecord.played} partite giocate · ${seasonRecord.goalsFor} gol fatti · ${seasonRecord.goalsAgainst} gol subiti`}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 14 }}>
                  <SeasonRecordStat label="Vittorie" value={seasonRecord.wins} tone="green" />
                  <SeasonRecordStat label="Pareggi" value={seasonRecord.draws} tone="blue" />
                  <SeasonRecordStat label="Sconfitte" value={seasonRecord.losses} tone="red" />
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>Gol fatti</span>
                    <strong style={{ ...srStyles.pillValue, color: "#22c55e" }}>{seasonRecord.goalsFor}</strong>
                  </div>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>Gol subiti</span>
                    <strong style={{ ...srStyles.pillValue, color: "#f87171" }}>{seasonRecord.goalsAgainst}</strong>
                  </div>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>Differenza reti</span>
                    <strong style={{
                      ...srStyles.pillValue,
                      color: seasonRecord.goalsFor - seasonRecord.goalsAgainst >= 0 ? "#22c55e" : "#f87171",
                    }}>
                      {seasonRecord.goalsFor - seasonRecord.goalsAgainst >= 0 ? "+" : ""}
                      {seasonRecord.goalsFor - seasonRecord.goalsAgainst}
                    </strong>
                  </div>
                  <div style={srStyles.pill}>
                    <span style={srStyles.pillLabel}>% vittorie</span>
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
                title="Top performers"
                subtitle="Classifica stagionale per gol, assist, minuti e presenze"
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 14,
                }}
              >
                <TopPerformer
                  label="Top scorer"
                  value={realTopScorer?.goals || 0}
                  name={realTopScorer?.goals ? realTopScorer.name : "Nessun dato"}
                  tone="green"
                  onClick={() =>
                    realTopScorer?.id && navigate(`/players/${realTopScorer.id}`)
                  }
                />

                <TopPerformer
                  label="Top assist"
                  value={realTopAssistman?.assists || 0}
                  name={
                    realTopAssistman?.assists
                      ? realTopAssistman.name
                      : "Nessun dato"
                  }
                  tone="blue"
                  onClick={() =>
                    realTopAssistman?.id && navigate(`/players/${realTopAssistman.id}`)
                  }
                />

                <TopPerformer
                  label="Più minuti"
                  value={realTopMinutes?.minutes || 0}
                  name={realTopMinutes?.minutes ? realTopMinutes.name : "Nessun dato"}
                  tone="orange"
                  onClick={() =>
                    realTopMinutes?.id && navigate(`/players/${realTopMinutes.id}`)
                  }
                />

                <TopPerformer
                  label="Più presenze"
                  value={realTopPresence?.appearances || 0}
                  name={
                    realTopPresence?.appearances
                      ? realTopPresence.name
                      : "Nessun dato"
                  }
                  tone="purple"
                  onClick={() =>
                    realTopPresence?.id && navigate(`/players/${realTopPresence.id}`)
                  }
                />
              </div>
            </AppCard>
          </div>
        );

      case "rosterStatus":
        if (!widgets.rosterStatus) return null;
        return (
          <AppCard>
            <SectionTitle
              title="Stato rosa"
              subtitle="Disponibilità generale squadra"
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
                label="Disponibili"
                value={players.filter((p) => !p.status || p.status === "Disponibile").length}
                tone="green"
              />
              <MiniStatus
                label="Infortunati"
                value={players.filter((p) => p.status === "Infortunato").length}
                tone="red"
              />
              <MiniStatus
                label="Squalificati"
                value={players.filter((p) => p.status === "Squalificato").length}
                tone="purple"
              />
              <MiniStatus
                label="In recupero"
                value={players.filter((p) => p.status === "Recupero" || p.status === "Differenziato").length}
                tone="orange"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                Totale rosa: {players.length}
              </span>
              <Button variant="ghost" onClick={() => navigate("/players")}>
                Vai alla rosa
              </Button>
            </div>
          </AppCard>
        );

      case "weekFocus":
        if (!widgets.weekFocus) return null;
        return (
          <AppCard>
            <SectionTitle
              title="Focus settimana"
              subtitle={`${upcomingWeekEvents} eventi nei prossimi 7 giorni`}
            />

            {upcomingWeekAgenda.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {upcomingWeekAgenda.map((event) => {
                  const isMatch = event.type === "Partita" || event.opponent;

                  return (
                    <FocusItem
                      key={`${event.type}-${event.id}-${event.date}`}
                      label={isMatch ? "Partita" : event.type || "Seduta"}
                      title={isMatch ? `CalcioLab - ${event.opponent || "Avversario"}` : event.title || "Seduta"}
                      meta={`${formatDate(event.date)}${event.theme ? ` · ${event.theme}` : ""}`}
                      tone={isMatch ? "orange" : "green"}
                      action={isMatch ? "Apri gara" : "Apri sedute"}
                      onClick={() => openAgendaEvent(event)}
                    />
                  );
                })}
              </div>
            ) : (
              <div>
                <EmptyState
                  icon="📅"
                  title="Settimana vuota"
                  text="Pianifica una seduta o inserisci una partita per dare ritmo alla settimana."
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <Button onClick={() => navigate("/trainings")}>Nuova seduta</Button>
                  <Button variant="ghost" onClick={() => navigate("/matches")}>Nuova partita</Button>
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
              title="Alert coach"
              subtitle="Cose importanti da guardare subito"
            />

            {coachAlerts.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {coachAlerts.map((alert, index) => (
                  <div
                    key={`${alert.text}-${index}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Badge tone={alert.tone}>{TONE_LABEL[alert.tone] || alert.tone}</Badge>
                    <span>{alert.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#94a3b8" }}>Nessun alert prioritario.</p>
            )}
          </AppCard>
        );

      case "recentActivities":
        if (!widgets.recentActivities) return null;
        return (
          <AppCard>
            <SectionTitle
              title="Ultime attività"
              subtitle="Sedute e partite più recenti"
            />

            {recentActivities.length === 0 ? (
              <EmptyState
                icon="📭"
                title="Nessuna attività"
                text="Crea una seduta o una partita per popolare la dashboard."
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
                        {activity.type}
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
              title="Azioni rapide"
              subtitle="Crea o consulta velocemente"
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
              }}
            >
              <QuickAction
                label="Rosa"
                icon="👥"
                onClick={() => navigate("/players")}
              />
              <QuickAction
                label="Eserciziario"
                icon="📚"
                onClick={() => navigate("/exercise-library")}
              />
              <QuickAction
                label="Sedute"
                icon="📋"
                onClick={() => navigate("/trainings")}
              />
              <QuickAction
                label="Match Day"
                icon="⚽"
                onClick={() => navigate("/match-day")}
              />
              <QuickAction
                label="Lavori fisici"
                icon="🏃"
                onClick={() => navigate("/physical-workouts")}
              />
              <QuickAction
                label="Calendario"
                icon="📅"
                onClick={() => navigate("/calendar")}
              />
              <QuickAction
                label="Genera con AI"
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
                <Badge tone="purple">Piano {plan.name}</Badge>

                <h2 style={{ margin: "12px 0 6px" }}>
                  Livello {reward.level} - {reward.title}
                </h2>

                <p style={{ color: "#94a3b8", margin: 0 }}>
                  {reward.points} punti attività · sconto potenziale{" "}
                  {reward.discount}%.
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
                  Premium e reward
                </Button>

                {plan.id === "free" && (
                  <Button onClick={() => navigate("/premium")}>
                    Sblocca funzioni
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
            {Object.entries({
              hero: "Intro",
              nextEvent: "Evento",
              kpis: "KPI",
              weekFocus: "Settimana",
              rosterStatus: "Rosa",
              coachAlerts: "Alert",
              recentActivities: "Attività",
              quickActions: "Azioni",
              rewardCenter: "Reward",
            }).map(([key, label]) => (
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
      {(billing.trialActive ||
        billing.trialExpired ||
        billing.billingStatus === "free") && (
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
                  ? "Trial"
                  : billing.trialExpired
                  ? "Trial scaduto"
                  : "Free"}
              </Badge>

              <h2 style={{ margin: "12px 0 6px" }}>
                {billing.trialActive
                  ? `${billing.trialDaysLeft} giorni rimasti di prova ${billing.effectivePlan.name}`
                  : billing.trialExpired
                  ? "Riattiva un piano per sbloccare le funzioni avanzate"
                  : "Avvia una prova Premium o Club"}
              </h2>

              <p style={{ color: "#94a3b8", margin: 0 }}>
                {billing.trialActive
                  ? "Accesso completo a tutte le funzioni durante il periodo di prova."
                  : billing.trialExpired
                  ? "Il tuo periodo di prova è terminato. Scegli un piano per continuare."
                  : "Passa a Premium o Club per sbloccare match day, statistiche avanzate e molto altro."}
              </p>
            </div>

            <Button onClick={() => navigate("/premium")}>{t("pages.dashboard.managePlan")}</Button>
          </div>
        </AppCard>
      )}

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
              Setup {setup.percent}%
            </Badge>

            <h2 style={{ margin: "12px 0 6px" }}>
              {setup.next ? setup.next.label : "Workspace pronto"}
            </h2>

            <p style={{ color: "#94a3b8", margin: 0 }}>
              {setup.completed}/{setup.total} passaggi completati per rendere
              CalcioLab pronto a staff, giocatori e club.
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
            <Button variant="ghost" onClick={() => navigate("/onboarding")}>
              Onboarding
            </Button>

            <Button onClick={() => navigate(setup.next?.path || "/settings")}>
              Prossimo passo
            </Button>
          </div>
        </div>
      </AppCard>

      {/* Sezioni draggable */}
      <DndContext onDragEnd={handleSectionDragEnd} collisionDetection={closestCenter}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((id) => {
            const content = renderSectionContent(id);
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
  const navigate = useNavigate();
  const player = players[0];
  const summary = getPlayerSummary(player, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const reference = getPhysicalReference(latestTest, appSettings.coachParameters);
  const nextEvents = [...sessions, ...matches]
    .filter((event) => new Date(event.date) >= todayStart())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  const program = player ? appSettings.playerPortal.programs[player.id] : "";

  return (
    <div>
      <PageHeader
        title="Dashboard Giocatore"
        subtitle="Programma personale, prossimi impegni e rendimento individuale"
        badge="Vista Player"
      />

      <div style={roleDashboardStyles.heroGrid}>
        <AppCard>
          <Badge tone={player?.status === "Disponibile" ? "green" : "orange"}>
            {player?.status || "Profilo atleta"}
          </Badge>

          <h2 style={roleDashboardStyles.heroTitle}>
            {player?.name || "Giocatore"}
          </h2>

          <p style={roleDashboardStyles.muted}>
            {player?.role || "Ruolo non definito"}{" "}
            {player?.shirtNumber ? `· #${player.shirtNumber}` : ""}
          </p>

          <div style={roleDashboardStyles.kpiGrid}>
            <MiniStatus label="Minuti" value={summary.stats.minutes} tone="blue" />
            <MiniStatus label="Gol" value={summary.stats.goals} tone="green" />
            <MiniStatus label="Assist" value={summary.stats.assists} tone="purple" />
          </div>
        </AppCard>

        <AppCard>
          <SectionTitle
            title="Programma personale"
            subtitle="Indicazioni assegnate dallo staff"
          />

          <p style={roleDashboardStyles.bodyText}>
            {program ||
              "Nessun programma individuale assegnato. Controlla l'area giocatori dopo il prossimo aggiornamento dello staff."}
          </p>

          <Button onClick={() => navigate("/player-portal")}>
            Apri area giocatori
          </Button>
        </AppCard>
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle
            title="Profilo fisico"
            subtitle="Ultimo test e gruppo di lavoro"
          />

          <InfoRows
            rows={[
              ["Ultimo test", latestTest ? formatShortDate(latestTest.date) : "Da testare"],
              ["Gruppo", reference.group],
              ["MAS", reference.mas ? `${reference.mas} km/h` : "-"],
            ]}
          />
        </AppCard>

        <AppCard>
          <SectionTitle title="Prossimi impegni" subtitle="Calendario personale" />
          <EventList events={nextEvents} emptyText="Nessun impegno programmato." />
        </AppCard>
      </div>
    </div>
  );
}

function SponsorRoleDashboard({ appSettings, matches }) {
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
        title="Dashboard Sponsor"
        subtitle="Visibilità, offerte community e report dedicati ai partner"
        badge="Vista Sponsor"
      />

      <div style={roleDashboardStyles.heroGrid}>
        <AppCard>
          <Badge tone="purple">Partner Club</Badge>

          <h2 style={roleDashboardStyles.heroTitle}>
            {mainSponsor?.name || "Sponsor principale da configurare"}
          </h2>

          <p style={roleDashboardStyles.muted}>
            {activeSponsors.length} sponsor attivi nel club.
          </p>

          <Button onClick={() => navigate("/sponsors")}>Apri sponsor hub</Button>
        </AppCard>

        <AppCard>
          <SectionTitle
            title="Offerta community"
            subtitle="Contenuto visibile a famiglie e squadra"
          />

          <p style={roleDashboardStyles.bodyText}>
            {mainSponsor?.offer ||
              activeSponsors[0]?.offer ||
              "Nessuna offerta sponsor ancora inserita."}
          </p>
        </AppCard>
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle
            title="Visibilità promessa"
            subtitle="Asset e spazi commerciali"
          />

          <p style={roleDashboardStyles.bodyText}>
            {mainSponsor?.visibility ||
              "Dashboard, report PDF, pagina squadra e materiali club."}
          </p>
        </AppCard>

        <AppCard>
          <SectionTitle
            title="Ultime partite"
            subtitle="Contesto per report e comunicazioni"
          />

          <EventList events={recentMatches} emptyText="Nessuna partita registrata." />
        </AppCard>
      </div>
    </div>
  );
}

function PhysicalRoleDashboard({ players, matches, physicalTests, coachAlerts }) {
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
        title="Dashboard Preparatore"
        subtitle="Test, gruppi fisici, carichi e disponibilità della rosa"
        badge="Vista Prep."
      />

      <div style={roleDashboardStyles.kpiGrid}>
        <KpiCard
          label="Giocatori"
          value={players.length}
          icon="👥"
          note="Rosa monitorata"
        />
        <KpiCard
          label="Test registrati"
          value={physicalTests.length}
          icon="⏱️"
          note={`${untestedPlayers.length} da testare`}
        />
        <KpiCard
          label="Prossima gara"
          value={nextMatch ? formatShortDate(nextMatch.date) : "-"}
          icon="⚽"
          note={nextMatch?.opponent || "Da programmare"}
        />
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle
            title="Ultimi test"
            subtitle="Riferimenti per i lavori individuali"
          />

          {latestTests.length ? (
            <InfoRows
              rows={latestTests.map((test) => {
                const player = players.find(
                  (item) => String(item.id) === String(test.playerId)
                );
                const reference = getPhysicalReference(test);
                return [
                  player?.name || "Giocatore",
                  `${reference.group} · ${reference.mas || "-"} km/h`,
                ];
              })}
            />
          ) : (
            <p style={roleDashboardStyles.muted}>Nessun test fisico registrato.</p>
          )}

          <Button onClick={() => navigate("/physical-tests")}>Aggiorna test</Button>
        </AppCard>

        <AppCard>
          <SectionTitle title="Alert fisici" subtitle="Priorità per la settimana" />

          {coachAlerts.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {coachAlerts.slice(0, 5).map((alert, index) => (
                <div
                  key={`${alert.text}-${index}`}
                  style={roleDashboardStyles.alertRow}
                >
                  <Badge tone={alert.tone}>{TONE_LABEL[alert.tone] || alert.tone}</Badge>
                  <span>{alert.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={roleDashboardStyles.muted}>Nessun alert prioritario.</p>
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
  const primaryStatus = todayEvents.length
    ? `${todayEvents.length} eventi oggi`
    : nextEvent
    ? `Prossimo: ${formatShortDate(nextEvent.date)}`
    : "Nessun evento";

  const actions = [
    !nextTraining && {
      label: "Pianifica seduta",
      path: "/trainings",
      variant: "primary",
    },
    !nextMatch && {
      label: "Inserisci partita",
      path: "/matches",
      variant: "ghost",
    },
    coachAlerts.length > 0 && {
      label: "Controlla alert",
      path: "/players",
      variant: "ghost",
    },
    setup.next && {
      label: "Completa setup",
      path: setup.next.path,
      variant: "ghost",
    },
    {
      label: "Nuova seduta",
      path: "/trainings",
      variant: "primary",
    },
  ].filter(Boolean).slice(0, 3);

  return (
    <AppCard>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.25fr) minmax(280px,0.75fr)", gap: 22, alignItems: "stretch" }}>
        <div>
          <Badge tone={coachAlerts.length ? "orange" : "green"}>
            {coachAlerts.length ? `${coachAlerts.length} alert aperti` : "Situazione sotto controllo"}
          </Badge>

          <h2 style={{ fontSize: 30, margin: "16px 0 8px", lineHeight: 1.08 }}>
            {primaryStatus}
          </h2>

          <p style={{ color: "#94a3b8", maxWidth: 640, lineHeight: 1.55, margin: 0 }}>
            {nextEvent
              ? `${nextEvent.title || nextEvent.opponent || "Evento"} · ${formatDate(nextEvent.date)}`
              : "Programma la prossima attività per dare allo staff una direzione operativa chiara."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 18 }}>
            <ControlRoomMetric label="Oggi" value={todayEvents.length} tone={todayEvents.length ? "green" : "blue"} />
            <ControlRoomMetric label="7 giorni" value={upcomingWeekEvents} tone="blue" />
            <ControlRoomMetric label="Disponibili" value={`${availablePlayers}/${playersCount}`} tone="green" />
            <ControlRoomMetric label="Da monitorare" value={unavailablePlayers} tone={unavailablePlayers ? "orange" : "green"} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, alignContent: "space-between" }}>
          <div style={{ display: "grid", gap: 8 }}>
            {(coachAlerts.length ? coachAlerts.slice(0, 2) : [
              { text: "Nessuna urgenza operativa", tone: "green" },
            ]).map((alert, index) => (
              <div key={`${alert.text}-${index}`} style={controlRoomStyles.alert}>
                <Badge tone={alert.tone || "blue"}>{TONE_LABEL[alert.tone] || alert.tone || "Info"}</Badge>
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

function ControlRoomMetric({ label, value, tone }) {
  const colors = {
    green: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", text: "#86efac" },
    blue: { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.2)", text: "#7dd3fc" },
    orange: { bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.22)", text: "#fdba74" },
  };
  const color = colors[tone] || colors.blue;

  return (
    <div style={{ borderRadius: 12, padding: "12px 13px", background: color.bg, border: `1px solid ${color.border}` }}>
      <p style={{ margin: "0 0 7px", color: "#94a3b8", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
        {label}
      </p>
      <strong style={{ color: color.text, fontSize: 22, lineHeight: 1 }}>{value}</strong>
    </div>
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

          <span style={{ fontSize: 32, lineHeight: 1, margin: "9px 0 8px", display: "block" }}>{value}</span>

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

function QuickAction({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
            {event.type || "Evento"}
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
      <span style={{ margin: 0, fontSize: 42, fontWeight: 900, color: c.text, letterSpacing: 0, lineHeight: 1, display: "block" }}>{value}</span>
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
function NextMatchCard({ match, navigate }) {
  const starterCount = (match.lineup?.starterIds || []).length;
  const benchCount   = (match.lineup?.benchIds   || []).length;
  const lineupReady  = match.lineup?.ready;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <Badge tone="orange">Prossima partita</Badge>
          <h2 style={{ margin: "10px 0 4px", lineHeight: 1.15 }}>
            CalcioLab <span style={{ color: "#64748b" }}>vs</span> {match.opponent}
          </h2>
          <p style={{ color: "#94a3b8", margin: 0 }}>
            {formatDate(match.date)}
            {match.location ? ` · ${match.location}` : ""}
            {match.formation ? ` · ${match.formation}` : ""}
          </p>
        </div>
        <Badge tone={lineupReady ? "green" : "orange"}>
          {lineupReady ? "Distinta pronta" : "Bozza"}
        </Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Titolari", value: `${starterCount}/11` },
          { label: "Panchina", value: benchCount },
          { label: "Modulo",   value: match.formation || "—" },
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
          Convocazione
        </button>
        <button
          type="button"
          onClick={() => navigate(`/match-day/${match.id}`)}
          style={{ ...nmcBtn, background: "linear-gradient(135deg,rgba(56,189,248,0.22),rgba(37,99,235,0.16))", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}
        >
          Scheda Gara
        </button>
        <button
          type="button"
          onClick={() => navigate(`/match-stats/${match.id}`)}
          style={nmcBtn}
        >
          Statistiche
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

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default Dashboard;
