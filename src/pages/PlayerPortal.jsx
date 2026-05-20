import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import {
  createId,
  formatDate,
  formatShortDate,
  getCurrentUserRole,
  getPhysicalReference,
  getPlayerSummary,
  normalizeAppSettings,
  normalizeComm,
} from "../utils/helpers";

export default function PlayerPortal({
  players = [],
  sessions = [],
  matches = [],
  physicalTests = [],
  appSettings = {},
  setAppSettings,
}) {
  const { t } = useTranslation();
  const settings     = normalizeAppSettings(appSettings);
  const portal       = settings.playerPortal;
  const comms        = settings.communications || [];
  const currentRole  = getCurrentUserRole(settings);
  const isPlayerView = currentRole === "player";

  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [draftProgram, setDraftProgram] = useState("");
  const [draftGoal,    setDraftGoal]    = useState("");
  const [draftNote,    setDraftNote]    = useState("");
  const isMobile = useIsMobile();

  const selectedPlayer = players.find((p) =>
    sameId(p.id, selectedPlayerId || players[0]?.id)
  );

  const summary          = getPlayerSummary(selectedPlayer, { sessions, matches, physicalTests });
  const latestTest       = summary.latestTests[0];
  const physicalReference = getPhysicalReference(latestTest, settings.coachParameters);

  const savedProgram = selectedPlayer ? portal.programs[selectedPlayer.id] || "" : "";
  const savedGoal    = selectedPlayer ? portal.goals[selectedPlayer.id] || selectedPlayer?.weeklyGoal || "" : "";
  const savedNote    = selectedPlayer ? portal.staffNotes[selectedPlayer.id] || "" : "";

  const activeProgram = draftProgram || savedProgram;
  const activeGoal    = draftGoal    || savedGoal;
  const activeNote    = draftNote    || savedNote;

  const nextEvents = useMemo(
    () =>
      [...sessions, ...matches]
        .filter((e) => new Date(e.date) >= todayStart())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5),
    [sessions, matches]
  );

  // Convocazioni pubblicate per il giocatore selezionato
  const myConvocations = useMemo(
    () =>
      selectedPlayer
        ? matches
            .filter((m) => m.convocazione?.published)
            .filter((m) =>
              (m.convocazione.playerIds || []).map(String).includes(String(selectedPlayer.id))
            )
            .sort((a, b) => new Date(a.date) - new Date(b.date))
        : [],
    [matches, selectedPlayer]
  );

  // Tutte le convocazioni pubblicate (per la preview staff)
  const allPublishedConvocations = useMemo(
    () =>
      matches
        .filter((m) => m.convocazione?.published)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [matches]
  );

  function updatePortal(patch) {
    setAppSettings?.({ ...settings, playerPortal: { ...portal, ...patch } });
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
      programs:   { ...portal.programs,   [selectedPlayer.id]: activeProgram },
      goals:      { ...portal.goals,      [selectedPlayer.id]: activeGoal    },
      staffNotes: { ...portal.staffNotes, [selectedPlayer.id]: activeNote    },
    });
    setDraftProgram("");
    setDraftGoal("");
    setDraftNote("");
  }

  // Comunicazioni: aggiungi / elimina
  function addComm(comm) {
    setAppSettings?.({
      ...settings,
      communications: [normalizeComm({ ...comm, id: createId("comm") }), ...comms],
    });
  }

  function deleteComm(commId) {
    setAppSettings?.({
      ...settings,
      communications: comms.filter((c) => c.id !== commId),
    });
  }

  return (
    <div style={ps.page}>
      <PageHeader
        title={isPlayerView ? t("pages.playerPortal.myArea") : t("pages.playerPortal.title")}
        subtitle={
          isPlayerView
            ? "Convocazioni, programma personale, comunicazioni staff e rendimento."
            : "Gestisci convocazioni, comunicazioni, programmi individuali e anteprima portale."
        }
        badge={portal.enabled ? "Portale attivo" : "Portale spento"}
      />

      {isPlayerView ? (
        <PlayerView
          selectedPlayer={selectedPlayer}
          summary={summary}
          latestTest={latestTest}
          physicalReference={physicalReference}
          nextEvents={nextEvents}
          myConvocations={myConvocations}
          allPublishedConvocations={allPublishedConvocations}
          players={players}
          portal={portal}
          comms={comms}
          activeProgram={savedProgram}
          activeGoal={savedGoal}
          activeNote={savedNote}
          isMobile={isMobile}
        />
      ) : (
        <StaffView
          players={players}
          selectedPlayer={selectedPlayer}
          summary={summary}
          latestTest={latestTest}
          physicalReference={physicalReference}
          nextEvents={nextEvents}
          myConvocations={myConvocations}
          allPublishedConvocations={allPublishedConvocations}
          portal={portal}
          comms={comms}
          activeProgram={activeProgram}
          activeGoal={activeGoal}
          activeNote={activeNote}
          onUpdatePortal={updatePortal}
          onPlayerChange={handlePlayerChange}
          onProgramChange={setDraftProgram}
          onGoalChange={setDraftGoal}
          onNoteChange={setDraftNote}
          onSave={savePlayerPortalData}
          onAddComm={addComm}
          onDeleteComm={deleteComm}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Vista STAFF
// ─────────────────────────────────────────────
function StaffView({
  players, selectedPlayer, summary, latestTest, physicalReference,
  nextEvents, myConvocations, allPublishedConvocations,
  portal, comms,
  activeProgram, activeGoal, activeNote,
  onUpdatePortal, onPlayerChange, onProgramChange, onGoalChange, onNoteChange,
  onSave, onAddComm, onDeleteComm, isMobile,
}) {
  return (
    <div style={{ ...ps.staffLayout, gridTemplateColumns: isMobile ? "1fr" : "360px minmax(0,1fr)" }}>
      {/* Colonna sinistra: controlli */}
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        {/* Pannello controllo portale */}
        <AppCard>
          <h3 style={ps.sectionTitle}>Controllo portale</h3>

          <label style={ps.checkRow}>
            <span>
              <strong style={{ lineHeight: 1.2 }}>Portale attivo</strong>
              <small style={ps.small}>Visibile ai giocatori con piano Club.</small>
            </span>
            <input
              type="checkbox"
              checked={portal.enabled}
              onChange={(e) => onUpdatePortal({ enabled: e.target.checked })}
            />
          </label>

          <label style={ps.fieldLabel}>
            Messaggio spogliatoio
            <textarea
              value={portal.welcomeMessage}
              onChange={(e) => onUpdatePortal({ welcomeMessage: e.target.value })}
              style={{ ...styles.input, minHeight: 72, marginTop: 6 }}
            />
          </label>
        </AppCard>

        {/* Comunicazioni */}
        <CommPanel comms={comms} onAdd={onAddComm} onDelete={onDeleteComm} />

        {/* Programma individuale */}
        <AppCard>
          <h3 style={ps.sectionTitle}>Programma individuale</h3>

          <label style={ps.fieldLabel}>
            Giocatore
            <select
              value={selectedPlayer?.id || ""}
              onChange={(e) => onPlayerChange(e.target.value)}
              style={{ ...styles.input, marginTop: 6 }}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.role ? `· ${p.role}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={ps.fieldLabel}>
            Obiettivo individuale
            <input
              value={activeGoal}
              onChange={(e) => onGoalChange(e.target.value)}
              placeholder="Es. Migliorare attacco in profondità"
              style={{ ...styles.input, marginTop: 6 }}
            />
          </label>

          <label style={ps.fieldLabel}>
            Programma personalizzato
            <textarea
              value={activeProgram}
              onChange={(e) => onProgramChange(e.target.value)}
              placeholder="Es. 2 blocchi mobilità, 3 serie core, lavoro 15/15 gruppo B..."
              style={{ ...styles.input, minHeight: 100, marginTop: 6 }}
            />
          </label>

          <label style={ps.fieldLabel}>
            Nota staff visibile
            <textarea
              value={activeNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Es. Buona settimana, cura alimentazione e recupero."
              style={{ ...styles.input, minHeight: 72, marginTop: 6 }}
            />
          </label>

          <Button onClick={onSave} disabled={!selectedPlayer} style={{ width: "100%", marginTop: 10 }}>
            Salva area atleta
          </Button>
        </AppCard>
      </div>

      {/* Colonna destra: preview */}
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        {/* Convocazioni pubblicate */}
        <AppCard>
          <h3 style={ps.sectionTitle}>
            Convocazioni pubblicate
            <span style={ps.badge}>{allPublishedConvocations.length}</span>
          </h3>
          {allPublishedConvocations.length === 0 ? (
            <p style={ps.muted}>Nessuna convocazione pubblicata. Vai in Partite → Convoca.</p>
          ) : (
            <div style={ps.list}>
              {allPublishedConvocations.map((m) => (
                <ConvocazioneRow key={m.id} match={m} players={players} highlightId={null} showFull />
              ))}
            </div>
          )}
        </AppCard>

        {/* Preview atleta */}
        <PlayerPreviewCard
          selectedPlayer={selectedPlayer}
          summary={summary}
          latestTest={latestTest}
          physicalReference={physicalReference}
          nextEvents={nextEvents}
          myConvocations={myConvocations}
          portal={portal}
          comms={comms}
          activeProgram={activeProgram}
          activeGoal={activeGoal}
          activeNote={activeNote}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Vista GIOCATORE
// ─────────────────────────────────────────────
function PlayerView({
  selectedPlayer, summary, latestTest, physicalReference,
  nextEvents, myConvocations,
  players, portal, comms,
  activeProgram, activeGoal, activeNote, isMobile,
}) {
  const upcoming = myConvocations.filter(
    (m) => new Date(m.date) >= todayStart()
  );
  const past = myConvocations.filter(
    (m) => new Date(m.date) < todayStart()
  );

  return (
    <div style={{ ...ps.playerLayout, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.4fr) minmax(280px,0.6fr)" }}>
      {/* Colonna principale */}
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        {/* Welcome + stats */}
        <PlayerPreviewCard
          selectedPlayer={selectedPlayer}
          summary={summary}
          latestTest={latestTest}
          physicalReference={physicalReference}
          nextEvents={nextEvents}
          myConvocations={myConvocations}
          portal={portal}
          comms={comms}
          activeProgram={activeProgram}
          activeGoal={activeGoal}
          activeNote={activeNote}
          compact={false}
        />
      </div>

      {/* Colonna laterale */}
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        {/* Le mie convocazioni */}
        <AppCard>
          <h3 style={ps.sectionTitle}>
            Le mie convocazioni
            {upcoming.length > 0 && (
              <Badge tone="green" style={{ marginLeft: 8 }}>{upcoming.length} prossime</Badge>
            )}
          </h3>

          {upcoming.length === 0 && past.length === 0 ? (
            <p style={ps.muted}>Nessuna convocazione pubblicata dallo staff.</p>
          ) : (
            <div style={ps.list}>
              {upcoming.map((m) => (
                <ConvocazioneRow
                  key={m.id}
                  match={m}
                  players={players}
                  highlightId={selectedPlayer?.id}
                  showFull
                />
              ))}
              {past.length > 0 && (
                <>
                  <p style={{ ...ps.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em", margin: "8px 0 4px" }}>
                    Archivio
                  </p>
                  {past.slice(0, 3).map((m) => (
                    <ConvocazioneRow
                      key={m.id}
                      match={m}
                      players={players}
                      highlightId={selectedPlayer?.id}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </AppCard>

        {/* Comunicazioni */}
        {comms.length > 0 && (
          <AppCard>
            <h3 style={ps.sectionTitle}>Bacheca staff</h3>
            <div style={ps.list}>
              {comms.slice(0, 6).map((c) => (
                <CommCard key={c.id} comm={c} />
              ))}
            </div>
          </AppCard>
        )}

        {/* Rendimento */}
        <AppCard>
          <h3 style={ps.sectionTitle}>Rendimento recente</h3>
          {summary.recentEvents.length ? (
            <div style={ps.list}>
              {summary.recentEvents.slice(0, 5).map(({ event, data }) => (
                <div key={`${event.id}-${selectedPlayer?.id}`} style={ps.eventRow}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{event.title}</p>
                    <p style={{ ...ps.muted, fontSize: 12 }}>{formatShortDate(event.date)}</p>
                  </div>
                  <strong style={{ color: "#38bdf8" }}>{data.minutes || 0}&apos;</strong>
                </div>
              ))}
            </div>
          ) : (
            <p style={ps.muted}>I tuoi dati gara e seduta compariranno qui.</p>
          )}
        </AppCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pannello Comunicazioni (solo staff)
// ─────────────────────────────────────────────
function CommPanel({ comms, onAdd, onDelete }) {
  const [title,    setTitle]    = useState("");
  const [body,     setBody]     = useState("");
  const [priority, setPriority] = useState("info");

  function handleAdd() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), body: body.trim(), priority, date: new Date().toISOString().slice(0, 10) });
    setTitle("");
    setBody("");
    setPriority("info");
  }

  return (
    <AppCard>
      <h3 style={ps.sectionTitle}>
        Comunicazioni
        <span style={ps.badge}>{comms.length}</span>
      </h3>
      <p style={{ ...ps.muted, marginBottom: 14 }}>
        Annunci visibili a tutti i giocatori nel portale.
      </p>

      {/* Form nuovo annuncio */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <input
          style={styles.input}
          placeholder="Titolo comunicazione *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          style={{ ...styles.input, minHeight: 64, resize: "vertical" }}
          placeholder="Testo (opzionale)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <select
            style={{ ...styles.input, flex: 1 }}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="info">Info</option>
            <option value="urgent">Urgente</option>
          </select>
          <Button onClick={handleAdd} disabled={!title.trim()}>
            Pubblica
          </Button>
        </div>
      </div>

      {/* Lista comunicazioni */}
      {comms.length === 0 ? (
        <p style={ps.muted}>Nessuna comunicazione ancora pubblicata.</p>
      ) : (
        <div style={ps.list}>
          {comms.map((c) => (
            <div key={c.id} style={{
              ...ps.commCard,
              borderLeftColor: c.priority === "urgent" ? "#f87171" : "#38bdf8",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <Badge tone={c.priority === "urgent" ? "red" : "blue"}>
                      {c.priority === "urgent" ? "Urgente" : "Info"}
                    </Badge>
                    <span style={{ fontSize: 11, color: "#475569" }}>{formatShortDate(c.date)}</span>
                  </div>
                  <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{c.title}</strong>
                  {c.body && <p style={{ ...ps.muted, fontSize: 13, marginTop: 4 }}>{c.body}</p>}
                </div>
                <button
                  onClick={() => onDelete(c.id)}
                  style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: "2px 4px" }}
                  title="Elimina"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppCard>
  );
}

// ─────────────────────────────────────────────
// Riga convocazione (riutilizzabile)
// ─────────────────────────────────────────────
function ConvocazioneRow({ match, players, highlightId, showFull = false }) {
  const [expanded, setExpanded] = useState(false);
  const isFuture  = new Date(match.date) >= todayStart();
  const conv      = match.convocazione || {};
  const details   = conv.details || {};
  const pids      = (conv.playerIds || []).map(String);
  const isIn      = highlightId ? pids.includes(String(highlightId)) : null;
  const meetingInfo = [details.meetingTime, details.meetingPlace].filter(Boolean).join(" · ");

  const convocati = showFull
    ? pids.map((pid) => players.find((p) => String(p.id) === pid)).filter(Boolean)
    : [];

  return (
    <div style={{
      ...ps.convRow,
      borderColor: isIn === true
        ? "rgba(34,197,94,0.35)"
        : isIn === false
        ? "rgba(248,113,113,0.25)"
        : "rgba(255,255,255,0.07)",
      background: isIn === true
        ? "rgba(34,197,94,0.07)"
        : "rgba(255,255,255,0.03)",
    }}>
      <div style={ps.convHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {isFuture && isIn === true && (
              <Badge tone="green">✓ Sei convocato</Badge>
            )}
            {isFuture && isIn === false && (
              <Badge tone="red">Non convocato</Badge>
            )}
            {!isFuture && <Badge tone="blue">Archivio</Badge>}
          </div>
          <p style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 15 }}>
            CalcioLab <span style={{ color: "#64748b" }}>vs</span> {match.opponent}
          </p>
          <p style={{ ...ps.muted, fontSize: 13 }}>
            {formatDate(match.date)}
            {match.location && ` · ${match.location}`}
          </p>
          {(details.matchTime || meetingInfo || details.lockerRoom || details.kit) && (
            <div style={{ display: "grid", gap: 3, marginTop: 6 }}>
              {details.matchTime && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>Ora gara: {details.matchTime}</p>
              )}
              {meetingInfo && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>Raduno: {meetingInfo}</p>
              )}
              {details.lockerRoom && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>Spogliatoio: {details.lockerRoom}</p>
              )}
              {details.kit && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>Kit: {details.kit}</p>
              )}
            </div>
          )}
          {details.message && (
            <p style={{ ...ps.muted, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
              {details.message}
            </p>
          )}
          {conv.notes && (
            <p style={{ ...ps.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
              📋 {conv.notes}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
            {pids.length} convocati
          </span>
          {showFull && convocati.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}
            >
              {expanded ? "Nascondi lista" : "Vedi lista"}
            </button>
          )}
        </div>
      </div>

      {/* Lista completa convocati */}
      {showFull && expanded && convocati.length > 0 && (
        <div style={ps.convList}>
          {convocati.map((p, i) => {
            const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
            const isHighlighted = highlightId && String(p.id) === String(highlightId);
            return (
              <div key={p.id} style={{
                ...ps.convPlayer,
                background: isHighlighted ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
                border: isHighlighted ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
              }}>
                <span style={{ color: "#475569", fontSize: 11, width: 20, textAlign: "right" }}>{i + 1}</span>
                <span style={{ color: "#64748b", fontSize: 11, width: 28, textAlign: "center" }}>#{p.shirtNumber || "—"}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isHighlighted ? 800 : 500 }}>{name}</span>
                {p.role && <span style={{ color: "#475569", fontSize: 11 }}>{p.role}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card comunicazione (solo vista player)
// ─────────────────────────────────────────────
function CommCard({ comm }) {
  return (
    <div style={{
      ...ps.commCard,
      borderLeftColor: comm.priority === "urgent" ? "#f87171" : "#38bdf8",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <Badge tone={comm.priority === "urgent" ? "red" : "blue"}>
          {comm.priority === "urgent" ? "Urgente" : "Info"}
        </Badge>
        <span style={{ fontSize: 11, color: "#475569" }}>{formatShortDate(comm.date)}</span>
      </div>
      <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{comm.title}</strong>
      {comm.body && <p style={{ ...ps.muted, fontSize: 13, marginTop: 4 }}>{comm.body}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card preview atleta (condivisa staff/player)
// ─────────────────────────────────────────────
function PlayerPreviewCard({
  selectedPlayer, summary, latestTest, physicalReference,
  nextEvents, myConvocations,
  portal, comms,
  activeProgram, activeGoal, activeNote,
  compact = true,
}) {
  const upcomingConv = myConvocations.filter((m) => new Date(m.date) >= todayStart());

  return (
    <AppCard>
      <h3 style={{ ...ps.sectionTitle, marginBottom: 16 }}>
        {compact ? "Preview atleta" : "Benvenuto"}
      </h3>

      {!selectedPlayer ? (
        <p style={ps.muted}>Aggiungi giocatori alla rosa per vedere il portale.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Header giocatore */}
          <div style={ps.playerHeader}>
            <div style={ps.avatar}>{selectedPlayer.name?.slice(0, 1) || "P"}</div>
            <div>
              <Badge tone={selectedPlayer.status === "Disponibile" ? "green" : "orange"}>
                {selectedPlayer.status || "Disponibile"}
              </Badge>
              <h2 style={{ margin: "8px 0 4px", fontSize: compact ? 22 : 30, lineHeight: 1.08 }}>
                {selectedPlayer.name}
              </h2>
              <p style={ps.muted}>
                {selectedPlayer.role || "Ruolo"}{selectedPlayer.shirtNumber ? ` · #${selectedPlayer.shirtNumber}` : ""}
              </p>
            </div>
          </div>

          {/* Messaggio spogliatoio */}
          {portal.welcomeMessage && (
            <p style={ps.welcomeMsg}>{portal.welcomeMessage}</p>
          )}

          {/* KPI */}
          <div style={ps.kpiGrid}>
            <MiniMetric label="Minuti"   value={summary.stats.minutes} />
            <MiniMetric label="Gol"      value={summary.stats.goals} />
            <MiniMetric label="Assist"   value={summary.stats.assists} />
            <MiniMetric label="Carico"   value={summary.stats.load} />
          </div>

          {/* Prossima convocazione */}
          {upcomingConv.length > 0 && (
            <div style={ps.convAlert}>
              <Badge tone="green">✓ Sei convocato</Badge>
              <p style={{ margin: "6px 0 2px", fontWeight: 700, lineHeight: 1.25 }}>
                {upcomingConv[0].opponent}
              </p>
              <p style={{ ...ps.muted, fontSize: 13 }}>
                {formatDate(upcomingConv[0].date)}
                {upcomingConv[0].location && ` · ${upcomingConv[0].location}`}
              </p>
              {upcomingConv[0].convocazione?.notes && (
                <p style={{ ...ps.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
                  📋 {upcomingConv[0].convocazione.notes}
                </p>
              )}
            </div>
          )}

          {/* Obiettivo + profilo fisico */}
          <div style={ps.twoCol}>
            <div style={ps.infoBlock}>
              <p style={ps.infoTitle}>Obiettivo</p>
              <p style={ps.infoValue}>{activeGoal || "Da assegnare"}</p>
              {activeNote && (
                <>
                  <p style={{ ...ps.infoTitle, marginTop: 10 }}>Nota staff</p>
                  <p style={ps.infoValue}>{activeNote}</p>
                </>
              )}
            </div>
            <div style={ps.infoBlock}>
              <p style={ps.infoTitle}>Profilo fisico</p>
              <InfoRow label="Ultimo test" value={latestTest ? formatShortDate(latestTest.date) : "Da testare"} />
              <InfoRow label="Gruppo"      value={physicalReference.group} />
              <InfoRow label="MAS"         value={physicalReference.mas ? `${physicalReference.mas} km/h` : "—"} />
            </div>
          </div>

          {/* Programma */}
          {activeProgram && (
            <div style={ps.programBox}>
              <p style={ps.infoTitle}>Programma assegnato</p>
              <p style={{ color: "#cbd5e1", lineHeight: 1.6, margin: 0, fontSize: 14 }}>{activeProgram}</p>
            </div>
          )}

          {/* Prossimi eventi */}
          <div style={ps.infoBlock}>
            <p style={ps.infoTitle}>Prossimi impegni</p>
            {nextEvents.length ? (
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                {nextEvents.map((e) => (
                  <div key={e.id} style={ps.eventRow}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, lineHeight: 1.25 }}>{e.title}</p>
                      <p style={{ ...ps.muted, fontSize: 11 }}>{e.type || "Evento"}</p>
                    </div>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{formatShortDate(e.date)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ ...ps.muted, marginTop: 6 }}>Nessun evento programmato.</p>
            )}
          </div>

          {/* Comunicazioni */}
          {comms.length > 0 && (
            <div>
              <p style={{ ...ps.infoTitle, marginBottom: 8 }}>Bacheca staff</p>
              {comms.slice(0, 3).map((c) => <CommCard key={c.id} comm={c} />)}
            </div>
          )}
        </div>
      )}
    </AppCard>
  );
}

// ─────────────────────────────────────────────
// Micro-componenti
// ─────────────────────────────────────────────
function MiniMetric({ label, value }) {
  return (
    <div style={ps.metric}>
      <p style={{ margin: "0 0 4px", color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}</p>
      <strong style={{ fontSize: 22 }}>{value || 0}</strong>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────
function sameId(a, b) { return String(a) === String(b); }
function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const ps = {
  page:        { display: "grid", gap: 20 },
  staffLayout: { display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: 20, alignItems: "start" },
  playerLayout:{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(280px,0.6fr)", gap: 20, alignItems: "start" },

  sectionTitle: { margin: "0 0 2px", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.2 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    borderRadius: 8,
    background: "rgba(255,255,255,0.1)",
    fontSize: 11,
    fontWeight: 800,
    padding: "0 6px",
    color: "#94a3b8",
  },
  small:    { display: "block", color: "#64748b", fontSize: 12, marginTop: 2, lineHeight: 1.35 },
  muted:    { color: "#94a3b8", margin: 0, lineHeight: 1.45 },
  fieldLabel: { display: "grid", gap: 0, color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, marginTop: 14 },
  checkRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 12, padding: 12, borderRadius: 10,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 10,
  },

  list:   { display: "grid", gap: 10 },

  // Preview card
  playerHeader: { display: "flex", gap: 14, alignItems: "center" },
  avatar: {
    width: 54, height: 54, borderRadius: 12, flexShrink: 0,
    display: "grid", placeItems: "center",
    background: "linear-gradient(135deg,#2563eb,#38bdf8)",
    fontSize: 24, fontWeight: 900,
  },
  welcomeMsg: {
    color: "#cbd5e1", lineHeight: 1.6, padding: "12px 14px",
    borderRadius: 10, margin: 0,
    background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)",
  },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 10 },
  metric:  { padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" },
  twoCol:  { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 },
  infoBlock: { padding: 14, borderRadius: 12, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)" },
  infoTitle: { margin: "0 0 6px", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0, color: "#475569" },
  infoValue: { margin: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 },
  programBox: { padding: 14, borderRadius: 12, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" },
  eventRow: {
    display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center",
    padding: "8px 10px", borderRadius: 8,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
  },

  // Convocazione alert (nel preview)
  convAlert: {
    padding: 14, borderRadius: 12,
    background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.25)",
  },

  // Riga convocazione
  convRow: {
    borderRadius: 12, padding: 14,
    border: "1px solid",
    display: "grid", gap: 10,
  },
  convHeader: { display: "flex", gap: 12, alignItems: "flex-start" },
  convList:   { display: "grid", gap: 4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" },
  convPlayer: {
    display: "flex", gap: 8, alignItems: "center",
    padding: "5px 8px", borderRadius: 8,
  },

  // Comunicazione
  commCard: {
    padding: "10px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderLeft: "3px solid",
  },
};
