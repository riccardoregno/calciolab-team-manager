import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { respondRsvpAsPlayer } from "../services/rsvp";
import { fetchPlayerAvailability, setPlayerAvailability } from "../services/playerAvailability";
import { touchPlayerPortalActivity } from "../services/playerPortalActivity";
import { fetchPlayerRpe, upsertRpe } from "../services/sessionRpe";

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
  supabaseRole = null,
  playersLoading = false,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings     = normalizeAppSettings(appSettings);
  const portal       = settings.playerPortal;
  const comms        = settings.communications || [];
  const currentRole  = supabaseRole || getCurrentUserRole(settings);
  const isPlayerView = currentRole === "player";

  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [draftProgram, setDraftProgram] = useState("");
  const [draftGoal,    setDraftGoal]    = useState("");
  const [draftNote,    setDraftNote]    = useState("");
  const isMobile = useIsMobile();

  const selectedPlayer = isPlayerView
    ? players.find((p) => sameId(p.id, myPlayerId)) || null
    : players.find((p) => sameId(p.id, selectedPlayerId || players[0]?.id));
  const invalidPlayerAccess = isPlayerView && !selectedPlayer;

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

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
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
        action={isPlayerView ? (
          <button onClick={handleLogout} style={ps.logoutBtn}>
            Esci
          </button>
        ) : null}
      />

      {isPlayerView && playersLoading ? (
        <AppCard>
          <div style={{ height: 120, display: "grid", placeItems: "center", color: "#64748b", fontSize: 14 }}>
            Caricamento...
          </div>
        </AppCard>
      ) : isPlayerView && invalidPlayerAccess ? (
        <AppCard>
          <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
            <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>{t("pages.playerPortal.notLinkedTitle")}</h2>
            <p style={{ margin: "0 0 20px", color: "#94a3b8", lineHeight: 1.6, maxWidth: 480, marginInline: "auto" }}>
              {t("pages.playerPortal.notLinkedBody")}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={handleLogout} style={{ ...ps.logoutBtn, padding: "10px 22px", fontSize: 14, borderRadius: 10 }}>
                {t("pages.playerPortal.notLinkedLogout")}
              </button>
              <a
                href="mailto:?"
                style={{
                  padding: "10px 22px", fontSize: 14, borderRadius: 10, fontWeight: 700,
                  background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)",
                  color: "#38bdf8", textDecoration: "none", display: "inline-block",
                }}
              >
                {t("pages.playerPortal.notLinkedContact")}
              </a>
            </div>
          </div>
        </AppCard>
      ) : isPlayerView ? (
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
          sessions={sessions}
          matches={matches}
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
  players, portal, comms, physicalTests, sessions = [], matches = [],
  activeProgram, activeGoal, activeNote, isMobile,
  teamId, myPlayerId,
}) {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState("home");
  const [myMatchStats, setMyMatchStats] = useState(null); // null = non ancora caricato
  const [rsvpMap, setRsvpMap] = useState({});
  const [rpeMap, setRpeMap] = useState({});    // eventId → rpe record
  const [rpeSaving, setRpeSaving] = useState(null); // eventId saving
  const [rpeNotes, setRpeNotes] = useState({}); // eventId → draft note
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
    if (teamId && myPlayerId) {
      fetchPlayerRpe({ teamId, playerId: myPlayerId }).then(({ data }) => {
        if (!mountedRef.current) return;
        const map = {};
        (data || []).forEach((r) => { map[r.event_id] = r; });
        setRpeMap(map);
      }).catch(() => {});
    }
    return () => { mountedRef.current = false; };
  }, [fetchRsvps, fetchAvailability, teamId, myPlayerId]);

  useEffect(() => {
    if (activeTab !== "statistiche" || !teamId || !myPlayerId || !isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from("match_stats")
      .select("match_id, minutes_played, goals, assists, yellow_cards, red_cards, rating")
      .eq("team_id", teamId)
      .eq("player_id", String(myPlayerId))
      .order("match_id", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setMyMatchStats(data || []);
      });
    return () => { cancelled = true; };
  }, [activeTab, teamId, myPlayerId]);

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

  async function handleRpe(eventId, eventType, value) {
    if (rpeSaving || !teamId || !myPlayerId) return;
    setRpeSaving(eventId);
    setRpeMap((prev) => ({ ...prev, [eventId]: { ...(prev[eventId] || {}), rpe_value: value, event_id: eventId } }));
    const { error } = await upsertRpe({
      teamId, playerId: myPlayerId,
      eventId: String(eventId), eventType,
      rpeValue: value,
      notes: rpeNotes[eventId] || "",
    });
    if (error) setRpeMap((prev) => { const n = { ...prev }; delete n[eventId]; return n; });
    setRpeSaving(null);
  }

  // Eventi degli ultimi 14 giorni valutabili (passati)
  const rateableEvents = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    return [
      ...sessions
        .filter((e) => e.date && new Date(e.date) < todayStart() && new Date(e.date) >= cutoff)
        .map((e) => ({ ...e, eventType: "session" })),
      ...myConvocations
        .filter((m) => m.date && new Date(m.date) < todayStart() && new Date(m.date) >= cutoff)
        .map((m) => ({ ...m, eventType: "match", title: `vs ${m.opponent || "?"}` })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7);
  }, [sessions, myConvocations]);

  const upcoming = myConvocations.filter((m) => new Date(m.date) >= todayStart());
  const past     = myConvocations.filter((m) => new Date(m.date) < todayStart());

  const TABS = [
    { id: "home",          label: "Home",          icon: "🏠" },
    { id: "convocazioni",  label: "Convocazioni",  icon: "📅", badge: upcoming.length || null },
    { id: "statistiche",   label: "Statistiche",   icon: "📊" },
    { id: "fisico",        label: "Fisico",        icon: "💪" },
    { id: "medico",        label: "Medico",        icon: "🩺", badge: activeInjuries.length || null },
    { id: "comunicazioni", label: "Comunicazioni", icon: "📢", badge: comms.length || null },
  ];

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* ── Header profilo ── */}
      <div style={ps.playerHeader2}>
        {selectedPlayer?.photo ? (
          <div style={ps.avatarFrame}>
            <img src={selectedPlayer.photo} alt={selectedPlayer.name} style={ps.avatarImg} />
          </div>
        ) : (
          <div style={ps.avatar}>{selectedPlayer?.name?.slice(0, 1) || "P"}</div>
        )}
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

            {/* RPE Borg */}
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 4 }}>Come hai sentito le ultime sedute?</h3>
              <p style={{ ...ps.muted, fontSize: 13, marginBottom: 14 }}>
                Valuta lo sforzo percepito (RPE 1–10) per ogni allenamento o partita.
              </p>
              {rateableEvents.length === 0 && (
                <p style={ps.muted}>Nessuna seduta o partita negli ultimi 14 giorni da valutare.</p>
              )}
              {rateableEvents.length > 0 && (
                <div style={{ display: "grid", gap: 14 }}>
                  {rateableEvents.map((e) => {
                    const rec = rpeMap[String(e.id)];
                    const saved = rec?.rpe_value;
                    return (
                      <div key={e.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                              {e.eventType === "match" ? "⚽" : "🏃"} {e.title}
                            </p>
                            <p style={{ ...ps.muted, fontSize: 11, margin: 0 }}>{formatShortDate(e.date)}</p>
                          </div>
                          {saved && (
                            <span style={{ fontSize: 13, fontWeight: 900, color: rpeTextColor(saved), background: rpeBgColor(saved), padding: "4px 10px", borderRadius: 8 }}>
                              RPE {saved} — {BORG_LABELS[saved]}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                            <button
                              key={v}
                              onClick={() => handleRpe(String(e.id), e.eventType, v)}
                              disabled={rpeSaving === String(e.id)}
                              title={BORG_LABELS[v]}
                              style={{
                                width: 34, height: 34, borderRadius: 8, border: "1px solid",
                                fontSize: 13, fontWeight: 700, cursor: "pointer",
                                background: saved === v ? rpeBgColor(v) : "rgba(255,255,255,0.04)",
                                borderColor: saved === v ? rpeTextColor(v) : "rgba(255,255,255,0.1)",
                                color: saved === v ? rpeTextColor(v) : "#64748b",
                                opacity: rpeSaving === String(e.id) ? 0.6 : 1,
                                transition: "all 0.12s",
                              }}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        {saved && (
                          <input
                            style={{ ...styles.input, fontSize: 12, marginTop: 8, padding: "6px 10px" }}
                            placeholder="Note opzionali (dolori, sensazioni, …)"
                            value={rpeNotes[String(e.id)] ?? (rec?.notes || "")}
                            onChange={(ev) => setRpeNotes((p) => ({ ...p, [String(e.id)]: ev.target.value }))}
                            onBlur={() => handleRpe(String(e.id), e.eventType, saved)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
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

            <PrehabSection injuryHistory={injuryHistory} selectedPlayer={selectedPlayer} />

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

        {/* STATISTICHE */}
        {activeTab === "statistiche" && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* KPI stagionali */}
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>La mia stagione</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 10 }}>
                {[
                  { label: "Presenze",  value: summary.stats.presences, color: "#38bdf8" },
                  { label: "Minuti",    value: summary.stats.minutes,   color: "#38bdf8" },
                  { label: "Gol",       value: summary.stats.goals,     color: "#4ade80" },
                  { label: "Assist",    value: summary.stats.assists,   color: "#a78bfa" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: "14px 8px", borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color }}>{value || 0}</div>
                  </div>
                ))}
              </div>
            </AppCard>

            {/* Storico partite */}
            <AppCard>
              <h3 style={{ ...ps.sectionTitle, marginBottom: 14 }}>Storico partite</h3>
              {myMatchStats === null && <p style={ps.muted}>Caricamento…</p>}
              {myMatchStats !== null && myMatchStats.length === 0 && (
                <p style={ps.muted}>Nessuna statistica registrata per te ancora.</p>
              )}
              {myMatchStats !== null && myMatchStats.length > 0 && (
                <div style={{ display: "grid", gap: 8 }}>
                  {myMatchStats.map((row) => {
                    const match = matches.find((m) => String(m.id) === String(row.match_id));
                    return (
                      <div key={row.match_id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {match ? (match.opponent ? `vs ${match.opponent}` : match.title || "Partita") : "Partita"}
                          </div>
                          {match && <div style={{ fontSize: 11, color: "#64748b" }}>{match.date}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                          {row.minutes_played > 0 && <StatPill label="min" value={row.minutes_played} />}
                          {row.goals > 0 && <StatPill label="⚽" value={row.goals} color="#4ade80" />}
                          {row.assists > 0 && <StatPill label="🅰️" value={row.assists} color="#a78bfa" />}
                          {row.yellow_cards > 0 && <StatPill label="🟨" value={row.yellow_cards} color="#fbbf24" />}
                          {row.red_cards > 0 && <StatPill label="🟥" value={row.red_cards} color="#f87171" />}
                          {row.rating != null && (
                            <StatPill label="voto" value={Number(row.rating).toFixed(1)} color="#38bdf8" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AppCard>
          </div>
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
// RPE helpers
// ─────────────────────────────────────────────
const BORG_LABELS = {
  1: "Molto leggero", 2: "Leggero", 3: "Moderato",
  4: "Abbastanza intenso", 5: "Intenso", 6: "Intenso+",
  7: "Molto intenso", 8: "Molto intenso+", 9: "Estremamente intenso", 10: "Massimale",
};
function rpeTextColor(v) {
  if (!v) return "#475569";
  if (v <= 3) return "#4ade80";
  if (v <= 6) return "#facc15";
  if (v <= 8) return "#fb923c";
  return "#f87171";
}
function rpeBgColor(v) {
  if (!v) return "rgba(255,255,255,0.04)";
  if (v <= 3) return "rgba(34,197,94,0.15)";
  if (v <= 6) return "rgba(250,204,21,0.15)";
  if (v <= 8) return "rgba(251,146,60,0.18)";
  return "rgba(248,113,113,0.18)";
}

// ─────────────────────────────────────────────
// PREHAB — dati routine e libreria
// ─────────────────────────────────────────────
const PREHAB_ROUTINES = {
  base: {
    label: "Base", duration: "8 min",
    exercises: [
      { id: "ponte",  emoji: "🍑", name: "Ponte Glutei",            sets: "2×12",        desc: "Attiva glutei e stabilizza bacino." },
      { id: "nordic", emoji: "🦵", name: "Nordic Hamstring",        sets: "2×5",         desc: "Eccentrico ischio-crurali, previene lesioni coscia." },
      { id: "bdog",   emoji: "🧠", name: "Bird Dog",                sets: "8+8",         desc: "Core stability e controllo lombare." },
      { id: "dbug",   emoji: "🧠", name: "Dead Bug",                sets: "8+8",         desc: "Anti-rotazione e stabilità addominale." },
      { id: "calf",   emoji: "🦶", name: "Calf Raise",              sets: "15+15",       desc: "Rinforzo polpaccio, protegge tendine d'Achille." },
      { id: "equil",  emoji: "⚖️", name: "Equilibrio Monopodalico", sets: "30\"",        desc: "Propriocezione e controllo caviglia." },
    ],
  },
  intermedia: {
    label: "Intermedia", duration: "12 min",
    exercises: [
      { id: "ponte",   emoji: "🍑", name: "Ponte Glutei",            sets: "2×12",       desc: "Attiva glutei e stabilizza bacino." },
      { id: "monster", emoji: "🐉", name: "Monster Walk",            sets: "2×10m",      desc: "Abduzione anca con elastico, attiva gluteo medio." },
      { id: "nordic",  emoji: "🦵", name: "Nordic Hamstring",        sets: "2×5",        desc: "Eccentrico ischio-crurali, previene lesioni coscia." },
      { id: "copen",   emoji: "⚽", name: "Copenhagen",              sets: "2×20\"",     desc: "Rinforzo adduttori, previene pubalgia." },
      { id: "calf",    emoji: "🦶", name: "Calf Raise",              sets: "15+15",      desc: "Rinforzo polpaccio e tendine d'Achille." },
      { id: "equil",   emoji: "⚖️", name: "Equilibrio Monopodalico", sets: "30\"",       desc: "Propriocezione e controllo caviglia." },
      { id: "bdog",    emoji: "🧠", name: "Bird Dog",                sets: "8+8",        desc: "Core stability e controllo lombare." },
      { id: "dbug",    emoji: "🧠", name: "Dead Bug",                sets: "8+8",        desc: "Anti-rotazione e stabilità addominale." },
      { id: "sprint",  emoji: "🏃", name: "Sprint progressivi",      sets: "60%-80%-95%", desc: "Attiva sistema neuromuscolare, previene strappi." },
    ],
  },
  elite: {
    label: "Elite", duration: "15 min",
    exercises: [
      { id: "ponte",   emoji: "🍑", name: "Ponte Glutei",            sets: "2×12",       desc: "Attiva glutei e stabilizza bacino." },
      { id: "monster", emoji: "🐉", name: "Monster Walk",            sets: "2×10m",      desc: "Abduzione anca con elastico, attiva gluteo medio." },
      { id: "nordic",  emoji: "🦵", name: "Nordic Hamstring",        sets: "2×5",        desc: "Eccentrico ischio-crurali, previene lesioni coscia." },
      { id: "copen",   emoji: "⚽", name: "Copenhagen avanzato",     sets: "3×25\"",     desc: "Rinforzo adduttori progressivo, alta intensità." },
      { id: "calf",    emoji: "🦶", name: "Calf Isometric",          sets: "3×30\"",     desc: "Tenuta isometrica polpaccio." },
      { id: "equil",   emoji: "⚖️", name: "Equilibrio Monopodalico", sets: "45\"",       desc: "Propriocezione avanzata con occhi chiusi." },
      { id: "bdog",    emoji: "🧠", name: "Bird Dog",                sets: "10+10",      desc: "Core stability progressiva." },
      { id: "dbug",    emoji: "🧠", name: "Dead Bug",                sets: "10+10",      desc: "Anti-rotazione avanzata." },
      { id: "hip",     emoji: "🍑", name: "Hip Thrust",              sets: "3×10",       desc: "Potenza glutei per sprint e frenate." },
      { id: "landing", emoji: "🦘", name: "Single Leg Landing",      sets: "3×6",        desc: "Atterraggio monopodalico, protegge LCA." },
      { id: "sprint",  emoji: "🏃", name: "Sprint 30m",              sets: "4×30m",      desc: "Velocità massimale, attiva unità motorie veloci." },
    ],
  },
};

const PREHAB_LIBRARY = [
  { key: "muscolare",      emoji: "🦵", title: "Lesione Muscolare Coscia",  reason: "PREVENZIONE",   injuryMatch: /muscolare|coscia|hamstring|quadricipite/,
    bullets: ["Nordic Hamstring 2×/settimana", "Sprint >90% velocità 1×/settimana", "Monitoraggio carico settimanale"],
    detail: { desc: "La coscia è il distretto muscolare più colpito nel calcio.", perche: "Gli ischio-crurali lavorano in eccentrico durante lo sprint: il rinforzo eccentrico riduce del 50% le lesioni.", quando: "2 volte a settimana, in riscaldamento o dopo il defaticamento." } },
  { key: "pubalgia",       emoji: "⚽", title: "Pubalgia / Adduttori",       reason: "PREVENZIONE",   injuryMatch: /pubalgia|adduttore|inguine/,
    bullets: ["Copenhagen Adduction", "Core Stability", "Monitoraggio dolore inguinale"],
    detail: { desc: "La pubalgia colpisce fino al 20% dei calciatori.", perche: "Squilibrio tra forza adduttori e abduttori causa microtraumi cronici alla sinfisi pubica.", quando: "3 volte a settimana nei periodi di alta densità di gare." } },
  { key: "caviglia",       emoji: "🦶", title: "Distorsione Caviglia",       reason: "PREVENZIONE",   injuryMatch: /caviglia|distorsione/,
    bullets: ["Propriocezione su superfici instabili", "Elastici peronieri", "Cambi direzione progressivi"],
    detail: { desc: "La distorsione di caviglia è il trauma più frequente nel calcio.", perche: "I recettori articolari si danneggiano dopo una distorsione. Il training propriocettivo riduce le recidive del 35%.", quando: "Prima del lavoro tecnico-tattico, ogni seduta." } },
  { key: "ginocchio",      emoji: "🦴", title: "Ginocchio LCA / Patella",    reason: "PREVENZIONE",   injuryMatch: /ginocchio|lca|patella|legament/,
    bullets: ["Squat monopodalico", "Step up eccentrico", "Controllo valgo dinamico"],
    detail: { desc: "Le lesioni al LCA sono le più invalidanti per un calciatore.", perche: "Il collasso del ginocchio in valgo durante atterraggi e cambi direzione è il principale meccanismo lesionale.", quando: "2-3 volte a settimana, integrato nel riscaldamento." } },
  { key: "tendine",        emoji: "⚡", title: "Tendinopatia",               reason: "PREVENZIONE",   injuryMatch: /tendine|achille|rotuleo|tendinopat/,
    bullets: ["Heel Drop eccentrico", "Heavy Slow Resistance", "Nessuno spike carico >10%/settimana"],
    detail: { desc: "Tendinopatie achillea e rotulea favorite da carichi discontinui.", perche: "I tendini si adattano lentamente. Un aumento del carico >10%/settimana supera la capacità rigenerativa.", quando: "2 volte a settimana. Ridurre nelle settimane con >3 allenamenti intensi." } },
  { key: "lombalgia",      emoji: "🧠", title: "Lombalgia e Colonna",        reason: "PREVENZIONE",   injuryMatch: /lombalgia|colonna|schiena|lombar/,
    bullets: ["Bird Dog + Dead Bug", "Mobilità toracica", "Evitare sprint in fatica"],
    detail: { desc: "Il 40% dei calciatori soffre di lombalgia. Il core instabile porta la colonna a compensare ogni movimento.", perche: "Il core è il fondamento della postura e del gesto atletico.", quando: "Ogni seduta come warm-up. Priorità nelle settimane di alta intensità." } },
  { key: "flessori",       emoji: "🏃", title: "Flessori Anca e Mobilità",   reason: "PREVENZIONE",   injuryMatch: /flessore|psoas|iliaco/,
    bullets: ["Stretching psoas 2×60\" per lato", "Mobilità anca in rotazione", "Dissociazione lombo-pelvica"],
    detail: { desc: "I calciatori accorciano cronicamente i flessori dell'anca per i continui gesti di corsa e tiro.", perche: "Flessori corti causano retroversione del bacino, lombalgia e riduzione della lunghezza del passo.", quando: "Post-allenamento come defaticamento, 3-4 volte a settimana." } },
  { key: "glutei",         emoji: "🍑", title: "Glutei e Catena Posteriore", reason: "PREVENZIONE",   injuryMatch: /gluteo/,
    bullets: ["Ponte glutei", "Hip Thrust", "Monster Walk con elastico"],
    detail: { desc: "I glutei deboli sono alla base di pubalgia, dolore al ginocchio e lombalgia.", perche: "Il gluteo medio stabilizza il bacino durante la corsa. Il grande gluteo genera la potenza dello sprint.", quando: "2-3 volte a settimana come attivazione pre-allenamento." } },
  { key: "propriocezione", emoji: "⚖️", title: "Propriocezione Caviglia",    reason: "PREVENZIONE",   injuryMatch: /propriocez|medusa|equilibr/,
    bullets: ["Medusa monopodalica 3×30\"", "Elastici peronei + tibiali", "Saltelli su superficie instabile"],
    detail: { desc: "La propriocezione è la capacità articolare di sentire la posizione nello spazio.", perche: "Dopo una distorsione, i recettori articolari si danneggiano. Il training li ripristina.", quando: "Prima di ogni allenamento, specialmente su terreni irregolari o bagnati." } },
];

const PERSONAL_PROFILES = [
  { test: /muscolare|coscia|hamstring|quadricipite/, label: "Profilo Coscia",   color: "#f87171", ids: ["nordic","ponte","sprint","bdog","dbug"] },
  { test: /pubalgia|adduttore|inguine/,              label: "Profilo Pubalgia", color: "#fb923c", ids: ["copen","ponte","bdog","dbug","monster"] },
  { test: /caviglia|distorsione/,                    label: "Profilo Caviglia", color: "#facc15", ids: ["equil","calf","monster","bdog","dbug"] },
  { test: /ginocchio|lca|patella/,                   label: "Profilo Ginocchio",color: "#a78bfa", ids: ["ponte","hip","landing","bdog","equil"] },
];

// ─────────────────────────────────────────────
// Sezione Prehab principale
// ─────────────────────────────────────────────
function PrehabSection({ injuryHistory = [], selectedPlayer }) {
  const [level, setLevel] = useState("intermedia");
  const [checked, setChecked] = useState(new Set());
  const [started, setStarted] = useState(false);
  const [modalItem, setModalItem] = useState(null);

  const routine = PREHAB_ROUTINES[level];
  const exercises = routine.exercises;
  const total = exercises.length;
  const done = exercises.filter((e) => checked.has(`${level}:${e.id}`)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  const injSource = [
    selectedPlayer?.injuryType, selectedPlayer?.differentiatedType,
    ...injuryHistory.flatMap((i) => [i.injuryType, i.differentiatedType, i.notes]),
  ].filter(Boolean).join(" ").toLowerCase();

  const personalProfile = PERSONAL_PROFILES.find((p) => p.test.test(injSource)) || null;
  const allEliteEx = PREHAB_ROUTINES.elite.exercises;
  const personalExercises = personalProfile
    ? personalProfile.ids.map((id) => allEliteEx.find((e) => e.id === id)).filter(Boolean)
    : null;

  function toggle(key) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function resetRoutine() {
    setChecked((prev) => {
      const next = new Set(prev);
      exercises.forEach((e) => next.delete(`${level}:${e.id}`));
      return next;
    });
    setStarted(false);
  }

  function switchLevel(key) {
    setLevel(key);
    setStarted(false);
    setChecked((prev) => {
      const next = new Set(prev);
      PREHAB_ROUTINES[key].exercises.forEach((e) => next.delete(`${key}:${e.id}`));
      return next;
    });
  }

  return (
    <>
      {/* Banner routine personalizzata */}
      {personalProfile && personalExercises && (
        <div style={{ padding: "16px 18px", borderRadius: 16, background: "linear-gradient(135deg,rgba(37,99,235,0.18),rgba(56,189,248,0.08))", border: "1px solid rgba(37,99,235,0.35)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ fontSize: 26 }}>⭐</span>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>ROUTINE PERSONALIZZATA</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: personalProfile.color, background: "rgba(255,255,255,0.07)", borderRadius: 5, padding: "1px 7px" }}>{personalProfile.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#f8fafc", lineHeight: 1.2 }}>CalcioLab ha rilevato un profilo di rischio.</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Segui questa routine prioritaria basata sul tuo storico infortuni.</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            {personalExercises.map((ex) => (
              <div key={ex.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 16 }}>{ex.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{ex.name}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8" }}>{ex.sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg,#1e3a5f 0%,#0f172a 55%,rgba(37,99,235,0.12) 100%)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 16, padding: "20px 18px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
          <span style={{ fontSize: 34 }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>PREHAB CALCIOLAB</p>
            <h2 style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 900, color: "#f8fafc", lineHeight: 1.1 }}>Routine consigliata</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{routine.duration} · 2 volte a settimana prima dell'allenamento.</p>
          </div>
        </div>

        {/* Level tabs */}
        <div style={{ display: "flex", gap: 0, padding: "4px", background: "rgba(0,0,0,0.35)", borderRadius: 12, marginBottom: 14 }}>
          {Object.entries(PREHAB_ROUTINES).map(([key, r]) => (
            <button key={key} onClick={() => switchLevel(key)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 800, lineHeight: 1.2,
              background: level === key ? "#2563eb" : "transparent",
              color: level === key ? "#fff" : "#64748b",
              transition: "all 0.18s",
            }}>
              {r.label}<br /><span style={{ fontSize: 10, opacity: 0.7, fontWeight: 600 }}>{r.duration}</span>
            </button>
          ))}
        </div>

        {!started ? (
          <button onClick={() => setStarted(true)} style={{ width: "100%", padding: "13px", borderRadius: 11, border: "none", background: "linear-gradient(90deg,#2563eb,#38bdf8)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: "0.01em" }}>
            Inizia Routine →
          </button>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? "#4ade80" : "#94a3b8" }}>
                {allDone ? "✅ Routine completata!" : "Routine in corso"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: allDone ? "#4ade80" : "#38bdf8" }}>{pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, transition: "width 0.4s ease", background: allDone ? "#4ade80" : "linear-gradient(90deg,#2563eb,#38bdf8)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 11, color: "#475569" }}>{done} di {total} esercizi</span>
              <button onClick={resetRoutine} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", fontWeight: 700, padding: 0 }}>↺ Ricomincia</button>
            </div>
          </div>
        )}
      </div>

      {/* Lista esercizi */}
      {started && (
        <div style={{ display: "grid", gap: 7 }}>
          {exercises.map((ex) => {
            const key = `${level}:${ex.id}`;
            const isDone = checked.has(key);
            return (
              <div key={key} onClick={() => toggle(key)} role="checkbox" aria-checked={isDone} style={{
                display: "flex", gap: 12, alignItems: "center", padding: "12px 14px",
                borderRadius: 12, cursor: "pointer", userSelect: "none",
                background: isDone ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${isDone ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`,
                transition: "all 0.2s",
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{ex.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isDone ? "#4ade80" : "#f8fafc", textDecoration: isDone ? "line-through" : "none", transition: "all 0.2s" }}>
                      {ex.name}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", flexShrink: 0 }}>{ex.sets}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.3 }}>{ex.desc}</p>
                </div>
                <div style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  border: `2px solid ${isDone ? "#4ade80" : "rgba(255,255,255,0.15)"}`,
                  background: isDone ? "#4ade80" : "transparent",
                  display: "grid", placeItems: "center",
                  fontSize: 14, fontWeight: 900, color: "#0f172a",
                  transition: "all 0.2s",
                }}>
                  {isDone ? "✓" : ""}
                </div>
              </div>
            );
          })}

          {allDone && (
            <div style={{ padding: "22px 18px", borderRadius: 14, background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.3)", textAlign: "center", marginTop: 4 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
              <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 900, color: "#4ade80" }}>Routine completata!</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>Ottimo lavoro. Ridurre il rischio di infortunio inizia dalla costanza.</p>
            </div>
          )}

          <p style={{ textAlign: "center", color: "#475569", fontSize: 12, margin: "2px 0 6px", fontWeight: 700 }}>
            ⏱ Tempo stimato: {routine.duration}
          </p>
        </div>
      )}

      {/* Libreria infortuni */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>📚 Libreria Infortuni</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {PREHAB_LIBRARY.map((item) => {
            const isPersonal = injuryHistory.some((inj) =>
              item.injuryMatch.test([inj.injuryType, inj.differentiatedType, inj.notes].filter(Boolean).join(" ").toLowerCase())
            );
            return (
              <div key={item.key} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${isPersonal ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.07)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 7 }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }}>{item.emoji}</span>
                    <strong style={{ fontSize: 14, color: "#f8fafc" }}>{item.title}</strong>
                    {isPersonal && (
                      <span style={{ fontSize: 9, fontWeight: 900, color: "#fb923c", background: "rgba(251,146,60,0.12)", borderRadius: 4, padding: "2px 6px", textTransform: "uppercase" }}>⚠ Storico</span>
                    )}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase", flexShrink: 0, letterSpacing: "0.05em" }}>{item.reason}</span>
                </div>
                <ul style={{ margin: "0 0 10px", paddingLeft: 16, display: "grid", gap: 3, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>
                  {item.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
                <button onClick={() => setModalItem(item)} style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#38bdf8", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Approfondisci →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal dettaglio */}
      {modalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setModalItem(null)}>
          <div style={{ width: "100%", maxWidth: 540, background: "#0f172a", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.1)", padding: "24px 20px 36px", maxHeight: "82vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 30 }}>{modalItem.emoji}</span>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase" }}>{modalItem.reason}</span>
                  <h3 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 900, color: "#f8fafc", lineHeight: 1.15 }}>{modalItem.title}</h3>
                </div>
              </div>
              <button onClick={() => setModalItem(null)} style={{ background: "rgba(255,255,255,0.07)", border: "none", color: "#94a3b8", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 20, display: "grid", placeItems: "center" }}>×</button>
            </div>
            <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.65, margin: "0 0 16px" }}>{modalItem.detail.desc}</p>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#38bdf8" }}>Perché è utile</p>
                <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{modalItem.detail.perche}</p>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4ade80" }}>Quando usarlo</p>
                <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{modalItem.detail.quando}</p>
              </div>
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569" }}>▶ Video dimostrazione</p>
                <p style={{ margin: 0, fontSize: 12, color: "#475569", fontStyle: "italic" }}>In arrivo nella prossima versione.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
function StatPill({ label, value, color = "#94a3b8" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 700, color }}>
      {label} {value}
    </span>
  );
}

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
    display: "flex", gap: 0, flexWrap: "nowrap", overflowX: "auto",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderTop: "none",
    borderRadius: "0 0 0 0",
  },
  kpiItem: {
    flex: "1 1 0", minWidth: 0,
    padding: "10px 8px",
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
  avatarFrame: {
    width: 54, height: 54, borderRadius: 12, flexShrink: 0,
    overflow: "hidden", border: "2px solid rgba(255,255,255,0.12)",
  },
  avatarImg: {
    width: "100%", height: "100%", objectFit: "cover", display: "block",
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

  logoutBtn: {
    padding: "7px 16px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#94a3b8", fontSize: 13, fontWeight: 700,
    cursor: "pointer",
  },

  // Comunicazione
  commCard: {
    padding: "10px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderLeft: "3px solid",
  },
};
