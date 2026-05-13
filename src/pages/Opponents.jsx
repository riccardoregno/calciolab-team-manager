import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import { formatShortDate } from "../utils/helpers";

export default function Opponents({ matches = [] }) {
  const opponents = Object.values(
    matches.reduce((acc, match) => {
      const name = match.opponent || "Avversario";
      if (!acc[name]) acc[name] = { name, matches: [], formations: new Set(), players: new Set() };
      acc[name].matches.push(match);
      if (match.opponentScouting?.formation) acc[name].formations.add(match.opponentScouting.formation);
      (match.opponentScouting?.lineup || []).forEach((player) => player.name && acc[name].players.add(player.name));
      return acc;
    }, {})
  );

  return (
    <div>
      <PageHeader title="Avversari" subtitle="Storico scouting, moduli, distinte e note ritorno" />
      <div style={opponentStyles.grid}>
        {opponents.length ? opponents.map((opponent) => (
          <AppCard key={opponent.name}>
            <div style={opponentStyles.header}>
              <h3 style={{ margin: 0 }}>{opponent.name}</h3>
              <Badge tone="orange">{opponent.matches.length} gare</Badge>
            </div>
            <p style={opponentStyles.muted}>Moduli: {Array.from(opponent.formations).join(", ") || "-"}</p>
            <p style={opponentStyles.muted}>Giocatori visti: {Array.from(opponent.players).slice(0, 6).join(", ") || "-"}</p>
            <div style={opponentStyles.matchList}>
              {opponent.matches.map((match) => (
                <div key={match.id} style={opponentStyles.matchItem}>
                  <strong>{formatShortDate(match.date)} · {match.result || "Risultato -"}</strong>
                  <span>{match.opponentScouting?.returnLegNotes || match.opponentNotes || "Nessuna nota"}</span>
                </div>
              ))}
            </div>
          </AppCard>
        )) : (
          <AppCard><p style={opponentStyles.muted}>Aggiungi una partita e compila lo scouting avversario.</p></AppCard>
        )}
      </div>
    </div>
  );
}

const opponentStyles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 },
  muted: { color: "#94a3b8", lineHeight: 1.5 },
  matchList: { display: "grid", gap: 10, marginTop: 14 },
  matchItem: { display: "grid", gap: 5, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
};

