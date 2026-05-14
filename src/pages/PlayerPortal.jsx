import { useMemo, useState } from "react";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import {
  formatShortDate,
  getCurrentUserRole,
  getPhysicalReference,
  getPlayerSummary,
  normalizeAppSettings,
} from "../utils/helpers";

export default function PlayerPortal({
  players = [],
  sessions = [],
  matches = [],
  physicalTests = [],
  appSettings = {},
  setAppSettings,
}) {
  const settings = normalizeAppSettings(appSettings);
  const portal = settings.playerPortal;
  const currentRole = getCurrentUserRole(settings);
  const isPlayerView = currentRole === "player";
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [draftProgram, setDraftProgram] = useState("");
  const [draftGoal, setDraftGoal] = useState("");
  const [draftNote, setDraftNote] = useState("");

  const selectedPlayer = players.find((player) =>
    sameId(player.id, selectedPlayerId || players[0]?.id)
  );
  const summary = getPlayerSummary(selectedPlayer, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const physicalReference = getPhysicalReference(latestTest, settings.coachParameters);
  const savedProgram = selectedPlayer ? portal.programs[selectedPlayer.id] || "" : "";
  const savedGoal = selectedPlayer ? portal.goals[selectedPlayer.id] || selectedPlayer.weeklyGoal || "" : "";
  const savedNote = selectedPlayer ? portal.staffNotes[selectedPlayer.id] || "" : "";
  const activeProgram = draftProgram || savedProgram;
  const activeGoal = draftGoal || savedGoal;
  const activeNote = draftNote || savedNote;

  const nextEvents = useMemo(
    () =>
      [...sessions, ...matches]
        .filter((event) => new Date(event.date) >= todayStart())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4),
    [sessions, matches]
  );

  const nextCallUps = useMemo(
    () =>
      selectedPlayer
        ? matches
          .filter((match) => new Date(match.date) >= todayStart())
          .filter((match) => (match.lineup?.calledUpIds || []).some((id) => sameId(id, selectedPlayer.id)))
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3)
        : [],
    [matches, selectedPlayer]
  );

  function updatePortal(patch) {
    setAppSettings?.({
      ...settings,
      playerPortal: {
        ...portal,
        ...patch,
      },
    });
  }

  function handlePlayerChange(playerId) {
    setSelectedPlayerId(playerId);
    setDraftProgram("");
    setDraftGoal("");
    setDraftNote("");
  }

  function savePlayerPortalData() {
    if (!selectedPlayer) return;

    updatePortal({
      programs: {
        ...portal.programs,
        [selectedPlayer.id]: activeProgram,
      },
      goals: {
        ...portal.goals,
        [selectedPlayer.id]: activeGoal,
      },
      staffNotes: {
        ...portal.staffNotes,
        [selectedPlayer.id]: activeNote,
      },
    });
    setDraftProgram("");
    setDraftGoal("");
    setDraftNote("");
  }

  return (
    <div style={portalStyles.page}>
      <PageHeader
        title={isPlayerView ? "La mia area" : "Area Giocatori"}
        subtitle={
          isPlayerView
            ? "Programma personale, prossimi impegni, rendimento e indicazioni dello staff."
            : "Gestisci programmi, obiettivi e comunicazioni che gli atleti vedranno nel portale Club."
        }
        badge="Piano Club"
      />

      {isPlayerView ? (
        <PlayerOnlyView
          selectedPlayer={selectedPlayer}
          summary={summary}
          latestTest={latestTest}
          physicalReference={physicalReference}
          nextEvents={nextEvents}
          nextCallUps={nextCallUps}
          portal={portal}
          activeProgram={savedProgram}
          activeGoal={savedGoal}
          activeNote={savedNote}
        />
      ) : (
        <StaffPortalView
          players={players}
          selectedPlayer={selectedPlayer}
          summary={summary}
          latestTest={latestTest}
          physicalReference={physicalReference}
          nextEvents={nextEvents}
          nextCallUps={nextCallUps}
          portal={portal}
          activeProgram={activeProgram}
          activeGoal={activeGoal}
          activeNote={activeNote}
          onUpdatePortal={updatePortal}
          onPlayerChange={handlePlayerChange}
          onProgramChange={setDraftProgram}
          onGoalChange={setDraftGoal}
          onNoteChange={setDraftNote}
          onSave={savePlayerPortalData}
        />
      )}
    </div>
  );
}

