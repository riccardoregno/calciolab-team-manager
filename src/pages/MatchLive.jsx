import { useState } from "react";
import { useParams } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { useAreaPermission } from "../components/auth/permissionContext";
import { createId, formatDate, getLineup, normalizeAppSettings } from "../utils/helpers";
import { useIsMobile } from "../hooks/useIsMobile";

const EVENT_TYPES = [
  { key: "goal",         label: "Gol",            icon: "⚽", color: "#22c55e" },
  { key: "own_goal",     label: "Autogol",         icon: "😬", color: "#f87171" },
  { key: "assist",       label: "Assist",          icon: "🎯", color: "#60a5fa" },
  { key: "yellow_card",  label: "Giallo",          icon: "🟨", color: "#fbbf24" },
  { key: "red_card",     label: "Rosso",           icon: "🟥", color: "#f87171" },
  { key: "substitution", label: "Sostituzione",    icon: "🔄", color: "#a78bfa" },
  { key: "injury",       label: "Infortunio",      icon: "🩹", color: "#fb923c" },
  { key: "note",         label: "Nota",            icon: "📝", color: "#94a3b8" },
];

const GOAL_TYPES = ["goal", "own_goal"];
const CARD_TYPES = ["yellow_card", "red_card"];

function eventColor(type) {
  return EVENT_TYPES.find((e) => e.key === type)?.color ?? "#94a3b8";
}
function eventIcon(type) {
  return EVENT_TYPES.find((e) => e.key === type)?.icon ?? "•";
}
function eventLabel(type) {
  return EVENT_TYPES.find((e) => e.key === type)?.label ?? type;
}

function buildSummaryText(match, liveEvents, players, homeScore, awayScore) {
  const lines = [
    `⚽ ${match.title || `${match.opponent || "Avversario"}`}`,
    `📅 ${formatDate(match.date)}${match.time ? ` · ${match.time}` : ""}`,
    `🏆 Risultato: ${homeScore} - ${awayScore}`,
    "",
    "📋 Cronaca:",
  ];
  const sorted = [...liveEvents].sort((a, b) => Number(a.minute) - Number(b.minute));
  for (const ev of sorted) {
    const player = players.find((p) => String(p.id) === String(ev.playerId));
    const playerOut = players.find((p) => String(p.id) === String(ev.playerOutId));
    const name = player?.name || player?.firstName || "—";
    const min = ev.minute ? `${ev.minute}'` : "";
    if (ev.type === "substitution") {
      const out = playerOut?.name || playerOut?.firstName || "—";
      lines.push(`${eventIcon(ev.type)} ${min} ${name} ↔ ${out}`);
    } else {
      lines.push(`${eventIcon(ev.type)} ${min} ${name}${ev.note ? ` (${ev.note})` : ""}`);
    }
  }
  return lines.join("\n");
}

const EMPTY_FORM = { minute: "", type: "goal", playerId: "", playerOutId: "", note: "" };

