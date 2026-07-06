import { useMemo, useState } from "react";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { useNavigate } from "react-router-dom";
import { normalizeRoleToGroup } from "../utils/helpers";
import { useIsMobile } from "../hooks/useIsMobile";

// Ordine di distribuzione per reparto: prima i GK così ogni squadra ha un portiere
const GROUP_ORDER = ["Portieri", "Difensori", "Centrocampisti", "Attaccanti", "Altro"];

const TEAM_COLORS = [
  { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)",  text: "#93c5fd", name: "Squadra A" },
  { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",   text: "#fca5a5", name: "Squadra B" },
  { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)",   text: "#86efac", name: "Squadra C" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTeams(players, numTeams) {
  // Raggruppa per reparto (usa anche altRoles per classificare meglio)
  const groups = Object.fromEntries(GROUP_ORDER.map((g) => [g, []]));
  for (const p of players) {
    const group = normalizeRoleToGroup(p.role);
    groups[group].push(p);
  }

  const teams = Array.from({ length: numTeams }, () => []);

  for (const groupKey of GROUP_ORDER) {
    const members = shuffle(groups[groupKey]);
    // Round-robin: 0,1,2,0,1,2... garantisce distribuzione bilanciata per reparto
    members.forEach((p, i) => teams[i % numTeams].push(p));
  }

  return teams;
}

function roleGroupColor(group) {
  if (group === "Portieri")       return "#38bdf8";
  if (group === "Difensori")      return "#4ade80";
  if (group === "Centrocampisti") return "#fb923c";
  if (group === "Attaccanti")     return "#f87171";
  return "#94a3b8";
}

export default function TeamGenerator({ players = [] }) {
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();

  const availablePlayers = useMemo(
    () => players.filter((p) => !["Infortunato", "Squalificato"].includes(p.status || "")),
    [players]
  );

  const [selected, setSelected] = useState(() => new Set(availablePlayers.map((p) => String(p.id))));
  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams]       = useState(null);

  function togglePlayer(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setTeams(null);
  }

  function toggleAll() {
    if (selected.size === availablePlayers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availablePlayers.map((p) => String(p.id))));
    }
    setTeams(null);
  }

  function generate() {
    const pool = availablePlayers.filter((p) => selected.has(String(p.id)));
    if (pool.length < numTeams) return;
    setTeams(buildTeams(pool, numTeams));
  }

  function reshuffle() {
    const pool = availablePlayers.filter((p) => selected.has(String(p.id)));
    if (pool.length < numTeams) return;
    setTeams(buildTeams(pool, numTeams));
  }

  // Raggruppa i giocatori disponibili per reparto per il pannello selezione
  const playersByGroup = useMemo(() => {
    const map = Object.fromEntries(GROUP_ORDER.map((g) => [g, []]));
    for (const p of availablePlayers) {
      const g = normalizeRoleToGroup(p.role);
      map[g].push(p);
    }
    return map;
  }, [availablePlayers]);

  if (!players.length) {
    return (
      <div style={{ display: "grid", gap: 22 }}>
        <PageHeader title="Generatore squadre" subtitle="Crea squadre bilanciate per gli allenamenti" />
        <EmptyState
          icon="⚽"
          title="Nessun giocatore in rosa"
          text="Aggiungi giocatori alla rosa prima di usare il generatore."
          action={<Button onClick={() => navigate("/players")}>Vai alla rosa</Button>}
        />
      </div>
    );
  }

  const selectedCount = selected.size;
  const canGenerate   = selectedCount >= numTeams;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        title="Generatore squadre"
        subtitle="Squadre bilanciate per ruolo in un click"
        badge={`${selectedCount} giocatori`}
      />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(260px,320px) 1fr", gap: 18, alignItems: "start" }}>

        {/* ── Pannello selezione ── */}
        <AppCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Seleziona giocatori</h3>
            <button
              onClick={toggleAll}
              style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              {selected.size === availablePlayers.length ? "Deseleziona tutti" : "Seleziona tutti"}
            </button>
          </div>

          {GROUP_ORDER.map((group) => {
            const groupPlayers = playersByGroup[group];
            if (!groupPlayers.length) return null;
            return (
              <div key={group} style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: roleGroupColor(group), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {group}
                </p>
                <div style={{ display: "grid", gap: 4 }}>
                  {groupPlayers.map((p) => {
                    const isSelected = selected.has(String(p.id));
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlayer(String(p.id))}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 10px", borderRadius: 10, cursor: "pointer",
                          background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
                          border: `1px solid ${isSelected ? "rgba(255,255,255,0.12)" : "transparent"}`,
                          color: isSelected ? "#e2e8f0" : "#475569",
                          textAlign: "left", width: "100%",
                          transition: "0.12s",
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                          background: isSelected ? "#2563eb" : "rgba(255,255,255,0.08)",
                          border: `2px solid ${isSelected ? "#3b82f6" : "rgba(255,255,255,0.15)"}`,
                          display: "grid", placeItems: "center", fontSize: 10, fontWeight: 900, color: "white",
                        }}>
                          {isSelected ? "✓" : ""}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: isSelected ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                        {p.shirtNumber && (
                          <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>#{p.shirtNumber}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Giocatori esclusi (infortunati/squalificati) */}
          {players.filter((p) => ["Infortunato", "Squalificato"].includes(p.status || "")).length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                Non disponibili
              </p>
              {players.filter((p) => ["Infortunato", "Squalificato"].includes(p.status || "")).map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", opacity: 0.5 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{p.name}</span>
                  <Badge tone={p.status === "Infortunato" ? "red" : "orange"}>{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </AppCard>

        {/* ── Pannello risultato ── */}
        <div style={{ display: "grid", gap: 14 }}>

          {/* Controlli */}
          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>Squadre:</span>
                {[2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setNumTeams(n); setTeams(null); }}
                    style={{
                      width: 40, height: 40, borderRadius: 10, fontSize: 16, fontWeight: 900, cursor: "pointer",
                      background: numTeams === n ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.05)",
                      border: `2px solid ${numTeams === n ? "#2563eb" : "rgba(255,255,255,0.1)"}`,
                      color: numTeams === n ? "#93c5fd" : "#64748b",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                {teams && (
                  <Button variant="ghost" onClick={reshuffle} aria-label="Rimescola squadre">
                    🔀 Rimescola
                  </Button>
                )}
                <Button onClick={generate} disabled={!canGenerate}>
                  {teams ? "Rigenera" : "⚽ Genera squadre"}
                </Button>
              </div>
            </div>

            {!canGenerate && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f87171" }}>
                Seleziona almeno {numTeams} giocatori per generare le squadre.
              </p>
            )}
          </AppCard>

          {/* Squadre generate */}
          {teams ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${numTeams}, minmax(0,1fr))`, gap: 12 }} className="no-mobile-override">
              {teams.map((team, ti) => {
                const col = TEAM_COLORS[ti] || TEAM_COLORS[0];
                const byGroup = Object.fromEntries(GROUP_ORDER.map((g) => [g, []]));
                team.forEach((p) => byGroup[normalizeRoleToGroup(p.role)].push(p));

                return (
                  <AppCard key={ti}>
                    <div style={{ padding: "6px 10px 10px", borderRadius: 10, background: col.bg, border: `1px solid ${col.border}`, marginBottom: 14 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: col.text }}>{col.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: col.text, opacity: 0.7 }}>{team.length} giocatori</p>
                    </div>

                    {GROUP_ORDER.map((group) => {
                      const gPlayers = byGroup[group];
                      if (!gPlayers.length) return null;
                      return (
                        <div key={group} style={{ marginBottom: 10 }}>
                          <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 800, color: roleGroupColor(group), textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {group}
                          </p>
                          {gPlayers.map((p) => (
                            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              {p.shirtNumber && (
                                <span style={{ fontSize: 10, color: "#475569", fontWeight: 800, minWidth: 18, textAlign: "right" }}>#{p.shirtNumber}</span>
                              )}
                              <span style={{ fontSize: 14, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name}
                              </span>
                              {(p.altRoles || []).length > 0 && (
                                <span style={{ fontSize: 9, color: "#38bdf8", fontWeight: 700 }}>
                                  +{p.altRoles.length}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </AppCard>
                );
              })}
            </div>
          ) : (
            <AppCard>
              <div style={{ textAlign: "center", padding: "32px 0", color: "#475569" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚽</div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#64748b" }}>
                  Seleziona i giocatori e premi <strong style={{ color: "#e2e8f0" }}>Genera squadre</strong>
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>
                  I ruoli verranno distribuiti in modo bilanciato tra le squadre.
                </p>
              </div>
            </AppCard>
          )}
        </div>
      </div>
    </div>
  );
}
