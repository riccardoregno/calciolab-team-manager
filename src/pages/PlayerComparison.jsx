import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import { styles } from "../styles/index.js";
import { useTranslation } from "../i18n";
import { getPlayerSummary } from "../utils/helpers";

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

// ─── Confronta una singola metrica ───────────────────────────────────────────
function MetricRow({ label, valueA, valueB, higherIsBetter = true, format = (v) => v, icon }) {
  const numA = Number(valueA ?? 0);
  const numB = Number(valueB ?? 0);

  let winA = false;
  let winB = false;
  if (numA !== numB) {
    if (higherIsBetter) { winA = numA > numB; winB = numB > numA; }
    else                { winA = numA < numB; winB = numB < numA; }
  }

  const maxVal = Math.max(numA, numB, 1);
  const barA = Math.round((numA / maxVal) * 100);
  const barB = Math.round((numB / maxVal) * 100);

  return (
    <div style={cmp.metricRow} className="no-mobile-override">
      {/* Valore A */}
      <div style={{ ...cmp.metricVal, justifyContent: "flex-end" }}>
        <span style={{ ...cmp.metricNum, color: winA ? "#22c55e" : "#e2e8f0" }}>
          {format(valueA)}
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
            }}
          />
        </div>
      </div>

      {/* Valore B */}
      <div style={{ ...cmp.metricVal, justifyContent: "flex-start" }}>
        {winB && <span style={cmp.winBadge}>▲</span>}
        <span style={{ ...cmp.metricNum, color: winB ? "#22c55e" : "#e2e8f0" }}>
          {format(valueB)}
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
export default function PlayerComparison({ players = [], sessions = [], matches = [], physicalTests = [] }) {
  const { t } = useTranslation();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [idA, setIdA] = useState(params.get("a") || players[0]?.id || "");
  const [idB, setIdB] = useState(params.get("b") || players[1]?.id || "");

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

  // Calcola presenze % allenamenti
  const sessionsWithAtt = sessions.filter((s) => s.attendance && Object.keys(s.attendance).length > 0);
  function attPct(player) {
    if (!player || !sessionsWithAtt.length) return 0;
    const present = sessionsWithAtt.filter((s) => s.attendance?.[player.id]?.status === "Presente").length;
    return Math.round((present / sessionsWithAtt.length) * 100);
  }

  const pctA = attPct(playerA);
  const pctB = attPct(playerB);

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
    { a: summaryA.stats.presences,  b: summaryB.stats.presences,  higher: true },
    { a: pctA,                       b: pctB,                       higher: true },
    { a: summaryA.stats.goals,       b: summaryB.stats.goals,       higher: true },
    { a: summaryA.stats.assists,     b: summaryB.stats.assists,     higher: true },
    { a: summaryA.stats.minutes,     b: summaryB.stats.minutes,     higher: true },
    { a: summaryA.stats.avgRpe,      b: summaryB.stats.avgRpe,      higher: false },
  ];
  const scoreA = metrics.filter((m) => {
    return m.higher ? Number(m.a) > Number(m.b) : Number(m.a) < Number(m.b);
  }).length;
  const scoreB = metrics.filter((m) => {
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
              valueA={summaryA.stats.presences}
              valueB={summaryB.stats.presences}
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
              valueA={summaryA.stats.goals}
              valueB={summaryB.stats.goals}
            />
            <MetricRow
              label={t("pages.playerComparison.metricAssists")}
              icon="🎯"
              valueA={summaryA.stats.assists}
              valueB={summaryB.stats.assists}
            />
            <MetricRow
              label={t("pages.playerComparison.metricMinutes")}
              icon="⏱️"
              valueA={summaryA.stats.minutes}
              valueB={summaryB.stats.minutes}
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
                    valueA={tA?.value ?? tA?.result ?? 0}
                    valueB={tB?.value ?? tB?.result ?? 0}
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
