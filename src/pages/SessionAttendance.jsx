import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { formatDate } from "../utils/helpers";
import { useTranslation } from "../i18n";

const STATUS_OPTIONS = ["Presente", "Assente", "Infortunato", "Permesso"];

const STATUS_TONE = {
  Presente:   "green",
  Assente:    "red",
  Infortunato:"orange",
  Permesso:   "blue",
};

export default function SessionAttendance({ players = [], sessions = [], setSessions }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const session = sessions.find((s) => String(s.id) === String(id));

  function updatePlayer(playerId, field, value) {
    if (!session) return;
    setSessions((prevSessions) =>
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
    if (!session) return;
    setSessions((prevSessions) =>
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
          <p style={s.muted}>Seduta non trovata.</p>
          <Button variant="ghost" onClick={() => navigate("/trainings")}>
            Torna alle sedute
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
      const st = attendance[String(p.id)]?.status || "Presente";
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
        badge={`${players.length} giocatori`}
      />

      {/* Barra riepilogo + azioni */}
      <AppCard>
        <div style={s.topBar}>
          <div style={s.summary}>
            <SummaryPill color="#22c55e" icon="✔" label="presenti"    value={presenti} />
            {assenti     > 0 && <SummaryPill color="#f87171"  icon="✖" label="assenti"     value={assenti} />}
            {infortunati > 0 && <SummaryPill color="#fb923c"  icon="⚠" label="infortunati" value={infortunati} />}
            {permesso    > 0 && <SummaryPill color="#38bdf8"  icon="◎" label="permesso"    value={permesso} />}
            <span style={s.pct}>{pct}% presenza</span>
          </div>
          <div style={s.topActions}>
            <Button variant="ghost" onClick={() => markAll("Presente")}>
              Tutti presenti
            </Button>
            <Button variant="ghost" onClick={() => navigate("/trainings")}>
              Indietro
            </Button>
          </div>
        </div>
      </AppCard>

      {players.length === 0 ? (
        <AppCard>
          <p style={s.muted}>
            Nessun giocatore in rosa. Aggiungili dalla sezione Giocatori.
          </p>
        </AppCard>
      ) : (
        <AppCard>
          <div style={s.grid}>
            {players.map((player) => {
              const pid    = String(player.id);
              const data   = attendance[pid] || {};
              // Pre-marca automaticamente infortunati e squalificati se non già registrati
              const playerRosterStatus = player.status || "Disponibile";
              const defaultStatus =
                playerRosterStatus === "Infortunato"  ? "Infortunato" :
                playerRosterStatus === "Squalificato" ? "Assente"     : "Presente";
              const status = data.status || defaultStatus;
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
                      />
                      <span style={s.rpeHint}>Carico percepito</span>
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
