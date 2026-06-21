import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { loadMatchStats, savePlayerMatchStats } from "../services/playerProfile";
import { useAuth } from "../hooks/useAuth";
import { normalizeAppSettings } from "../utils/helpers";
import { useTranslation } from "../i18n";

const EMPTY_ROW = {
  minutes_played: "",
  goals: "",
  assists: "",
  yellow_cards: "",
  red_cards: "",
  rating: "",
  notes: "",
};

function parseNum(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function parseRating(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

function validateRow(row, t) {
  const errors = [];
  const mins    = parseInt(row.minutes_played, 10);
  const yellows = parseInt(row.yellow_cards,   10);
  const reds    = parseInt(row.red_cards,      10);
  const goals   = parseInt(row.goals,          10);
  const assists = parseInt(row.assists,        10);
  const rating  = parseFloat(row.rating);

  if (!isNaN(mins)    && (mins    < 0 || mins    > 120)) errors.push(t("pages.matchStats.errMinutes"));
  if (!isNaN(goals)   && goals   < 0)                    errors.push(t("pages.matchStats.errGoalsNeg"));
  if (!isNaN(assists) && assists < 0)                     errors.push(t("pages.matchStats.errAssistsNeg"));
  if (!isNaN(yellows) && (yellows < 0 || yellows > 2))   errors.push(t("pages.matchStats.errYellows"));
  if (!isNaN(reds)    && (reds    < 0 || reds    > 1))   errors.push(t("pages.matchStats.errReds"));
  if (!isNaN(rating)  && (rating  < 0 || rating  > 10))  errors.push(t("pages.matchStats.errRating"));

  return errors;
}

function rowToStats(row) {
  return {
    minutes_played: parseNum(row.minutes_played),
    goals:          parseNum(row.goals),
    assists:        parseNum(row.assists),
    yellow_cards:   parseNum(row.yellow_cards),
    red_cards:      parseNum(row.red_cards),
    rating:         parseRating(row.rating),
    notes:          (row.notes || "").trim(),
  };
}

export default function MatchStats({ players = [], matches = [], appSettings = {} }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const activeSeason = normalizeAppSettings(appSettings).workspaceProfile.currentSeason;

  const match = matches.find((m) => String(m.id) === String(id));

  // convocati = starterIds + benchIds (senza duplicati)
  const convocatiIds = match
    ? [...new Set([
        ...(match.lineup?.starterIds || []),
        ...(match.lineup?.benchIds   || []),
      ])]
    : [];

  const convocati = convocatiIds
    .map((pid) => players.find((p) => String(p.id) === String(pid)))
    .filter(Boolean);

  // rows: { [playerId]: { ...EMPTY_ROW } }
  const [rows, setRows] = useState({});
  // savedStats: { [playerId]: riga player_matches già in DB (o null) }
  const savedRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // "ok" | "error"
  const [validationErrors, setValidationErrors] = useState({}); // { [pid]: string[] }
  const [quickMode, setQuickMode] = useState(false);

  useEffect(() => {
    if (!auth.team?.id || !id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    setLoading(true);
    loadMatchStats(auth.team.id, id).then(({ data }) => {
      const byPlayer = {};
      (data || []).forEach((row) => {
        byPlayer[String(row.player_id)] = row;
      });
      savedRef.current = byPlayer;

      // Precompila i rows con i valori già salvati
      const initial = {};
      convocati.forEach((p) => {
        const pid = String(p.id);
        const saved = byPlayer[pid];
        initial[pid] = saved
          ? {
              minutes_played: saved.minutes_played ?? "",
              goals:          saved.goals          ?? "",
              assists:        saved.assists         ?? "",
              yellow_cards:   saved.yellow_cards    ?? "",
              red_cards:      saved.red_cards       ?? "",
              rating:         saved.rating          ?? "",
              notes:          saved.notes           ?? "",
            }
          : { ...EMPTY_ROW };
      });
      setRows(initial);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.team?.id, id]);

  function updateCell(playerId, field, value) {
    setRows((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || EMPTY_ROW), [field]: value },
    }));
    setSaveResult(null);
    // Rimuove eventuali errori di validazione per questo giocatore quando modifica
    setValidationErrors((prev) => {
      if (!prev[playerId]) return prev;
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }

  async function handleSave() {
    if (!auth.team?.id || !id) return;

    // Validazione preventiva
    const errors = {};
    for (const player of convocati) {
      const pid = String(player.id);
      const row = rows[pid];
      if (!row) continue;
      const rowErrors = validateRow(row, t);
      if (rowErrors.length > 0) errors[pid] = rowErrors;
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setSaveResult(null);
    setValidationErrors({});

    let hasError = false;
    for (const player of convocati) {
      const pid = String(player.id);
      const row = rows[pid];
      if (!row) continue;

      // Salta righe completamente vuote (nessun dato inserito)
      const hasData = Object.entries(row).some(([k, v]) =>
        k !== "notes" ? v !== "" && v !== 0 : v !== ""
      );
      if (!hasData) continue;

      const newStats = rowToStats(row);
      const oldStats = savedRef.current[pid] || null;

      const { error } = await savePlayerMatchStats(
        auth.team.id, pid, String(id), newStats, oldStats, activeSeason
      );

      if (error) {
        hasError = true;
      } else {
        // Aggiorna savedRef con i nuovi valori per eventuali salvataggi successivi
        savedRef.current[pid] = { ...newStats, player_id: pid, match_id: String(id) };
      }
    }

    setSaving(false);
    setSaveResult(hasError ? "error" : "ok");
  }

  if (!match) {
    return (
      <div style={s.page}>
        <AppCard>
          <p style={s.muted}>{t("pages.matchStats.notFound")}</p>
          <Button variant="ghost" onClick={() => navigate("/matches")}>{t("pages.matchStats.backToMatches")}</Button>
        </AppCard>
      </div>
    );
  }

  const subtitle = [match.date, match.location, match.result].filter(Boolean).join(" · ");

  return (
    <div style={s.page}>
      <PageHeader
        title={`${t("pages.matchStats.title")} — ${match.opponent || t("pages.matchStats.defaultOpponent")}`}
        subtitle={subtitle}
        badge={t("pages.matchStats.badge", { count: convocati.length })}
      />

      <MatchTabBar
        matchId={id}
        active="statistiche"
        matchLabel={match.opponent ? `vs ${match.opponent}` : undefined}
        matchData={match}
      />

      <AppCard>
        <div style={s.topBar}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={s.muted}>{t("pages.matchStats.topBarHint")}</span>
            <button
              onClick={() => setQuickMode((v) => !v)}
              style={{
                padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)",
                background: quickMode ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.05)",
                color: quickMode ? "#38bdf8" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {quickMode ? "📋 Schede" : "⚡ Vista rapida"}
            </button>
          </div>
          <div style={s.topActions}>
            <Button variant="ghost" onClick={() => navigate("/matches")}>{t("pages.matchStats.btnBack")}</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? t("pages.matchStats.btnSaving") : t("pages.matchStats.btnSave")}
            </Button>
          </div>
        </div>

        {saveResult === "ok" && (
          <p style={s.successMsg}>{t("pages.matchStats.successMsg")}</p>
        )}
        {saveResult === "error" && (
          <p style={s.errorMsg}>{t("pages.matchStats.errorMsg")}</p>
        )}
      </AppCard>

      {loading ? (
        <AppCard><p style={s.muted}>{t("pages.matchStats.loading")}</p></AppCard>
      ) : convocati.length === 0 ? (
        <AppCard>
          <p style={s.muted}>
            {t("pages.matchStats.noPlayersMsg")}{" "}
            {match?.convocazione?.playerIds?.length > 0 ? (
              <>
                {t("pages.matchStats.noPlayersConvocatiPre", { count: match.convocazione.playerIds.length })}{" "}
                <button style={s.link} onClick={() => navigate(`/match-day/${id}`)}>
                  {t("pages.matchStats.matchSheetLink")}
                </button>{" "}
                {t("pages.matchStats.noPlayersConvocatiPost")}
              </>
            ) : (
              <>
                {t("pages.matchStats.noPlayersLineupPre")}{" "}
                <button style={s.link} onClick={() => navigate(`/match-day/${id}`)}>
                  {t("pages.matchStats.matchSheetLink")}
                </button>
                {t("pages.matchStats.noPlayersLineupPost")}
              </>
            )}
          </p>
        </AppCard>
      ) : quickMode ? (
        <AppCard>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Giocatore","Min","Gol","Ass","🟨","🟥","Voto"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {convocati.map((player) => {
                  const pid = String(player.id);
                  const row = rows[pid] || EMPTY_ROW;
                  const isStarter = (match.lineup?.starterIds || []).map(String).includes(pid);
                  const name = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";
                  const qi = { width: "52px", padding: "4px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f8fafc", fontSize: 13, textAlign: "center" };
                  return (
                    <tr key={pid} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 700 }}>{name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10, color: isStarter ? "#4ade80" : "#38bdf8", fontWeight: 800 }}>{isStarter ? "T" : "P"}</span>
                      </td>
                      <td style={{ padding: "4px 6px" }}><input style={{ ...qi, width: 48 }} type="number" min="0" max="120" placeholder="—" value={row.minutes_played} onChange={(e) => updateCell(pid, "minutes_played", e.target.value)} /></td>
                      <td style={{ padding: "4px 6px" }}><input style={qi} type="number" min="0" placeholder="—" value={row.goals} onChange={(e) => updateCell(pid, "goals", e.target.value)} /></td>
                      <td style={{ padding: "4px 6px" }}><input style={qi} type="number" min="0" placeholder="—" value={row.assists} onChange={(e) => updateCell(pid, "assists", e.target.value)} /></td>
                      <td style={{ padding: "4px 6px" }}><input style={qi} type="number" min="0" max="2" placeholder="—" value={row.yellow_cards} onChange={(e) => updateCell(pid, "yellow_cards", e.target.value)} /></td>
                      <td style={{ padding: "4px 6px" }}><input style={qi} type="number" min="0" max="1" placeholder="—" value={row.red_cards} onChange={(e) => updateCell(pid, "red_cards", e.target.value)} /></td>
                      <td style={{ padding: "4px 6px" }}><input style={{ ...qi, width: 56 }} type="number" min="0" max="10" step="0.5" placeholder="—" value={row.rating} onChange={(e) => updateCell(pid, "rating", e.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AppCard>
      ) : (
        <AppCard>
          <div style={s.playerStatsList}>
          {convocati.map((player) => {
            const pid  = String(player.id);
            const row  = rows[pid] || EMPTY_ROW;
            const isStarter = (match.lineup?.starterIds || []).map(String).includes(pid);
            const displayName =
              [player.firstName, player.lastName].filter(Boolean).join(" ") ||
              player.name || "—";

            const rowErrors = validationErrors[pid] || [];

            return (
              <div key={pid} style={{
                ...s.playerStatsCard,
                borderColor: rowErrors.length > 0 ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.04)",
              }}>
                <div style={s.playerStatsHeader}>
                  <div style={s.playerIdentity}>
                    <span style={s.playerName}>{displayName}</span>
                    <Badge tone={isStarter ? "green" : "blue"}>
                      {isStarter ? t("pages.matchStats.badgeStarter") : t("pages.matchStats.badgeBench")}
                    </Badge>
                  </div>
                </div>

                <div style={s.statGrid}>
                  <StatInput label={t("pages.matchStats.labelMinutes")} hint={t("pages.matchStats.hintMinutes")} value={row.minutes_played}>
                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      max="120"
                      placeholder="—"
                      value={row.minutes_played}
                      onChange={(e) => updateCell(pid, "minutes_played", e.target.value)}
                    />
                  </StatInput>
                  <StatInput label={t("pages.matchStats.labelGoals")} value={row.goals}>
                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      placeholder="—"
                      value={row.goals}
                      onChange={(e) => updateCell(pid, "goals", e.target.value)}
                    />
                  </StatInput>
                  <StatInput label={t("pages.matchStats.labelAssists")} value={row.assists}>
                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      placeholder="—"
                      value={row.assists}
                      onChange={(e) => updateCell(pid, "assists", e.target.value)}
                    />
                  </StatInput>
                  <StatInput label={t("pages.matchStats.labelYellows")} hint={t("pages.matchStats.hintYellows")} value={row.yellow_cards}>
                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      max="2"
                      placeholder="—"
                      value={row.yellow_cards}
                      onChange={(e) => updateCell(pid, "yellow_cards", e.target.value)}
                    />
                  </StatInput>
                  <StatInput label={t("pages.matchStats.labelReds")} hint={t("pages.matchStats.hintReds")} value={row.red_cards}>
                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      max="1"
                      placeholder="—"
                      value={row.red_cards}
                      onChange={(e) => updateCell(pid, "red_cards", e.target.value)}
                    />
                  </StatInput>
                  <StatInput label={t("pages.matchStats.labelRating")} hint={t("pages.matchStats.hintRating")} value={row.rating}>
                    <input
                      style={{ ...s.input, ...s.inputRating }}
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      placeholder="—"
                      value={row.rating}
                      onChange={(e) => updateCell(pid, "rating", e.target.value)}
                    />
                  </StatInput>
                </div>

                <label style={s.notesField}>
                  <span style={s.fieldLabel}>{t("pages.matchStats.labelNotes")}</span>
                  <input
                    style={{ ...s.input, ...s.inputNotes }}
                    type="text"
                    placeholder={t("pages.matchStats.notesPlaceholder")}
                    value={row.notes}
                    onChange={(e) => updateCell(pid, "notes", e.target.value)}
                  />
                </label>
                {rowErrors.length > 0 && (
                  <div style={s.rowErrors}>
                    {rowErrors.map((err) => (
                      <span key={err} style={s.rowError}>{err}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </AppCard>
      )}
    </div>
  );
}

function StatInput({ label, hint, children }) {
  return (
    <label style={s.statField}>
      <span style={s.fieldLabel}>{label}</span>
      {children}
      {hint && <span style={s.fieldHint}>{hint}</span>}
    </label>
  );
}

const s = {
  page:       { display: "grid", gap: 18 },
  muted:      { color: "#94a3b8", margin: 0, lineHeight: 1.45 },
  topBar:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  topActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  successMsg: { margin: "12px 0 0", color: "#22c55e", fontSize: 14, lineHeight: 1.4 },
  errorMsg:   { margin: "12px 0 0", color: "#f87171", fontSize: 14, lineHeight: 1.4 },
  link:       { background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, fontSize: "inherit" },

  playerStatsList: {
    display: "grid",
    gap: 12,
  },
  playerStatsCard: {
    border: "1px solid",
    borderRadius: 16,
    background: "rgba(255,255,255,0.025)",
    transition: "border-color 0.2s, background 0.2s",
    display: "grid",
    gap: 14,
    padding: 14,
  },
  playerStatsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  playerIdentity: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    minWidth: 0,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))",
    gap: 10,
  },
  statField: {
    display: "grid",
    gap: 5,
    minWidth: 0,
  },
  notesField: {
    display: "grid",
    gap: 6,
  },
  rowErrors: {
    gridColumn: "1 / -1",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "4px 4px 10px",
  },
  rowError: {
    fontSize: 12,
    fontWeight: 700,
    color: "#f87171",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: 8,
    padding: "2px 8px",
  },
  playerName: { fontSize: 15, fontWeight: 800, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 },
  fieldLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  fieldHint: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.2,
  },

  input: {
    width: "100%",
    minHeight: 40,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 14,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  inputRating: { border: "1px solid rgba(56,189,248,0.3)" },
  inputNotes:  { textAlign: "left" },
};
