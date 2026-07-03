/**
 * SeasonGoals — Obiettivi stagione
 *
 * Sezioni:
 *  1. KPI stagione (auto-calcolati da matches)
 *  2. Obiettivi squadra con barre di progresso
 *  3. Obiettivi individuali giocatori
 */
import { useState } from "react";
import { useTranslation } from "../i18n";
import { useSeasonGoals } from "../hooks/useSeasonGoals";
import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import { useToast } from "../components/ui/Toast";
import { parseMatchResult } from "../utils/helpers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeasonStats(matches = []) {
  const played = matches.map((match) => parseMatchResult(match.result)).filter(Boolean);
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
  for (const result of played) {
    const gf = result.goalsFor;
    const ga = result.goalsAgainst;
    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets++;
    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;
  }
  return {
    played: played.length,
    wins,
    draws,
    losses,
    points: wins * 3 + draws,
    goalsFor,
    goalsAgainst,
    cleanSheets,
  };
}

const TEAM_GOAL_TEMPLATES = [
  { type: "points",       emoji: "🏆", color: "#fbbf24" },
  { type: "wins",         emoji: "✅", color: "#22c55e" },
  { type: "goals_for",    emoji: "⚽", color: "#60a5fa" },
  { type: "goals_against",emoji: "🛡️", color: "#f87171", invert: true },
  { type: "clean_sheets", emoji: "🧤", color: "#a78bfa" },
];

const STATUS_LABEL_KEYS = {
  "In corso": "pages.seasonGoals.statusInProgress",
  Completato: "pages.seasonGoals.statusCompleted",
  "Non raggiunto": "pages.seasonGoals.statusNotReached",
};

function getGoalStatus(pct, invert = false) {
  if (invert && pct >= 100) return "Non raggiunto";
  if (!invert && pct >= 100) return "Completato";
  return "In corso";
}

function getAutoValue(type, stats) {
  const map = {
    points:        stats.points,
    wins:          stats.wins,
    goals_for:     stats.goalsFor,
    goals_against: stats.goalsAgainst,
    clean_sheets:  stats.cleanSheets,
  };
  return map[type] ?? null;
}

