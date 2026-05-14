import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";

import {
  formatDate,
  formatShortDate,
  getBillingStatus,
  getCoachAlerts,
  getCoachRewardProfile,
  getCurrentUserRole,
  getPhysicalReference,
  getPlayerSummary,
  getSetupProgress,
  getSubscriptionPlan,
  normalizeAppSettings,
} from "../utils/helpers";

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
  const currentRole = getCurrentUserRole(settings);
  const reward = getCoachRewardProfile({ players, exercises, sessions, matches, physicalTests });
  const plan = getSubscriptionPlan(settings);
  const setup = getSetupProgress({ players, exercises, sessions, matches, appSettings: settings });
  const billing = getBillingStatus(settings);

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
            rewardCenter: "Reward",
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

      {(billing.trialActive || billing.trialExpired || billing.billingStatus === "free") && (
        <AppCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <Badge tone={billing.trialActive ? "orange" : billing.trialExpired ? "red" : "blue"}>
                {billing.trialActive ? "Trial" : billing.trialExpired ? "Trial scaduto" : "Free"}
              </Badge>
              <h2 style={{ margin: "12px 0 6px" }}>
                {billing.trialActive
                  ? `${billing.trialDaysLeft} giorni rimasti di prova ${billing.effectivePlan.name}`
                  : billing.trialExpired
                  ? "Riattiva un piano per sbloccare le funzioni avanzate"
                  : "Avvia una prova Premium o Club"}
              </h2>
              <p style={{ color: "#94a3b8", margin: 0 }}>
                Il billing e' simulato ma pronto per Stripe: status, periodo, price e subscription id sono gia' nel modello.
              </p>
            </div>
            <Button onClick={() => navigate("/premium")}>
              Gestisci piano
            </Button>
          </div>
        </AppCard>
      )}

      <AppCard>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
          <div>
            <Badge tone={setup.percent >= 70 ? "green" : "orange"}>Setup {setup.percent}%</Badge>
            <h2 style={{ margin: "12px 0 6px" }}>
              {setup.next ? setup.next.label : "Workspace pronto"}
            </h2>
            <p style={{ color: "#94a3b8", margin: 0 }}>
              {setup.completed}/{setup.total} passaggi completati per rendere CalcioLab pronto a staff, giocatori e club.
            </p>
            <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 14 }}>
              <div style={{ width: `${setup.percent}%`, height: "100%", background: "linear-gradient(135deg,#22c55e,#38bdf8)" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => navigate("/onboarding")}>Onboarding</Button>
            <Button onClick={() => navigate(setup.next?.path || "/club-settings")}>
              Prossimo passo
            </Button>
          </div>
        </div>
      </AppCard>

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

      {widgets.rewardCenter && (
        <AppCard>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 18, alignItems: "center" }}>
            <div>
              <Badge tone="purple">Piano {plan.name}</Badge>
              <h2 style={{ margin: "12px 0 6px" }}>
                Livello {reward.level} - {reward.title}
              </h2>
              <p style={{ color: "#94a3b8", margin: 0 }}>
                {reward.points} punti attivita' · sconto potenziale {reward.discount}%.
              </p>
              <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 14 }}>
                <div style={{ width: `${reward.progress}%`, height: "100%", background: "linear-gradient(135deg,#22c55e,#38bdf8)" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
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

function PlayerRoleDashboard({ players, sessions, matches, physicalTests, appSettings }) {
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
          <h2 style={roleDashboardStyles.heroTitle}>{player?.name || "Giocatore"}</h2>
          <p style={roleDashboardStyles.muted}>
            {player?.role || "Ruolo non definito"} {player?.shirtNumber ? `· #${player.shirtNumber}` : ""}
          </p>
          <div style={roleDashboardStyles.kpiGrid}>
            <MiniStatus label="Minuti" value={summary.stats.minutes} tone="blue" />
            <MiniStatus label="Gol" value={summary.stats.goals} tone="green" />
            <MiniStatus label="Assist" value={summary.stats.assists} tone="purple" />
          </div>
        </AppCard>

        <AppCard>
          <SectionTitle title="Programma personale" subtitle="Indicazioni assegnate dallo staff" />
          <p style={roleDashboardStyles.bodyText}>
            {program || "Nessun programma individuale assegnato. Controlla l'area giocatori dopo il prossimo aggiornamento dello staff."}
          </p>
          <Button onClick={() => navigate("/player-portal")}>Apri area giocatori</Button>
        </AppCard>
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle title="Profilo fisico" subtitle="Ultimo test e gruppo di lavoro" />
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
  const mainSponsor = hub.sponsors.find((sponsor) => String(sponsor.id) === String(hub.mainSponsorId));
  const recentMatches = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Dashboard Sponsor"
        subtitle="Visibilita, offerte community e report dedicati ai partner"
        badge="Vista Sponsor"
      />

      <div style={roleDashboardStyles.heroGrid}>
        <AppCard>
          <Badge tone="purple">Partner Club</Badge>
          <h2 style={roleDashboardStyles.heroTitle}>{mainSponsor?.name || "Sponsor principale da configurare"}</h2>
          <p style={roleDashboardStyles.muted}>
            {activeSponsors.length} sponsor attivi nel club.
          </p>
          <Button onClick={() => navigate("/sponsors")}>Apri sponsor hub</Button>
        </AppCard>

        <AppCard>
          <SectionTitle title="Offerta community" subtitle="Contenuto visibile a famiglie e squadra" />
          <p style={roleDashboardStyles.bodyText}>
            {mainSponsor?.offer || activeSponsors[0]?.offer || "Nessuna offerta sponsor ancora inserita."}
          </p>
        </AppCard>
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle title="Visibilita promessa" subtitle="Asset e spazi commerciali" />
          <p style={roleDashboardStyles.bodyText}>
            {mainSponsor?.visibility || "Dashboard, report PDF, pagina squadra e materiali club."}
          </p>
        </AppCard>

        <AppCard>
          <SectionTitle title="Ultime partite" subtitle="Contesto per report e comunicazioni" />
          <EventList events={recentMatches} emptyText="Nessuna partita registrata." />
        </AppCard>
      </div>
    </div>
  );
}

function PhysicalRoleDashboard({ players, matches, physicalTests, coachAlerts }) {
  const navigate = useNavigate();
  const testedPlayerIds = new Set(physicalTests.map((test) => String(test.playerId)));
  const untestedPlayers = players.filter((player) => !testedPlayerIds.has(String(player.id)));
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
        subtitle="Test, gruppi fisici, carichi e disponibilita della rosa"
        badge="Vista Prep."
      />

      <div style={roleDashboardStyles.kpiGrid}>
        <KpiCard label="Giocatori" value={players.length} icon="👥" note="Rosa monitorata" />
        <KpiCard label="Test registrati" value={physicalTests.length} icon="⏱️" note={`${untestedPlayers.length} da testare`} />
        <KpiCard label="Prossima gara" value={nextMatch ? formatShortDate(nextMatch.date) : "-"} icon="⚽" note={nextMatch?.opponent || "Da programmare"} />
      </div>

      <div style={roleDashboardStyles.twoColumns}>
        <AppCard>
          <SectionTitle title="Ultimi test" subtitle="Riferimenti per i lavori individuali" />
          {latestTests.length ? (
            <InfoRows
              rows={latestTests.map((test) => {
                const player = players.find((item) => String(item.id) === String(test.playerId));
                const reference = getPhysicalReference(test);
                return [player?.name || "Giocatore", `${reference.group} · ${reference.mas || "-"} km/h`];
              })}
            />
          ) : (
            <p style={roleDashboardStyles.muted}>Nessun test fisico registrato.</p>
          )}
          <Button onClick={() => navigate("/physical-tests")}>Aggiorna test</Button>
        </AppCard>

        <AppCard>
          <SectionTitle title="Alert fisici" subtitle="Priorita per la settimana" />
          {coachAlerts.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {coachAlerts.slice(0, 5).map((alert, index) => (
                <div key={`${alert.text}-${index}`} style={roleDashboardStyles.alertRow}>
                  <Badge tone={alert.tone}>{alert.tone}</Badge>
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
    gridTemplateColumns: "1fr 1fr",
    gap: 22,
    marginBottom: 22,
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
    borderRadius: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
  },
  eventRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  alertRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
};

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default Dashboard;
