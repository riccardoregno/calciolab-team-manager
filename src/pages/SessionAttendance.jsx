import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { useAreaPermission } from "../components/auth/permissionContext";
import { formatDate, getRecordedTrainingStatus, getTrainingSessionStatus, isFriendlyMatch, isTrainingParticipation, parseRecordedMinutes } from "../utils/helpers";
import { useTranslation } from "../i18n";

const STATUS_OPTIONS = ["Presente", "Parziale", "Assente", "Infortunato", "Recupero", "Permesso", "Squalificato"];

const STATUS_TONE = {
  Presente:   "green",
  Assente:    "red",
  Infortunato:"orange",
  Parziale:   "blue",
  Recupero:   "blue",
  Permesso:   "blue",
  Squalificato:"purple",
};

function getFriendlySession(match) {
  if (!match) return null;
  const opponent = match.opponent || match.title || "Avversario";
  return {
    ...match,
    title: `Amichevole - ${opponent}`,
    theme: "Amichevole",
    exercises: [],
    isFriendlyMatch: true,
  };
}

export default function SessionAttendance({ players = [], sessions = [], setSessions, matches = [], setMatches }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const rosterReturn = state?.rosterWeek ? "/statistics?rosterWeek=" + encodeURIComponent(state.rosterWeek) : null;
  const [pendingOnly, setPendingOnly] = useState(Boolean(state?.pendingOnly));
  const { canManage } = useAreaPermission();
  const [showSummaryList, setShowSummaryList] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  const trainingSession = sessions.find((s) => String(s.id) === String(id));
  const friendlyMatch = matches.find((match) => String(match.id) === String(id) && isFriendlyMatch(match));
  const session = trainingSession || getFriendlySession(friendlyMatch);
  const updateEvents = session?.isFriendlyMatch ? setMatches : setSessions;
  const attendance = session?.attendance || {};
  const firstTeamPlayers = players.filter((player) => String(player.gruppo || "prima").trim().toLowerCase() === "prima");
  const visiblePlayers = pendingOnly
    ? firstTeamPlayers.filter((player) => getRecordedTrainingStatus(player, session) === null)
    : players;

  function updatePlayer(playerId, field, value) {
    if (!canManage) return;
    if (!session) return;
    if (!updateEvents) return;
    updateEvents((prevSessions) =>
      prevSessions.map((item) => {
        if (String(item.id) !== String(id)) return item;
        const current = item.attendance?.[playerId] || {};
        return {
          ...item,
          attendance: {
            ...(item.attendance || {}),
            [playerId]: { ...current, [field]: value },
          },
        };
      })
    );
  }

  function markAll(status) {
    if (!canManage) return;
    if (!session) return;
    if (!updateEvents) return;
    updateEvents((prevSessions) =>
      prevSessions.map((item) => {
        if (String(item.id) !== String(id)) return item;
        const newAttendance = { ...item.attendance };
        visiblePlayers.forEach((p) => {
          const playerId = String(p.id);
          if (pendingOnly && getRecordedTrainingStatus(p, item)) return;
          newAttendance[playerId] = {
            ...(item.attendance?.[playerId] || {}),
            status,
          };
        });
        return { ...item, attendance: newAttendance };
      })
    );
  }

  if (!session) {
    return (
      <div style={s.page}>
        <AppCard>
          <p style={s.muted}>{t("pages.sessionAttendance.sessionNotFound")}</p>
          <Button variant="ghost" onClick={() => navigate("/trainings")}>
            {t("pages.sessionAttendance.backToSessions")}
          </Button>
        </AppCard>
      </div>
    );
  }

  const totalMinutes = (session.exercises || []).reduce(
    (sum, item) => sum + Number(item.customDuration || 0),
    0
  );



  // Contatori per status
  const counts = firstTeamPlayers.reduce(
    (acc, p) => {
      const st = getRecordedTrainingStatus(p, session) ?? "Da confermare";
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    {}
  );

  const presenti = (counts.Presente || 0) + (counts.Recupero || 0);
  const partial = counts.Parziale || 0;
  const pending = counts["Da confermare"] || 0;
  const assenti     = counts["Assente"]     || 0;
  const infortunati = counts["Infortunato"] || 0;
  const permesso    = counts["Permesso"]    || 0;

  const subtitle = [
    formatDate(session.date),
    session.theme,
    totalMinutes ? `${totalMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={s.page}>
      <PageHeader
        title={`${t("pages.sessionAttendance.title")} — ${session.title || t("pages.sessionAttendance.defaultSession")}`}
        subtitle={subtitle}
        badge={t("pages.sessionAttendance.badge", { count: firstTeamPlayers.length })}
      />

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      {/* Barra riepilogo + azioni */}
      <AppCard>
        <div style={s.topBar}>
          <div style={s.summary}>
            <SummaryPill color="#22c55e" icon="✔" label={t("pages.sessionAttendance.summaryPresenti")}    value={presenti} />
            {partial > 0 && <SummaryPill color="#38bdf8" icon="◐" label="parziali" value={partial} />}
            {assenti     > 0 && <SummaryPill color="#f87171"  icon="✖" label={t("pages.sessionAttendance.summaryAssenti")}     value={assenti} />}
            {infortunati > 0 && <SummaryPill color="#fb923c"  icon="⚠" label={t("pages.sessionAttendance.summaryInfortunati")} value={infortunati} />}
            {permesso    > 0 && <SummaryPill color="#38bdf8"  icon="◎" label={t("pages.sessionAttendance.summaryPermesso")}    value={permesso} />}
            {pending > 0 && <SummaryPill color="#facc15" icon="?" label="da confermare" value={pending} />}
          </div>
          <div style={s.topActions}>
            {canManage && (
              <Button variant="ghost" onClick={() => setConfirmState({
                message: "Questo aggiornerà le presenze di tutti i giocatori. Vuoi continuare?",
                confirmLabel: t("pages.sessionAttendance.markAllPresent"),
                onConfirm: () => markAll("Presente"),
              })}>
                {t("pages.sessionAttendance.markAllPresent")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate(rosterReturn || "/trainings")}>
              {rosterReturn ? "Torna al riepilogo settimanale" : t("pages.sessionAttendance.back")}
            </Button>
          </div>
        </div>
      </AppCard>

      {/* Lista riepilogo presenti/assenti */}
      {(() => {
        const getName = (p) => `${p.lastName || ""} ${p.firstName || ""}`.trim() || p.name || "—";
        const getSortKey = (p) => (p.lastName || p.name || "").toLowerCase();
        const getRoleOrder = (role) => {
          const r = (role || "").toLowerCase();
          if (r.startsWith("portiere")) return 0;
          if (r.startsWith("difensore")) return 1;
          if (r.startsWith("centrocampista")) return 2;
          if (r.startsWith("attaccante")) return 3;
          return 99;
        };
        const sortByRole = (arr) => [...arr].sort((a, b) => {
          const ra = getRoleOrder(a.role);
          const rb = getRoleOrder(b.role);
          if (ra !== rb) return ra - rb;
          return getSortKey(a).localeCompare(getSortKey(b), "it");
        });
        const presentiList = sortByRole(firstTeamPlayers.filter((p) => isTrainingParticipation(getRecordedTrainingStatus(p, session))));
        const assentiList  = sortByRole(firstTeamPlayers.filter((p) => !isTrainingParticipation(getRecordedTrainingStatus(p, session))));
        return (
          <AppCard>
            <button
              type="button"
              aria-expanded={showSummaryList}
              aria-controls={showSummaryList ? "attendance-summary" : undefined}
              onClick={() => setShowSummaryList((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, padding: 0 }}
            >
              {showSummaryList ? "▲" : "▼"} {t("pages.sessionAttendance.firstTeamSummary")}
            </button>
            {showSummaryList && (
              <div id="attendance-summary" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 14 }}>
                <div>
                  <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 13, marginBottom: 8 }}>✔ Presenti ({presentiList.length})</p>
                  {presentiList.map((p) => {
                    return (
                      <div key={p.id} style={{ fontSize: 13, color: "#e2e8f0", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {getName(p)} <span style={{ color: "#64748b", fontSize: 11 }}>{p.role || ""}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <p style={{ color: "#f87171", fontWeight: 800, fontSize: 13, marginBottom: 8 }}>✖ {t("pages.sessionAttendance.notOnPitch")} ({assentiList.length})</p>
                  {assentiList.map((p) => {
                    const st = getTrainingSessionStatus(p, session);
                    const stColor = { Assente: "#f87171", Infortunato: "#fb923c", Recupero: "#38bdf8", Permesso: "#38bdf8", Squalificato: "#c084fc" }[st] || "#94a3b8";
                    return (
                      <div key={p.id} style={{ fontSize: 13, color: "#e2e8f0", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                        <span>{getName(p)} <span style={{ color: "#64748b", fontSize: 11 }}>{p.role || ""}</span></span>
                        <span style={{ color: stColor, fontSize: 11, fontWeight: 700 }}>{st}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </AppCard>
        );
      })()}

      {players.length === 0 ? (
        <AppCard>
          <p style={s.muted}>{t("pages.sessionAttendance.noPlayers")}</p>
        </AppCard>
      ) : (
        <AppCard>
          {state?.pendingOnly && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Button variant="ghost" onClick={() => setPendingOnly((value) => !value)}>
                {t(pendingOnly ? "pages.sessionAttendance.showAllPlayers" : "pages.sessionAttendance.showPendingPlayers")}
              </Button>
              {!rosterReturn && <Button variant="ghost" onClick={() => navigate("/")}>{t("pages.sessionAttendance.backToDashboard")}</Button>}
            </div>
          )}
          {pendingOnly && !visiblePlayers.length && <p role="status">{t("pages.sessionAttendance.attendanceComplete")}</p>}
          <div className="cl-fluid-grid" style={s.grid}>
            {[...visiblePlayers].sort((a, b) => {
              const ro = (r) => { const s = (r||"").toLowerCase(); return s.startsWith("portiere") ? 0 : s.startsWith("difensore") ? 1 : s.startsWith("centrocampista") ? 2 : s.startsWith("attaccante") ? 3 : 99; };
              if (ro(a.role) !== ro(b.role)) return ro(a.role) - ro(b.role);
              return (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "it");
            }).map((player) => {
              const pid    = String(player.id);
              const data   = attendance[pid] || {};
              const recorded = getRecordedTrainingStatus(player, session);
              const status = getTrainingSessionStatus(player, session);
              const rpe    = data.rpe ?? "";
              const displayName =
                [player.firstName, player.lastName].filter(Boolean).join(" ") ||
                player.name ||
                "—";

              return (
                <div key={pid} style={s.playerCard}>
                  {/* Header giocatore */}
                  <div style={s.playerHeader}>
                    <div style={{ minWidth: 0 }}>
                      <p style={s.playerName}>{displayName}</p>
                      <p style={s.playerRole}>{player.role || "—"}</p>
                    </div>
                    <Badge tone={STATUS_TONE[status] || "blue"}>{recorded ?? ("Da confermare · suggerito " + status)}</Badge>
                  </div>

                  {/* Bottoni stato */}
                  <div style={s.statusButtons}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={recorded === opt}
                        onClick={() => updatePlayer(pid, "status", opt)}
                        disabled={!canManage}
                        style={{
                          ...s.statusBtn,
                          ...(status === opt ? s.statusBtnActive : {}),
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {/* RPE solo se presente */}
                  {recorded === "Parziale" && (
                    <label style={s.rpeRow}>
                      <span>Minuti svolti (facoltativi)</span>
                      <input style={s.rpeInput} type="number" min="1" step="1" inputMode="numeric"
                        value={data.partialMinutes ?? ""} disabled={!canManage}
                        onChange={(event) => {
                          const value = event.target.value;
                          const minutes = parseRecordedMinutes(value, Infinity);
                          if (value === "" || minutes > 0) updatePlayer(pid, "partialMinutes", minutes);
                        }} />
                    </label>
                  )}
                  {isTrainingParticipation(status) && (
                    <div style={s.rpeRow}>
                      <span style={s.rpeLabel}>RPE</span>
                      <input
                        style={s.rpeInput}
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        aria-label={`RPE ${displayName}`}
                        inputMode="decimal"
                        placeholder="1–10"
                        value={rpe}
                        onChange={(e) => updatePlayer(pid, "rpe", e.target.value)}
                        disabled={!canManage}
                      />
                      <span style={s.rpeHint}>{t("pages.sessionAttendance.rpeHint")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </AppCard>
      )}
    </div>
  );
}

function SummaryPill({ color, icon, label, value }) {
  return (
    <span style={{ ...pill.base, color }}>
      {icon} <strong>{value}</strong> {label}
    </span>
  );
}

const pill = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 14,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
};

const s = {
  page: { display: "grid", gap: 18 },
  muted: { color: "#94a3b8", margin: 0 },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  summary: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  pct: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    marginLeft: 4,
  },
  topActions: { display: "flex", gap: 10 },

  grid: {
    display: "grid",
    "--cl-grid-min": "280px",
    gap: 14,
  },

  playerCard: {
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 12,
  },
  playerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  playerName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#e2e8f0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  playerRole: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#64748b",
  },

  statusButtons: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  statusBtn: {
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    color: "white",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    transition: "background 0.15s, border-color 0.15s",
  },
  statusBtnActive: {
    background: "rgba(56,189,248,0.20)",
    border: "1px solid rgba(56,189,248,0.45)",
  },

  rpeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  rpeLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  rpeInput: {
    width: 68,
    padding: "5px 8px",
    borderRadius: 8,
    border: "1px solid rgba(56,189,248,0.3)",
    background: "rgba(56,189,248,0.06)",
    color: "#e2e8f0",
    fontSize: 14,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  rpeHint: {
    fontSize: 11,
    color: "#475569",
  },
};
