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

function validateRow(row) {
  const errors = [];
  const mins    = parseInt(row.minutes_played, 10);
  const yellows = parseInt(row.yellow_cards,   10);
  const reds    = parseInt(row.red_cards,      10);
  const goals   = parseInt(row.goals,          10);
  const assists = parseInt(row.assists,        10);
  const rating  = parseFloat(row.rating);

  if (!isNaN(mins)    && (mins    < 0 || mins    > 120)) errors.push("Minuti fuori range (0–120)");
  if (!isNaN(goals)   && goals   < 0)                    errors.push("Gol non può essere negativo");
  if (!isNaN(assists) && assists < 0)                     errors.push("Assist non può essere negativo");
  if (!isNaN(yellows) && (yellows < 0 || yellows > 2))   errors.push("Gialli: max 2 per partita");
  if (!isNaN(reds)    && (reds    < 0 || reds    > 1))   errors.push("Rossi: max 1 per partita");
  if (!isNaN(rating)  && (rating  < 0 || rating  > 10))  errors.push("Voto fuori range (0–10)");

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
      const rowErrors = validateRow(row);
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
          <p style={s.muted}>Partita non trovata.</p>
          <Button variant="ghost" onClick={() => navigate("/matches")}>Torna alle partite</Button>
        </AppCard>
      </div>
    );
  }

  const subtitle = [match.date, match.location, match.result].filter(Boolean).join(" · ");

  return (
    <div style={s.page}>
      <PageHeader
        title={`Statistiche — ${match.opponent || "Partita"}`}
        subtitle={subtitle}
        badge={`${convocati.length} convocati`}
      />

      <MatchTabBar
        matchId={id}
        active="statistiche"
        matchLabel={match.opponent ? `vs ${match.opponent}` : undefined}
      />

      <AppCard>
        <div style={s.topBar}>
          <span style={s.muted}>
            Inserisci le statistiche per ogni giocatore convocato. Lascia vuoto per saltare.
          </span>
          <div style={s.topActions}>
            <Button variant="ghost" onClick={() => navigate("/matches")}>Indietro</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? "Salvataggio..." : "Salva statistiche"}
            </Button>
          </div>
        </div>

        {saveResult === "ok" && (
          <p style={s.successMsg}>Statistiche salvate correttamente.</p>
        )}
        {saveResult === "error" && (
          <p style={s.errorMsg}>Errore durante il salvataggio. Controlla la console.</p>
        )}
      </AppCard>

      {loading ? (
        <AppCard><p style={s.muted}>Caricamento...</p></AppCard>
      ) : convocati.length === 0 ? (
        <AppCard>
          <p style={s.muted}>
            Nessun convocato trovato. Aggiungi titolari e panchina dalla{" "}
            <button style={s.link} onClick={() => navigate(`/match-day/${id}`)}>
              Scheda gara
            </button>
            .
          </p>
        </AppCard>
      ) : (
        <AppCard>
          {/* Header colonne */}
          <div style={s.tableHeader}>
            <span style={s.colName}>Giocatore</span>
            <span style={s.colNum}>Min</span>
            <span style={s.colNum}>Gol</span>
            <span style={s.colNum}>Assist</span>
            <span style={s.colNum}>Gialli</span>
            <span style={s.colNum}>Rossi</span>
            <span style={s.colNum}>Voto</span>
            <span style={s.colNotes}>Note</span>
          </div>

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
                ...s.tableRow,
                ...s.tableRowWrapper,
                borderColor: rowErrors.length > 0 ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.04)",
              }}>
                <div style={s.colName}>
                  <span style={s.playerName}>{displayName}</span>
                  <Badge tone={isStarter ? "green" : "blue"}>
                    {isStarter ? "Titolare" : "Panchina"}
                  </Badge>
                </div>

                <div>
                  <input
                    style={s.input}
                    type="number"
                    min="0"
                    max="120"
                    placeholder="—"
                    value={row.minutes_played}
                    onChange={(e) => updateCell(pid, "minutes_played", e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "block" }}>0 – 120 min</span>
                </div>
                <input
                  style={s.input}
                  type="number"
                  min="0"
                  placeholder="—"
                  value={row.goals}
                  onChange={(e) => updateCell(pid, "goals", e.target.value)}
                />
                <input
                  style={s.input}
                  type="number"
                  min="0"
                  placeholder="—"
                  value={row.assists}
                  onChange={(e) => updateCell(pid, "assists", e.target.value)}
                />
                <input
                  style={s.input}
                  type="number"
                  min="0"
                  max="2"
                  placeholder="—"
                  value={row.yellow_cards}
                  onChange={(e) => updateCell(pid, "yellow_cards", e.target.value)}
                />
                <input
                  style={s.input}
                  type="number"
                  min="0"
                  max="1"
                  placeholder="—"
                  value={row.red_cards}
                  onChange={(e) => updateCell(pid, "red_cards", e.target.value)}
                />
                <div>
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
                  <span style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "block" }}>0 – 10</span>
                </div>
                <input
                  style={{ ...s.input, ...s.inputNotes }}
                  type="text"
                  placeholder="Nota libera"
                  value={row.notes}
                  onChange={(e) => updateCell(pid, "notes", e.target.value)}
                />
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
        </AppCard>
      )}
    </div>
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

  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 56px 56px 64px 60px 56px 60px 1fr",
    gap: 8,
    padding: "8px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 4,
  },
  tableRowWrapper: {
    border: "1px solid",
    borderRadius: 10,
    background: "rgba(255,255,255,0.025)",
    transition: "border-color 0.2s, background 0.2s",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 56px 56px 64px 60px 56px 60px 1fr",
    gap: 8,
    alignItems: "center",
    padding: "10px",
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
  colName:   { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  colNum:    { textAlign: "center" },
  colNotes:  {},
  playerName: { fontSize: 14, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 },

  input: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 8,
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
