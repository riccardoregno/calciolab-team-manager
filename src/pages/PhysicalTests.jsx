import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";

import { styles } from "../styles/index.js";
import { createId, formatShortDate, getPhysicalReference } from "../utils/helpers";
import { useAppSettings } from "../hooks/useAppSettings";
import { useTranslation } from "../i18n";

const GROUP_TONE = { "Gruppo A": "green", "Gruppo B": "blue", "Gruppo C": "orange", "Gruppo D": "red", "Da testare": "purple" };
const PHYSICAL_TEST_MODAL = "physical-test";
const PHYSICAL_TEST_DRAFT_KEY = "calciolab_physical_test_draft_v1";

function emptyForm(playerId = "") {
  return {
    playerId,
    date:       new Date().toISOString().slice(0, 10),
    gaconLevel: "", yoYo: "", sprint10m: "", sprint30m: "",
    jumpCm: "", weight: "", bodyFat: "", agility: "", restingHR: "", height: "", notes: "",
  };
}

function loadPhysicalTestDraft(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

function clearPhysicalTestDraft(id = "new") {
  try {
    localStorage.removeItem(`${PHYSICAL_TEST_DRAFT_KEY}:${id}`);
  } catch {
    /* localStorage can be unavailable in restricted browsers */
  }
}

// ─── BMI ──────────────────────────────────────
function calcBMI(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (!w || !h || isNaN(w) || isNaN(h) || h <= 0) return null;
  return parseFloat((w / (h * h)).toFixed(1));
}

function getBMICategory(bmi) {
  if (bmi === null || bmi === undefined) return null;
  if (bmi < 18.5) return { labelKey: "pages.physicalTests.bmiUnderweight", color: "#60a5fa" };
  if (bmi < 25)   return { labelKey: "pages.physicalTests.bmiNormal",      color: "#22c55e" };
  if (bmi < 30)   return { labelKey: "pages.physicalTests.bmiOverweight",  color: "#f59e0b" };
  return            { labelKey: "pages.physicalTests.bmiObese",             color: "#f87171" };
}

// ─── Trend ────────────────────────────────────
function getTrend(curr, prev, higherIsBetter) {
  if (!curr || !prev || higherIsBetter === null) return null;
  const c = parseFloat(curr), p = parseFloat(prev);
  if (isNaN(c) || isNaN(p) || c === p) return "same";
  return higherIsBetter ? (c > p ? "up" : "down") : (c < p ? "up" : "down");
}

// ─── Delta % tra due rilevazioni ──────────────
function calcDelta(curr, prev, higherIsBetter) {
  const c = parseFloat(curr), p = parseFloat(prev);
  if (isNaN(c) || isNaN(p) || p === 0) return null;
  const pct = ((c - p) / Math.abs(p)) * 100;
  let isImprovement = null;
  if (higherIsBetter === true)  isImprovement = pct > 0;
  if (higherIsBetter === false) isImprovement = pct < 0;
  return { pct: Math.abs(pct).toFixed(1), sign: pct >= 0 ? "+" : "−", isImprovement };
}

const TREND_STYLE = {
  up:   { color: "#22c55e", symbol: "↑" },
  down: { color: "#f87171", symbol: "↓" },
  same: { color: "#64748b", symbol: "→" },
};

// ─── Grafico SVG per singolo giocatore ────────
function PlayerLineChart({ tests, metrics }) {
  const { t } = useTranslation();
  const chartMetrics = metrics.filter((m) => {
    // solo metriche con almeno 1 valore numerico
    return tests.some((t) => t[m.key] !== "" && !isNaN(parseFloat(t[m.key])));
  });

  const [selKey, setSelKey] = useState(chartMetrics[0]?.key || "");
  const metric = chartMetrics.find((m) => m.key === selKey);

  const sorted = [...tests].sort((a, b) => new Date(a.date) - new Date(b.date));
  const points = sorted
    .map((t) => ({ date: t.date, val: parseFloat(t[selKey]) }))
    .filter((p) => !isNaN(p.val));

  if (chartMetrics.length === 0) {
    return <p style={{ color: "#64748b", textAlign: "center", padding: "24px 0" }}>{t("pages.physicalTests.chartNoData")}</p>;
  }

  return (
    <div>
      {/* selector metriche */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {chartMetrics.map((m) => (
          <button
            type="button"
            key={m.key}
            onClick={() => setSelKey(m.key)}
            style={{
              padding: "5px 12px", borderRadius: 9, fontSize: 12, cursor: "pointer", border: "none",
              background: selKey === m.key ? "rgba(96,165,250,0.22)" : "rgba(255,255,255,0.06)",
              color: selKey === m.key ? "#93c5fd" : "#64748b", fontWeight: 700, transition: "all 0.15s",
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {points.length < 2 ? (
        <p style={{ color: "#64748b", textAlign: "center", padding: "20px 0" }}>
          {t("pages.physicalTests.chartNeedTwo")}
        </p>
      ) : (
        <ChartSVG points={points} metric={metric} />
      )}

      {/* tabella valori */}
      {points.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {points.map((p, i) => {
            const prev = points[i - 1];
            const delta = prev ? calcDelta(p.val, prev.val, metric?.higherIsBetter) : null;
            return (
              <div key={i} style={{
                padding: "8px 12px", borderRadius: 12,
                background: i === points.length - 1 ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${i === points.length - 1 ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.07)"}`,
                minWidth: 80, textAlign: "center",
              }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, color: "#475569" }}>{formatShortDate(p.date)}</p>
                <strong style={{ fontSize: 15, color: "#e2e8f0" }}>{p.val}</strong>
                {metric?.unit && <span style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>{metric.unit}</span>}
                {delta && (
                  <p style={{
                    margin: "3px 0 0", fontSize: 11, fontWeight: 800,
                    color: delta.isImprovement === null ? "#64748b" : delta.isImprovement ? "#22c55e" : "#f87171",
                  }}>
                    {delta.sign}{delta.pct}%
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChartSVG({ points, metric }) {
  const W = 460, H = 180;
  const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const vals = points.map((p) => p.val);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const xScale = (i) => PAD.left + (i / Math.max(points.length - 1, 1)) * innerW;
  const yScale = (v) => PAD.top + innerH - ((v - minV) / range) * innerH;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(p.val).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${xScale(points.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const gridVals = [0, 0.33, 0.67, 1].map((t) => ({
    y: PAD.top + t * innerH,
    v: (maxV - t * range).toFixed(1),
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id="ptAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid */}
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={g.y} x2={PAD.left + innerW} y2={g.y}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={PAD.left - 6} y={g.y + 4} fontSize={9} fill="#475569" textAnchor="end">{g.v}</text>
        </g>
      ))}

      {/* area */}
      <path d={areaD} fill="url(#ptAreaGrad)" />
      {/* line */}
      <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* dots + value labels */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <g key={i}>
            <circle cx={xScale(i)} cy={yScale(p.val)} r={isLast ? 5 : 4}
              fill={isLast ? "#93c5fd" : "#60a5fa"} stroke="#0f172a" strokeWidth={2} />
            <text x={xScale(i)} y={yScale(p.val) - 11} fontSize={isLast ? 11 : 9}
              fill={isLast ? "#e2e8f0" : "#94a3b8"} textAnchor="middle" fontWeight={isLast ? "900" : "600"}>
              {p.val}{metric?.unit}
            </text>
            <text x={xScale(i)} y={PAD.top + innerH + 16} fontSize={9} fill="#475569" textAnchor="middle">
              {formatShortDate(p.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────
export default function PhysicalTests({
  players = [], physicalTests = [], setPhysicalTests, appSettings }) {

  const { t } = useTranslation();
  const { showToast, ToastContainer } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const isTestModalOpen = searchParams.get("modal") === PHYSICAL_TEST_MODAL;
  const modalPlayerId = searchParams.get("playerId") || "";
  const modalTestId = searchParams.get("testId") || "";
  const modalKeyRef = useRef("");
  // FIX #13: memoizzato via hook
  const settings = useAppSettings(appSettings);
  const METRICS  = settings.physicalMetrics.filter((m) => m.enabled);

  const [modal, setModal]               = useState(null);       // null | { mode, form, testId? }
  const [openHistory, setOpenHistory]   = useState(null);       // playerId
  const [rankMetric, setRankMetric]     = useState(null);       // null = grid
  const [chartPlayerId, setChartPlayerId] = useState(null);     // playerId per modale grafico
  const [confirmState, setConfirmState] = useState(null);

  // Per ogni giocatore: tutti i test ordinati per data DESC
  const testsByPlayer = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[String(p.id)] = physicalTests
        .filter((t) => String(t.playerId) === String(p.id))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    return map;
  }, [players, physicalTests]);

  useEffect(() => {
    if (!isTestModalOpen) {
      modalKeyRef.current = "";
      return;
    }

    const keyId = modalTestId || modalPlayerId || "new";
    const key = `${PHYSICAL_TEST_DRAFT_KEY}:${keyId}`;
    if (modalKeyRef.current === key) return;
    modalKeyRef.current = key;

    if (modalTestId) {
      const test = physicalTests.find((item) => String(item.id) === String(modalTestId));
      if (!test) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModal(loadPhysicalTestDraft(key, { mode: "edit", testId: test.id, form: { ...test } }));
      return;
    }

    setModal(loadPhysicalTestDraft(key, { mode: "add", form: emptyForm(String(modalPlayerId)) }));
  }, [isTestModalOpen, modalPlayerId, modalTestId, physicalTests]);

  useEffect(() => {
    if (!isTestModalOpen || !modal || !modalKeyRef.current) return;
    try {
      localStorage.setItem(modalKeyRef.current, JSON.stringify(modal));
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }, [isTestModalOpen, modal]);

  // ── Modal helpers ─────────────────────────
  function openAdd(playerId) {
    const params = new URLSearchParams(location.search);
    params.set("modal", PHYSICAL_TEST_MODAL);
    params.set("playerId", String(playerId));
    params.delete("testId");
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function openEdit(test) {
    const params = new URLSearchParams(location.search);
    params.set("modal", PHYSICAL_TEST_MODAL);
    params.set("testId", String(test.id));
    params.delete("playerId");
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeModal({ resetDraft = false } = {}) {
    const draftId = modal?.testId || modal?.form?.playerId || modalTestId || modalPlayerId || "new";
    if (resetDraft) clearPhysicalTestDraft(draftId);
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    params.delete("playerId");
    params.delete("testId");
    const search = params.toString();
    setModal(null);
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  }

  function saveTest() {
    const f = modal.form;
    if (!f.playerId) {
      showToast(t("pages.physicalTests.noPlayerToast"), "warn");
      return;
    }
    if (modal.mode === "edit") {
      setPhysicalTests((prevTests) => prevTests.map((t) => t.id === modal.testId ? { ...f, id: modal.testId } : t));
    } else {
      setPhysicalTests((prevTests) => [...prevTests, { ...f, id: createId("pt") }]);
    }
    clearPhysicalTestDraft(modal.testId || f.playerId || "new");
    closeModal();
  }

  function deleteTest(id) {
    setConfirmState({
      message: t("pages.physicalTests.deleteConfirm"),
      confirmLabel: t("pages.physicalTests.deleteLabel"),
      confirmTone: "red",
      onConfirm: () => setPhysicalTests((prevTests) => prevTests.filter((t) => t.id !== id)),
    });
  }

  // ── Ranking ───────────────────────────────
  const rankingRows = useMemo(() => {
    if (!rankMetric) return [];
    const metric = METRICS.find((m) => m.key === rankMetric);
    return players
      .map((p) => {
        const latest = testsByPlayer[String(p.id)]?.[0];
        const val    = latest?.[rankMetric] || null;
        return { player: p, value: val };
      })
      .filter((r) => r.value !== null && r.value !== "")
      .sort((a, b) => {
        const va = parseFloat(a.value), vb = parseFloat(b.value);
        return metric?.higherIsBetter === false ? va - vb : vb - va;
      });
  }, [rankMetric, players, testsByPlayer, METRICS]);

  const totalTests     = physicalTests.length;
  const playersTested  = players.filter((p) => (testsByPlayer[String(p.id)] || []).length > 0).length;
  const lastTestDate   = physicalTests.length
    ? [...physicalTests].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
    : null;

  // player per grafico
  const chartPlayer = players.find((p) => String(p.id) === String(chartPlayerId));
  const chartTests  = chartPlayerId ? (testsByPlayer[String(chartPlayerId)] || []) : [];
  const chartName   = chartPlayer
    ? ([chartPlayer.firstName, chartPlayer.lastName].filter(Boolean).join(" ") || chartPlayer.name || "—")
    : "";

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.physicalTests.title")}
        subtitle={t("pages.physicalTests.subtitle")}
      />

      {/* Stats bar */}
      <div style={pt.statsBar}>
        <StatChip label={t("pages.physicalTests.statTotal")}        value={totalTests}     color="#60a5fa" />
        <StatChip label={t("pages.physicalTests.statTested")}  value={`${playersTested}/${players.length}`} color="#34d399" />
        {lastTestDate && <StatChip label={t("pages.physicalTests.statLastTest")} value={formatShortDate(lastTestDate)} color="#a78bfa" />}
        <div style={{ flex: 1 }} />

        {/* Ranking toggle */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{t("pages.physicalTests.rankingLabel")}</span>
          <button
            type="button"
            onClick={() => setRankMetric(null)}
            style={{ ...pt.rankBtn, ...(rankMetric === null ? pt.rankBtnActive : {}) }}
          >
            {t("pages.physicalTests.rankingSquad")}
          </button>
          {METRICS.filter((m) => m.higherIsBetter !== null).map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => setRankMetric(rankMetric === m.key ? null : m.key)}
              style={{ ...pt.rankBtn, ...(rankMetric === m.key ? pt.rankBtnActive : {}) }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── VISTA RANKING ── */}
      {rankMetric && (
        <AppCard>
          <h3 style={{ margin: "0 0 16px", lineHeight: 1.2 }}>
            {t("pages.physicalTests.rankingTitle", { metric: METRICS.find((m) => m.key === rankMetric)?.label })}
          </h3>
          {rankingRows.length === 0 ? (
            <p style={{ color: "#64748b" }}>{t("pages.physicalTests.rankingNoData")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {rankingRows.map((row, i) => {
                const name = [row.player.firstName, row.player.lastName].filter(Boolean).join(" ") || row.player.name || "—";
                const metric = METRICS.find((m) => m.key === rankMetric);
                return (
                  <div key={row.player.id} style={pt.rankRow}>
                    <span style={{ ...pt.rankNum, color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>
                      #{i + 1}
                    </span>
                    <strong style={{ flex: 1, fontSize: 14, color: "#e2e8f0" }}>{name}</strong>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>{row.player.role || "—"}</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: "#e2e8f0", minWidth: 80, textAlign: "right" }}>
                      {row.value} <span style={{ fontSize: 12, color: "#64748b" }}>{metric?.unit}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>
      )}

      {/* ── VISTA SQUADRA (cards per giocatore) ── */}
      {!rankMetric && (
        <>
          {players.length === 0 ? (
            <EmptyState icon="⏱️" title={t("pages.physicalTests.emptyTitle")} text={t("pages.physicalTests.emptyText")} />
          ) : (
            <div style={pt.grid}>
              {players.map((player) => {
                const pid      = String(player.id);
                const tests    = testsByPlayer[pid] || [];
                const latest   = tests[0];
                const previous = tests[1];
                const name     = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";
                const reference = getPhysicalReference(latest, settings.coachParameters);
                const isOpen   = openHistory === pid;

                // BMI derivato dall'ultimo test
                const bmi     = latest ? calcBMI(latest.weight, latest.height) : null;
                const bmiCat  = getBMICategory(bmi);

                return (
                  <div key={pid} style={pt.playerCard}>
                    {/* Header */}
                    <div style={pt.cardHeader}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={pt.avatar}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: "#60a5fa" }}>{name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <strong style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.2 }}>{name}</strong>
                          <p style={pt.muted}>{player.role || "—"}{player.shirtNumber ? ` · #${player.shirtNumber}` : ""}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <Badge tone={GROUP_TONE[reference.group] || "purple"}>{reference.group}</Badge>
                        {latest && <span style={{ fontSize: 11, color: "#475569" }}>{formatShortDate(latest.date)}</span>}
                      </div>
                    </div>

                    {/* MAS se disponibile */}
                    {reference.mas > 0 && (
                      <div style={pt.masRow}>
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>MAS</span>
                        <strong style={{ color: "#34d399" }}>{reference.mas} km/h</strong>
                        <span style={{ fontSize: 12, color: "#475569" }}>· {reference.intensity}</span>
                        {bmi && bmiCat && (
                          <>
                            <span style={{ color: "#334155", margin: "0 4px" }}>·</span>
                            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>BMI</span>
                            <strong style={{ color: bmiCat.color }}>{bmi}</strong>
                            <span style={{ fontSize: 11, color: bmiCat.color, fontWeight: 700 }}>({t(bmiCat.labelKey)})</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* BMI standalone se no MAS */}
                    {reference.mas === 0 && bmi && bmiCat && (
                      <div style={{ ...pt.masRow, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>BMI</span>
                        <strong style={{ color: bmiCat.color, fontSize: 16 }}>{bmi}</strong>
                        <span style={{ fontSize: 12, color: bmiCat.color, fontWeight: 700 }}>— {t(bmiCat.labelKey)}</span>
                      </div>
                    )}

                    {/* Griglia metriche */}
                    <div style={pt.metricsGrid}>
                      {METRICS.map((metric) => {
                        const val     = latest?.[metric.key];
                        const prevVal = previous?.[metric.key];
                        const trend   = val && prevVal ? getTrend(val, prevVal, metric.higherIsBetter) : null;
                        const delta   = val && prevVal ? calcDelta(val, prevVal, metric.higherIsBetter) : null;
                        const ts      = trend ? TREND_STYLE[trend] : null;

                        return (
                          <div key={metric.key} style={{ ...pt.metricCell, opacity: val ? 1 : 0.35 }}>
                            <span style={pt.metricIcon}>{metric.icon}</span>
                            <span style={pt.metricLabel}>{metric.label}</span>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 15, color: val ? "#e2e8f0" : "#475569" }}>
                                {val || "—"}
                              </strong>
                              {val && <span style={{ fontSize: 10, color: "#475569" }}>{metric.unit}</span>}
                              {ts && (
                                <span style={{ fontSize: 12, fontWeight: 900, color: ts.color, marginLeft: 1 }} title={delta ? `${delta.sign}${delta.pct}%` : ""}>
                                  {ts.symbol}
                                </span>
                              )}
                            </div>
                            {/* delta % sotto il valore */}
                            {delta && trend !== "same" && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: ts?.color || "#64748b" }}>
                                {delta.sign}{delta.pct}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Azioni */}
                    <div style={pt.cardActions}>
                      {tests.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenHistory(isOpen ? null : pid)}
                          style={pt.ghostBtn}
                        >
                          {t("pages.physicalTests.historyBtn", { count: tests.length })}
                        </button>
                      )}
                      {tests.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => setChartPlayerId(pid)}
                          style={{ ...pt.ghostBtn, color: "#93c5fd", borderColor: "rgba(96,165,250,0.25)" }}
                        >
                          {t("pages.physicalTests.chartBtn")}
                        </button>
                      )}
                      <div style={{ flex: 1 }} />
                      <Button onClick={() => openAdd(pid)}>{t("pages.physicalTests.addTestBtn")}</Button>
                    </div>

                    {/* Storico espandibile con delta */}
                    {isOpen && (
                      <div style={pt.historyBox}>
                        <p style={pt.historyTitle}>{t("pages.physicalTests.historyTitle")}</p>
                        <div style={{ display: "grid", gap: 8 }}>
                          {tests.map((test, idx) => {
                            const nextTest = tests[idx + 1]; // più vecchio
                            return (
                              <div key={test.id} style={pt.historyRow}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <Badge tone="blue">{formatShortDate(test.date)}</Badge>
                                  {idx === 0 && <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>● {t("pages.physicalTests.latestBadge")}</span>}
                                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                                    <button onClick={() => openEdit(test)} style={pt.iconBtn} title="Modifica">✏️</button>
                                    <button onClick={() => deleteTest(test.id)} style={{ ...pt.iconBtn, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }} title="Elimina">🗑️</button>
                                  </div>
                                </div>
                                {/* metriche con confronto */}
                                <div style={pt.historyMetrics}>
                                  {METRICS.filter((m) => test[m.key] !== undefined && test[m.key] !== "").map((m) => {
                                    const delta = nextTest ? calcDelta(test[m.key], nextTest[m.key], m.higherIsBetter) : null;
                                    return (
                                      <span key={m.key} style={pt.historyChip}>
                                        <span style={{ color: "#64748b" }}>{m.label}</span>
                                        <strong style={{ color: "#e2e8f0" }}>{test[m.key]}{m.unit}</strong>
                                        {delta && (
                                          <span style={{
                                            fontWeight: 800, fontSize: 11,
                                            color: delta.isImprovement === null ? "#64748b"
                                              : delta.isImprovement ? "#22c55e" : "#f87171",
                                          }}>
                                            {delta.sign}{delta.pct}%
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                                {test.notes && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{test.notes}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── MODAL GRAFICO ── */}
      {chartPlayerId && chartPlayer && (
        <div style={pt.overlay} onClick={() => setChartPlayerId(null)}>
          <div style={{ ...pt.modalBox, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>{t("pages.physicalTests.chartTitle", { name: chartName })}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.35 }}>{t("pages.physicalTests.chartSubtitle", { count: chartTests.length })}</p>
              </div>
              <button onClick={() => setChartPlayerId(null)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <PlayerLineChart tests={chartTests} metrics={METRICS} />
          </div>
        </div>
      )}

      {/* ── MODAL AGGIUNGI / MODIFICA ── */}
      {modal && (
        <div style={pt.overlay} onClick={() => closeModal()}>
          <div style={pt.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>
                {modal.mode === "edit" ? t("pages.physicalTests.modalEditTitle") : t("pages.physicalTests.modalAddTitle")}
              </h3>
              <button onClick={() => closeModal()} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {/* Giocatore + data */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={pt.fieldLabel}>{t("pages.physicalTests.fieldPlayer")}</label>
                  <select
                    value={modal.form.playerId}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, playerId: e.target.value } })}
                    style={styles.input}
                    disabled={modal.mode === "edit"}
                  >
                    <option value="">{t("pages.physicalTests.playerPlaceholder")}</option>
                    {players.map((p) => {
                      const n = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
                      return <option key={p.id} value={String(p.id)}>{n}</option>;
                    })}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={pt.fieldLabel}>{t("pages.physicalTests.fieldDate")}</label>
                  <input
                    type="date"
                    value={modal.form.date}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, date: e.target.value } })}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Metriche in griglia 2 colonne */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {METRICS.map((m) => (
                  <div key={m.key} style={{ display: "grid", gap: 5 }}>
                    <label style={pt.fieldLabel}>{m.icon} {m.label}{m.unit ? ` (${m.unit})` : ""}</label>
                    <input
                      placeholder={
                        m.key === "gaconLevel" ? "es. 22" :
                        m.key === "sprint10m"  ? "es. 1.72" :
                        m.key === "sprint30m"  ? "es. 4.15" :
                        m.key === "jumpCm"     ? "es. 58" :
                        m.key === "yoYo"       ? "es. 18.4" :
                        m.key === "weight"     ? "es. 75" :
                        m.key === "height"     ? "es. 178" :
                        m.key === "bodyFat"    ? "es. 12" :
                        "es. —"
                      }
                      value={modal.form[m.key] ?? ""}
                      onChange={(e) => setModal({ ...modal, form: { ...modal.form, [m.key]: e.target.value } })}
                      style={styles.input}
                      type="number"
                      step="0.01"
                      min="0"
                    />
                  </div>
                ))}
              </div>

              {/* BMI preview in modal se peso + altezza inseriti */}
              {(() => {
                const bmi = calcBMI(modal.form.weight, modal.form.height);
                const cat = getBMICategory(bmi);
                if (!bmi || !cat) return null;
                return (
                  <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{t("pages.physicalTests.bmiCalculated")}</span>
                    <strong style={{ fontSize: 18, color: cat.color }}>{bmi}</strong>
                    <span style={{ fontSize: 12, color: cat.color, fontWeight: 700 }}>— {t(cat.labelKey)}</span>
                  </div>
                );
              })()}

              <div style={{ display: "grid", gap: 6 }}>
                <label style={pt.fieldLabel}>{t("pages.physicalTests.fieldNotes")}</label>
                <textarea
                  value={modal.form.notes}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })}
                  placeholder={t("pages.physicalTests.notesPlaceholder")}
                  style={{ ...styles.input, minHeight: 68, resize: "vertical" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Button variant="ghost" onClick={() => closeModal({ resetDraft: true })}>{t("pages.physicalTests.cancel")}</Button>
              <Button onClick={saveTest}>{modal.mode === "edit" ? t("pages.physicalTests.updateTest") : t("pages.physicalTests.saveTest")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UI helpers ───────────────────────────────
function StatChip({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: 14, color: "#e2e8f0" }}>{value}</strong>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stili
// ─────────────────────────────────────────────
const pt = {
  statsBar:    { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 22 },
  grid:        { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 },
  playerCard:  { borderRadius: 14, padding: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 14 },
  cardHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  avatar:      { width: 42, height: 42, borderRadius: 12, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", display: "grid", placeItems: "center", flexShrink: 0 },
  muted:       { margin: "3px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.35 },
  masRow:      { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)", fontSize: 13, flexWrap: "wrap" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  metricCell:  { display: "grid", gap: 2, padding: "10px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center", minWidth: 0 },
  metricIcon:  { fontSize: 14 },
  metricLabel: { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0, lineHeight: 1.15 },
  cardActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  ghostBtn:    { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "7px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 700 },
  historyBox:  { background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 14, border: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 10 },
  historyTitle:{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#475569" },
  historyRow:  { display: "grid", gap: 6, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  historyMetrics: { display: "flex", gap: 6, flexWrap: "wrap" },
  historyChip: { fontSize: 12, padding: "3px 8px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 4, alignItems: "center" },
  iconBtn:     { width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 12, display: "grid", placeItems: "center", padding: 0 },
  rankBtn:     { borderRadius: 9, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" },
  rankBtnActive:{ background: "rgba(96,165,250,0.18)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd" },
  rankRow:     { display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" },
  rankNum:     { fontSize: 16, fontWeight: 900, minWidth: 28 },
  overlay:     { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modalBox:    { background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 520, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" },
  fieldLabel:  { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#64748b" },
};
