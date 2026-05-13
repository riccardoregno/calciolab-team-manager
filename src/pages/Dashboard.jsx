import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";

import { formatDate, getCoachAlerts, normalizeAppSettings } from "../utils/helpers";

function Dashboard({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  physicalTests = [],
  appSettings = {},
  setAppSettings,
}) {
  const navigate = useNavigate();
  const settings = normalizeAppSettings(appSettings);
  const widgets = settings.dashboardWidgets;

  const events = [...sessions, ...matches].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const nextEvent = events.find((event) => new Date(event.date) >= todayStart());
  const nextTraining = sessions.find((s) => new Date(s.date) >= todayStart());
  const nextMatch = matches.find((m) => new Date(m.date) >= todayStart());

  const availablePlayers = players.filter(
    (p) => !p.status || p.status === "Disponibile"
  ).length;

  const injuredPlayers = players.filter(
    (p) => p.status === "Infortunato"
  ).length;

  const recentActivities = [...events]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);
  const coachAlerts = getCoachAlerts({ players, matches, physicalTests, sessions });

  function toggleWidget(key) {
    setAppSettings?.({
      ...settings,
      dashboardWidgets: {
        ...widgets,
        [key]: !widgets[key],
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Control room della stagione, rosa, sedute e partite"
      />

      <AppCard>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Personalizza dashboard</h3>
            <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>Scegli cosa vuoi vedere appena apri CalcioLab.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/coach-settings")}>
            Parametri coach
          </Button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {Object.entries({
            hero: "Intro",
            nextEvent: "Evento",
            kpis: "KPI",
            weekFocus: "Settimana",
            rosterStatus: "Rosa",
            coachAlerts: "Alert",
            recentActivities: "Attivita",
            quickActions: "Azioni",
          }).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleWidget(key)}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: widgets[key] ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.045)",
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

      {(widgets.hero || widgets.nextEvent) && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.8fr",
          gap: 24,
          alignItems: "start",
          marginBottom: 24,
          marginTop: 24,
        }}
      >
        {widgets.hero && (
        <AppCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <Badge tone="blue">Coach Control Room</Badge>

              <h2
                style={{
                  fontSize: 34,
                  margin: "18px 0 8px",
                  letterSpacing: "-0.04em",
                }}
              >
                Gestisci la tua stagione in modo professionale
              </h2>

              <p
                style={{
                  color: "#94a3b8",
                  maxWidth: 620,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Rosa, esercizi, sedute, partite, calendario e statistiche in un
                unico ambiente operativo.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => navigate("/trainings")}>
                + Nuova seduta
              </Button>

              <Button variant="ghost" onClick={() => navigate("/matches")}>
                + Nuova partita
              </Button>
            </div>
          </div>
        </AppCard>
        )}

        {widgets.nextEvent && (
        <AppCard>
          <h3 style={{ marginTop: 0 }}>Prossimo evento</h3>

          {nextEvent ? (
            <div>
              <Badge tone={nextEvent.type === "Partita" ? "orange" : "green"}>
                {nextEvent.type}
              </Badge>

              <h2 style={{ marginBottom: 8 }}>{nextEvent.title}</h2>

              <p style={{ color: "#94a3b8" }}>
                {formatDate(nextEvent.date)}
              </p>

              <p style={{ color: "#cbd5e1" }}>
                {nextEvent.theme || nextEvent.opponent || "Evento programmato"}
              </p>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>Nessun evento programmato.</p>
          )}
        </AppCard>
        )}
      </div>
      )}

      {widgets.kpis && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <KpiCard label="Giocatori" value={players.length} icon="👥" note={`${availablePlayers} disponibili`} />
        <KpiCard label="Esercizi" value={exercises.length} icon="🎯" note="Libreria tecnica" />
        <KpiCard label="Sedute" value={sessions.length} icon="📋" note="Allenamenti creati" />
        <KpiCard label="Partite" value={matches.length} icon="🏟️" note={`${injuredPlayers} infortunati`} />
      </div>
      )}

      {(widgets.weekFocus || widgets.rosterStatus) && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 24,
        }}
      >
        {widgets.weekFocus && (
        <AppCard>
          <SectionTitle title="Focus settimana" subtitle="Le prossime attività operative" />

          <div style={{ display: "grid", gap: 14 }}>
            <FocusItem
              label="Prossima seduta"
              title={nextTraining?.title || "Nessuna seduta programmata"}
              meta={nextTraining ? formatDate(nextTraining.date) : "Da pianificare"}
              tone="green"
            />

            <FocusItem
              label="Prossima partita"
              title={
                nextMatch
                  ? `CalcioLab - ${nextMatch.opponent}`
                  : "Nessuna partita programmata"
              }
              meta={nextMatch ? formatDate(nextMatch.date) : "Da inserire"}
              tone="orange"
            />
          </div>
        </AppCard>
        )}

        {widgets.rosterStatus && (
        <AppCard>
          <SectionTitle title="Stato rosa" subtitle="Disponibilità generale squadra" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
            }}
          >
            <MiniStatus label="Disponibili" value={availablePlayers} tone="green" />
            <MiniStatus label="Infortunati" value={injuredPlayers} tone="red" />
            <MiniStatus label="Totale rosa" value={players.length} tone="blue" />
          </div>

          <div style={{ marginTop: 18 }}>
            <Button variant="ghost" onClick={() => navigate("/players")}>
              Vai alla rosa
            </Button>
          </div>
        </AppCard>
        )}
      </div>
      )}

      {widgets.coachAlerts && (
        <AppCard>
          <SectionTitle title="Alert coach" subtitle="Cose importanti da guardare subito" />
          {coachAlerts.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {coachAlerts.map((alert, index) => (
                <div key={`${alert.text}-${index}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Badge tone={alert.tone}>{alert.tone}</Badge>
                  <span>{alert.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>Nessun alert prioritario.</p>
          )}
        </AppCard>
      )}

      {(widgets.recentActivities || widgets.quickActions) && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 24,
        }}
      >
        {widgets.recentActivities && (
        <AppCard>
          <SectionTitle title="Ultime attività" subtitle="Sedute e partite più recenti" />

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
        )}

        {widgets.quickActions && (
        <AppCard>
          <SectionTitle title="Azioni rapide" subtitle="Crea o consulta velocemente" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: 12,
            }}
          >
            <QuickAction label="Rosa" icon="👥" onClick={() => navigate("/players")} />
            <QuickAction label="Esercizi" icon="🎯" onClick={() => navigate("/exercises")} />
            <QuickAction label="Sedute" icon="📋" onClick={() => navigate("/trainings")} />
            <QuickAction label="Match Day" icon="⚽" onClick={() => navigate("/match-day")} />
            <QuickAction label="Lavori fisici" icon="🏃" onClick={() => navigate("/physical-workouts")} />
            <QuickAction label="Generatore" icon="🧩" onClick={() => navigate("/session-generator")} />
          </div>
        </AppCard>
        )}
      </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, note }) {
  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ color: "#94a3b8", margin: 0, fontWeight: 800 }}>
            {label}
          </p>

          <h2 style={{ fontSize: 34, margin: "8px 0" }}>
            {value}
          </h2>

          <p style={{ color: "#64748b", margin: 0 }}>
            {note}
          </p>
        </div>

        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            background: "rgba(56,189,248,0.12)",
            fontSize: 26,
          }}
        >
          {icon}
        </div>
      </div>
    </AppCard>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>{subtitle}</p>
    </div>
  );
}

function FocusItem({ label, title, meta, tone }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Badge tone={tone}>{label}</Badge>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <p style={{ color: "#94a3b8", margin: 0 }}>{meta}</p>
    </div>
  );
}

function MiniStatus({ label, value, tone }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Badge tone={tone}>{label}</Badge>

      <h2 style={{ marginBottom: 0 }}>
        {value}
      </h2>
    </div>
  );
}

function QuickAction({ label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 18,
        padding: 18,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "white",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <strong>{label}</strong>
    </button>
  );
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default Dashboard;
