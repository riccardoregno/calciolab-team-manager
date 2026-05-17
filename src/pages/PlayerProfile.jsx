import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { loadPlayerById, loadPlayerStats, loadPlayerMatches } from "../services/playerProfile";
import { useAuth } from "../hooks/useAuth";

const SECTIONS = ["overview", "partite", "sviluppo"];
const SECTION_LABELS = { overview: "Overview", partite: "Partite", sviluppo: "Sviluppo" };

const STATUS_TONE = { Disponibile: "green", Recupero: "orange", Infortunato: "red" };

export default function PlayerProfile({ players = [], matches = [], physicalTests = [], loading: appLoading = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();

  // Cerca prima nello state locale (già caricato da Supabase via useTeamData)
  const playerFromState = players.find((p) => String(p.id) === String(id));

  const [playerFromDb, setPlayerFromDb] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [section, setSection] = useState("overview");
  const [stats, setStats] = useState(null);
  const [playerMatches, setPlayerMatches] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fallback: carica direttamente da Supabase se lo state non ha ancora il player
  useEffect(() => {
    if (playerFromState || appLoading || !auth.team?.id || !id) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerLoading(true);
    loadPlayerById(auth.team.id, id).then(({ data }) => {
      setPlayerFromDb(data);
      setPlayerLoading(false);
    });
  }, [playerFromState, appLoading, auth.team?.id, id]);

  // Carica stats e partite da Supabase
  useEffect(() => {
    if (!auth.team?.id || !id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);
    Promise.all([
      loadPlayerStats(auth.team.id, id),
      loadPlayerMatches(auth.team.id, id),
    ]).then(([statsResult, matchesResult]) => {
      setStats(statsResult.data);
      setPlayerMatches(matchesResult.data);
      setLoadingStats(false);
    });
  }, [auth.team?.id, id]);

  const player = playerFromState || playerFromDb;

  if (appLoading || playerLoading) {
    return (
      <div style={styles.page}>
        <AppCard><p style={styles.muted}>Caricamento giocatore...</p></AppCard>
      </div>
    );
  }

  if (!player) {
    return (
      <div style={styles.page}>
        <AppCard>
          <p style={styles.muted}>Giocatore non trovato.</p>
          <Button variant="ghost" onClick={() => navigate("/players")}>Torna alla rosa</Button>
        </AppCard>
      </div>
    );
  }

  const initials = [player.firstName, player.lastName, player.name]
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const displayName = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";

  // Presenze e minuti derivati dai dati locali come fallback
  const localAppearances = matches.filter(
    (m) => m.attendance && Object.keys(m.attendance).includes(String(player.id))
  ).length;

  const recentTests = physicalTests
    .filter((t) => t.playerId === String(player.id))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 4);

  const matchesWithContext = playerMatches
    .map((pm) => {
      const match = matches.find((m) => String(m.id) === String(pm.match_id));
      return { ...pm, match };
    })
    .sort((a, b) => new Date(b.match?.date || 0) - new Date(a.match?.date || 0));

  return (
    <div style={styles.page}>
      <PageHeader
        title={displayName}
        subtitle={[player.role, player.shirtNumber ? `#${player.shirtNumber}` : null].filter(Boolean).join(" · ")}
        badge={player.status || "Disponibile"}
      />

      {/* Header giocatore */}
      <AppCard>
        <div style={styles.playerHeader}>
          <div style={styles.avatar}>{initials}</div>
          <div style={styles.playerInfo}>
            <div style={styles.badgeRow}>
              <Badge tone={STATUS_TONE[player.status] || "blue"}>{player.status || "Disponibile"}</Badge>
              {player.nationality && <Badge tone="blue">{player.nationality}</Badge>}
              {player.foot && <Badge tone="blue">Piede {player.foot}</Badge>}
            </div>
            <div style={styles.metaRow}>
              {player.birthDate && <span style={styles.metaItem}>Nato: {player.birthDate}</span>}
              {player.height && <span style={styles.metaItem}>{player.height} cm</span>}
              {player.weight && <span style={styles.metaItem}>{player.weight} kg</span>}
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate(`/players/${id}`)}>Modifica</Button>
        </div>
      </AppCard>

      {/* Navigazione sezioni */}
      <div style={styles.tabRow}>
        {SECTIONS.map((s) => (
          <button
            key={s}
            style={{ ...styles.tab, ...(section === s ? styles.tabActive : {}) }}
            onClick={() => setSection(s)}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {section === "overview" && (
        <div style={styles.grid2}>
          <AppCard title="Statistiche stagione">
            {loadingStats ? (
              <p style={styles.muted}>Caricamento...</p>
            ) : (
              <div style={styles.kpiGrid}>
                <Kpi label="Presenze" value={stats?.appearances ?? localAppearances} />
                <Kpi label="Gol" value={stats?.goals ?? 0} />
                <Kpi label="Assist" value={stats?.assists ?? 0} />
                <Kpi label="Minuti" value={stats?.minutes_played ?? 0} />
                <Kpi label="Ammonizioni" value={stats?.yellow_cards ?? 0} />
                <Kpi label="Espulsioni" value={stats?.red_cards ?? 0} />
              </div>
            )}
          </AppCard>

          <AppCard title="Valutazioni tecniche">
            {player.ratings ? (
              <div style={styles.ratingList}>
                {Object.entries(player.ratings).map(([key, val]) => (
                  <RatingRow key={key} label={key} value={val} />
                ))}
              </div>
            ) : (
              <p style={styles.muted}>Nessuna valutazione inserita.</p>
            )}
          </AppCard>
        </div>
      )}

      {/* ── PARTITE ── */}
      {section === "partite" && (
        <AppCard title="Storico partite">
          {loadingStats ? (
            <p style={styles.muted}>Caricamento...</p>
          ) : matchesWithContext.length === 0 ? (
            <p style={styles.muted}>Nessuna partita registrata per questo giocatore.</p>
          ) : (
            <div style={styles.matchList}>
              <div style={styles.matchHeader}>
                <span>Partita</span>
                <span>Min</span>
                <span>Gol</span>
                <span>Assist</span>
                <span>Rating</span>
              </div>
              {matchesWithContext.map((pm) => (
                <div key={pm.id} style={styles.matchRow}>
                  <span style={styles.matchName}>
                    {pm.match
                      ? `${pm.match.opponent || "Avversario"} — ${pm.match.date || ""}`
                      : `Partita ${pm.match_id}`}
                  </span>
                  <span>{pm.minutes_played}</span>
                  <span>{pm.goals}</span>
                  <span>{pm.assists}</span>
                  <span>{pm.rating ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      )}

      {/* ── SVILUPPO ── */}
      {section === "sviluppo" && (
        <div style={styles.grid2}>
          <AppCard title="Obiettivi e note tecniche">
            <InfoField label="Obiettivo settimanale" value={player.weeklyGoal} />
            <InfoField label="Obiettivi individuali" value={player.individualGoals} />
            <InfoField label="Punti di forza" value={player.strengths} />
            <InfoField label="Da migliorare" value={player.improvements} />
            <InfoField label="Note staff" value={player.notes} />
          </AppCard>

          <AppCard title="Test fisici recenti">
            {recentTests.length === 0 ? (
              <p style={styles.muted}>Nessun test registrato.</p>
            ) : (
              <div style={styles.testList}>
                {recentTests.map((t, i) => (
                  <div key={i} style={styles.testRow}>
                    <span style={styles.testName}>{t.type || t.testType || "Test"}</span>
                    <span style={styles.muted}>{t.date || "—"}</span>
                    <Badge tone="blue">{t.result ?? t.value ?? "—"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </AppCard>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={styles.kpiItem}>
      <span style={styles.kpiValue}>{value}</span>
      <span style={styles.kpiLabel}>{label}</span>
    </div>
  );
}

function RatingRow({ label, value }) {
  const pct = ((value || 0) / 10) * 100;
  const labelMap = {
    technique: "Tecnica", vision: "Visione", intensity: "Intensità",
    speed: "Velocità", physicality: "Fisico", leadership: "Leadership",
    tactics: "Tattica", mentality: "Mentalità",
  };
  return (
    <div style={styles.ratingRow}>
      <span style={styles.ratingLabel}>{labelMap[label] || label}</span>
      <div style={styles.ratingTrack}>
        <div style={{ ...styles.ratingBar, width: `${pct}%` }} />
      </div>
      <span style={styles.ratingVal}>{value}</span>
    </div>
  );
}

function InfoField({ label, value }) {
  if (!value) return null;
  return (
    <div style={styles.infoField}>
      <span style={styles.infoLabel}>{label}</span>
      <p style={styles.infoValue}>{value}</p>
    </div>
  );
}

const styles = {
  page: { display: "grid", gap: 18 },
  muted: { color: "#94a3b8", margin: 0 },

  playerHeader: { display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" },
  avatar: {
    width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#22c55e,#38bdf8)",
    display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700, color: "#0f1115", flexShrink: 0,
  },
  playerInfo: { flex: 1, display: "grid", gap: 8 },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  metaRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  metaItem: { color: "#94a3b8", fontSize: 13 },

  tabRow: { display: "flex", gap: 6 },
  tab: {
    padding: "8px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500,
  },
  tabActive: { background: "rgba(34,197,94,0.15)", borderColor: "#22c55e", color: "#22c55e" },

  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 },

  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  kpiItem: { display: "grid", gap: 4, textAlign: "center", padding: "12px 0" },
  kpiValue: { fontSize: 28, fontWeight: 700 },
  kpiLabel: { fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" },

  ratingList: { display: "grid", gap: 10 },
  ratingRow: { display: "flex", alignItems: "center", gap: 10 },
  ratingLabel: { width: 80, fontSize: 13, color: "#cbd5e1", flexShrink: 0 },
  ratingTrack: { flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
  ratingBar: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#38bdf8)" },
  ratingVal: { width: 20, textAlign: "right", fontSize: 13, color: "#94a3b8" },

  matchList: { display: "grid", gap: 0 },
  matchHeader: {
    display: "grid", gridTemplateColumns: "1fr 50px 50px 50px 60px",
    padding: "8px 12px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  matchRow: {
    display: "grid", gridTemplateColumns: "1fr 50px 50px 50px 60px",
    padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)",
    fontSize: 14, color: "#cbd5e1", alignItems: "center",
  },
  matchName: { color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  testList: { display: "grid", gap: 10 },
  testRow: { display: "flex", alignItems: "center", gap: 12 },
  testName: { flex: 1, color: "#e2e8f0", fontSize: 14 },

  infoField: { marginBottom: 14 },
  infoLabel: { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" },
  infoValue: { margin: "4px 0 0", color: "#cbd5e1", lineHeight: 1.6 },
};