function ProgressBar({ pct, color = "#60a5fa", invert = false }) {
  // invert = lower is better (goals against)
  const clamp = Math.min(100, Math.max(0, pct));
  const barColor =
    invert
      ? pct >= 100 ? "#f87171" : pct >= 75 ? "#fb923c" : "#22c55e"
      : pct >= 100 ? "#22c55e" : pct >= 60 ? "#fbbf24" : color;

  return (
    <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, height: "100%",
        width: `${clamp}%`,
        background: barColor,
        borderRadius: 99,
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

function StatusBadge({ pct, invert = false }) {
  const { t } = useTranslation();
  const status = getGoalStatus(pct, invert);
  let color, bg;
  if (invert) {
    if (pct >= 100) { color = "#f87171"; bg = "rgba(239,68,68,0.1)"; }
    else if (pct >= 75) { color = "#fb923c"; bg = "rgba(251,146,60,0.1)"; }
    else { color = "#22c55e"; bg = "rgba(34,197,94,0.1)"; }
  } else {
    if (pct >= 100) { color = "#22c55e"; bg = "rgba(34,197,94,0.1)"; }
    else if (pct >= 60) { color = "#fbbf24"; bg = "rgba(251,191,36,0.1)"; }
    else { color = "#f87171"; bg = "rgba(239,68,68,0.1)"; }
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 99, color, background: bg }}>
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
}

// ─── Modale aggiunta obiettivo squadra ───────────────────────────────────────
function AddTeamGoalModal({ onClose, onAdd, stats }) {
  const { t } = useTranslation();
  const [type, setType] = useState("points");
  const [target, setTarget] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  const template = TEAM_GOAL_TEMPLATES.find((tpl) => tpl.type === type) || TEAM_GOAL_TEMPLATES[0];
  const current = getAutoValue(type, stats);

  function handleAdd() {
    const targetNum = Number(target);
    if (!targetNum || targetNum <= 0) return;
    onAdd({
      type,
      emoji: template.emoji,
      color: template.color,
      invert: template.invert || false,
      label: type === "custom" ? customLabel : "",
      target: targetNum,
    });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 420,
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800 }}>
          🎯 {t("pages.seasonGoals.addTeamGoal")}
        </h3>

        <label style={lbl}>{t("pages.seasonGoals.goalType")}</label>
        <select value={type} onChange={(e) => setType(e.target.value)} style={inp}>
          {TEAM_GOAL_TEMPLATES.map((tpl) => (
            <option key={tpl.type} value={tpl.type}>
              {tpl.emoji} {t(`pages.seasonGoals.goalTypes.${tpl.type}`)}
            </option>
          ))}
          <option value="custom">✏️ {t("pages.seasonGoals.goalTypes.custom")}</option>
        </select>

        {type === "custom" && (
          <>
            <label style={lbl}>{t("pages.seasonGoals.goalLabel")}</label>
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={t("pages.seasonGoals.goalLabelPlaceholder")}
              style={inp}
            />
          </>
        )}

        {current !== null && (
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 12px" }}>
            {t("pages.seasonGoals.currentValue")}: <strong style={{ color: "#e2e8f0" }}>{current}</strong>
          </p>
        )}

        <label style={lbl}>{t("pages.seasonGoals.target")}</label>
        <input
          type="number"
          min={1}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t("pages.seasonGoals.targetPlaceholder")}
          style={inp}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={btnGhost}>{t("common.cancel")}</button>
          <button onClick={handleAdd} disabled={!target || Number(target) <= 0} style={btnPrimary}>
            {t("pages.seasonGoals.addBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modale aggiunta obiettivo giocatore ─────────────────────────────────────
function AddPlayerGoalModal({ onClose, onAdd, players }) {
  const { t } = useTranslation();
  const [playerId, setPlayerId] = useState(players[0]?.id || "");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState(t("pages.seasonGoals.defaultUnit"));

  function handleAdd() {
    if (!playerId || !label.trim() || !Number(target)) return;
    onAdd({ playerId, label: label.trim(), target: Number(target), unit: unit.trim() || "" });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 420,
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800 }}>
          👤 {t("pages.seasonGoals.addPlayerGoal")}
        </h3>

        <label style={lbl}>{t("pages.seasonGoals.player")}</label>
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={inp}>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—"}
            </option>
          ))}
        </select>

        <label style={lbl}>{t("pages.seasonGoals.goalLabel")}</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("pages.seasonGoals.playerGoalPlaceholder")}
          style={inp}
        />

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>{t("pages.seasonGoals.target")}</label>
            <input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>{t("pages.seasonGoals.unit")}</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={btnGhost}>{t("common.cancel")}</button>
          <button onClick={handleAdd} disabled={!playerId || !label.trim() || !Number(target)} style={btnPrimary}>
            {t("pages.seasonGoals.addBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function SeasonGoals({ matches = [], players = [] }) {
  const { t } = useTranslation();
  const { showToast, ToastContainer } = useToast();
  const {
    teamGoals, playerGoals,
    addTeamGoal, deleteTeamGoal,
    addPlayerGoal, updatePlayerGoal, deletePlayerGoal,
  } = useSeasonGoals();

  const stats = getSeasonStats(matches);
  const [showTeamModal, setShowTeamModal]     = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingCurrent, setEditingCurrent]   = useState(null); // { id, value }

  // ── KPI bar stagione ───────────────────────────────────────────────────────
  const kpiItems = [
    { label: t("pages.seasonGoals.kpiPlayed"),   value: stats.played,      color: "#94a3b8" },
    { label: t("pages.seasonGoals.kpiWins"),      value: stats.wins,        color: "#22c55e" },
    { label: t("pages.seasonGoals.kpiDraws"),     value: stats.draws,       color: "#fbbf24" },
    { label: t("pages.seasonGoals.kpiLosses"),    value: stats.losses,      color: "#f87171" },
    { label: t("pages.seasonGoals.kpiPoints"),    value: stats.points,      color: "#a78bfa" },
    { label: t("pages.seasonGoals.kpiGoalsFor"),  value: stats.goalsFor,    color: "#60a5fa" },
    { label: t("pages.seasonGoals.kpiGoalsAgainst"), value: stats.goalsAgainst, color: "#fb923c" },
    { label: t("pages.seasonGoals.kpiCleanSheets"), value: stats.cleanSheets, color: "#34d399" },
  ];

  return (
    <div style={{ padding: "24px 24px 40px", maxWidth: 900, margin: "0 auto" }}>
      <ToastContainer />

      {showTeamModal && (
        <AddTeamGoalModal
          stats={stats}
          onClose={() => setShowTeamModal(false)}
          onAdd={(goal) => {
            addTeamGoal(goal);
            showToast(t("pages.seasonGoals.goalAdded"), "ok");
          }}
        />
      )}

      {showPlayerModal && (
        <AddPlayerGoalModal
          players={players}
          onClose={() => setShowPlayerModal(false)}
          onAdd={(goal) => {
            addPlayerGoal(goal);
            showToast(t("pages.seasonGoals.goalAdded"), "ok");
          }}
        />
      )}

      <PageHeader
        title={t("pages.seasonGoals.title")}
        subtitle={t("pages.seasonGoals.subtitle")}
      />

      {/* ── KPI stagione ── */}
      <AppCard style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
          📊 {t("pages.seasonGoals.currentSeason")}
        </h3>
        <div className="no-mobile-override" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 10,
        }}>
          {kpiItems.map(({ label, value, color }) => (
            <div key={label} style={{
              padding: "12px 14px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 4, textTransform: "uppercase" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </AppCard>

      {/* ── Obiettivi squadra ── */}
      <AppCard style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
            🏆 {t("pages.seasonGoals.teamGoalsTitle")}
          </h3>
          <button onClick={() => setShowTeamModal(true)} style={btnAdd}>
            + {t("pages.seasonGoals.addTeamGoal")}
          </button>
        </div>

        {teamGoals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "#475569", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
            <div style={{ fontWeight: 700 }}>{t("pages.seasonGoals.noTeamGoals")}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t("pages.seasonGoals.noTeamGoalsText")}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {teamGoals.map((goal) => {
              const current = goal.type !== "custom"
                ? (getAutoValue(goal.type, stats) ?? 0)
                : 0;
              const pct = goal.target > 0 ? Math.round((current / goal.target) * 100) : 0;
              const label = goal.type === "custom"
                ? goal.label
                : t(`pages.seasonGoals.goalTypes.${goal.type}`);

              return (
                <div key={goal.id} style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{goal.emoji || "🎯"}</span>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{label}</span>
                      <StatusBadge pct={pct} invert={goal.invert} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>
                        <strong style={{ color: goal.color || "#e2e8f0", fontSize: 16 }}>{current}</strong>
                        {" / "}{goal.target}
                      </span>
                      <button
                        onClick={() => {
                          deleteTeamGoal(goal.id);
                          showToast(t("pages.seasonGoals.goalDeleted"), "info");
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, padding: 2 }}
                        title={t("common.delete")}
                        aria-label="Elimina"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <ProgressBar pct={pct} color={goal.color} invert={goal.invert} />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 5, textAlign: "right" }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>

      {/* ── Obiettivi individuali ── */}
      <AppCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
            👤 {t("pages.seasonGoals.playerGoalsTitle")}
          </h3>
          <button
            onClick={() => {
              if (players.length === 0) {
                showToast(t("pages.seasonGoals.noPlayersToast"), "warn");
                return;
              }
              setShowPlayerModal(true);
            }}
            style={btnAdd}
          >
            + {t("pages.seasonGoals.addPlayerGoal")}
          </button>
        </div>

        {playerGoals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "#475569", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
            <div style={{ fontWeight: 700 }}>{t("pages.seasonGoals.noPlayerGoals")}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t("pages.seasonGoals.noPlayerGoalsText")}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {playerGoals.map((goal) => {
              const player = players.find((p) => String(p.id) === String(goal.playerId));
              const playerName = player
                ? player.name || `${player.firstName || ""} ${player.lastName || ""}`.trim()
                : t("pages.seasonGoals.unknownPlayer");
              const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
              const isEditing = editingCurrent?.id === goal.id;

              return (
                <div key={goal.id} style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{goal.label}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        👤 {playerName} {goal.unit ? `· ${goal.unit}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StatusBadge pct={pct} />
                      {/* Edit current value */}
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          value={editingCurrent.value}
                          onChange={(e) => setEditingCurrent({ id: goal.id, value: e.target.value })}
                          onBlur={() => {
                            updatePlayerGoal(goal.id, { current: Number(editingCurrent.value) });
                            setEditingCurrent(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updatePlayerGoal(goal.id, { current: Number(editingCurrent.value) });
                              setEditingCurrent(null);
                            }
                            if (e.key === "Escape") setEditingCurrent(null);
                          }}
                          autoFocus
                          style={{
                            width: 70, padding: "4px 8px", borderRadius: 8,
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(96,165,250,0.5)",
                            color: "#e2e8f0", fontSize: 13, fontWeight: 700,
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingCurrent({ id: goal.id, value: goal.current })}
                          style={{
                            fontSize: 13, fontWeight: 700, color: "#60a5fa",
                            background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)",
                            borderRadius: 8, padding: "3px 10px", cursor: "pointer",
                          }}
                          title={t("pages.seasonGoals.editCurrent")}
                        >
                          {goal.current} / {goal.target}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          deletePlayerGoal(goal.id);
                          showToast(t("pages.seasonGoals.goalDeleted"), "info");
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, padding: 2 }}
                        title={t("common.delete")}
                        aria-label="Elimina"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <ProgressBar pct={pct} color="#60a5fa" />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 5, textAlign: "right" }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>
    </div>
  );
}

// ─── Stili locali ─────────────────────────────────────────────────────────────
const inp = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#e2e8f0", fontSize: 13, marginBottom: 14, boxSizing: "border-box",
};
const lbl = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#64748b", textTransform: "uppercase", marginBottom: 5,
};
const btnPrimary = {
  padding: "9px 20px", borderRadius: 10,
  background: "rgba(59,130,246,0.8)", border: "none",
  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
};
const btnGhost = {
  padding: "9px 20px", borderRadius: 10,
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const btnAdd = {
  padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer",
  background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd",
};
