import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

import { formatDate, normalizeAppSettings } from "../utils/helpers";
import { styles } from "../styles/index.js";
import { loadAllPlayerStats, loadPlayerMatches } from "../services/playerProfile";
import { useAuth } from "../hooks/useAuth";

function Statistics({ events, players, appSettings = {}, setAppSettings }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const settings = normalizeAppSettings(appSettings);
  const activeSeason = settings.workspaceProfile.currentSeason;

  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || "");
  const [eventType, setEventType] = useState("Tutti");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [playerStatsMap, setPlayerStatsMap] = useState({});
  const [playerMatchesDB, setPlayerMatchesDB] = useState([]);
  const [sortBy, setSortBy] = useState("goals");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchPlayer, setSearchPlayer] = useState("");
  const [onlyWithStats, setOnlyWithStats] = useState(false);
  const [roleFilter, setRoleFilter] = useState("Tutti");
  const [comparePlayerIds, setComparePlayerIds] = useState(() =>
    players.slice(0, 2).map((player) => String(player.id))
  );

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 640);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Modalità allenatore
  const [coachMode, setCoachMode] = useState(false);
  const [minMinutes, setMinMinutes] = useState("");
  const [minGoals, setMinGoals] = useState("");
  const [minPresences, setMinPresences] = useState("");
  const [minAvgMinutes, setMinAvgMinutes] = useState("");

  const effectiveSelectedPlayerId = selectedPlayerId || players[0]?.id || "";

  function exportCSV() {
    const headers = ["Giocatore", "Ruolo", "Stato", "Presenze", "Assenze", "Infortuni", "Pres. all.", "% All.", "Minuti", "Media min", "Gol", "Assist", "G+A", "Min/Gol", "Min/G+A", "Ammonizioni", "Espulsioni"];
    const rows = stats.map((r) => [
      r.name,
      r.role || "",
      r.status || "",
      r.presences,
      r.absences,
      r.injuries,
      r.trainingPresences,
      r.trainingPct !== null ? `${r.trainingPct}%` : "—",
      r.minutes,
      r.avgMinutes,
      r.goals,
      r.assists,
      r.goalContributions,
      r.minutesPerGoal || "—",
      r.minutesPerContribution || "—",
      r.yellowCards,
      r.redCards,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statistiche-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function changeSeason(newSeason) {
    if (!newSeason.trim() || !setAppSettings) return;
    setAppSettings({
      ...settings,
      workspaceProfile: { ...settings.workspaceProfile, currentSeason: newSeason.trim() },
    });
  }

  function handleSort(field) {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  }

  function sortArrow(field) {
    if (sortBy !== field) return "";
    return sortOrder === "asc" ? "↑" : "↓";
  }

  function updateComparePlayer(index, value) {
    setComparePlayerIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next.filter((id, itemIndex) => id || itemIndex < 2);
    });
  }

  // FIX #10: tracciamo la fonte dati delle statistiche per mostrare un badge all'utente
  // e prevenire la situazione in cui playerStatsMap è vuoto (Supabase offline) e
  // l'intera colonna gol/assist/minuti appare a 0 senza spiegazione.
  const [statsSource, setStatsSource] = useState("local"); // "supabase" | "local"

  useEffect(() => {
    if (!auth.team?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatsSource("local");
      return;
    }
    loadAllPlayerStats(auth.team.id, activeSeason).then(({ data, error }) => {
      if (error || !data || Object.keys(data).length === 0) {
        setStatsSource("local");
        setPlayerStatsMap({});
      } else {
        setStatsSource("supabase");
        setPlayerStatsMap(data);
      }
    });
  }, [auth.team?.id, activeSeason]);

  useEffect(() => {
    if (!auth.team?.id || !effectiveSelectedPlayerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlayerMatchesDB([]);
      return;
    }
    loadPlayerMatches(auth.team.id, effectiveSelectedPlayerId).then(({ data }) => {
      setPlayerMatchesDB(data || []);
    });
  }, [auth.team?.id, effectiveSelectedPlayerId]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesType = eventType === "Tutti" || event.type === eventType;
      const afterStart = !fromDate || event.date >= fromDate;
      const beforeEnd = !toDate || event.date <= toDate;

      return matchesType && afterStart && beforeEnd;
    });
  }, [events, eventType, fromDate, toDate]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const stats = useMemo(() => {
    const baseStats = getStatsSummary(filteredEvents, players, playerStatsMap);

    return [...baseStats]
      .filter((player) =>
        player.name.toLowerCase().includes(searchPlayer.toLowerCase())
      )
      .filter((player) => {
        if (roleFilter === "Tutti") return true;

        const role = (player.role || "").toLowerCase();

        if (roleFilter === "Difensori") return role.includes("dif");
        if (roleFilter === "Centrocampisti") return role.includes("cent");
        if (roleFilter === "Attaccanti") return role.includes("att");
        if (roleFilter === "Portieri") return role.includes("port");

        return true;
      })
      .filter((player) => {
        if (!onlyWithStats) return true;

        return (
          player.presences > 0 ||
          player.minutes > 0 ||
          player.goals > 0 ||
          player.assists > 0 ||
          player.yellowCards > 0 ||
          player.redCards > 0
        );
      })
      .filter((player) => {
        if (!coachMode) return true;

        const avgMinutes = player.presences
          ? Math.round(player.minutes / player.presences)
          : 0;

        if (minMinutes !== "" && player.minutes < Number(minMinutes)) return false;
        if (minGoals !== "" && player.goals < Number(minGoals)) return false;
        if (minPresences !== "" && player.presences < Number(minPresences)) {
          return false;
        }
        if (minAvgMinutes !== "" && avgMinutes < Number(minAvgMinutes)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return sortOrder === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }

        const diff = Number(b[sortBy] || 0) - Number(a[sortBy] || 0);
        return sortOrder === "asc" ? -diff : diff;
      });
  }, [
    filteredEvents,
    players,
    playerStatsMap,
    sortBy,
    sortOrder,
    searchPlayer,
    onlyWithStats,
    roleFilter,
    coachMode,
    minMinutes,
    minGoals,
    minPresences,
    minAvgMinutes,
  ]);

  const selectedPlayer = players.find(
    (p) => String(p.id) === String(effectiveSelectedPlayerId)
  );

  const selectedStats = stats.find(
    (s) => String(s.id) === String(effectiveSelectedPlayerId)
  );

  const history = getPlayerHistory(filteredEvents, selectedPlayer, playerMatchesDB);

  const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0];
  const mostMinutes = [...stats].sort((a, b) => b.minutes - a.minutes)[0];
  const coachInsights = useMemo(() => getCoachInsights(stats), [stats]);
  const compareStats = comparePlayerIds
    .filter(Boolean)
    .map((id) => stats.find((player) => String(player.id) === String(id)))
    .filter(Boolean);

  if (players.length === 0) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Statistiche"
          subtitle="Database stagione e rendimento giocatori"
        />
        <EmptyState
          icon="📊"
          title="Nessun dato disponibile"
          text="Aggiungi giocatori ed eventi per iniziare a generare statistiche."
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <PageHeader
          title="Statistiche"
          subtitle="Analizza rendimento, minutaggio e storico stagione"
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* FIX #10: badge fonte dati — l'utente sa se sta vedendo dati Supabase o locali */}
          <Badge tone={statsSource === "supabase" ? "green" : "orange"}>
            {statsSource === "supabase" ? "📊 Dati cloud" : "💾 Dati locali"}
          </Badge>
          <Button variant="ghost" onClick={() => navigate("/exports")}>
            Report PDF
          </Button>
          <SeasonSelector activeSeason={activeSeason} onChange={changeSeason} />
        </div>
      </div>

      {/* ── KPI ── */}
      <div style={s.kpiGrid} className="no-mobile-override">
        <KpiCard label="Eventi totali" value={filteredEvents.length} icon="📅" accent="#38bdf8" />
        <KpiCard label="Giocatori" value={players.length} icon="👥" accent="#a78bfa" />
        <KpiCard label="Gol top scorer" value={topScorer?.goals || 0} icon="⚽" accent="#4ade80" />
        <KpiCard label="Minuti top" value={mostMinutes?.minutes || 0} icon="⏱️" accent="#fbbf24" />
      </div>

      {coachInsights.some((i) => i.name !== "N/D") && (
        <div style={s.insightsGrid}>
          {coachInsights.map((item) => (
            <AppCard key={item.title}>
              <div style={s.insightCard}>
                <span style={s.insightIcon}>{item.icon}</span>
                <div>
                  <p style={s.insightTitle}>{item.title}</p>
                  <h3 style={s.insightName}>{item.name}</h3>
                  <p style={s.insightDesc}>{item.description}</p>
                </div>
                <strong style={s.insightValue}>{item.value}</strong>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {/* ── Grafici ── */}
      <StatisticsCharts stats={stats} history={history} selectedPlayer={selectedPlayer} />

      {/* ── Filtri ── */}
      <AppCard>
        <p style={s.sectionLabel}>Filtri</p>
        <div style={s.filtersGrid}>
          <label style={s.filterLabel}>
            Tipo evento
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              style={styles.input}
            >
              <option>Tutti</option>
              <option>Allenamento</option>
              <option>Partita</option>
            </select>
          </label>

          <label style={s.filterLabel}>
            Dal
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={s.filterLabel}>
            Al
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={s.filterLabel}>
            Giocatore
            <select
              value={effectiveSelectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              style={styles.input}
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setEventType("Tutti");
                setFromDate("");
                setToDate("");
                setSearchPlayer("");
                setOnlyWithStats(false);
                setRoleFilter("Tutti");
                setCoachMode(false);
                setMinMinutes("");
                setMinGoals("");
                setMinPresences("");
                setMinAvgMinutes("");
                setSortBy("goals");
                setSortOrder("desc");
                setSelectedPlayerId(players[0]?.id || "");
              }}
              style={s.resetBtn}
            >
              Reset filtri
            </button>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <div style={s.compareHeader}>
          <div>
            <p style={s.sectionLabel}>Confronta giocatori</p>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, lineHeight: 1.2 }}>
              Lettura affiancata rendimento rosa
            </h3>
          </div>
          <div style={s.compareSelectors}>
            {[0, 1, 2, 3].map((slot) => (
              <select
                key={slot}
                value={comparePlayerIds[slot] || ""}
                onChange={(event) => updateComparePlayer(slot, event.target.value)}
                style={{ ...styles.input, minWidth: 160, height: 38, fontSize: 13 }}
              >
                <option value="">{slot < 2 ? "Seleziona" : "Aggiungi"}</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>

        {compareStats.length ? (
          <div style={s.compareGrid}>
            {compareStats.map((player) => (
              <div key={player.id} style={s.compareCard}>
                <div style={s.compareCardHeader}>
                  <div>
                    <strong style={{ fontSize: 16 }}>{player.name}</strong>
                    <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>
                      {player.role || "Ruolo non impostato"} · {player.status}
                    </p>
                  </div>
                  <Badge tone={player.status === "Disponibile" ? "green" : "orange"}>
                    {player.presences} pres.
                  </Badge>
                </div>

                <div style={s.compareMetrics}>
                  <CompareMetric label="Min" value={player.minutes} />
                  <CompareMetric label="Media" value={player.avgMinutes} />
                  <CompareMetric label="Gol" value={player.goals} color="#4ade80" />
                  <CompareMetric label="Assist" value={player.assists} color="#38bdf8" />
                  <CompareMetric label="G+A" value={player.goalContributions} color="#a78bfa" />
                  <CompareMetric label="% All." value={player.trainingPct !== null ? `${player.trainingPct}%` : "—"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📊"
            title="Seleziona almeno un giocatore"
            text="Usa i menu sopra per confrontare rendimento, minutaggio e presenza agli allenamenti."
          />
        )}
      </AppCard>

      {/* ── Griglia principale ── */}
      <div style={s.mainGrid}>

        {/* ── Tabella giocatori ── */}
        <AppCard>
          <div style={s.tableHeader}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>Riepilogo giocatori</h3>
              <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13, lineHeight: 1.4 }}>
                Presenze · Minuti · Gol · Assist · Disciplina
              </p>
            </div>
            <div style={s.tableHeaderActions}>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setSortOrder(e.target.value === "name" ? "asc" : "desc");
                }}
                style={{ ...styles.input, minWidth: 170, height: 38, padding: "0 12px", fontSize: 13 }}
              >
                <option value="goals">Ordina: Gol</option>
                <option value="assists">Ordina: Assist</option>
                <option value="minutes">Ordina: Minuti</option>
                <option value="presences">Ordina: Presenze</option>
                <option value="trainingPct">Ordina: % Presenze all.</option>
                <option value="avgMinutes">Ordina: Media minuti</option>
                <option value="goalContributions">Ordina: Gol + Assist</option>
                <option value="yellowCards">Ordina: Ammonizioni</option>
                <option value="redCards">Ordina: Espulsioni</option>
                <option value="name">Ordina: Nome</option>
              </select>
              <Badge tone="purple">Live DB</Badge>
              <button onClick={exportCSV} style={s.exportBtn} title="Esporta tabella visibile come CSV">
                ⬇ CSV
              </button>
            </div>
          </div>

          {/* Barra ricerca + filtri secondari */}
          <div style={s.searchRow}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <span style={s.searchIcon}>&#8981;</span>
              <input
                type="text"
                placeholder="Cerca giocatore..."
                value={searchPlayer}
                onChange={(e) => setSearchPlayer(e.target.value)}
                style={{ ...styles.input, paddingLeft: 36 }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ ...styles.input, width: "auto", minWidth: 150 }}
            >
              <option>Tutti</option>
              <option>Portieri</option>
              <option>Difensori</option>
              <option>Centrocampisti</option>
              <option>Attaccanti</option>
            </select>

            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={onlyWithStats}
                onChange={(e) => setOnlyWithStats(e.target.checked)}
                style={{ accentColor: "#38bdf8" }}
              />
              Solo con statistiche
            </label>

            <button
              type="button"
              onClick={() => setCoachMode((v) => !v)}
              style={{
                ...s.coachBtn,
                background: coachMode ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)",
                border: coachMode ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.12)",
                color: coachMode ? "#38bdf8" : "white",
              }}
            >
              {coachMode ? "Coach attivo" : "Coach mode"}
            </button>
          </div>

          {/* Panel modalità allenatore */}
          {coachMode && (
            <div style={s.coachPanel}>
              <div style={s.coachPanelHeader}>
                <span style={s.coachDot} />
                <div>
                  <strong style={{ fontSize: 14 }}>Filtri decisionali</strong>
                  <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 12 }}>
                    Filtra per soglie minime di rendimento
                  </p>
                </div>
              </div>
              <div style={s.coachGrid}>
                <label style={s.filterLabel}>
                  Min. minuti totali
                  <input
                    type="number"
                    min="0"
                    value={minMinutes}
                    onChange={(e) => setMinMinutes(e.target.value)}
                    placeholder="es. 200"
                    style={styles.input}
                  />
                </label>
                <label style={s.filterLabel}>
                  Min. gol
                  <input
                    type="number"
                    min="0"
                    value={minGoals}
                    onChange={(e) => setMinGoals(e.target.value)}
                    placeholder="es. 3"
                    style={styles.input}
                  />
                </label>
                <label style={s.filterLabel}>
                  Min. presenze
                  <input
                    type="number"
                    min="0"
                    value={minPresences}
                    onChange={(e) => setMinPresences(e.target.value)}
                    placeholder="es. 5"
                    style={styles.input}
                  />
                </label>
                <label style={s.filterLabel}>
                  Media min. minima
                  <input
                    type="number"
                    min="0"
                    value={minAvgMinutes}
                    onChange={(e) => setMinAvgMinutes(e.target.value)}
                    placeholder="es. 60"
                    style={styles.input}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Contatore risultati */}
          <div style={s.resultCount}>
            <span>{stats.length} giocator{stats.length === 1 ? "e" : "i"} visualizzat{stats.length === 1 ? "o" : "i"}</span>
          </div>

          {/* Tabella / Card mobile */}
          {isMobile ? (
            <div style={{ display: "grid", gap: 10 }}>
              {stats.length === 0 && (
                <div style={s.emptyTable}>
                  Nessun giocatore corrisponde ai filtri attivi.
                </div>
              )}
              {stats.map((row) => {
                const isTopScorer = row.goals === topScorer?.goals && row.goals > 0;
                const isTopMinutes = row.minutes === mostMinutes?.minutes && row.minutes > 0;
                return (
                  <button
                    key={row.id}
                    onClick={() => {
                      setSelectedPlayerId(row.id);
                      navigate(`/player/${row.id}`);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      borderRadius: 14,
                      padding: "14px 16px",
                      background: isTopScorer
                        ? "rgba(34,197,94,0.08)"
                        : isTopMinutes
                        ? "rgba(234,179,8,0.08)"
                        : "rgba(255,255,255,0.04)",
                      border: isTopScorer
                        ? "1px solid rgba(34,197,94,0.3)"
                        : isTopMinutes
                        ? "1px solid rgba(234,179,8,0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 15 }}>{row.name}</strong>
                        {row.role && (
                          <span style={s.roleChip}>{row.role}</span>
                        )}
                        {isTopScorer && <span style={s.tagGoal}>⚽ Top</span>}
                        {isTopMinutes && !isTopScorer && <span style={s.tagMinutes}>⏱ Top</span>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 900, color: row.status === "Disponibile" ? "#86efac" : "#fdba74", flexShrink: 0 }}>
                        {row.status || "—"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }} className="no-mobile-override">
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>Presenze</span>
                        <span style={s.mobileStatValue}>{row.presences}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>Minuti</span>
                        <span style={s.mobileStatValue}>{row.minutes}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>Gol</span>
                        <span style={{ ...s.mobileStatValue, color: row.goals > 0 ? "#4ade80" : "#94a3b8" }}>{row.goals}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>Assist</span>
                        <span style={{ ...s.mobileStatValue, color: row.assists > 0 ? "#38bdf8" : "#94a3b8" }}>{row.assists}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>% All.</span>
                        <span style={{
                          ...s.mobileStatValue,
                          color: row.trainingPct === null ? "#475569" : row.trainingPct >= 80 ? "#22c55e" : row.trainingPct >= 60 ? "#fbbf24" : "#f87171",
                        }}>
                          {row.trainingPct !== null ? `${row.trainingPct}%` : "—"}
                        </span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>🟨 / 🟥</span>
                        <span style={s.mobileStatValue}>{row.yellowCards} / {row.redCards}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={s.table}>
              {/* Header */}
              <div style={s.colHeader}>
                <span
                  onClick={() => handleSort("name")}
                  style={{ ...s.thClickable, color: sortBy === "name" ? "#38bdf8" : "#64748b" }}
                >
                  Giocatore {sortArrow("name")}
                </span>
                <span style={{ color: "#64748b" }}>Stato</span>
                <span
                  onClick={() => handleSort("presences")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "presences" ? "#38bdf8" : "#64748b" }}
                >
                  Pres. {sortArrow("presences")}
                </span>
                <span style={{ ...s.thNum, color: "#64748b" }}>Ass.</span>
                <span style={{ ...s.thNum, color: "#64748b" }}>Inf.</span>
                <span style={{ ...s.thNum, color: "#64748b" }}>Pres. all.</span>
                <span
                  onClick={() => handleSort("trainingPct")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "trainingPct" ? "#22d3ee" : "#64748b" }}
                  title="% presenze allenamenti"
                >
                  % All. {sortArrow("trainingPct")}
                </span>
                <span
                  onClick={() => handleSort("minutes")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "minutes" ? "#38bdf8" : "#64748b" }}
                >
                  Min {sortArrow("minutes")}
                </span>
                <span
                  onClick={() => handleSort("avgMinutes")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "avgMinutes" ? "#38bdf8" : "#64748b" }}
                >
                  Media {sortArrow("avgMinutes")}
                </span>
                <span
                  onClick={() => handleSort("goals")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "goals" ? "#4ade80" : "#64748b" }}
                >
                  Gol {sortArrow("goals")}
                </span>
                <span
                  onClick={() => handleSort("assists")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "assists" ? "#38bdf8" : "#64748b" }}
                >
                  Ass. {sortArrow("assists")}
                </span>
                <span
                  onClick={() => handleSort("goalContributions")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "goalContributions" ? "#a78bfa" : "#64748b" }}
                >
                  G+A {sortArrow("goalContributions")}
                </span>
                <span style={{ ...s.thNum, color: "#64748b" }}>Min/G</span>
                <span style={{ ...s.thNum, color: "#64748b" }}>Min/G+A</span>
                <span
                  onClick={() => handleSort("yellowCards")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "yellowCards" ? "#fbbf24" : "#64748b" }}
                >
                  🟨 {sortArrow("yellowCards")}
                </span>
                <span
                  onClick={() => handleSort("redCards")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "redCards" ? "#f87171" : "#64748b" }}
                >
                  🟥 {sortArrow("redCards")}
                </span>
              </div>

              {stats.length === 0 && (
                <div style={s.emptyTable}>
                  Nessun giocatore corrisponde ai filtri attivi.
                </div>
              )}

              {stats.map((row) => {
                const isSelected = String(selectedPlayerId) === String(row.id);
                const isTopScorer = row.goals === topScorer?.goals && row.goals > 0;
                const isTopMinutes = row.minutes === mostMinutes?.minutes && row.minutes > 0;

                return (
                  <button
                    key={row.id}
                    onClick={() => {
                      setSelectedPlayerId(row.id);
                      navigate(`/player/${row.id}`);
                    }}
                    style={{
                      ...s.tableRow,
                      background: isSelected
                        ? "rgba(56,189,248,0.12)"
                        : isTopScorer
                        ? "rgba(34,197,94,0.08)"
                        : isTopMinutes
                        ? "rgba(234,179,8,0.08)"
                        : "rgba(255,255,255,0.028)",
                      border: isSelected
                        ? "1px solid rgba(56,189,248,0.4)"
                        : isTopScorer
                        ? "1px solid rgba(34,197,94,0.3)"
                        : isTopMinutes
                        ? "1px solid rgba(234,179,8,0.3)"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isSelected
                        ? "rgba(56,189,248,0.12)"
                        : isTopScorer
                        ? "rgba(34,197,94,0.08)"
                        : isTopMinutes
                        ? "rgba(234,179,8,0.08)"
                        : "rgba(255,255,255,0.028)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <span style={s.playerName}>
                      <strong>{row.name}</strong>
                      {row.role && <span style={s.roleChip}>{row.role}</span>}
                      {isTopScorer && <span style={s.tagGoal}>⚽ Top scorer</span>}
                      {isTopMinutes && !isTopScorer && <span style={s.tagMinutes}>⏱ Più minuti</span>}
                    </span>
                    <span style={{ ...s.statusCell, color: row.status === "Disponibile" ? "#86efac" : "#fdba74" }}>
                      {row.status || "—"}
                    </span>
                    <span style={s.tdNum}>{row.presences}</span>
                    <span style={s.tdNum}>{row.absences}</span>
                    <span style={s.tdNum}>{row.injuries}</span>
                    <span style={s.tdNum}>{row.trainingPresences}/{row.registeredTrainings}</span>
                    <span style={{
                      ...s.tdNum,
                      color: row.trainingPct === null
                        ? "#475569"
                        : row.trainingPct >= 80
                        ? "#22c55e"
                        : row.trainingPct >= 60
                        ? "#fbbf24"
                        : "#f87171",
                      fontWeight: row.trainingPct !== null ? 700 : 400,
                    }}>
                      {row.trainingPct !== null ? `${row.trainingPct}%` : "—"}
                    </span>
                    <span style={s.tdNum}>{row.minutes}</span>
                    <span style={s.tdNum}>{row.avgMinutes}</span>
                    <span style={{ ...s.tdNum, color: row.goals > 0 ? "#4ade80" : "inherit", fontWeight: row.goals > 0 ? 800 : 400 }}>
                      {row.goals}
                    </span>
                    <span style={{ ...s.tdNum, color: row.assists > 0 ? "#38bdf8" : "inherit", fontWeight: row.assists > 0 ? 800 : 400 }}>
                      {row.assists}
                    </span>
                    <span style={{ ...s.tdNum, color: row.goalContributions > 0 ? "#a78bfa" : "inherit", fontWeight: row.goalContributions > 0 ? 800 : 400 }}>
                      {row.goalContributions}
                    </span>
                    <span style={s.tdNum}>{row.minutesPerGoal || "—"}</span>
                    <span style={s.tdNum}>{row.minutesPerContribution || "—"}</span>
                    <span style={{ ...s.tdNum, color: row.yellowCards > 0 ? "#fbbf24" : "inherit" }}>
                      {row.yellowCards}
                    </span>
                    <span style={{ ...s.tdNum, color: row.redCards > 0 ? "#f87171" : "inherit" }}>
                      {row.redCards}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </AppCard>

        {/* ── Colonna destra ── */}
        <div style={{ display: "grid", gap: 18 }}>

          {/* Scheda rapida */}
          <AppCard>
            <h3 style={s.sideTitle}>
              Scheda rapida
            </h3>

            <select
              value={effectiveSelectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              style={styles.input}
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>

            {selectedPlayer && (
              <div style={{ marginTop: 18 }}>
                <div style={s.quickProfile}>
                  <div style={s.avatar}>
                    {selectedPlayer.photo ? (
                      <img
                        src={selectedPlayer.photo}
                        alt={selectedPlayer.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 26, fontWeight: 900 }}>
                        {selectedPlayer.name?.[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.2 }}>{selectedPlayer.name}</h2>
                    <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13, lineHeight: 1.35 }}>
                      {selectedPlayer.role || "Ruolo non impostato"}
                    </p>
                  </div>
                </div>

                <div style={s.miniGrid}>
                  <MiniStat label="Presenze" value={selectedStats?.presences || 0} icon="📋" />
                  <MiniStat label="Minuti" value={selectedStats?.minutes || 0} icon="⏱️" />
                  <MiniStat label="Gol" value={selectedStats?.goals || 0} icon="⚽" color="#4ade80" />
                  <MiniStat label="Assist" value={selectedStats?.assists || 0} icon="🅰️" color="#38bdf8" />
                </div>
              </div>
            )}
          </AppCard>

          {/* Storico eventi */}
          <AppCard>
            <h3 style={s.sideTitle}>
              Storico eventi
            </h3>

            {history.length === 0 ? (
              <div style={s.emptyHistory}>
                <span style={{ fontSize: 28 }}>📭</span>
                <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
                  Nessun evento registrato
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {history.map((item) => (
                  <div key={`${item.sessionId}-${item.date}`} style={s.historyItem}>
                    <div style={s.historyTop}>
                      <strong style={{ fontSize: 14 }}>{item.title}</strong>
                      <StatusBadge status={item.status} />
                    </div>

                    <p style={{ color: "#64748b", margin: "5px 0 8px", fontSize: 12, lineHeight: 1.35 }}>
                      {formatDate(item.date)} · {item.type}
                    </p>

                    <div style={s.historyMeta}>
                      <StatChip label="min" value={item.minutes} />
                      <StatChip label="gol" value={item.goals} color={item.goals > 0 ? "#4ade80" : undefined} />
                      <StatChip label="ast" value={item.assists} color={item.assists > 0 ? "#38bdf8" : undefined} />
                      {item.yellowCards > 0 && <StatChip label="🟨" value={item.yellowCards} color="#fbbf24" />}
                      {item.redCards > 0 && <StatChip label="🟥" value={item.redCards} color="#f87171" />}
                      {item.rating != null && (
                        <StatChip label="voto" value={item.rating} color="#a78bfa" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppCard>
        </div>
      </div>
    </div>
  );
}

// ── Charts ───────────────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    fontSize: 12,
    color: "#e2e8f0",
  },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

function StatisticsCharts({ stats, history, selectedPlayer }) {
  // Dati grafico 1: top 10 per gol+assist
  const topScorers = [...stats]
    .filter((p) => p.goals > 0 || p.assists > 0)
    .sort((a, b) => b.goalContributions - a.goalContributions)
    .slice(0, 10)
    .map((p) => ({ name: p.name.split(" ")[0], goals: p.goals, assists: p.assists }));

  // Dati grafico 2: minutaggio nel tempo del giocatore selezionato
  const minutesHistory = [...history]
    .filter((h) => h.minutes > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((h) => ({
      date: h.date?.slice(5), // MM-DD
      min: h.minutes,
      type: h.type === "Partita" ? "⚽" : "📋",
    }));

  // Dati grafico 3: % presenze allenamenti top 12
  const attendanceData = [...stats]
    .filter((p) => p.trainingPct !== null)
    .sort((a, b) => b.trainingPct - a.trainingPct)
    .slice(0, 12)
    .map((p) => ({
      name: p.name.split(" ")[0],
      pct: p.trainingPct,
    }));

  if (topScorers.length === 0 && minutesHistory.length === 0 && attendanceData.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

      {/* Grafico 1 — Gol + Assist */}
      {topScorers.length > 0 && (
        <AppCard>
          <p style={s.sectionLabel}>Gol + Assist</p>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>Top marcatori stagione</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topScorers} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="goals" name="Gol" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
              <Bar dataKey="assists" name="Assist" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* Grafico 2 — Minutaggio nel tempo */}
      {minutesHistory.length > 1 && (
        <AppCard>
          <p style={s.sectionLabel}>Minutaggio nel tempo</p>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>
            {selectedPlayer?.name || "Giocatore"} — minuti per evento
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={minutesHistory} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} min`, "Minuti"]} />
              <Line
                type="monotone"
                dataKey="min"
                stroke="#a78bfa"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#a78bfa" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* Grafico 3 — % Presenze allenamenti */}
      {attendanceData.length > 0 && (
        <AppCard>
          <p style={s.sectionLabel}>Presenze allenamenti</p>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>% partecipazione per giocatore</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Presenze"]} />
              <Bar dataKey="pct" name="% Presenze" radius={[4, 4, 0, 0]}>
                {attendanceData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.pct >= 80 ? "#22c55e" : entry.pct >= 60 ? "#fbbf24" : "#f87171"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent = "#38bdf8" }) {
  return (
    <AppCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p style={{ color: "#64748b", margin: 0, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, lineHeight: 1.2 }}>
            {label}
          </p>
          <h2 style={{ margin: "9px 0 0", fontSize: 32, fontWeight: 900, letterSpacing: 0, lineHeight: 1 }}>
            {value}
          </h2>
        </div>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${accent}22`,
          border: `1px solid ${accent}44`,
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </AppCard>
  );
}

function MiniStat({ label, value, icon, color }) {
  return (
    <div style={s.miniStat}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
          {label}
        </span>
      </div>
      <strong style={{ fontSize: 22, fontWeight: 900, color: color || "white", lineHeight: 1 }}>{value}</strong>
    </div>
  );
}

function CompareMetric({ label, value, color = "#e2e8f0" }) {
  return (
    <div style={s.compareMetric}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function SeasonSelector({ activeSeason, onChange }) {
  const SEASONS = ["2023/2024", "2024/2025", "2025/2026", "2026/2027"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#475569" }}>
        Stagione attiva
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {SEASONS.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.15s",
              background: activeSeason === s ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.05)",
              border: activeSeason === s ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: activeSeason === s ? "#38bdf8" : "#64748b",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Presente: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.35)", color: "#4ade80" },
    Assente:  { bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.35)", color: "#f87171" },
    Permesso: { bg: "rgba(148,163,184,0.15)", border: "rgba(148,163,184,0.35)", color: "#94a3b8" },
    Infortunato: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.35)", color: "#fbbf24" },
  };
  const t = map[status] || map["Permesso"];
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 800,
      padding: "3px 8px",
      borderRadius: 8,
      background: t.bg,
      border: `1px solid ${t.border}`,
      color: t.color,
    }}>
      {status}
    </span>
  );
}

function StatChip({ label, value, color }) {
  return (
    <span style={{
      fontSize: 12,
      fontWeight: 700,
      padding: "3px 8px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: color || "#cbd5e1",
    }}>
      {value} {label}
    </span>
  );
}

// ── Logic (invariata) ─────────────────────────────────────────────────────────

function getCoachInsights(stats) {
  const withMinutes = stats.filter((p) => p.minutes > 0);
  const withGoals = stats.filter((p) => p.goals > 0);

  const efficient = [...withGoals].sort((a, b) => {
    const aRatio = a.goals / Math.max(a.minutes, 1);
    const bRatio = b.goals / Math.max(b.minutes, 1);
    return bRatio - aRatio;
  })[0];

  const mostUsed = [...withMinutes].sort((a, b) => b.minutes - a.minutes)[0];

  const decisive = [...stats].sort(
    (a, b) => b.goals + b.assists - (a.goals + a.assists)
  )[0];

  const monitor = [...stats]
    .filter((p) => p.presences >= 3)
    .sort((a, b) => {
      const avgA = a.presences ? a.minutes / a.presences : 0;
      const avgB = b.presences ? b.minutes / b.presences : 0;
      return avgA - avgB;
    })[0];

  return [
    {
      icon: "⚡",
      title: "Più efficiente",
      name: efficient?.name || "N/D",
      value: efficient ? `${efficient.goals} gol` : "-",
      description: efficient
        ? "Miglior rapporto gol/minuti."
        : "Servono gol e minuti per calcolarlo.",
    },
    {
      icon: "🧱",
      title: "Più utilizzato",
      name: mostUsed?.name || "N/D",
      value: mostUsed ? `${mostUsed.minutes} min` : "-",
      description: "Giocatore con più minutaggio.",
    },
    {
      icon: "🎯",
      title: "Più decisivo",
      name: decisive?.name || "N/D",
      value: decisive ? `${decisive.goals + decisive.assists} G+A` : "-",
      description: "Somma gol + assist.",
    },
    {
      icon: "👀",
      title: "Da monitorare",
      name: monitor?.name || "N/D",
      value: monitor
        ? `${Math.round(monitor.minutes / Math.max(monitor.presences, 1))} min/pres`
        : "-",
      description: "Presenze alte, media minuti bassa.",
    },
  ];
}

function getStatsSummary(events, players, playerStatsMap = {}) {
  // Calcola il totale delle sedute di allenamento (non partite)
  const trainingSessions = events.filter((e) => e.type !== "Partita");
  const totalTrainings = trainingSessions.length;

  return players.map((player) => {
    const attendance = events.reduce(
      (acc, event) => {
        const data = event.attendance?.[player.id];
        if (!data) return acc;

        if (data.status === "Assente" || data.status === "Permesso") {
          acc.absences += 1;
        }

        if (data.status === "Infortunato") {
          acc.injuries += 1;
        }

        return acc;
      },
      { absences: 0, injuries: 0 }
    );

    // % presenze allenamenti: conta le sedute dove lo status è "Presente" (o non registrato = presente di default)
    const trainingPresences = trainingSessions.filter((s) => {
      const data = s.attendance?.[player.id];
      // Se non c'è nessun dato registrato per questa seduta, non la contiamo
      if (!data) return false;
      return data.status === "Presente";
    }).length;

    // Sedute con dati registrati per questo giocatore
    const registeredTrainings = trainingSessions.filter(
      (s) => s.attendance?.[player.id]
    ).length;

    const trainingPct = registeredTrainings > 0
      ? Math.round((trainingPresences / registeredTrainings) * 100)
      : null; // null = nessun dato inserito

    const ps = playerStatsMap[String(player.id)] || {};

    // FIX #10: se playerStatsMap è vuoto (Supabase offline), calcola le stats
    // aggregate dalle partite locali (attendance blob) come fallback.
    // Nota: questa è una fonte secondaria — può divergere da player_stats su Supabase
    // se i dati non sono stati sincronizzati. Il badge "Dati locali" in UI avvisa l'utente.
    const hasSupabaseStats = Object.keys(ps).length > 0;
    const localMatchStats = hasSupabaseStats ? null : events
      .filter((e) => e.type === "Partita")
      .reduce(
        (acc, event) => {
          const d = event.attendance?.[player.id];
          if (!d || d.status === "Assente") return acc;
          acc.appearances += 1;
          acc.minutes_played  += Number(d.minutes || 0);
          acc.goals           += Number(d.goals || 0);
          acc.assists         += Number(d.assists || 0);
          acc.yellow_cards    += Number(d.yellowCards || 0);
          acc.red_cards       += Number(d.redCards || 0);
          return acc;
        },
        { appearances: 0, minutes_played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 }
      );

    const src = hasSupabaseStats ? ps : (localMatchStats || {});
    const presences = Number(src.appearances ?? 0);
    const minutes = Number(src.minutes_played ?? 0);
    const goals = Number(src.goals ?? 0);
    const assists = Number(src.assists ?? 0);
    const goalContributions = goals + assists;

    return {
      id: player.id,
      name: player.name,
      status: player.status || "Disponibile",
      role: player.role || "",
      presences,
      minutes,
      goals,
      assists,
      goalContributions,
      avgMinutes: presences ? Math.round(minutes / presences) : 0,
      minutesPerGoal: goals ? Math.round(minutes / goals) : 0,
      minutesPerContribution: goalContributions ? Math.round(minutes / goalContributions) : 0,
      yellowCards:  Number(src.yellow_cards   ?? 0),
      redCards:     Number(src.red_cards      ?? 0),
      absences: attendance.absences,
      injuries: attendance.injuries,
      trainingPresences,
      trainingPct,
      totalTrainings,
      registeredTrainings,
    };
  });
}

function getPlayerHistory(events, player, playerMatchesDB = []) {
  if (!player) return [];

  // Mappa match_id → riga player_matches (dati reali Supabase)
  const dbMap = {};
  playerMatchesDB.forEach((row) => {
    dbMap[String(row.match_id)] = row;
  });

  return [...events]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((event) => {
      if (event.type === "Partita") {
        // Partite: usa player_matches da Supabase
        const db = dbMap[String(event.id)];
        if (!db) return null;
        return {
          sessionId: event.id,
          title: event.title,
          date: event.date,
          type: event.type,
          status: "Presente",
          minutes: Number(db.minutes_played || 0),
          goals: Number(db.goals || 0),
          assists: Number(db.assists || 0),
          yellowCards: Number(db.yellow_cards || 0),
          redCards: Number(db.red_cards || 0),
          rating: db.rating != null ? db.rating : null,
        };
      } else {
        // Allenamenti: usa event.attendance (sistema locale)
        const data = event.attendance?.[player.id];
        if (!data) return null;
        return {
          sessionId: event.id,
          title: event.title,
          date: event.date,
          type: event.type,
          status: data.status,
          minutes: data.status === "Presente" ? Number(data.minutes || 0) : 0,
          goals: data.status === "Presente" ? Number(data.goals || 0) : 0,
          assists: data.status === "Presente" ? Number(data.assists || 0) : 0,
          yellowCards: data.status === "Presente" ? Number(data.yellowCards || 0) : 0,
          redCards: data.status === "Presente" ? Number(data.redCards || 0) : 0,
          rating: null,
        };
      }
    })
    .filter(Boolean);
}

// ── Stili ─────────────────────────────────────────────────────────────────────

const s = {
  // Coach Insights
  insightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  insightCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  insightIcon: {
    fontSize: 26,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  insightTitle: {
    margin: "0 0 2px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#64748b",
  },
  insightName: {
    margin: "0 0 4px",
    fontSize: 15,
    fontWeight: 900,
    color: "white",
  },
  insightDesc: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.4,
  },
  insightValue: {
    marginLeft: "auto",
    flexShrink: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "#38bdf8",
    paddingLeft: 12,
  },

  // Layout
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 0.75fr",
    gap: 20,
    alignItems: "start",
    marginTop: 20,
  },

  // Filtri
  sectionLabel: {
    margin: "0 0 12px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#475569",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#64748b",
  },
  compareHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  compareSelectors: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  compareCard: {
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  compareCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  compareMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
  },
  compareMetric: {
    borderRadius: 10,
    padding: "9px 8px",
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(255,255,255,0.06)",
    display: "grid",
    gap: 4,
    textAlign: "center",
  },
  exportBtn: {
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(167,139,250,0.35)",
    background: "rgba(167,139,250,0.1)",
    color: "#a78bfa",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    padding: "0 12px",
    transition: "all 0.2s",
  },
  resetBtn: {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#94a3b8",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Tabella — header
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  tableHeaderActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  // Barra ricerca
  searchRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  searchIcon: {
    position: "absolute",
    left: 11,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    pointerEvents: "none",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  coachBtn: {
    height: 38,
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    padding: "0 14px",
    transition: "all 0.2s",
  },

  // Coach panel
  coachPanel: {
    display: "grid",
    gap: 14,
    marginBottom: 16,
    padding: "16px 18px",
    borderRadius: 12,
    background: "rgba(56,189,248,0.06)",
    border: "1px solid rgba(56,189,248,0.2)",
  },
  coachPanelHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  coachDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#38bdf8",
    marginTop: 5,
    flexShrink: 0,
    boxShadow: "0 0 8px rgba(56,189,248,0.6)",
  },
  coachGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },

  // Risultati
  resultCount: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  // Tabella dati
  table: {
    minWidth: 1160,
    display: "grid",
    gap: 6,
  },
  colHeader: {
    display: "grid",
    gridTemplateColumns: "1.6fr 0.8fr repeat(15, 0.55fr)",
    gap: 6,
    padding: "8px 14px 10px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 4,
  },
  thClickable: {
    cursor: "pointer",
    userSelect: "none",
    transition: "color 0.15s",
  },
  thNum: {
    textAlign: "right",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.6fr 0.8fr repeat(15, 0.55fr)",
    gap: 6,
    padding: "12px 14px",
    borderRadius: 10,
    color: "white",
    cursor: "pointer",
    textAlign: "left",
    transition: "transform 0.15s, background 0.15s",
  },
  playerName: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    minWidth: 0,
  },
  roleChip: {
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "2px 7px",
    borderRadius: 8,
  },
  statusCell: {
    fontSize: 11,
    fontWeight: 900,
    alignSelf: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagGoal: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#86efac",
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.3)",
    padding: "2px 7px",
    borderRadius: 8,
  },
  tagMinutes: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#fde68a",
    background: "rgba(234,179,8,0.14)",
    border: "1px solid rgba(234,179,8,0.3)",
    padding: "2px 7px",
    borderRadius: 999,
  },
  tdNum: {
    textAlign: "right",
    fontSize: 14,
  },
  emptyTable: {
    padding: "24px 16px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#475569",
    textAlign: "center",
    fontSize: 14,
  },

  // Scheda rapida
  quickProfile: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginBottom: 16,
    padding: "14px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 14,
    background: "linear-gradient(135deg, rgba(56,189,248,0.3), rgba(37,99,235,0.18))",
    border: "2px solid rgba(56,189,248,0.25)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  miniStat: {
    borderRadius: 10,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },

  // Storico
  emptyHistory: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 0",
    textAlign: "center",
  },
  historyItem: {
    borderRadius: 10,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.07)",
    transition: "border-color 0.15s",
  },
  historyTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  historyMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  sideTitle: {
    marginTop: 0,
    marginBottom: 14,
    fontSize: 15,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  // Mobile card stats
  mobileStatRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  mobileStatLabel: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    color: "#64748b",
  },
  mobileStatValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#e2e8f0",
  },
};

export default Statistics;
