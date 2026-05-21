import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";

import { formatDate, normalizeAppSettings } from "../utils/helpers";
import { styles } from "../styles/index.js";
import { loadAllPlayerStats, loadPlayerMatches } from "../services/playerProfile";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";

const StatisticsCharts = lazy(() => import("../components/statistics/StatisticsCharts"));

function Statistics({
  events, players, appSettings = {}, setAppSettings }) {
  const { t } = useTranslation();
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

  const isMobile = useIsMobile(641);
  const isNarrow = useIsMobile(1025);

  // Modalità allenatore
  const [coachMode, setCoachMode] = useState(false);
  const [minMinutes, setMinMinutes] = useState("");
  const [minGoals, setMinGoals] = useState("");
  const [minPresences, setMinPresences] = useState("");
  const [minAvgMinutes, setMinAvgMinutes] = useState("");

  const effectiveSelectedPlayerId = selectedPlayerId || players[0]?.id || "";

  function exportCSV() {
    const headers = t("pages.statistics.csvHeaders").split(",");
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
  const coachInsights = useMemo(() => getCoachInsights(stats, t), [stats, t]);
  const teamSummary = useMemo(() => getTeamSummary(stats), [stats]);
  const compareStats = comparePlayerIds
    .filter(Boolean)
    .map((id) => stats.find((player) => String(player.id) === String(id)))
    .filter(Boolean);

  if (players.length === 0) {
    return (
      <div style={{ ...styles.page, ...s.page }}>
        <PageHeader
          title={t("pages.statistics.title")}
          subtitle={t("pages.statistics.subtitle")}
        />
        <EmptyState
          icon="📊"
          title={t("pages.statistics.noDataTitle")}
          text={t("pages.statistics.noDataText")}
        />
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, ...s.page }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, minWidth: 0 }}>
        <PageHeader
          title={t("pages.statistics.title")}
          subtitle={t("pages.statistics.subtitle")}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end", minWidth: 0, maxWidth: "100%" }}>
          {/* FIX #10: badge fonte dati — l'utente sa se sta vedendo dati Supabase o locali */}
          <Badge tone={statsSource === "supabase" ? "green" : "orange"}>
            {statsSource === "supabase" ? t("pages.statistics.cloudData") : t("pages.statistics.localData")}
          </Badge>
          <Button variant="ghost" onClick={() => navigate("/exports")}>
            {t("pages.statistics.reportPdf")}
          </Button>
          <SeasonSelector activeSeason={activeSeason} onChange={changeSeason} />
        </div>
      </div>

      {/* ── KPI ── */}
      <div style={s.kpiGrid} className="no-mobile-override">
        <KpiCard label={t("pages.statistics.totalEvents")} value={filteredEvents.length} icon="📅" accent="#38bdf8" />
        <KpiCard label={t("common.players")} value={players.length} icon="👥" accent="#a78bfa" />
        <KpiCard label={t("pages.statistics.topScorerGoals")} value={topScorer?.goals || 0} icon="⚽" accent="#4ade80" />
        <KpiCard label={t("pages.statistics.topMinutes")} value={mostMinutes?.minutes || 0} icon="⏱️" accent="#fbbf24" />
      </div>

      <div style={s.summaryGrid}>
        <SummaryCard
          label={t("pages.statistics.offensiveProduction")}
          value={`${teamSummary.goals} G · ${teamSummary.assists} A`}
          detail={`${teamSummary.goalContributions} ${t("pages.statistics.totalContributions")}`}
          accent="#4ade80"
        />
        <SummaryCard
          label={t("pages.statistics.matchLoad")}
          value={`${teamSummary.minutes} min`}
          detail={`${teamSummary.avgMinutesPerPlayer} ${t("pages.statistics.avgMinutesPerPlayer")}`}
          accent="#fbbf24"
        />
        <SummaryCard
          label={t("pages.statistics.trainingPresence")}
          value={teamSummary.avgTrainingPct !== null ? `${teamSummary.avgTrainingPct}%` : "—"}
          detail={`${teamSummary.trainingPlayers} ${t("pages.statistics.playersWithData")}`}
          accent="#38bdf8"
        />
        <SummaryCard
          label={t("pages.statistics.availability")}
          value={`${teamSummary.available}/${teamSummary.totalPlayers}`}
          detail={`${teamSummary.notAvailable} ${t("pages.statistics.toMonitor")}`}
          accent={teamSummary.notAvailable > 0 ? "#fb7185" : "#22c55e"}
        />
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
      <Suspense fallback={<div style={s.chartFallback}>{t("pages.statistics.loadingCharts")}</div>}>
        <StatisticsCharts stats={stats} history={history} selectedPlayer={selectedPlayer} />
      </Suspense>

      {/* ── Filtri ── */}
      <AppCard>
        <p style={s.sectionLabel}>{t("pages.statistics.filters")}</p>
        <div style={s.filtersGrid}>
          <label style={s.filterLabel}>
            {t("pages.statistics.eventType")}
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              style={styles.input}
            >
              <option value="Tutti">{t("pages.statistics.allEvents")}</option>
              <option value="Allenamento">{t("pages.statistics.training")}</option>
              <option value="Partita">{t("pages.statistics.match")}</option>
            </select>
          </label>

          <label style={s.filterLabel}>
            {t("pages.statistics.from")}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={s.filterLabel}>
            {t("pages.statistics.to")}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={s.filterLabel}>
            {t("pages.statistics.playerFilter")}
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
              {t("pages.statistics.resetFilters")}
            </button>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <div style={s.compareHeader}>
          <div>
            <p style={s.sectionLabel}>{t("pages.statistics.compareTitle")}</p>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, lineHeight: 1.2 }}>
              {t("pages.statistics.compareSubtitle")}
            </h3>
          </div>
          <div style={s.compareSelectors}>
            {[0, 1, 2, 3].map((slot) => (
              <select
                key={slot}
                value={comparePlayerIds[slot] || ""}
                onChange={(event) => updateComparePlayer(slot, event.target.value)}
              style={{ ...styles.input, minWidth: isMobile ? 0 : 160, width: isMobile ? "100%" : undefined, height: 38, fontSize: 13 }}
              >
                <option value="">{slot < 2 ? t("pages.statistics.selectPlayer") : t("pages.statistics.addPlayer")}</option>
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
                      {player.role || t("pages.statistics.roleNotSet")} · {player.status}
                    </p>
                  </div>
                  <Badge tone={player.status === "Disponibile" ? "green" : "orange"}>
                    {t("pages.statistics.comparePresences", { count: player.presences })}
                  </Badge>
                </div>

                <div style={s.compareMetrics}>
                  <CompareMetric label={t("pages.statistics.minAbbr")} value={player.minutes} />
                  <CompareMetric label={t("pages.statistics.avgAbbr")} value={player.avgMinutes} />
                  <CompareMetric label={t("common.goals")} value={player.goals} color="#4ade80" />
                  <CompareMetric label={t("common.assists")} value={player.assists} color="#38bdf8" />
                  <CompareMetric label={t("pages.statistics.gaAbbr")} value={player.goalContributions} color="#a78bfa" />
                  <CompareMetric label={t("pages.statistics.trainingPctAbbr")} value={player.trainingPct !== null ? `${player.trainingPct}%` : "—"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📊"
            title={t("pages.statistics.noCompareTitle")}
            text={t("pages.statistics.noCompareText")}
          />
        )}
      </AppCard>

      {/* ── Griglia principale ── */}
      <div style={{ ...s.mainGrid, ...(isNarrow ? s.mainGridStack : null) }}>

        {/* ── Tabella giocatori ── */}
        <div style={s.mainColumn}>
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={s.tableHeader}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>{t("pages.statistics.playerSummary")}</h3>
              <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13, lineHeight: 1.4 }}>
                {t("pages.statistics.playerSummarySubtitle")}
              </p>
            </div>
            <div style={s.tableHeaderActions}>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setSortOrder(e.target.value === "name" ? "asc" : "desc");
                }}
                style={{ ...styles.input, minWidth: isMobile ? 0 : 170, width: isMobile ? "100%" : undefined, height: 38, padding: "0 12px", fontSize: 13 }}
              >
                <option value="goals">{t("pages.statistics.sortGoals")}</option>
                <option value="assists">{t("pages.statistics.sortAssists")}</option>
                <option value="minutes">{t("pages.statistics.sortMinutes")}</option>
                <option value="presences">{t("pages.statistics.sortPresences")}</option>
                <option value="trainingPct">{t("pages.statistics.sortTrainingPct")}</option>
                <option value="avgMinutes">{t("pages.statistics.sortAvgMinutes")}</option>
                <option value="goalContributions">{t("pages.statistics.sortGoalContributions")}</option>
                <option value="yellowCards">{t("pages.statistics.sortYellowCards")}</option>
                <option value="redCards">{t("pages.statistics.sortRedCards")}</option>
                <option value="name">{t("pages.statistics.sortName")}</option>
              </select>
              <Badge tone="purple">Live DB</Badge>
              <button onClick={exportCSV} style={s.exportBtn} title={t("pages.statistics.exportTitle")}>
                {t("pages.statistics.exportCsv")}
              </button>
            </div>
          </div>

          {/* Barra ricerca + filtri secondari */}
          <div style={s.searchRow}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <span style={s.searchIcon}>&#8981;</span>
              <input
                type="text"
                placeholder={t("pages.statistics.searchPlayer")}
                value={searchPlayer}
                onChange={(e) => setSearchPlayer(e.target.value)}
                style={{ ...styles.input, paddingLeft: 36 }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ ...styles.input, width: isMobile ? "100%" : "auto", minWidth: isMobile ? 0 : 150 }}
            >
              <option value="Tutti">{t("pages.statistics.allRoles")}</option>
              <option value="Portieri">{t("pages.statistics.goalkeepers")}</option>
              <option value="Difensori">{t("pages.statistics.defenders")}</option>
              <option value="Centrocampisti">{t("pages.statistics.midfielders")}</option>
              <option value="Attaccanti">{t("pages.statistics.forwards")}</option>
            </select>

            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={onlyWithStats}
                onChange={(e) => setOnlyWithStats(e.target.checked)}
                style={{ accentColor: "#38bdf8" }}
              />
              {t("pages.statistics.onlyWithStats")}
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
              {coachMode ? t("pages.statistics.coachModeActive") : t("pages.statistics.coachMode")}
            </button>
          </div>

          {/* Panel modalità allenatore */}
          {coachMode && (
            <div style={s.coachPanel}>
              <div style={s.coachPanelHeader}>
                <span style={s.coachDot} />
                <div>
                  <strong style={{ fontSize: 14 }}>{t("pages.statistics.decisionFilters")}</strong>
                  <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 12 }}>
                    {t("pages.statistics.filterByThresholds")}
                  </p>
                </div>
              </div>
              <div style={s.coachGrid}>
                <label style={s.filterLabel}>
                  {t("pages.statistics.minTotalMinutes")}
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
                  {t("pages.statistics.minGoals")}
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
                  {t("pages.statistics.minPresences")}
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
                  {t("pages.statistics.minAvgMinutes")}
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
            <span>{stats.length === 1 ? t("pages.statistics.playersShown", { count: stats.length }) : t("pages.statistics.playersShownPlural", { count: stats.length })}</span>
          </div>

          {/* Tabella desktop / card mobile-tablet */}
          {isNarrow ? (
            <div style={s.mobileCardsGrid}>
              {stats.length === 0 && (
                <div style={s.emptyTable}>
                  {t("pages.statistics.noPlayersMatch")}
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
                      navigate(`/players/${row.id}`);
                    }}
                    style={{
                      ...s.mobilePlayerCard,
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
                        <span style={s.mobileStatLabel}>{t("pages.statistics.presAbbr")}</span>
                        <span style={s.mobileStatValue}>{row.presences}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>{t("pages.statistics.minAbbr")}</span>
                        <span style={s.mobileStatValue}>{row.minutes}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>{t("common.goals")}</span>
                        <span style={{ ...s.mobileStatValue, color: row.goals > 0 ? "#4ade80" : "#94a3b8" }}>{row.goals}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>{t("common.assists")}</span>
                        <span style={{ ...s.mobileStatValue, color: row.assists > 0 ? "#38bdf8" : "#94a3b8" }}>{row.assists}</span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>{t("pages.statistics.trainingPctAbbr")}</span>
                        <span style={{
                          ...s.mobileStatValue,
                          color: row.trainingPct === null ? "#475569" : row.trainingPct >= 80 ? "#22c55e" : row.trainingPct >= 60 ? "#fbbf24" : "#f87171",
                        }}>
                          {row.trainingPct !== null ? `${row.trainingPct}%` : "—"}
                        </span>
                      </div>
                      <div style={s.mobileStatRow}>
                        <span style={s.mobileStatLabel}>{t("pages.statistics.cardsLabel")}</span>
                        <span style={s.mobileStatValue}>{row.yellowCards} / {row.redCards}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
          <div style={s.tableScroll}>
            <div style={s.table}>
              {/* Header */}
              <div style={s.colHeader}>
                <span
                  onClick={() => handleSort("name")}
                  style={{ ...s.thClickable, color: sortBy === "name" ? "#38bdf8" : "#64748b" }}
                >
                  {t("common.player")} {sortArrow("name")}
                </span>
                <span style={{ color: "#64748b" }}>{t("common.status")}</span>
                <span
                  onClick={() => handleSort("presences")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "presences" ? "#38bdf8" : "#64748b" }}
                >
                  {t("pages.statistics.presAbbr")} {sortArrow("presences")}
                </span>
                <span style={{ ...s.thNum, color: "#64748b" }}>{t("pages.statistics.absAbbr")}</span>
                <span style={{ ...s.thNum, color: "#64748b" }}>{t("pages.statistics.injAbbr")}</span>
                <span style={{ ...s.thNum, color: "#64748b" }}>{t("pages.statistics.trainingPresAbbr")}</span>
                <span
                  onClick={() => handleSort("trainingPct")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "trainingPct" ? "#22d3ee" : "#64748b" }}
                  title={t("pages.statistics.trainingAttendancePct")}
                >
                  {t("pages.statistics.trainingPctAbbr")} {sortArrow("trainingPct")}
                </span>
                <span
                  onClick={() => handleSort("minutes")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "minutes" ? "#38bdf8" : "#64748b" }}
                >
                  {t("pages.statistics.minAbbr")} {sortArrow("minutes")}
                </span>
                <span
                  onClick={() => handleSort("avgMinutes")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "avgMinutes" ? "#38bdf8" : "#64748b" }}
                >
                  {t("pages.statistics.avgAbbr")} {sortArrow("avgMinutes")}
                </span>
                <span
                  onClick={() => handleSort("goals")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "goals" ? "#4ade80" : "#64748b" }}
                >
                  {t("common.goals")} {sortArrow("goals")}
                </span>
                <span
                  onClick={() => handleSort("assists")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "assists" ? "#38bdf8" : "#64748b" }}
                >
                  {t("common.assists")} {sortArrow("assists")}
                </span>
                <span
                  onClick={() => handleSort("goalContributions")}
                  style={{ ...s.thClickable, ...s.thNum, color: sortBy === "goalContributions" ? "#a78bfa" : "#64748b" }}
                >
                  {t("pages.statistics.gaAbbr")} {sortArrow("goalContributions")}
                </span>
                <span style={{ ...s.thNum, color: "#64748b" }}>{t("pages.statistics.minPerGoalAbbr")}</span>
                <span style={{ ...s.thNum, color: "#64748b" }}>{t("pages.statistics.minPerGAAbbr")}</span>
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
                  {t("pages.statistics.noPlayersMatch")}
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
                       navigate(`/players/${row.id}`);
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
                      {isTopScorer && <span style={s.tagGoal}>⚽ {t("pages.dashboard.topScorer")}</span>}
                      {isTopMinutes && !isTopScorer && <span style={s.tagMinutes}>⏱ {t("pages.dashboard.mostMinutes")}</span>}
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
        </div>

        {/* ── Colonna destra ── */}
        <div style={s.sideColumn}>

          {/* Scheda rapida */}
          <AppCard>
            <h3 style={s.sideTitle}>
              {t("pages.statistics.quickCard")}
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
                      {selectedPlayer.role || t("pages.statistics.roleNotSet")}
                    </p>
                  </div>
                </div>

                <div style={s.miniGrid}>
                  <MiniStat label={t("pages.statistics.presences")} value={selectedStats?.presences || 0} icon="📋" />
                  <MiniStat label={t("common.minutes")} value={selectedStats?.minutes || 0} icon="⏱️" />
                  <MiniStat label={t("common.goals")} value={selectedStats?.goals || 0} icon="⚽" color="#4ade80" />
                  <MiniStat label={t("common.assists")} value={selectedStats?.assists || 0} icon="🅰️" color="#38bdf8" />
                </div>
              </div>
            )}
          </AppCard>

          {/* Storico eventi */}
          <AppCard>
            <h3 style={s.sideTitle}>
              {t("pages.statistics.eventHistory")}
            </h3>

            {history.length === 0 ? (
              <div style={s.emptyHistory}>
                <span style={{ fontSize: 28 }}>📭</span>
                <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
                  {t("pages.statistics.noEventHistory")}
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

function SummaryCard({ label, value, detail, accent = "#38bdf8" }) {
  return (
    <div style={{ ...s.summaryCard, borderColor: `${accent}33`, background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.035))` }}>
      <div style={{ ...s.summaryAccent, background: accent }} />
      <p style={s.summaryLabel}>{label}</p>
      <strong style={s.summaryValue}>{value}</strong>
      <span style={s.summaryDetail}>{detail}</span>
    </div>
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
  const { t } = useTranslation();
  const SEASONS = ["2023/2024", "2024/2025", "2025/2026", "2026/2027"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#475569" }}>
        {t("pages.statistics.activeSeason")}
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

function getCoachInsights(stats, t) {
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
      title: t("pages.statistics.mostEfficient"),
      name: efficient?.name || "N/D",
      value: efficient ? t("pages.statistics.efficientGoals", { count: efficient.goals }) : "-",
      description: efficient
        ? t("pages.statistics.efficientDesc")
        : t("pages.statistics.efficientNoData"),
    },
    {
      icon: "🧱",
      title: t("pages.statistics.mostUsed"),
      name: mostUsed?.name || "N/D",
      value: mostUsed ? t("pages.statistics.mostUsedMinutes", { count: mostUsed.minutes }) : "-",
      description: t("pages.statistics.mostUsedDesc"),
    },
    {
      icon: "🎯",
      title: t("pages.statistics.mostDecisive"),
      name: decisive?.name || "N/D",
      value: decisive ? t("pages.statistics.decisiveGA", { count: decisive.goals + decisive.assists }) : "-",
      description: t("pages.statistics.decisiveDesc"),
    },
    {
      icon: "👀",
      title: t("pages.statistics.toMonitorLabel"),
      name: monitor?.name || "N/D",
      value: monitor
        ? t("pages.statistics.monitorValue", { avg: Math.round(monitor.minutes / Math.max(monitor.presences, 1)) })
        : "-",
      description: t("pages.statistics.monitorDesc"),
    },
  ];
}

function getTeamSummary(stats) {
  const totals = stats.reduce(
    (acc, player) => {
      acc.totalPlayers += 1;
      acc.goals += Number(player.goals || 0);
      acc.assists += Number(player.assists || 0);
      acc.goalContributions += Number(player.goalContributions || 0);
      acc.minutes += Number(player.minutes || 0);
      acc.available += player.status === "Disponibile" ? 1 : 0;

      if (player.trainingPct !== null && player.trainingPct !== undefined) {
        acc.trainingPctSum += Number(player.trainingPct || 0);
        acc.trainingPlayers += 1;
      }

      return acc;
    },
    {
      totalPlayers: 0,
      goals: 0,
      assists: 0,
      goalContributions: 0,
      minutes: 0,
      available: 0,
      trainingPctSum: 0,
      trainingPlayers: 0,
    }
  );

  return {
    ...totals,
    avgMinutesPerPlayer: totals.totalPlayers ? Math.round(totals.minutes / totals.totalPlayers) : 0,
    avgTrainingPct: totals.trainingPlayers ? Math.round(totals.trainingPctSum / totals.trainingPlayers) : null,
    notAvailable: Math.max(0, totals.totalPlayers - totals.available),
  };
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
  page: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflowX: "hidden",
    boxSizing: "border-box",
  },

  // Coach Insights
  insightsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
    gap: 14,
    marginBottom: 20,
    minWidth: 0,
  },
  insightCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    minWidth: 0,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
    gap: 16,
    marginBottom: 20,
    minWidth: 0,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
    gap: 12,
    marginBottom: 20,
    minWidth: 0,
  },
  summaryCard: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid",
    borderRadius: 14,
    padding: "14px 16px 14px 18px",
  },
  summaryAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 999,
  },
  summaryLabel: {
    margin: "0 0 8px",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  summaryValue: {
    display: "block",
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1.05,
  },
  summaryDetail: {
    display: "block",
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
  },
  chartFallback: {
    minHeight: 120,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 20,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.75fr)",
    gap: 20,
    alignItems: "start",
    marginTop: 20,
    maxWidth: "100%",
    minWidth: 0,
  },
  mainGridStack: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  mainColumn: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  sideColumn: {
    display: "grid",
    gap: 18,
    minWidth: 0,
    maxWidth: "100%",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
    gap: 12,
    alignItems: "end",
    minWidth: 0,
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
    minWidth: 0,
  },
  compareSelectors: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 0,
    maxWidth: "100%",
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
    gap: 12,
    minWidth: 0,
  },
  compareCard: {
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    minWidth: 0,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
    gap: 8,
    minWidth: 0,
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
    minWidth: 0,
  },
  tableHeaderActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    minWidth: 0,
    maxWidth: "100%",
  },

  // Barra ricerca
  searchRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
    minWidth: 0,
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
  tableScroll: {
    overflowX: "auto",
    overflowY: "hidden",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    WebkitOverflowScrolling: "touch",
  },
  table: {
    minWidth: 1040,
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
  mobileCardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
    gap: 12,
    minWidth: 0,
  },
  mobilePlayerCard: {
    width: "100%",
    minWidth: 0,
    textAlign: "left",
    borderRadius: 14,
    padding: "14px 16px",
    color: "white",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s, transform 0.15s",
  },
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