function StaffPortalView({
  players,
  selectedPlayer,
  summary,
  latestTest,
  physicalReference,
  nextEvents,
  nextCallUps,
  portal,
  activeProgram,
  activeGoal,
  activeNote,
  onUpdatePortal,
  onPlayerChange,
  onProgramChange,
  onGoalChange,
  onNoteChange,
  onSave,
}) {
  return (
    <div style={portalStyles.grid}>
      <AppCard title="Controllo staff" subtitle="Configura cosa vedranno gli atleti.">
        <label style={portalStyles.checkRow}>
          <span>
            <strong>Portale attivo</strong>
            <small>Mostra accesso giocatori quando il piano Club e' attivo.</small>
          </span>
          <input
            type="checkbox"
            checked={portal.enabled}
            onChange={(event) => onUpdatePortal({ enabled: event.target.checked })}
          />
        </label>

        <label style={portalStyles.label}>
          Messaggio spogliatoio
          <textarea
            value={portal.welcomeMessage}
            onChange={(event) => onUpdatePortal({ welcomeMessage: event.target.value })}
            style={{ ...styles.input, minHeight: 88 }}
          />
        </label>

        <label style={portalStyles.label}>
          Giocatore
          <select
            value={selectedPlayer?.id || ""}
            onChange={(event) => onPlayerChange(event.target.value)}
            style={styles.input}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} {player.role ? `- ${player.role}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={portalStyles.label}>
          Obiettivo individuale
          <input
            value={activeGoal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder="Es. Migliorare attacco profondita e continuita difensiva"
            style={styles.input}
          />
        </label>

        <label style={portalStyles.label}>
          Programma personalizzato
          <textarea
            value={activeProgram}
            onChange={(event) => onProgramChange(event.target.value)}
            placeholder="Es. 2 blocchi mobilita anche, 3 serie core, lavoro 15/15 gruppo B..."
            style={{ ...styles.input, minHeight: 118 }}
          />
        </label>

        <label style={portalStyles.label}>
          Nota staff visibile
          <textarea
            value={activeNote}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Es. Buona settimana, cura alimentazione e recupero post seduta."
            style={{ ...styles.input, minHeight: 92 }}
          />
        </label>

        <Button onClick={onSave} disabled={!selectedPlayer} style={{ width: "100%" }}>
          Salva area atleta
        </Button>
      </AppCard>

      <PlayerPreview
        title="Preview atleta"
        subtitle="Questa e' la vista sintetica pensata per il giocatore."
        selectedPlayer={selectedPlayer}
        summary={summary}
        latestTest={latestTest}
        physicalReference={physicalReference}
        nextEvents={nextEvents}
        nextCallUps={nextCallUps}
        portal={portal}
        activeProgram={activeProgram}
        activeGoal={activeGoal}
        activeNote={activeNote}
      />
    </div>
  );
}

function PlayerOnlyView({
  selectedPlayer,
  summary,
  latestTest,
  physicalReference,
  nextEvents,
  nextCallUps,
  portal,
  activeProgram,
  activeGoal,
  activeNote,
}) {
  return (
    <div style={portalStyles.playerOnlyLayout}>
      <PlayerPreview
        title="Benvenuto"
        subtitle="La vista e' limitata ai tuoi dati e ai contenuti condivisi dallo staff."
        selectedPlayer={selectedPlayer}
        summary={summary}
        latestTest={latestTest}
        physicalReference={physicalReference}
        nextEvents={nextEvents}
        nextCallUps={nextCallUps}
        portal={portal}
        activeProgram={activeProgram}
        activeGoal={activeGoal}
        activeNote={activeNote}
        compactHeader={false}
      />

      <div style={portalStyles.sideStack}>
        <AppCard title="Convocazioni" subtitle="Prossime partite in cui sei stato inserito.">
          {nextCallUps.length ? (
            <div style={portalStyles.list}>
              {nextCallUps.map((match) => (
                <EventRow key={match.id} event={match} />
              ))}
            </div>
          ) : (
            <p style={portalStyles.muted}>Nessuna convocazione futura registrata.</p>
          )}
        </AppCard>

        <AppCard title="Rendimento" subtitle="Sintesi dai dati inseriti dallo staff.">
          <div style={portalStyles.list}>
            {summary.recentEvents.length ? (
              summary.recentEvents.slice(0, 4).map(({ event, data }) => (
                <div key={`${event.id}-${selectedPlayer?.id}`} style={portalStyles.eventRow}>
                  <span>
                    <strong>{event.title}</strong>
                    <small>{formatShortDate(event.date)}</small>
                  </span>
                  <strong>{data.minutes || 0}'</strong>
                </div>
              ))
            ) : (
              <p style={portalStyles.muted}>I tuoi dati gara e seduta compariranno qui.</p>
            )}
          </div>
        </AppCard>
      </div>
    </div>
  );
}

function PlayerPreview({
  title,
  subtitle,
  selectedPlayer,
  summary,
  latestTest,
  physicalReference,
  nextEvents,
  nextCallUps,
  portal,
  activeProgram,
  activeGoal,
  activeNote,
  compactHeader = true,
}) {
  return (
    <AppCard title={title} subtitle={subtitle}>
      {selectedPlayer ? (
        <div style={portalStyles.playerPreview}>
          <div style={portalStyles.playerHeader}>
            <div>
              <Badge tone={selectedPlayer.status === "Disponibile" ? "green" : "orange"}>
                {selectedPlayer.status || "Disponibile"}
              </Badge>
              <h2 style={compactHeader ? portalStyles.playerName : portalStyles.playerNameLarge}>
                {selectedPlayer.name}
              </h2>
              <p style={portalStyles.muted}>
                {selectedPlayer.role || "Ruolo"} {selectedPlayer.shirtNumber ? `- #${selectedPlayer.shirtNumber}` : ""}
              </p>
            </div>
            <div style={portalStyles.avatar}>
              {selectedPlayer.name?.slice(0, 1) || "P"}
            </div>
          </div>

          <p style={portalStyles.message}>{portal.welcomeMessage}</p>

          <div style={portalStyles.kpis}>
            <MiniMetric label="Minuti" value={summary.stats.minutes} />
            <MiniMetric label="Gol" value={summary.stats.goals} />
            <MiniMetric label="Assist" value={summary.stats.assists} />
            <MiniMetric label="Carico" value={summary.stats.load} />
          </div>

          <div style={portalStyles.twoColumns}>
            <InfoBlock
              title="Obiettivo"
              rows={[
                ["Focus", activeGoal || "Da assegnare"],
                ["Nota staff", activeNote || "Nessuna nota"],
              ]}
            />
            <InfoBlock
              title="Profilo fisico"
              rows={[
                ["Ultimo test", latestTest ? formatShortDate(latestTest.date) : "Da testare"],
                ["Gruppo", physicalReference.group],
                ["MAS", physicalReference.mas ? `${physicalReference.mas} km/h` : "-"],
              ]}
            />
          </div>

          <div style={portalStyles.twoColumns}>
            <ProgramBlock text={activeProgram} />
            <PanelBlock
              title="Prossimi impegni"
              subtitle={nextCallUps.length ? "Hai convocazioni in calendario." : "Calendario personale."}
            >
              <div style={portalStyles.list}>
                {nextEvents.length ? (
                  nextEvents.map((event) => <EventRow key={event.id} event={event} />)
                ) : (
                  <p style={portalStyles.muted}>Nessun evento programmato.</p>
                )}
              </div>
            </PanelBlock>
          </div>

          {summary.alerts.length ? (
            <div style={portalStyles.alertBox}>
              {summary.alerts.map((alert) => (
                <Badge key={alert} tone="orange">{alert}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p style={portalStyles.muted}>Aggiungi giocatori alla rosa per vedere il portale.</p>
      )}
    </AppCard>
  );
}

function ProgramBlock({ text }) {
  return (
    <div style={portalStyles.programBox}>
      <strong>Programma assegnato</strong>
      <p>{text || "Nessun programma individuale assegnato."}</p>
    </div>
  );
}

function PanelBlock({ title, subtitle, children }) {
  return (
    <section style={portalStyles.panelBlock}>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      {children}
    </section>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div style={portalStyles.metric}>
      <span>{label}</span>
      <strong>{value || 0}</strong>
    </div>
  );
}

function InfoBlock({ title, rows }) {
  return (
    <div style={portalStyles.infoBlock}>
      <h3>{title}</h3>
      {rows.map(([label, value]) => (
        <div key={`${title}-${label}`} style={portalStyles.infoRow}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event }) {
  return (
    <div style={portalStyles.eventRow}>
      <span>
        <strong>{event.title}</strong>
        <small>{event.type || "Evento"}</small>
      </span>
      <strong>{formatShortDate(event.date)}</strong>
    </div>
  );
}

function sameId(a, b) {
  return String(a) === String(b);
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

const portalStyles = {
  page: { display: "grid", gap: 22 },
  grid: { display: "grid", gridTemplateColumns: "390px minmax(0,1fr)", gap: 22, alignItems: "start" },
  playerOnlyLayout: { display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(280px,0.65fr)", gap: 22, alignItems: "start" },
  sideStack: { display: "grid", gap: 18 },
  label: { display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", marginTop: 14 },
  checkRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  muted: { color: "#94a3b8", margin: 0 },
  playerPreview: { display: "grid", gap: 18 },
  playerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 },
  playerName: { margin: "12px 0 4px", fontSize: 24 },
  playerNameLarge: { margin: "12px 0 4px", fontSize: 34 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    fontSize: 30,
    fontWeight: 900,
  },
  message: {
    color: "#cbd5e1",
    lineHeight: 1.6,
    padding: 16,
    borderRadius: 8,
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.18)",
    margin: 0,
  },
  kpis: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 },
  metric: { padding: 14, borderRadius: 8, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 },
  infoBlock: { padding: 16, borderRadius: 8, background: "rgba(15,23,42,0.72)", border: "1px solid rgba(255,255,255,0.08)" },
  infoRow: { display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", color: "#cbd5e1", borderTop: "1px solid rgba(255,255,255,0.06)" },
  programBox: { padding: 16, borderRadius: 8, background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.2)" },
  panelBlock: { padding: 16, borderRadius: 8, background: "rgba(15,23,42,0.72)", border: "1px solid rgba(255,255,255,0.08)" },
  alertBox: { display: "flex", flexWrap: "wrap", gap: 8 },
  list: { display: "grid", gap: 10 },
  eventRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
};