export default function MatchLive({ matches = [], setMatches, players = [], appSettings = {} }) {
  const { id } = useParams();
  const isMobile = useIsMobile();
  const { canManage } = useAreaPermission();
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";

  const match = matches.find((m) => String(m.id) === String(id));

  const [addingEvent, setAddingEvent] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [copied, setCopied] = useState(false);

  if (!match) {
    return (
      <div style={s.page}>
        <AppCard><p style={s.muted}>Partita non trovata.</p></AppCard>
      </div>
    );
  }

  const liveEvents = Array.isArray(match.liveEvents) ? match.liveEvents : [];
  const homeScore = match.homeScore ?? liveEvents.filter((e) => e.type === "goal").length;
  const awayScore = match.awayScore ?? 0;

  const lineup = getLineup(match);
  const calledIds = [
    ...lineup.starterIds,
    ...lineup.benchIds,
    ...lineup.calledUpIds,
  ];
  const calledPlayers = calledIds.length
    ? players.filter((p) => calledIds.some((cid) => String(cid) === String(p.id)))
    : players;

  function patchMatch(patch) {
    setMatches((prev) => prev.map((m) => String(m.id) === String(id) ? { ...m, ...patch } : m));
  }

  function adjustScore(team, delta) {
    if (!canManage) return;
    const key = team === "home" ? "homeScore" : "awayScore";
    const current = match[key] ?? (team === "home" ? liveEvents.filter((e) => e.type === "goal").length : 0);
    patchMatch({ [key]: Math.max(0, current + delta) });
  }

  function addEvent() {
    if (!canManage) return;
    const ev = {
      id: createId(),
      minute: form.minute ? String(form.minute) : "",
      type: form.type,
      playerId: form.playerId,
      playerOutId: form.type === "substitution" ? form.playerOutId : "",
      note: form.note.trim(),
    };
    patchMatch({ liveEvents: [...liveEvents, ev] });
    setForm(EMPTY_FORM);
    setAddingEvent(false);
  }

  function removeEvent(eventId) {
    if (!canManage) return;
    patchMatch({ liveEvents: liveEvents.filter((e) => e.id !== eventId) });
  }

  async function copyTabellino() {
    const text = buildSummaryText(match, liveEvents, players, homeScore, awayScore);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const sortedEvents = [...liveEvents].sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0));

  const goalScorers = liveEvents
    .filter((e) => e.type === "goal")
    .map((e) => players.find((p) => String(p.id) === String(e.playerId))?.name || "—");
  const yellowCards = liveEvents.filter((e) => e.type === "yellow_card").length;
  const redCards = liveEvents.filter((e) => e.type === "red_card").length;

  return (
    <div style={s.page}>
      <PageHeader
        title="Live Match"
        subtitle={`${clubName} vs ${match.opponent || "Avversario"} · ${formatDate(match.date)}`}
      />

      <MatchTabBar matchId={id} active="live" matchLabel={match.opponent ? `vs ${match.opponent}` : undefined} matchData={match} />

      {/* ── Scoreboard ────────────────────────────────────────────────────── */}
      <AppCard>
        <div style={{ ...s.scoreboard, flexDirection: isMobile ? "column" : "row" }}>
          <div style={s.teamBlock}>
            <div style={s.teamName}>{clubName}</div>
            <div style={s.teamSub}>Casa</div>
          </div>

          <div style={s.scoreCenter}>
            <div style={s.scoreRow}>
              {canManage && (
                <button style={s.scoreBtn} onClick={() => adjustScore("home", -1)}>−</button>
              )}
              <span style={s.scoreNum}>{homeScore}</span>
              <span style={s.scoreDash}>–</span>
              <span style={s.scoreNum}>{awayScore}</span>
              {canManage && (
                <button style={s.scoreBtn} onClick={() => adjustScore("away", -1)}>−</button>
              )}
            </div>
            <div style={s.scoreBtnsRow}>
              {canManage && (
                <>
                  <button style={{ ...s.scorePlusBtn, marginRight: 48 }} onClick={() => adjustScore("home", +1)}>+ Gol</button>
                  <button style={s.scorePlusBtn} onClick={() => adjustScore("away", +1)}>+ Gol</button>
                </>
              )}
            </div>
            <div style={s.cardRow}>
              {yellowCards > 0 && <span style={s.cardBadge("yellow")}>🟨 {yellowCards}</span>}
              {redCards > 0 && <span style={s.cardBadge("red")}>🟥 {redCards}</span>}
            </div>
          </div>

          <div style={{ ...s.teamBlock, textAlign: "right" }}>
            <div style={s.teamName}>{match.opponent || "Avversario"}</div>
            <div style={s.teamSub}>Ospite</div>
          </div>
        </div>

        {goalScorers.length > 0 && (
          <p style={s.scorers}>⚽ {goalScorers.join(", ")}</p>
        )}
      </AppCard>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <AppCard>
        <div style={s.timelineHeader}>
          <h3 style={s.sectionTitle}>Cronaca eventi</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canManage && (
              <Button onClick={() => { setAddingEvent((v) => !v); setForm(EMPTY_FORM); }}>
                {addingEvent ? "Annulla" : "+ Evento"}
              </Button>
            )}
            <Button variant="ghost" onClick={copyTabellino} disabled={liveEvents.length === 0}>
              {copied ? "✓ Copiato!" : "📋 Copia tabellino"}
            </Button>
          </div>
        </div>

        {/* Form nuovo evento */}
        {addingEvent && (
          <div style={s.addForm}>
            <div style={s.formRow}>
              <label style={s.fieldLabel}>
                Minuto
                <input
                  type="number"
                  min="1" max="120"
                  value={form.minute}
                  onChange={(e) => setForm({ ...form, minute: e.target.value })}
                  placeholder="45"
                  style={{ ...s.input, width: 80 }}
                />
              </label>

              <label style={s.fieldLabel}>
                Tipo evento
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={s.input}>
                  {EVENT_TYPES.map((et) => (
                    <option key={et.key} value={et.key}>{et.icon} {et.label}</option>
                  ))}
                </select>
              </label>

              <label style={s.fieldLabel}>
                {form.type === "substitution" ? "Entra" : "Giocatore"}
                <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} style={s.input}>
                  <option value="">— Seleziona —</option>
                  {calledPlayers.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{p.name || [p.firstName, p.lastName].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              </label>

              {form.type === "substitution" && (
                <label style={s.fieldLabel}>
                  Esce
                  <select value={form.playerOutId} onChange={(e) => setForm({ ...form, playerOutId: e.target.value })} style={s.input}>
                    <option value="">— Seleziona —</option>
                    {calledPlayers.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{p.name || [p.firstName, p.lastName].filter(Boolean).join(" ")}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!GOAL_TYPES.includes(form.type) && !CARD_TYPES.includes(form.type) && form.type !== "substitution" && (
                <label style={{ ...s.fieldLabel, gridColumn: "1 / -1" }}>
                  Nota
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Descrizione breve..."
                    style={s.input}
                  />
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button onClick={addEvent} disabled={!form.type}>
                Aggiungi
              </Button>
            </div>
          </div>
        )}

        {/* Lista eventi */}
        {sortedEvents.length === 0 ? (
          <p style={{ ...s.muted, marginTop: 14 }}>Nessun evento registrato. Premi "+ Evento" per iniziare.</p>
        ) : (
          <div style={s.timeline}>
            {sortedEvents.map((ev) => {
              const player = players.find((p) => String(p.id) === String(ev.playerId));
              const playerOut = players.find((p) => String(p.id) === String(ev.playerOutId));
              const name = player?.name || [player?.firstName, player?.lastName].filter(Boolean).join(" ") || "—";
              return (
                <div key={ev.id} style={s.timelineRow}>
                  <div style={{ ...s.eventDot, background: eventColor(ev.type) }} />
                  <div style={s.eventMinute}>{ev.minute ? `${ev.minute}'` : "—"}</div>
                  <div style={{ ...s.eventIcon, color: eventColor(ev.type) }}>{eventIcon(ev.type)}</div>
                  <div style={s.eventBody}>
                    <span style={s.eventType}>{eventLabel(ev.type)}</span>
                    <span style={s.eventName}>{name}</span>
                    {ev.type === "substitution" && playerOut && (
                      <span style={s.eventSub}>↔ {playerOut.name || [playerOut.firstName, playerOut.lastName].filter(Boolean).join(" ")}</span>
                    )}
                    {ev.note && <span style={s.eventNote}>{ev.note}</span>}
                  </div>
                  {canManage && (
                    <button style={s.removeBtn} onClick={() => removeEvent(ev.id)}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AppCard>

      {/* ── Statistiche rapide ─────────────────────────────────────────────── */}
      {liveEvents.length > 0 && (
        <AppCard>
          <h3 style={s.sectionTitle}>Riepilogo partita</h3>
          <div style={s.statsGrid}>
            {[
              { label: "Gol segnati",    value: liveEvents.filter((e) => e.type === "goal").length },
              { label: "Assist",         value: liveEvents.filter((e) => e.type === "assist").length },
              { label: "Gialli",         value: yellowCards },
              { label: "Rossi",          value: redCards },
              { label: "Sostituzioni",   value: liveEvents.filter((e) => e.type === "substitution").length },
              { label: "Note staff",     value: liveEvents.filter((e) => e.type === "note").length },
            ].map(({ label, value }) => (
              <div key={label} style={s.statCard}>
                <div style={s.statValue}>{value}</div>
                <div style={s.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        </AppCard>
      )}
    </div>
  );
}

const s = {
  page: { display: "grid", gap: 18 },
  muted: { color: "#94a3b8", margin: 0 },

  scoreboard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  teamBlock: { flex: "1 1 80px", minWidth: 0 },
  teamName: { fontSize: 16, fontWeight: 900, color: "#e2e8f0", lineHeight: 1.2 },
  teamSub: { fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 4 },

  scoreCenter: { flex: "0 0 auto", textAlign: "center" },
  scoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  scoreNum: { fontSize: 52, fontWeight: 900, color: "white", lineHeight: 1, minWidth: 48, textAlign: "center" },
  scoreDash: { fontSize: 36, fontWeight: 400, color: "#475569" },
  scoreBtn: {
    width: 32, height: 32, borderRadius: 8,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#94a3b8", fontSize: 18, fontWeight: 700,
    cursor: "pointer", display: "grid", placeItems: "center",
    lineHeight: 1,
  },
  scoreBtnsRow: { display: "flex", justifyContent: "center", gap: 0, marginTop: 10 },
  scorePlusBtn: {
    padding: "6px 18px",
    borderRadius: 10,
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#86efac", fontSize: 13, fontWeight: 800,
    cursor: "pointer",
  },
  cardRow: { display: "flex", justifyContent: "center", gap: 8, marginTop: 10 },
  cardBadge: (color) => ({
    fontSize: 13, fontWeight: 700,
    padding: "3px 10px", borderRadius: 8,
    background: color === "yellow" ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)",
    border: `1px solid ${color === "yellow" ? "rgba(251,191,36,0.3)" : "rgba(248,113,113,0.3)"}`,
    color: color === "yellow" ? "#fbbf24" : "#f87171",
  }),
  scorers: { marginTop: 12, marginBottom: 0, fontSize: 13, color: "#86efac", fontWeight: 600 },

  timelineHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 12, flexWrap: "wrap", marginBottom: 16,
  },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 900 },

  addForm: {
    padding: 16, borderRadius: 14,
    background: "rgba(37,99,235,0.08)",
    border: "1px solid rgba(37,99,235,0.2)",
    marginBottom: 16,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  fieldLabel: {
    display: "grid", gap: 6,
    color: "#94a3b8", fontSize: 12, fontWeight: 800, textTransform: "uppercase",
  },
  input: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },

  timeline: { display: "grid", gap: 6 },
  timelineRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  eventDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  eventMinute: { fontSize: 13, fontWeight: 900, color: "#64748b", minWidth: 30 },
  eventIcon: { fontSize: 16, flexShrink: 0 },
  eventBody: { flex: 1, display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "center" },
  eventType: { fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" },
  eventName: { fontSize: 14, fontWeight: 700, color: "#e2e8f0" },
  eventSub: { fontSize: 12, color: "#a78bfa" },
  eventNote: { fontSize: 12, color: "#64748b", fontStyle: "italic" },
  removeBtn: {
    background: "none", border: "none", color: "#475569",
    cursor: "pointer", fontSize: 14, padding: "2px 6px",
    borderRadius: 6, lineHeight: 1,
    flexShrink: 0,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    padding: "12px 10px", borderRadius: 12, textAlign: "center",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  statValue: { fontSize: 26, fontWeight: 900, color: "white", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 4, textTransform: "uppercase" },
};
