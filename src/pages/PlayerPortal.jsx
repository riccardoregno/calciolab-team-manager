import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { respondRsvpAsPlayer } from "../services/rsvp";
import { fetchPlayerAvailability, setPlayerAvailability } from "../services/playerAvailability";
import { touchPlayerPortalActivity } from "../services/playerPortalActivity";
import { getPreventionRecommendations } from "../components/players/playerDetailLogic";

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
  teamId = null,
  myPlayerId = null,
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

  const selectedPlayer = isPlayerView
    ? players.find((p) => sameId(p.id, myPlayerId)) || (myPlayerId ? null : players.find((p) => sameId(p.id, players[0]?.id)))
    : players.find((p) => sameId(p.id, selectedPlayerId || players[0]?.id));

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
            ? t("pages.playerPortal.subtitlePlayer")
            : t("pages.playerPortal.subtitle")
        }
        badge={portal.enabled ? t("pages.playerPortal.badgeActive") : t("pages.playerPortal.badgeOff")}
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
          physicalTests={physicalTests}
          activeProgram={savedProgram}
          activeGoal={savedGoal}
          activeNote={savedNote}
          isMobile={isMobile}
          teamId={teamId}
          myPlayerId={myPlayerId}
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
  const { t } = useTranslation();
  return (
    <div style={{ ...ps.staffLayout, gridTemplateColumns: isMobile ? "1fr" : "360px minmax(0,1fr)" }}>
      {/* Colonna sinistra: controlli */}
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        {/* Pannello controllo portale */}
        <AppCard>
          <h3 style={ps.sectionTitle}>{t("pages.playerPortal.portalControlTitle")}</h3>

          <label style={ps.checkRow}>
            <span>
              <strong style={{ lineHeight: 1.2 }}>{t("pages.playerPortal.portalEnabledLabel")}</strong>
              <small style={ps.small}>{t("pages.playerPortal.portalEnabledDesc")}</small>
            </span>
            <input
              type="checkbox"
              checked={portal.enabled}
              onChange={(e) => onUpdatePortal({ enabled: e.target.checked })}
            />
          </label>

          <label style={ps.fieldLabel}>
            {t("pages.playerPortal.welcomeMessageLabel")}
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
          <h3 style={ps.sectionTitle}>{t("pages.playerPortal.programTitle")}</h3>

          <label style={ps.fieldLabel}>
            {t("pages.playerPortal.fieldPlayer")}
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
            {t("pages.playerPortal.fieldGoal")}
            <input
              value={activeGoal}
              onChange={(e) => onGoalChange(e.target.value)}
              placeholder={t("pages.playerPortal.goalPlaceholder")}
              style={{ ...styles.input, marginTop: 6 }}
            />
          </label>

          <label style={ps.fieldLabel}>
            {t("pages.playerPortal.fieldProgram")}
            <textarea
              value={activeProgram}
              onChange={(e) => onProgramChange(e.target.value)}
              placeholder={t("pages.playerPortal.programPlaceholder")}
              style={{ ...styles.input, minHeight: 100, marginTop: 6 }}
            />
          </label>

          <label style={ps.fieldLabel}>
            {t("pages.playerPortal.fieldNote")}
            <textarea
              value={activeNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t("pages.playerPortal.notePlaceholder")}
              style={{ ...styles.input, minHeight: 72, marginTop: 6 }}
            />
          </label>

          <Button onClick={onSave} disabled={!selectedPlayer} style={{ width: "100%", marginTop: 10 }}>
            {t("pages.playerPortal.saveArea")}
          </Button>
        </AppCard>
      </div>

      {/* Colonna destra: preview */}
      <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
        {/* Convocazioni pubblicate */}
        <AppCard>
          <h3 style={ps.sectionTitle}>
            {t("pages.playerPortal.convPublishedTitle")}
            <span style={ps.badge}>{allPublishedConvocations.length}</span>
          </h3>
          {allPublishedConvocations.length === 0 ? (
            <p style={ps.muted}>{t("pages.playerPortal.convNone")}</p>
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
  players, portal, comms, physicalTests,
  activeProgram, activeGoal, activeNote, isMobile,
  teamId, myPlayerId,
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("home");
  const [rsvpMap, setRsvpMap] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [availSaving, setAvailSaving] = useState(false);
  const [availReason, setAvailReason] = useState("");
  const mountedRef = useRef(true);

  const injuryHistory = useMemo(
    () => [...(selectedPlayer?.injuries || [])].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)),
    [selectedPlayer]
  );
  const activeInjuries = injuryHistory.filter((inj) => !inj.endDate);
  const preventionRecs = useMemo(
    () => getPreventionRecommendations(injuryHistory, selectedPlayer),
    [injuryHistory, selectedPlayer]
  );
  const myPhysicalTests = useMemo(
    () => (physicalTests || [])
      .filter((t) => String(t.playerId) === String(selectedPlayer?.id))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    [physicalTests, selectedPlayer]
  );

  const fetchRsvps = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId || !myPlayerId) return;
    const { data } = await supabase
      .from("rsvp_tokens")
      .select("match_id, response, responded_at")
      .eq("team_id", teamId)
      .eq("player_id", String(myPlayerId));
    if (!mountedRef.current || !data) return;
    const map = {};
    data.forEach((r) => { map[String(r.match_id)] = r; });
    setRsvpMap(map);
  }, [teamId, myPlayerId]);

  const fetchAvailability = useCallback(async () => {
    if (!teamId || !myPlayerId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await fetchPlayerAvailability({ teamId, playerId: myPlayerId });
    if (!mountedRef.current) return;
    const current = (data || []).find((r) => r.date_from === today && !r.date_to) || null;
    setAvailability(current);
    setAvailReason(current?.reason || "");
  }, [teamId, myPlayerId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchRsvps();
    fetchAvailability();
    return () => { mountedRef.current = false; };
  }, [fetchRsvps, fetchAvailability]);

  useEffect(() => {
    if (!teamId || !myPlayerId) return undefined;
    touchPlayerPortalActivity({ teamId, playerId: myPlayerId, increment: true });
    const intervalId = window.setInterval(() => {
      touchPlayerPortalActivity({ teamId, playerId: myPlayerId, increment: false });
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [teamId, myPlayerId]);

  async function handleAvailability(status) {
    if (availSaving || !teamId || !myPlayerId) return;
    setAvailSaving(true);
    setAvailability((prev) => ({ ...(prev || {}), status, reason: availReason }));
    const { error } = await setPlayerAvailability({ teamId, playerId: myPlayerId, status, reason: availReason });
    if (!error) await fetchAvailability();
    setAvailSaving(false);
  }

  async function handleRsvp(matchId, response) {
    if (savingId || !teamId || !myPlayerId) return;
    setSavingId(String(matchId));
    setRsvpMap((prev) => ({ ...prev, [String(matchId)]: { response, responded_at: new Date().toISOString() } }));
    const { error } = await respondRsvpAsPlayer({ teamId, matchId: String(matchId), playerId: String(myPlayerId), response });
    if (error) {
      setRsvpMap((prev) => { const next = { ...prev }; delete next[String(matchId)]; return next; });
    }
    setSavingId(null);
  }

  const upcoming = myConvocations.filter((m) => new Date(m.date) >= todayStart());
  const past     = myConvocations.filter((m) => new Date(m.date) < todayStart());

  const TABS = [
    { id: "home",          label: "Home",          icon: "🏠" },
    { id: "convocazioni",  label: "Convocazioni",  icon: "📅", badge: upcoming.length || null },
    { id: "fisico",        label: "Fisico",        icon: "💪" },
    { id: "medico",        label: "Medico",        icon: "🩺", badge: activeInjuries.length || null },
    { id: "comunicazioni", label: "Comunicazioni", icon: "📢", badge: comms.length || null },
  ];

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* ── Header profilo ── */}
      <div style={ps.playerHeader2}>
        <div style={ps.avatar}>{selectedPlayer?.name?.slice(0, 1) || "P"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <Badge tone={selectedPlayer?.status === "Disponibile" || !selectedPlayer?.status ? "green" : "orange"}>
              {selectedPlayer?.status || "Disponibile"}
            </Badge>
            {activeInjuries.length > 0 && (
              <Badge tone="red">{activeInjuries.length} infortun{activeInjuries.length === 1 ? "io" : "i"} attiv{activeInjuries.length === 1 ? "o" : "i"}</Badge>
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 900, lineHeight: 1.08 }}>
            {selectedPlayer?.name || "Giocatore"}
          </h2>
          <p style={{ ...ps.muted, fontSize: 13, margin: "2px 0 0" }}>
            {selectedPlayer?.role || "—"}{selectedPlayer?.shirtNumber ? ` · #${selectedPlayer.shirtNumber}` : ""}
          </p>
        </div>
        {/* Disponibilità mini-toggle */}
        <div style={ps.availMini}>
          <p style={{ ...ps.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", margin: "0 0 6px" }}>Disponibilità</p>
          <div style={{ display: "flex", gap: 5 }}>
            {["available", "doubtful", "unavailable"].map((s) => {
              const active = availability?.status === s;
              const color = s === "available" ? "#4ade80" : s === "doubtful" ? "#fb923c" : "#f87171";
              const bg    = s === "available" ? "rgba(34,197,94,0.18)" : s === "doubtful" ? "rgba(251,146,60,0.18)" : "rgba(248,113,113,0.18)";
              return (
                <button key={s} onClick={() => handleAvailability(s)} disabled={availSaving}
                  title={s === "available" ? "Disponibile" : s === "doubtful" ? "In dubbio" : "Non disponibile"}
                  style={{ ...ps.availDot, background: active ? bg : "rgba(255,255,255,0.04)", border: `1px solid ${active ? color : "rgba(255,255,255,0.1)"}`, color: active ? color : "#475569", opacity: availSaving ? 0.6 : 1 }}>
                  {s === "available" ? "✅" : s === "doubtful" ? "🟡" : "❌"}
                </button>
              );
            })}
          </div>
          {availability?.status && (
            <input
              style={{ ...styles.input, fontSize: 11, marginTop: 6, padding: "4px 8px" }}
              placeholder="Motivazione..."
              value={availReason}
              onChange={(e) => setAvailReason(e.target.value)}
              onBlur={() => availability?.status && handleAvailability(availability.status)}
            />
          )}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={ps.kpiStrip}>
        {[
          { label: "Presenze",  value: summary.stats.presences },
          { label: "Minuti",    value: summary.stats.minutes   },
          { label: "Gol",       value: summary.stats.goals     },
          { label: "Assist",    value: summary.stats.assists   },
          { label: "Carico",    value: summary.stats.load      },
        ].map(({ label, value }) => (
          <div key={label} style={ps.kpiItem}>
            <p style={{ margin: "0 0 2px", color: "#64748b", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{label}</p>
            <strong style={{ fontSize: 20, lineHeight: 1 }}>{value || 0}</strong>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div style={ps.tabBar}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            ...ps.tabBtn,
            color: activeTab === tab.id ? "#f8fafc" : "#64748b",
            borderBottom: `2px solid ${activeTab === tab.id ? "#2563eb" : "transparent"}`,
          }}>
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {!isMobile && <span>{tab.label}</span>}
            {tab.badge ? (
              <span style={{ ...ps.tabBadge, background: activeTab === tab.id ? "#2563eb" : "rgba(255,255,255,0.1)" }}>
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ paddingTop: 20, display: "grid", gap: 18 }}>

        {/* HOME */}
        {activeTab === "home" && (
          <>
            {portal.welcomeMessage && (
              <div style={ps.welcomeMsg}>{portal.welcomeMessage}</div>
            )}
            {/* Prossima convocazione */}
            {upcoming[0] && (
              <AppCard>
                <h3 style={{ ...ps.sectionTitle, marginBottom: 10 }}>Prossima partita</h3>
                <ConvocazioneRow match={upcoming[0]} players={players} highlightId={selectedPlayer?.id} showFull />
                <RsvpButtons matchId={upcoming[0].id} rsvp={rsvpMap[String(upcoming[0].id)]} saving={savingId === String(upcoming[0].id)} onRespond={handleRsvp} t={t} />
              </AppCard>
            )}
            {/* Obiettivo + programma */}
            {(activeGoal || activeProgram || activeNote) && (
              <AppCard>
                {activeGoal && (
                  <div style={{ marginBottom: activeProgram || activeNote ? 14 : 0 }}>
                    <p style={ps.infoTitle}>Obiettivo settimana</p>
                    <p style={{ ...ps.infoValue, fontSize: 15 }}>{activeGoal}</p>
                  </div>
                )}
                {activeProgram && (
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", marginBottom: activeNote ? 12 : 0 }}>
                    <p style={ps.infoTitle}>Programma assegnato</p>
                    <p style={{ color: "#cbd5e1", lineHeight: 1.6, margin: 0, fontSize: 14 }}>{activeProgram}</p>
                  </div>
                )}
                {activeNote && (
                  <div>
                    <p style={ps.infoTitle}>Nota staff</p>
                    <p style={{ ...ps.infoValue }}>{activeNote}</p>
                  </div>
                )}
              </AppCard>
            )}
            {/* Prossimi eventi */}
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 10 }}>Prossimi impegni</h3>
              {nextEvents.length ? (
                <div style={ps.list}>
                  {nextEvents.map((e) => (
                    <div key={e.id} style={ps.eventRow}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{e.title}</p>
                        <p style={{ ...ps.muted, fontSize: 11 }}>{e.type || "Evento"}</p>
                      </div>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>{formatShortDate(e.date)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={ps.muted}>Nessun impegno nei prossimi giorni.</p>
              )}
            </AppCard>
            {/* Rendimento recente */}
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 10 }}>Rendimento recente</h3>
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
                <p style={ps.muted}>Nessun evento recente registrato.</p>
              )}
            </AppCard>
          </>
        )}

        {/* CONVOCAZIONI */}
        {activeTab === "convocazioni" && (
          <AppCard>
            <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>
              Le mie convocazioni
              {upcoming.length > 0 && <Badge tone="green" style={{ marginLeft: 8 }}>{upcoming.length} in arrivo</Badge>}
            </h3>
            {upcoming.length === 0 && past.length === 0 ? (
              <p style={ps.muted}>Nessuna convocazione pubblicata.</p>
            ) : (
              <div style={ps.list}>
                {upcoming.map((m) => (
                  <div key={m.id}>
                    <ConvocazioneRow match={m} players={players} highlightId={selectedPlayer?.id} showFull />
                    <RsvpButtons matchId={m.id} rsvp={rsvpMap[String(m.id)]} saving={savingId === String(m.id)} onRespond={handleRsvp} t={t} />
                  </div>
                ))}
                {past.length > 0 && (
                  <>
                    <p style={{ ...ps.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em", margin: "8px 0 4px" }}>
                      Archivio
                    </p>
                    {past.slice(0, 5).map((m) => (
                      <div key={m.id}>
                        <ConvocazioneRow match={m} players={players} highlightId={selectedPlayer?.id} />
                        <RsvpButtons matchId={m.id} rsvp={rsvpMap[String(m.id)]} saving={savingId === String(m.id)} onRespond={handleRsvp} t={t} archived />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </AppCard>
        )}

        {/* FISICO */}
        {activeTab === "fisico" && (
          <>
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>Profilo fisico</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
                <div style={ps.infoBlock}>
                  <p style={ps.infoTitle}>Ultimo test</p>
                  <p style={ps.infoValue}>{latestTest ? formatShortDate(latestTest.date) : "Da testare"}</p>
                </div>
                <div style={ps.infoBlock}>
                  <p style={ps.infoTitle}>Gruppo</p>
                  <p style={ps.infoValue}>{physicalReference.group || "Da testare"}</p>
                </div>
                <div style={ps.infoBlock}>
                  <p style={ps.infoTitle}>MAS</p>
                  <p style={ps.infoValue}>{physicalReference.mas ? `${physicalReference.mas} km/h` : "—"}</p>
                </div>
              </div>
            </AppCard>
            {myPhysicalTests.length > 0 && (
              <AppCard>
                <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>Storico test fisici</h3>
                <div style={ps.list}>
                  {myPhysicalTests.map((test) => (
                    <div key={test.id} style={{ ...ps.eventRow, alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{formatShortDate(test.date)}</p>
                        <p style={{ ...ps.muted, fontSize: 12 }}>Gruppo {test.group || "—"}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: "#38bdf8", fontSize: 15 }}>{test.mas ? `${test.mas} km/h` : "—"}</strong>
                        {test.vo2max && <p style={{ ...ps.muted, fontSize: 11, margin: 0 }}>VO₂max {test.vo2max}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </AppCard>
            )}
          </>
        )}

        {/* MEDICO */}
        {activeTab === "medico" && (
          <>
            {/* Infortuni attivi */}
            {activeInjuries.length > 0 && (
              <AppCard>
                <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>
                  Infortuni attivi
                  <Badge tone="red">{activeInjuries.length}</Badge>
                </h3>
                <div style={ps.list}>
                  {activeInjuries.map((inj, i) => (
                    <div key={i} style={{ padding: 14, borderRadius: 12, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div>
                          <Badge tone="red" style={{ marginBottom: 6 }}>{inj.injuryType || "Infortunio"}</Badge>
                          {inj.differentiatedType && (
                            <p style={{ ...ps.muted, fontSize: 12, margin: "4px 0 0" }}>Tipo: {inj.differentiatedType}</p>
                          )}
                          {inj.startDate && (
                            <p style={{ ...ps.muted, fontSize: 12, margin: "2px 0 0" }}>Dal {formatShortDate(inj.startDate)}</p>
                          )}
                        </div>
                        {inj.expectedReturn && (
                          <div style={{ textAlign: "right" }}>
                            <p style={{ ...ps.muted, fontSize: 11, margin: 0 }}>Rientro previsto</p>
                            <strong style={{ color: "#fb923c", fontSize: 14 }}>{formatShortDate(inj.expectedReturn)}</strong>
                          </div>
                        )}
                      </div>
                      {inj.preventionPlan?.returnToPlayNotes && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <p style={ps.infoTitle}>Return to Play</p>
                          <p style={{ ...ps.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>{inj.preventionPlan.returnToPlayNotes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AppCard>
            )}

            {/* Prevenzione e Return to Play */}
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 4 }}>Prevenzione e Return to Play</h3>
              <p style={{ ...ps.muted, fontSize: 13, marginBottom: preventionRecs.length ? 14 : 0 }}>
                Schede rapide per gestire rischio ricaduta, recupero e lavoro individuale.
              </p>
              {preventionRecs.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
                  {preventionRecs.map((item) => (
                    <div key={item.key} style={{ padding: 14, borderRadius: 12, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                        <strong style={{ fontSize: 13, lineHeight: 1.3, color: "#f8fafc" }}>{item.title}</strong>
                        <span style={{ flexShrink: 0, color: "#38bdf8", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{item.reason}</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 5, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>
                        {item.points.map((pt, i) => <li key={i}>{pt}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 16, borderRadius: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", marginTop: 10 }}>
                  <p style={{ margin: 0, color: "#4ade80", fontWeight: 700, fontSize: 13 }}>Nessuna scheda di prevenzione attiva</p>
                  <p style={{ ...ps.muted, fontSize: 12, margin: "4px 0 0" }}>
                    Le schede compaiono automaticamente in base allo storico infortuni.
                  </p>
                </div>
              )}
            </AppCard>

            {/* Storico infortuni */}
            {injuryHistory.length > 0 && (
              <AppCard>
                <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>Storico infortuni</h3>
                <div style={ps.list}>
                  {injuryHistory.filter((inj) => inj.endDate).slice(0, 5).map((inj, i) => (
                    <div key={i} style={ps.eventRow}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{inj.injuryType || "Infortunio"}</p>
                        <p style={{ ...ps.muted, fontSize: 12 }}>
                          {formatShortDate(inj.startDate)} → {formatShortDate(inj.endDate)}
                        </p>
                      </div>
                      {inj.daysLost > 0 && (
                        <span style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>{inj.daysLost}gg</span>
                      )}
                    </div>
                  ))}
                </div>
              </AppCard>
            )}
          </>
        )}

        {/* COMUNICAZIONI */}
        {activeTab === "comunicazioni" && (
          <AppCard>
            <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>
              Comunicazioni
              {comms.length > 0 && <span style={ps.badge}>{comms.length}</span>}
            </h3>
            {comms.length === 0 ? (
              <p style={ps.muted}>Nessuna comunicazione pubblicata.</p>
            ) : (
              <div style={ps.list}>
                {comms.map((c) => <CommCard key={c.id} comm={c} />)}
              </div>
            )}
          </AppCard>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pannello Comunicazioni (solo staff)
// ─────────────────────────────────────────────
function CommPanel({ comms, onAdd, onDelete }) {
  const { t } = useTranslation();
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
        {t("pages.playerPortal.commTitle")}
        <span style={ps.badge}>{comms.length}</span>
      </h3>
      <p style={{ ...ps.muted, marginBottom: 14 }}>
        {t("pages.playerPortal.commDesc")}
      </p>

      {/* Form nuovo annuncio */}
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <input
          style={styles.input}
          placeholder={t("pages.playerPortal.commTitlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          style={{ ...styles.input, minHeight: 64, resize: "vertical" }}
          placeholder={t("pages.playerPortal.commBodyPlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <select
            style={{ ...styles.input, flex: 1 }}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="info">{t("pages.playerPortal.commPriorityInfo")}</option>
            <option value="urgent">{t("pages.playerPortal.commPriorityUrgent")}</option>
          </select>
          <Button onClick={handleAdd} disabled={!title.trim()}>
            {t("pages.playerPortal.commPublish")}
          </Button>
        </div>
      </div>

      {/* Lista comunicazioni */}
      {comms.length === 0 ? (
        <p style={ps.muted}>{t("pages.playerPortal.commNone")}</p>
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
                      {c.priority === "urgent" ? t("pages.playerPortal.commPriorityUrgent") : t("pages.playerPortal.commPriorityInfo")}
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
  const { t } = useTranslation();
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
              <Badge tone="green">{t("pages.playerPortal.convSelected")}</Badge>
            )}
            {isFuture && isIn === false && (
              <Badge tone="red">{t("pages.playerPortal.convNotSelected")}</Badge>
            )}
            {!isFuture && <Badge tone="blue">{t("pages.playerPortal.convArchive")}</Badge>}
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
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>{t("pages.playerPortal.matchTime")} {details.matchTime}</p>
              )}
              {meetingInfo && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>{t("pages.playerPortal.meetingLabel")} {meetingInfo}</p>
              )}
              {details.lockerRoom && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>{t("pages.playerPortal.lockerRoom")} {details.lockerRoom}</p>
              )}
              {details.kit && (
                <p style={{ ...ps.muted, fontSize: 12, margin: 0 }}>{t("pages.playerPortal.kitLabel")} {details.kit}</p>
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
            {t("pages.playerPortal.convCount", { count: pids.length })}
          </span>
          {showFull && convocati.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}
            >
              {expanded ? t("pages.playerPortal.convHideList") : t("pages.playerPortal.convShowList")}
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
  const { t } = useTranslation();
  return (
    <div style={{
      ...ps.commCard,
      borderLeftColor: comm.priority === "urgent" ? "#f87171" : "#38bdf8",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <Badge tone={comm.priority === "urgent" ? "red" : "blue"}>
          {comm.priority === "urgent" ? t("pages.playerPortal.commPriorityUrgent") : t("pages.playerPortal.commPriorityInfo")}
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
  const { t } = useTranslation();
  const upcomingConv = myConvocations.filter((m) => new Date(m.date) >= todayStart());
  const playerFirstName = selectedPlayer?.firstName || selectedPlayer?.name?.split(" ")?.[0] || "";

  return (
    <AppCard>
      <h3 style={{ ...ps.sectionTitle, marginBottom: 16 }}>
        {compact ? t("pages.playerPortal.previewTitle") : t("pages.playerPortal.welcomeTitle")}
      </h3>

      {!selectedPlayer ? (
        <p style={ps.muted}>{t("pages.playerPortal.noPlayers")}</p>
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
                {selectedPlayer.role || t("pages.playerPortal.roleFallback")}{selectedPlayer.shirtNumber ? ` · #${selectedPlayer.shirtNumber}` : ""}
              </p>
            </div>
          </div>

          {/* Messaggio spogliatoio */}
          <p style={ps.welcomeMsg}>
            {portal.welcomeMessage || t("pages.playerPortal.defaultWelcome", { name: playerFirstName })}
          </p>

          {/* KPI */}
          <div style={ps.kpiGrid}>
            <MiniMetric label={t("pages.playerPortal.kpiPresences")} value={summary.stats.presences} />
            <MiniMetric label={t("pages.playerPortal.kpiMinutes")}   value={summary.stats.minutes} />
            <MiniMetric label={t("pages.playerPortal.kpiGoals")}      value={summary.stats.goals} />
            <MiniMetric label={t("pages.playerPortal.kpiAssists")}   value={summary.stats.assists} />
            <MiniMetric label={t("pages.playerPortal.kpiLoad")}   value={summary.stats.load} />
          </div>

          {/* Prossima convocazione */}
          {upcomingConv.length > 0 && (
            <div style={ps.convAlert}>
              <Badge tone="green">{t("pages.playerPortal.convSelected")}</Badge>
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
              <p style={ps.infoTitle}>{t("pages.playerPortal.objectiveLabel")}</p>
              <p style={ps.infoValue}>{activeGoal || t("pages.playerPortal.objectiveFallback")}</p>
              {activeNote && (
                <>
                  <p style={{ ...ps.infoTitle, marginTop: 10 }}>{t("pages.playerPortal.staffNoteLabel")}</p>
                  <p style={ps.infoValue}>{activeNote}</p>
                </>
              )}
            </div>
            <div style={ps.infoBlock}>
              <p style={ps.infoTitle}>{t("pages.playerPortal.physicalProfileTitle")}</p>
              <InfoRow label={t("pages.playerPortal.lastTestLabel")} value={latestTest ? formatShortDate(latestTest.date) : t("pages.playerPortal.lastTestFallback")} />
              <InfoRow label={t("pages.playerPortal.groupLabel")}      value={physicalReference.group} />
              <InfoRow label={t("pages.playerPortal.masLabel")}         value={physicalReference.mas ? `${physicalReference.mas} km/h` : "—"} />
            </div>
          </div>

          {/* Programma */}
          {activeProgram && (
            <div style={ps.programBox}>
              <p style={ps.infoTitle}>{t("pages.playerPortal.assignedProgram")}</p>
              <p style={{ color: "#cbd5e1", lineHeight: 1.6, margin: 0, fontSize: 14 }}>{activeProgram}</p>
            </div>
          )}

          {/* Prossimi eventi */}
          <div style={ps.infoBlock}>
            <p style={ps.infoTitle}>{t("pages.playerPortal.nextEventsTitle")}</p>
            {nextEvents.length ? (
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                {nextEvents.map((e) => (
                  <div key={e.id} style={ps.eventRow}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, lineHeight: 1.25 }}>{e.title}</p>
                      <p style={{ ...ps.muted, fontSize: 11 }}>{e.type || t("pages.playerPortal.eventTypeFallback")}</p>
                    </div>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{formatShortDate(e.date)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ ...ps.muted, marginTop: 6 }}>{t("pages.playerPortal.noEvents")}</p>
            )}
          </div>

          {/* Comunicazioni */}
          {comms.length > 0 && (
            <div>
              <p style={{ ...ps.infoTitle, marginBottom: 8 }}>{t("pages.playerPortal.commBoardTitle")}</p>
              {comms.slice(0, 3).map((c) => <CommCard key={c.id} comm={c} />)}
            </div>
          )}
        </div>
      )}
    </AppCard>
  );
}

// ─────────────────────────────────────────────
// Bottoni risposta RSVP (vista giocatore)
// ─────────────────────────────────────────────
function RsvpButtons({ matchId, rsvp, saving, onRespond, t, archived = false }) {
  const current = rsvp?.response || "pending";
  const hasToken = rsvp !== undefined;

  // Don't show if staff hasn't created a token yet
  if (!hasToken) return null;

  return (
    <div style={ps.rsvpBar}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
        {current === "yes"     ? t("pages.playerPortal.rsvpConfirmed")
         : current === "no"   ? t("pages.playerPortal.rsvpDeclined")
         :                      t("pages.playerPortal.rsvpPendingLabel")}
      </span>
      {!archived && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onRespond(matchId, "yes")}
            disabled={saving || current === "yes"}
            style={{
              ...ps.rsvpBtn,
              background: current === "yes" ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.07)",
              border: `1px solid ${current === "yes" ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.2)"}`,
              color: "#4ade80",
              opacity: saving ? 0.6 : 1,
            }}
          >
            ✅ {t("pages.playerPortal.rsvpYes")}
          </button>
          <button
            onClick={() => onRespond(matchId, "no")}
            disabled={saving || current === "no"}
            style={{
              ...ps.rsvpBtn,
              background: current === "no" ? "rgba(248,113,113,0.18)" : "rgba(248,113,113,0.07)",
              border: `1px solid ${current === "no" ? "rgba(248,113,113,0.5)" : "rgba(248,113,113,0.2)"}`,
              color: "#f87171",
              opacity: saving ? 0.6 : 1,
            }}
          >
            ❌ {t("pages.playerPortal.rsvpNo")}
          </button>
        </div>
      )}
    </div>
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

  // Player portal redesign
  playerHeader2: {
    display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap",
    padding: "20px 20px 16px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    marginBottom: 0,
  },
  kpiStrip: {
    display: "flex", gap: 0, flexWrap: "wrap",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderTop: "none",
    borderRadius: "0 0 0 0",
  },
  kpiItem: {
    flex: "1 1 80px", minWidth: 70,
    padding: "12px 16px",
    textAlign: "center",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  availMini: {
    marginLeft: "auto", minWidth: 130,
  },
  availDot: {
    width: 34, height: 34, borderRadius: 8,
    display: "grid", placeItems: "center",
    fontSize: 14, cursor: "pointer",
    transition: "opacity 0.15s",
  },
  tabBar: {
    display: "flex", gap: 0, overflowX: "auto",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    marginBottom: 4,
  },
  tabBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "12px 18px",
    background: "none", border: "none",
    fontSize: 13, fontWeight: 700,
    cursor: "pointer", whiteSpace: "nowrap",
    transition: "color 0.15s",
  },
  tabBadge: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 18, height: 18, borderRadius: 9,
    fontSize: 10, fontWeight: 900, color: "#fff",
    padding: "0 5px",
  },

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
  infoTitle: { margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0, color: "#475569" },
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

  // Availability buttons
  availBtn: {
    padding: "8px 16px", borderRadius: 10,
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    transition: "opacity 0.15s",
  },

  // RSVP buttons bar
  rsvpBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, flexWrap: "wrap",
    padding: "8px 14px", marginTop: 6, borderRadius: "0 0 10px 10px",
    background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  rsvpBtn: {
    padding: "5px 12px", borderRadius: 8, border: "none",
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    transition: "opacity 0.15s",
  },

  // Comunicazione
  commCard: {
    padding: "10px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderLeft: "3px solid",
  },
};
