import { useEffect, useState } from "react";
import { loadPlayerMatchesForPeriod } from "../../services/playerProfile";
import { useAuth } from "../../hooks/useAuth";

const CELL_W = 46;
const HEADER_H = 110;
const ROW_H = 32;
const NAME_W = 160;

/* ── helpers ── */
function getLineup(event) {
  return event?.lineup || { calledUpIds: [], starterIds: [], benchIds: [] };
}

function cellType(player, event, stats) {
  const lineup = getLineup(event);
  const pid = String(player.id);
  const isCalledUp   = (lineup.calledUpIds  || []).map(String).includes(pid);
  const isStarter    = (lineup.starterIds   || []).map(String).includes(pid);
  const isBench      = (lineup.benchIds     || []).map(String).includes(pid);
  const mins         = stats ? Number(stats.minutes_played) || 0 : 0;
  const hasStats     = Boolean(stats);

  if (!isCalledUp && !hasStats) return { type: "absent" };
  if (isStarter && mins >= 88)  return { type: "full",    mins };
  if (isStarter && mins > 0)    return { type: "starter", mins };
  if (isStarter && mins === 0)  return { type: "full",    mins: 90 };
  if ((isBench || hasStats) && mins > 0) return { type: "sub",   mins };
  if (isCalledUp)               return { type: "unused" };
  if (hasStats && mins > 0)     return { type: "sub",     mins };
  return { type: "absent" };
}

const COLORS = {
  full:    { bg: "#15803d", text: "#dcfce7" },
  starter: { bg: "#22c55e", text: "#052e16" },
  sub:     { bg: "#ca8a04", text: "#fefce8" },
  unused:  { bg: "rgba(255,255,255,0.06)", text: "#475569" },
  absent:  { bg: "transparent", text: "#1e293b" },
};

const LEGEND = [
  { label: "Titolare 90'",    bg: "#15803d", text: "#dcfce7" },
  { label: "Titolare uscito", bg: "#22c55e", text: "#052e16" },
  { label: "Subentrato",      bg: "#ca8a04", text: "#fefce8" },
  { label: "Conv. non util.", bg: "rgba(255,255,255,0.08)", text: "#94a3b8", symbol: "—" },
  { label: "Non convocato",   bg: "transparent",            text: "#1e293b" },
];

