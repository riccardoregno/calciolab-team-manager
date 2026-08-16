import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { useAreaPermission } from "../components/auth/permissionContext";
import { formatDate, getPlayerUnavailabilityOnDate } from "../utils/helpers";
import { useTranslation } from "../i18n";

const STATUS_OPTIONS = ["Presente", "Assente", "Infortunato", "Recupero", "Permesso", "Squalificato"];

const STATUS_TONE = {
  Presente:   "green",
  Assente:    "red",
  Infortunato:"orange",
  Recupero:   "blue",
  Permesso:   "blue",
  Squalificato:"purple",
};

function normalizeDateStr(value) {
  if (!value) return "";
  const direct = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultStatus(player, dateStr) {
  if (player.status === "Infortunato") return "Infortunato";
  if (player.status === "Squalificato") return "Squalificato";
  const unavailability = getPlayerUnavailabilityOnDate(player, dateStr);
  if (unavailability?.type === "injury") return "Infortunato";
  if (unavailability?.type === "absence") return "Permesso";
  if (player.status === "Recupero" || player.status === "Differenziato") return "Recupero";
  if ((player.gruppo || "prima") === "juniores") return "Assente";
  return "Presente";
}

function getPlayerSessionStatus(player, session, attendance) {
  const entry = attendance[String(player.id)] || {};
  return STATUS_TONE[entry.status] ? entry.status : getDefaultStatus(player, normalizeDateStr(session.date));
}

function isFriendlyMatch(match) {
  if (match?.type !== "Partita") return false;
  if (match.isFriendly === true || match.friendly === true) return true;
  const fields = [match.matchKind, match.match_kind, match.competition, match.category, match.kind, match.title, match.notes];
  return fields.some((value) => String(value || "").trim().toLowerCase().includes("amichevol"));
}

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
  const { canManage } = useAreaPermission();
  const [showSummaryList, setShowSummaryList] = useState(false);

  const trainingSession = sessions.find((s) => String(s.id) === String(id));
  const friendlyMatch = matches.find((match) => String(match.id) === String(id) && isFriendlyMatch(match));
  const session = trainingSession || getFriendlySession(friendlyMatch);
  const updateEvents = session?.isFriendlyMatch ? setMatches : setSessions;

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
        const newAttendance = {};
        players.forEach((p) => {
          const playerId = String(p.id);
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

  const attendance = session.attendance || {};

  // Contatori per status
  const counts = players.reduce(
    (acc, p) => {
      const st = getPlayerSessionStatus(p, session, attendance);
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    {}
  );

  const presenti    = counts["Presente"]    || 0;
  const assenti     = counts["Assente"]     || 0;
  const infortunati = counts["Infortunato"] || 0;
  const permesso    = counts["Permesso"]    || 0;
  const pct = players.length > 0 ? Math.round((presenti / players.length) * 100) : 0;

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
        badge={t("pages.sessionAttendance.badge", { count: players.length })}
      />

      {/* Barra riepilogo + azioni */}
      <AppCard>
        <div style={s.topBar}>
          <div style={s.summary}>
            <SummaryPill color="#22c55e" icon="✔" label={t("pages.sessionAttendance.summaryPresenti")}    value={presenti} />
            {assenti     > 0 && <SummaryPill color="#f87171"  icon="✖" label={t("pages.sessionAttendance.summaryAssenti")}     value={assenti} />}
            {infortunati > 0 && <SummaryPill color="#fb923c"  icon="⚠" label={t("pages.sessionAttendance.summaryInfortunati")} value={infortunati} />}
            {permesso    > 0 && <SummaryPill color="#38bdf8"  icon="◎" label={t("pages.sessionAttendance.summaryPermesso")}    value={permesso} />}
            <span style={s.pct}>{pct}{t("pages.sessionAttendance.summaryPct")}</span>
          </div>
          <div style={s.topActions}>
            {canManage && (
              <Button variant="ghost" onClick={() => { if (window.confirm("Sei sicuro? Questo sovrascriverà le presenze di tutti i giocatori.")) markAll("Presente"); }}>
                {t("pages.sessionAttendance.markAllPresent")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/trainings")}>
              {t("pages.sessionAttendance.back")}
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
        const isJun = (p) => (p.gruppo || "prima") === "juniores";
        const sortByRole = (arr) => [...arr].sort((a, b) => {
          const ra = getRoleOrder(a.role);
          const rb = getRoleOrder(b.role);
          if (ra !== rb) return ra - rb;
          return getSortKey(a).localeCompare(getSortKey(b), "it");
        });
        const sortByGruppoRole = (arr) => [...arr].sort((a, b) => {
          const ga = isJun(a) ? 1 : 0;
          const gb = isJun(b) ? 1 : 0;
          if (ga !== gb) return ga - gb;
          const ra = getRoleOrder(a.role);
          const rb = getRoleOrder(b.role);
          if (ra !== rb) return ra - rb;
          return getSortKey(a).localeCompare(getSortKey(b), "it");
        });
        const presentiList = sortByRole(players.filter((p) => getPlayerSessionStatus(p, session, attendance) === "Presente"));
        const assentiList  = sortByGruppoRole(players.filter((p) => getPlayerSessionStatus(p, session, attendance) !== "Presente"));
        return (
          <AppCard>
            <button
              onClick={() => setShowSummaryList((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, padding: 0 }}
            >
              {showSummaryList ? "▲" : "▼"} Lista presenti / non in campo
            </button>
            {showSummaryList && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 14 }}>
                <div>
                  <p style={{ color: "#22c55e", fontWeight: 800, fontSize: 13, marginBottom: 8 }}>✔ Presenti ({presentiList.length})</p>
                  {presentiList.map((p) => {
                    const isJuniores = (p.gruppo || "prima") === "juniores";
                    return (
                      <div key={p.id} style={{ fontSize: 13, color: "#e2e8f0", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        {getName(p)} <span style={{ color: "#64748b", fontSize: 11 }}>{p.role || ""}{isJuniores ? " · Juniores" : ""}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <p style={{ color: "#f87171", fontWeight: 800, fontSize: 13, marginBottom: 8 }}>✖ Assenti ({assentiList.length})</p>
                  {assentiList.map((p) => {
                    const st = getPlayerSessionStatus(p, session, attendance);
                    const stColor = { Assente: "#f87171", Infortunato: "#fb923c", Recupero: "#38bdf8", Permesso: "#38bdf8", Squalificato: "#c084fc" }[st] || "#94a3b8";
                    const isJuniores = (p.gruppo || "prima") === "juniores";
                    return (
                      <div key={p.id} style={{ fontSize: 13, color: "#e2e8f0", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                        <span>{getName(p)} <span style={{ color: "#64748b", fontSize: 11 }}>{p.role || ""}{isJuniores ? " · Juniores" : ""}</span></span>
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
          <div style={s.grid}>
            {[...players].sort((a, b) => {
              const ro = (r) => { const s = (r||"").toLowerCase(); return s.startsWith("portiere") ? 0 : s.startsWith("difensore") ? 1 : s.startsWith("centrocampista") ? 2 : s.startsWith("attaccante") ? 3 : 99; };
              if (ro(a.role) !== ro(b.role)) return ro(a.role) - ro(b.role);
              return (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "it");
            }).map((player) => {
              const pid    = String(player.id);
              const data   = attendance[pid] || {};
              const status = getPlayerSessionStatus(player, session, attendance);
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
                    <Badge tone={STATUS_TONE[status] || "blue"}>{status}</Badge>
                  </div>

                  {/* Bottoni stato */}
                  <div style={s.statusButtons}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt}
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
                  {status === "Presente" && (
                    <div style={s.rpeRow}>
                      <span style={s.rpeLabel}>RPE</span>
                      <input
                        style={s.rpeInput}
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
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
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
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
