import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import { styles } from "../styles/index.js";
import { useTranslation } from "../i18n";
import { getPlayerSummary, normalizeAppSettings } from "../utils/helpers";
import { loadAllPlayerStats, loadTeamPlayerMatches } from "../services/playerProfile";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function age(birthDate) {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function statusTone(status) {
  if (status === "Infortunato")  return "red";
  if (status === "Squalificato") return "orange";
  if (status === "Disponibile")  return "green";
  return "blue";
}

function buildComparableStats(localStats, dbStats, matchRows = []) {
  const fromRows = matchRows.reduce((acc, row) => ({
    appearances: acc.appearances + (hasMatchContribution(row) ? 1 : 0),
    minutes: acc.minutes + Number(row.minutes_played || 0),
    goals: acc.goals + Number(row.goals || 0),
    assists: acc.assists + Number(row.assists || 0),
  }), { appearances: 0, minutes: 0, goals: 0, assists: 0 });

  if (matchRows.length > 0) {
    return {
      ...localStats,
      presences: fromRows.appearances,
      minutes: fromRows.minutes,
      goals: fromRows.goals,
      assists: fromRows.assists,
    };
  }

  if (!dbStats) return localStats;

  return {
    ...localStats,
    minutes:   Number(dbStats.minutes_played ?? localStats.minutes ?? 0),
    goals:     Number(dbStats.goals ?? localStats.goals ?? 0),
    assists:   Number(dbStats.assists ?? localStats.assists ?? 0),
  };
}

function hasMatchContribution(row) {
  return [
    row.minutes_played,
    row.goals,
    row.assists,
    row.yellow_cards,
    row.red_cards,
    row.rating,
  ].some((value) => Number(value || 0) > 0);
}

function isFriendlyMatch(match) {
  if (match?.isFriendly === true || match?.friendly === true) return true;
  const fields = [match?.matchKind, match?.match_kind, match?.competition, match?.category, match?.kind, match?.title, match?.notes];
  return fields.some((value) => String(value || "").trim().toLowerCase().includes("amichevol"));
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isPresentStatus(value) {
  const status = normalizeStatus(value);
  return status === "presente" || status === "recupero" || status === "titolare" || status === "entrato";
}

function isAbsentStatus(value) {
  const status = normalizeStatus(value);
  return status === "assente" || status === "infortunato" || status === "squalificato" || status === "permesso";
}

function getMatchPlayerIds(match) {
  return [...new Set([
    ...(match?.lineup?.starterIds || []),
    ...(match?.lineup?.benchIds || []),
    ...(match?.lineup?.calledUpIds || []),
  ].map(String).filter(Boolean))];
}

function getLineupAppearances(player, matches) {
  if (!player) return 0;
  const pid = String(player.id);
  return matches.filter((match) => {
    if (isFriendlyMatch(match)) return false;
    const attendance = match?.attendance?.[pid] ?? match?.attendance?.[player.id];
    if (isAbsentStatus(attendance?.status)) return false;
    if (isPresentStatus(attendance?.status)) return true;
    return getMatchPlayerIds(match).includes(pid);
  }).length;
}

function normalizeDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getTrainingPct(player, sessions, matches) {
  if (!player) return null;
  const pid = String(player.id);
  const today = new Date().toISOString().slice(0, 10);
  const isJunior = (player.gruppo || "prima") === "juniores";
  const trainings = [...sessions, ...matches.filter(isFriendlyMatch)]
    .filter((event) => ((event.type || "Allenamento") === "Allenamento" || isFriendlyMatch(event)))
    .map((event) => ({ ...event, date: normalizeDate(event.date) }))
    .filter((event) => event.date && event.date <= today);

  let present = 0;
  let total = 0;
  trainings.forEach((event) => {
    const entry = event.attendance?.[pid] ?? event.attendance?.[player.id];
    const status = entry?.status;
    if (isJunior && !status) return;
    total += 1;
    if (status ? isPresentStatus(status) : true) present += 1;
  });

  return total > 0 ? Math.round((present / total) * 100) : null;
}

// ─── Confronta una singola metrica ───────────────────────────────────────────
function MetricRow({ label, valueA, valueB, higherIsBetter = true, format = (v) => v, icon }) {
  const hasA = valueA !== null && valueA !== undefined && valueA !== "";
  const hasB = valueB !== null && valueB !== undefined && valueB !== "";
  const numA = hasA ? Number(valueA) : 0;
  const numB = hasB ? Number(valueB) : 0;

  let winA = false;
  let winB = false;
  if (hasA && hasB && numA !== numB) {
    if (higherIsBetter) { winA = numA > numB; winB = numB > numA; }
    else                { winA = numA < numB; winB = numB < numA; }
  }

  const maxVal = Math.max(numA, numB, 1);
  const barA = hasA ? Math.round((numA / maxVal) * 100) : 0;
  const barB = hasB ? Math.round((numB / maxVal) * 100) : 0;
  const display = (value, hasValue) => hasValue ? format(value) : "—";

  return (
    <div style={cmp.metricRow} className="no-mobile-override">
      {/* Valore A */}
      <div style={{ ...cmp.metricVal, justifyContent: "flex-end" }}>
        <span style={{ ...cmp.metricNum, color: winA ? "#22c55e" : "#e2e8f0" }}>
          {display(valueA, hasA)}
        </span>
        {winA && <span style={cmp.winBadge}>▲</span>}
      </div>

      {/* Barre + label */}
      <div style={cmp.metricCenter} className="no-mobile-override">
        {/* Barra A */}
        <div style={cmp.barTrack}>
          <div
            style={{
              ...cmp.barFill,
              width: `${barA}%`,
              background: winA
                ? "linear-gradient(90deg, #16a34a, #22c55e)"
                : "linear-gradient(90deg, #1d4ed8, #2563eb)",
              marginLeft: "auto",
              minWidth: hasA ? 2 : 0,
            }}
          />
        </div>

        <div style={cmp.metricLabel}>
          {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
          {label}
        </div>

        {/* Barra B */}
        <div style={cmp.barTrack}>
          <div
            style={{
              ...cmp.barFill,
              width: `${barB}%`,
              background: winB
                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                : "linear-gradient(90deg, #2563eb, #1d4ed8)",
              minWidth: hasB ? 2 : 0,
            }}
          />
        </div>
      </div>

      {/* Valore B */}
      <div style={{ ...cmp.metricVal, justifyContent: "flex-start" }}>
        {winB && <span style={cmp.winBadge}>▲</span>}
        <span style={{ ...cmp.metricNum, color: winB ? "#22c55e" : "#e2e8f0" }}>
          {display(valueB, hasB)}
        </span>
      </div>
    </div>
  );
}

// ─── Intestazione giocatore ───────────────────────────────────────────────────
function PlayerHeader({ player, side }) {
  const { t } = useTranslation();
  const playerAge = age(player?.birthDate);

  return (
    <div style={{
      ...cmp.playerHead,
      alignItems: side === "left" ? "flex-start" : "flex-end",
      borderBottom: `2px solid ${side === "left" ? "#2563eb" : "#7c3aed"}`,
    }}>
      {/* Avatar */}
      <div style={{
        ...cmp.avatar,
        background: side === "left"
          ? "linear-gradient(135deg, #1d4ed8, #2563eb)"
          : "linear-gradient(135deg, #6d28d9, #7c3aed)",
      }}>
        {player?.photo
          ? <img src={player.photo} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          : (player?.name?.[0] || "?").toUpperCase()
        }
      </div>
      <strong style={{ fontSize: 16, color: "#e2e8f0" }}>{player?.name || "—"}</strong>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: side === "left" ? "flex-start" : "flex-end" }}>
        {player?.role && <Badge tone="blue">{player.role}</Badge>}
        {player?.status && <Badge tone={statusTone(player.status)}>{player.status}</Badge>}
      </div>
      {playerAge && (
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {playerAge} {t("pages.playerComparison.years")}
          {player?.shirtNumber ? ` · #${player.shirtNumber}` : ""}
        </span>
      )}
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────
export default function PlayerComparison({ players = [], sessions = [], matches = [], physicalTests = [], teamId = null, appSettings = {} }) {
  const { t } = useTranslation();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeSeason = normalizeAppSettings(appSettings).workspaceProfile.currentSeason;

  const [idA, setIdA] = useState(params.get("a") || players[0]?.id || "");
  const [idB, setIdB] = useState(params.get("b") || players[1]?.id || "");
  const [seasonStats, setSeasonStats] = useState({});
  const [playerMatchRows, setPlayerMatchRows] = useState([]);

  const playerA = useMemo(() => players.find((p) => String(p.id) === String(idA)), [players, idA]);
  const playerB = useMemo(() => players.find((p) => String(p.id) === String(idB)), [players, idB]);

  const summaryA = useMemo(
    () => getPlayerSummary(playerA, { sessions, matches, physicalTests }),
    [playerA, sessions, matches, physicalTests]
  );
  const summaryB = useMemo(
    () => getPlayerSummary(playerB, { sessions, matches, physicalTests }),
    [playerB, sessions, matches, physicalTests]
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      teamId ? loadAllPlayerStats(teamId, activeSeason) : Promise.resolve({ data: {} }),
      teamId ? loadTeamPlayerMatches(teamId) : Promise.resolve({ data: [] }),
    ]).then(([statsResult, matchesResult]) => {
      if (!active) return;
      setSeasonStats(statsResult.data || {});
      setPlayerMatchRows(matchesResult.data || []);
    });

    return () => { active = false; };
  }, [activeSeason, teamId]);

  const rowsA = playerMatchRows.filter((row) => String(row.player_id) === String(playerA?.id || ""));
  const rowsB = playerMatchRows.filter((row) => String(row.player_id) === String(playerB?.id || ""));
  const statsA = buildComparableStats(summaryA.stats, seasonStats[String(playerA?.id || "")], rowsA);
  const statsB = buildComparableStats(summaryB.stats, seasonStats[String(playerB?.id || "")], rowsB);

  const appearancesA = rowsA.length > 0 ? statsA.presences : getLineupAppearances(playerA, matches);
  const appearancesB = rowsB.length > 0 ? statsB.presences : getLineupAppearances(playerB, matches);
  const pctA = getTrainingPct(playerA, sessions, matches);
  const pctB = getTrainingPct(playerB, sessions, matches);

  // Test fisici: ultimi per tipo
  function latestTest(player, type) {
    if (!player) return null;
    const tests = physicalTests
      .filter((t) => String(t.playerId) === String(player.id) && (t.type || t.testType || "").toLowerCase().includes(type.toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return tests[0] ?? null;
  }

  // Determina i tipi di test presenti
  const testTypes = [...new Set(physicalTests.map((t) => t.type || t.testType || "Test").filter(Boolean))].slice(0, 4);

  // Punteggio globale (chi vince di più)
  const metrics = [
    { a: appearancesA,              b: appearancesB,              higher: true },
    { a: pctA,                       b: pctB,                       higher: true, requireBoth: true },
    { a: statsA.goals,              b: statsB.goals,              higher: true },
    { a: statsA.assists,            b: statsB.assists,            higher: true },
    { a: statsA.minutes,            b: statsB.minutes,            higher: true },
    { a: summaryA.stats.avgRpe,      b: summaryB.stats.avgRpe,      higher: false },
  ];
  const scoreA = metrics.filter((m) => {
    if (m.requireBoth && (m.a === null || m.b === null)) return false;
    return m.higher ? Number(m.a) > Number(m.b) : Number(m.a) < Number(m.b);
  }).length;
  const scoreB = metrics.filter((m) => {
    if (m.requireBoth && (m.a === null || m.b === null)) return false;
    return m.higher ? Number(m.b) > Number(m.a) : Number(m.b) < Number(m.a);
  }).length;

  return (
    <div style={styles.page}>
      <PageHeader
        title={t("pages.playerComparison.title")}
        subtitle={t("pages.playerComparison.subtitle")}
      />

      {/* Selettori */}
      <AppCard style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }} className="no-mobile-override">
          <div>
            <label style={cmp.selectLabel}>{t("pages.playerComparison.playerA")}</label>
            <select
              value={idA}
              onChange={(e) => setIdA(e.target.value)}
              style={cmp.select}
            >
              <option value="">{t("pages.playerComparison.selectPlayer")}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.role ? `· ${p.role}` : ""}</option>
              ))}
            </select>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={cmp.vsCircle}>VS</div>
          </div>

          <div>
            <label style={cmp.selectLabel}>{t("pages.playerComparison.playerB")}</label>
            <select
              value={idB}
              onChange={(e) => setIdB(e.target.value)}
              style={cmp.select}
            >
              <option value="">{t("pages.playerComparison.selectPlayer")}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.role ? `· ${p.role}` : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </AppCard>

      {(!playerA || !playerB) ? (
        <AppCard>
          <p style={{ color: "#64748b", textAlign: "center", padding: 32, margin: 0 }}>
            {t("pages.playerComparison.selectBoth")}
          </p>
        </AppCard>
      ) : (
        <>
          {/* Header giocatori */}
          <div style={cmp.headGrid}>
            <PlayerHeader player={playerA} side="left" />
            <PlayerHeader player={playerB} side="right" />
          </div>

          {/* Punteggio globale */}
          {(scoreA !== scoreB) && (
            <div style={cmp.scoreBar}>
              <span style={{ color: scoreA > scoreB ? "#22c55e" : "#64748b", fontWeight: 900 }}>
                {playerA?.name?.split(" ")[0]} {scoreA > scoreB ? "🏆" : ""}
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {scoreA} – {scoreB}
              </span>
              <span style={{ color: scoreB > scoreA ? "#22c55e" : "#64748b", fontWeight: 900 }}>
                {scoreB > scoreA ? "🏆" : ""} {playerB?.name?.split(" ")[0]}
              </span>
            </div>
          )}

          {/* Metriche principali */}
          <AppCard title={t("pages.playerComparison.sectionStats")} style={{ marginBottom: 16 }}>
            <MetricRow
              label={t("pages.playerComparison.metricMatchPresences")}
              icon="⚽"
              valueA={appearancesA}
              valueB={appearancesB}
            />
            <MetricRow
              label={t("pages.playerComparison.metricTrainingPct")}
              icon="📋"
              valueA={pctA}
              valueB={pctB}
              format={(v) => `${v}%`}
            />
            <MetricRow
              label={t("pages.playerComparison.metricGoals")}
              icon="🥅"
              valueA={statsA.goals}
              valueB={statsB.goals}
            />
            <MetricRow
              label={t("pages.playerComparison.metricAssists")}
              icon="🎯"
              valueA={statsA.assists}
              valueB={statsB.assists}
            />
            <MetricRow
              label={t("pages.playerComparison.metricMinutes")}
              icon="⏱️"
              valueA={statsA.minutes}
              valueB={statsB.minutes}
              format={(v) => `${v}'`}
            />
            <MetricRow
              label={t("pages.playerComparison.metricRpe")}
              icon="💥"
              valueA={summaryA.stats.avgRpe}
              valueB={summaryB.stats.avgRpe}
              higherIsBetter={false}
              format={(v) => Number(v) ? `${v}/10` : "—"}
            />
            <MetricRow
              label={t("pages.playerComparison.metricLoad")}
              icon="📊"
              valueA={summaryA.stats.load}
              valueB={summaryB.stats.load}
              higherIsBetter={false}
            />
          </AppCard>

          {/* Test fisici */}
          {testTypes.length > 0 && (
            <AppCard title={t("pages.playerComparison.sectionPhysical")} style={{ marginBottom: 16 }}>
              {testTypes.map((type) => {
                const tA = latestTest(playerA, type);
                const tB = latestTest(playerB, type);
                return (
                  <MetricRow
                    key={type}
                    label={type}
                    icon="🏃"
                    valueA={tA?.value ?? tA?.result ?? null}
                    valueB={tB?.value ?? tB?.result ?? null}
                    format={(v) => Number(v) ? Number(v).toFixed(1) : "—"}
                  />
                );
              })}
            </AppCard>
          )}

          {/* Alert */}
          {(summaryA.alerts.length > 0 || summaryB.alerts.length > 0) && (
            <div style={cmp.headGrid}>
              <AppCard title={`⚠️ ${playerA?.name?.split(" ")[0]}`} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {summaryA.alerts.length > 0
                  ? summaryA.alerts.map((a, i) => <p key={i} style={{ margin: "4px 0", fontSize: 13, color: "#fca5a5" }}>{a}</p>)
                  : <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>—</p>}
              </AppCard>
              <AppCard title={`⚠️ ${playerB?.name?.split(" ")[0]}`} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {summaryB.alerts.length > 0
                  ? summaryB.alerts.map((a, i) => <p key={i} style={{ margin: "4px 0", fontSize: 13, color: "#fca5a5" }}>{a}</p>)
                  : <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>—</p>}
              </AppCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────
const cmp = {
  headGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  playerHead: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 20,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    paddingBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 900,
    color: "white",
    overflow: "hidden",
  },
  scoreBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    borderRadius: 12,
    background: "rgba(34,197,94,0.07)",
    border: "1px solid rgba(34,197,94,0.2)",
    marginBottom: 16,
    fontSize: 14,
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 1fr",
    gap: 10,
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  metricVal: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  metricNum: {
    fontWeight: 800,
    fontSize: 15,
  },
  winBadge: {
    fontSize: 10,
    color: "#22c55e",
    fontWeight: 900,
  },
  metricCenter: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 6,
    alignItems: "center",
  },
  metricLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    background: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    display: "flex",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.4s ease",
    minWidth: 2,
  },
  selectLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
  },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
  },
};