/* ── component ── */
export default function MinutaggioMatrix({ players, matches }) {
  const auth = useAuth();
  const [statsMap, setStatsMap] = useState({});  // { matchId: { playerId: row } }
  const [loading, setLoading]   = useState(false);

  const sortedMatches = [...matches]
    .filter((e) => e.type === "Partita")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const sortedPlayers = [...players].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );

  useEffect(() => {
    if (!auth.team?.id || sortedMatches.length === 0) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    const ids = sortedMatches.map((e) => String(e.id));
    loadPlayerMatchesForPeriod(auth.team.id, ids).then(({ data }) => {
      const map = {};
      (data || []).forEach((row) => {
        const mid = String(row.match_id);
        const pid = String(row.player_id);
        if (!map[mid]) map[mid] = {};
        map[mid][pid] = row;
      });
      setStatsMap(map);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.team?.id, sortedMatches.length, matches]);

  if (loading) {
    return <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>Caricamento dati…</div>;
  }

  if (sortedMatches.length === 0) {
    return <div style={{ padding: "24px 0", color: "#475569", fontSize: 13 }}>Nessuna partita trovata nel periodo. Aggiungi eventi di tipo <strong>Partita</strong> nel calendario.</div>;
  }

  const totalWidth = NAME_W + CELL_W * sortedMatches.length + CELL_W + 2;

  return (
    <div>
      {/* scrollable wrapper */}
      <div style={{ overflowX: "auto", overflowY: "visible", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: totalWidth, position: "relative" }}>

          {/* ── HEADER ROW ── */}
          <div style={{ display: "flex", height: HEADER_H }}>
            {/* corner */}
            <div style={{ width: NAME_W, flexShrink: 0, borderRight: "2px solid rgba(255,255,255,0.12)", borderBottom: "2px solid rgba(255,255,255,0.12)" }} />

            {sortedMatches.map((match) => {
              const opponent = match.opponent || match.title || "—";
              const dateStr  = match.date ? match.date.slice(5).replace("-", "/") : "";
              return (
                <div
                  key={match.id}
                  style={{
                    width: CELL_W,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 6,
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    borderBottom: "2px solid rgba(255,255,255,0.12)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      transform: "rotate(180deg)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94a3b8",
                      lineHeight: 1.2,
                      maxHeight: HEADER_H - 12,
                      overflow: "hidden",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: "#e2e8f0" }}>{opponent}</span>
                    {dateStr && <span style={{ color: "#64748b", marginTop: 2, display: "block" }}>{dateStr}</span>}
                  </div>
                </div>
              );
            })}

            {/* TOTALE header */}
            <div style={{
              width: CELL_W,
              flexShrink: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 8,
              borderLeft: "2px solid rgba(255,255,255,0.12)",
              borderBottom: "2px solid rgba(255,255,255,0.12)",
            }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#60a5fa", textTransform: "uppercase", letterSpacing: 0.5 }}>Tot</span>
            </div>
          </div>

          {/* ── PLAYER ROWS ── */}
          {sortedPlayers.map((player, pi) => {
            const pid = String(player.id);
            let total = 0;

            return (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  height: ROW_H,
                  background: pi % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {/* player name */}
                <div style={{
                  width: NAME_W,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 10,
                  borderRight: "2px solid rgba(255,255,255,0.12)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {player.name}
                </div>

                {sortedMatches.map((match) => {
                  const mid   = String(match.id);
                  const stats = statsMap[mid]?.[pid];
                  const cell  = cellType(player, match, stats);
                  const col   = COLORS[cell.type];
                  const hasRed    = stats && Number(stats.red_cards)    > 0;
                  const hasYellow = stats && Number(stats.yellow_cards) > 0;

                  if (cell.type !== "absent") total += cell.mins || 0;

                  return (
                    <div
                      key={match.id}
                      title={`${player.name} vs ${match.opponent || match.title || "—"}: ${cell.mins ?? "—"} min`}
                      style={{
                        width: CELL_W,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: col.bg,
                        borderRight: "1px solid rgba(255,255,255,0.05)",
                        fontSize: 10,
                        fontWeight: 900,
                        color: col.text,
                        position: "relative",
                        outline: hasRed ? "2px solid #ef4444" : undefined,
                        outlineOffset: "-2px",
                      }}
                    >
                      {cell.type === "absent"  ? "" :
                       cell.type === "unused"  ? "—" :
                       cell.mins != null       ? cell.mins :
                       ""}
                      {hasYellow && (
                        <span style={{ position: "absolute", top: 2, right: 3, width: 5, height: 5, background: "#facc15", borderRadius: 1 }} />
                      )}
                      {hasRed && (
                        <span style={{ position: "absolute", top: 2, right: 3, width: 5, height: 5, background: "#ef4444", borderRadius: 1 }} />
                      )}
                    </div>
                  );
                })}

                {/* totale */}
                <div style={{
                  width: CELL_W,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeft: "2px solid rgba(255,255,255,0.12)",
                  fontSize: 11,
                  fontWeight: 900,
                  color: total > 0 ? "#60a5fa" : "#334155",
                }}>
                  {total > 0 ? total : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── LEGEND ── */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {LEGEND.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: item.bg, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: item.text }}>
              {item.symbol || ""}
            </div>
            {item.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
          <span style={{ width: 5, height: 5, background: "#facc15", borderRadius: 1, display: "inline-block" }} /> Giallo
          <span style={{ width: 5, height: 5, background: "#ef4444", borderRadius: 1, display: "inline-block", marginLeft: 8 }} /> Rosso
        </div>
      </div>
    </div>
  );
}
