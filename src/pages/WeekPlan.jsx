import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { formatShortDate, getAvailabilityGroups, getSessionLoad } from "../utils/helpers";
import { useTranslation } from "../i18n";

export default function WeekPlan({
  sessions = [], matches = [], players = [] }) {

  const { t } = useTranslation();
  const weekDays = [
    t("pages.weekPlan.dayMon"), t("pages.weekPlan.dayTue"), t("pages.weekPlan.dayWed"),
    t("pages.weekPlan.dayThu"), t("pages.weekPlan.dayFri"), t("pages.weekPlan.daySat"), t("pages.weekPlan.daySun"),
  ];
  const week = buildCurrentWeek();
  const events = [...sessions, ...matches];
  const availability = getAvailabilityGroups(players);
  const weeklyLoad = sessions.reduce((sum, session) => sum + getSessionLoad(session), 0);

  return (
    <div>
      <PageHeader
        title={t("pages.weekPlan.title")}
        subtitle={t("pages.weekPlan.subtitle")}
      />

      <div style={weekStyles.kpiGrid}>
        <Kpi label={t("pages.weekPlan.kpiSessions")} value={sessions.length} tone="green" />
        <Kpi label={t("pages.weekPlan.kpiMatches")} value={matches.length} tone="orange" />
        <Kpi label={t("pages.weekPlan.kpiLoad")} value={weeklyLoad || "-"} tone="purple" />
        <Kpi label={t("pages.weekPlan.kpiAtRisk")} value={availability.injured.length + availability.limited.length} tone="red" />
      </div>

      <div style={weekStyles.grid}>
        {week.map((day, index) => {
          const dayEvents = events.filter((event) => event.date === day.key);

          return (
            <AppCard key={day.key}>
              <div style={weekStyles.dayHeader}>
                <div>
                  <h3 style={{ margin: 0 }}>{weekDays[index]}</h3>
                  <p style={weekStyles.muted}>{formatShortDate(day.key)}</p>
                </div>
                <Badge tone={dayEvents.length ? "blue" : "purple"}>
                  {dayEvents.length || t("pages.weekPlan.dayOff")}
                </Badge>
              </div>

              <div style={weekStyles.eventList}>
                {dayEvents.length ? (
                  dayEvents.map((event) => (
                    <div key={`${event.type}-${event.id}`} style={weekStyles.event}>
                      <Badge tone={event.type === "Partita" ? "orange" : "green"}>
                        {event.type}
                      </Badge>
                      <strong>{event.title}</strong>
                      <span>{event.theme || event.opponent || event.objective || t("pages.weekPlan.dayObjectiveFallback")}</span>
                    </div>
                  ))
                ) : (
                  <p style={weekStyles.muted}>{t("pages.weekPlan.dayRestText")}</p>
                )}
              </div>
            </AppCard>
          );
        })}
      </div>

      <AppCard>
        <div style={weekStyles.alertHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.weekPlan.alertTitle")}</h3>
            <p style={weekStyles.muted}>{t("pages.weekPlan.alertSubtitle")}</p>
          </div>
          <Button onClick={() => window.print()}>{t("pages.weekPlan.printWeek")}</Button>
        </div>

        <div style={weekStyles.alertGrid}>
          <AlertColumn title={t("pages.weekPlan.alertInjured")} players={availability.injured} />
          <AlertColumn title={t("pages.weekPlan.alertRecovery")} players={availability.limited} />
          <AlertColumn title={t("pages.weekPlan.alertSuspended")} players={availability.suspended} />
        </div>
      </AppCard>
    </div>
  );
}

function AlertColumn({ title, players }) {
  const { t } = useTranslation();
  return (
    <div style={weekStyles.alertColumn}>
      <strong>{title}</strong>
      {players.length ? (
        players.map((player) => (
          <span key={player.id}>
            {player.name} {player.expectedReturn ? t("pages.weekPlan.expectedReturn", { date: player.expectedReturn }) : ""}
          </span>
        ))
      ) : (
        <span>{t("pages.weekPlan.alertNoPlayers")}</span>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <AppCard>
      <Badge tone={tone}>{label}</Badge>
      <h2 style={{ marginBottom: 0 }}>{value}</h2>
    </AppCard>
  );
}

function buildCurrentWeek() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { date, key: toDateKey(date) };
  });
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const weekStyles = {
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 22 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginBottom: 22 },
  dayHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  muted: { color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.5 },
  eventList: { display: "grid", gap: 10 },
  event: { display: "grid", gap: 8, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  alertHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 },
  alertGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  alertColumn: { display: "grid", gap: 8, padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
};
