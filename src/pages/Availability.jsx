import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { getAvailabilityGroups } from "../utils/helpers";

export default function Availability({ players = [], setPlayers }) {
  const groups = getAvailabilityGroups(players);

  function updatePlayer(playerId, field, value) {
    setPlayers(
      players.map((player) =>
        player.id === playerId ? { ...player, [field]: value } : player
      )
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Disponibilita"
        subtitle="Stato rosa, infortuni, recuperi e rientri previsti"
      />

      <div style={availabilityStyles.kpiGrid}>
        <Kpi title="Disponibili" value={groups.available.length} tone="green" />
        <Kpi title="Recupero" value={groups.limited.length} tone="orange" />
        <Kpi title="Infortunati" value={groups.injured.length} tone="red" />
        <Kpi title="Squalificati" value={groups.suspended.length} tone="purple" />
      </div>

      <AppCard>
        <div style={availabilityStyles.table}>
          {players.map((player) => (
            <div key={player.id} style={availabilityStyles.row}>
              <div>
                <strong>{player.name}</strong>
                <p style={availabilityStyles.muted}>{player.role || "Ruolo"} · #{player.shirtNumber || "-"}</p>
              </div>
              <select
                value={player.status || "Disponibile"}
                onChange={(event) => updatePlayer(player.id, "status", event.target.value)}
                style={styles.input}
              >
                <option>Disponibile</option>
                <option>Differenziato</option>
                <option>Recupero</option>
                <option>Infortunato</option>
                <option>Squalificato</option>
                <option>Permesso</option>
              </select>
              <input
                placeholder="Problema / fase"
                value={player.injuryType || player.returnPhase || ""}
                onChange={(event) => updatePlayer(player.id, "injuryType", event.target.value)}
                style={styles.input}
              />
              <input
                type="date"
                value={player.expectedReturn || ""}
                onChange={(event) => updatePlayer(player.id, "expectedReturn", event.target.value)}
                style={styles.input}
              />
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function Kpi({ title, value, tone }) {
  return (
    <AppCard>
      <Badge tone={tone}>{title}</Badge>
      <h2 style={{ marginBottom: 0 }}>{value}</h2>
    </AppCard>
  );
}

const availabilityStyles = {
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 22 },
  table: { display: "grid", gap: 12 },
  row: { display: "grid", gridTemplateColumns: "1.2fr 180px 1fr 180px", gap: 12, alignItems: "center", padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  muted: { color: "#94a3b8", margin: "6px 0 0" },
};

