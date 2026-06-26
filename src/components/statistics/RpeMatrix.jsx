import { useEffect, useState } from "react";
import { fetchTeamRpe } from "../../services/sessionRpe";
import AppCard from "../ui/AppCard";
import { comparePlayersByName, formatShortDate } from "../../utils/helpers";

const BORG_LABELS = {
  1: "Molto leggero", 2: "Leggero", 3: "Moderato",
  4: "Abbastanza intenso", 5: "Intenso", 6: "Intenso+",
  7: "Molto intenso", 8: "Molto intenso+", 9: "Estremamente intenso", 10: "Massimale",
};

function rpeColor(v) {
  if (!v) return { bg: "rgba(255,255,255,0.04)", text: "#475569" };
  if (v <= 3) return { bg: "rgba(34,197,94,0.18)",  text: "#4ade80" };
  if (v <= 6) return { bg: "rgba(250,204,21,0.18)",  text: "#facc15" };
  if (v <= 8) return { bg: "rgba(251,146,60,0.2)",   text: "#fb923c" };
  return          { bg: "rgba(248,113,113,0.22)",    text: "#f87171" };
}

export default function RpeMatrix({ teamId, players = [], sessions = [], matches = [] }) {
  const [rpeData, setRpeData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchTeamRpe({ teamId }).then(({ data }) => {
      setRpeData(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamId]);

  // Ultimi 12 eventi (sessioni + partite), ordine cronologico crescente
  const events = [
    ...sessions.map((s) => ({ ...s, eventType: "session", label: s.title || "Allenamento", date: s.date })),
    ...matches.map((m)  => ({ ...m, eventType: "match",   label: `vs ${m.opponent || "?"}`, date: m.date })),
  ]
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Indice rpe: "playerId:eventId" → record
  const rpeIndex = {};
  rpeData.forEach((r) => { rpeIndex[`${r.player_id}:${r.event_id}`] = r; });

  // Giocatori attivi (con almeno una valutazione) + tutti gli altri, ciascun
  // gruppo ordinato per cognome e nome.
  const activePlayers = players
    .filter((p) => events.some((e) => rpeIndex[`${p.id}:${e.id}`]))
    .sort(comparePlayersByName);
  const otherPlayers = players
    .filter((p) => !events.some((e) => rpeIndex[`${p.id}:${e.id}`]))
    .sort(comparePlayersByName);
  const orderedPlayers = [...activePlayers, ...otherPlayers];

  // Medie per evento
  function eventAvg(eventId) {
    const vals = players.map((p) => rpeIndex[`${p.id}:${eventId}`]?.rpe_value).filter(Boolean);
    if (!vals.length) return null;
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
  }

  // Media per giocatore
  function playerAvg(playerId) {
    const vals = events.map((e) => rpeIndex[`${playerId}:${e.id}`]?.rpe_value).filter(Boolean);
    if (!vals.length) return null;
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
  }

  if (loading) return <AppCard><p style={s.muted}>Caricamento RPE…</p></AppCard>;
  if (events.length === 0) return null;

  return (
    <AppCard>
      <div style={{ marginBottom: 16 }}>
        <h3 style={s.title}>Matrice RPE (Borg 1–10)</h3>
        <p style={s.muted}>Valutazione soggettiva dello sforzo percepito dai giocatori dopo ogni seduta o partita.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          {[[1,3,"#4ade80","Leggero"],[4,6,"#facc15","Medio"],[7,8,"#fb923c","Intenso"],[9,10,"#f87171","Massimale"]].map(([lo,hi,color,label]) => (
            <span key={label} style={{ fontSize: 11, color, fontWeight: 700 }}>● {lo}–{hi} {label}</span>
          ))}
          <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>— Non compilato</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
          <thead>
            <tr>
              <th style={{ ...s.th, textAlign: "left", minWidth: 140, position: "sticky", left: 0, background: "#0f172a", zIndex: 1 }}>
                Giocatore
              </th>
              {events.map((e) => (
                <th key={e.id} style={{ ...s.th, minWidth: 72 }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                    {e.eventType === "match" ? "⚽" : "🏃"}
                  </div>
                  <div style={{ fontSize: 10, whiteSpace: "nowrap" }}>{formatShortDate(e.date)}</div>
                  <div style={{ fontSize: 9, color: "#475569", whiteSpace: "nowrap", maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis" }} title={e.label}>
                    {e.label}
                  </div>
                </th>
              ))}
              <th style={{ ...s.th, minWidth: 52, color: "#38bdf8" }}>Media</th>
            </tr>
          </thead>
          <tbody>
            {orderedPlayers.map((player) => {
              const avg = playerAvg(player.id);
              const { bg: avgBg, text: avgText } = rpeColor(avg ? Math.round(Number(avg)) : null);
              return (
                <tr key={player.id}>
                  <td style={{ ...s.td, position: "sticky", left: 0, background: "#0f172a", zIndex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>
                      {player.firstName || player.name?.split(" ")[0] || player.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {player.lastName || ""}{player.shirtNumber ? ` · #${player.shirtNumber}` : ""}
                    </div>
                  </td>
                  {events.map((e) => {
                    const rec = rpeIndex[`${player.id}:${e.id}`];
                    const { bg, text } = rpeColor(rec?.rpe_value);
                    return (
                      <td key={e.id} style={{ ...s.td, textAlign: "center" }}>
                        <div
                          style={{ ...s.cell, background: bg, color: text }}
                          title={rec ? `${rec.rpe_value} – ${BORG_LABELS[rec.rpe_value]}${rec.notes ? `\n${rec.notes}` : ""}` : "Non compilato"}
                        >
                          {rec?.rpe_value || "—"}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <div style={{ ...s.cell, background: avgBg, color: avgText, fontWeight: 900 }}>
                      {avg || "—"}
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* Riga medie per colonna */}
            <tr style={{ borderTop: "2px solid rgba(255,255,255,0.08)" }}>
              <td style={{ ...s.td, position: "sticky", left: 0, background: "#0f172a", zIndex: 1, fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                Media squadra
              </td>
              {events.map((e) => {
                const avg = eventAvg(e.id);
                const { bg, text } = rpeColor(avg ? Math.round(Number(avg)) : null);
                return (
                  <td key={e.id} style={{ ...s.td, textAlign: "center" }}>
                    <div style={{ ...s.cell, background: bg, color: text, fontWeight: 900 }}>
                      {avg || "—"}
                    </div>
                  </td>
                );
              })}
              <td style={s.td} />
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}

const s = {
  title: { margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "#f8fafc" },
  muted: { color: "#64748b", margin: 0, fontSize: 13 },
  th: {
    padding: "8px 6px", fontSize: 11, fontWeight: 700,
    color: "#94a3b8", textTransform: "uppercase",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#0f172a",
  },
  td: {
    padding: "6px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    verticalAlign: "middle",
  },
  cell: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 36, height: 30, borderRadius: 8,
    fontSize: 13, fontWeight: 700,
    cursor: "default",
  },
};
