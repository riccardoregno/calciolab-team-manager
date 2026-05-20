import { useRef, useState } from "react";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { createId, formatDate } from "../utils/helpers";
import { styles } from "../styles/index.js";
import { useTranslation } from "../i18n";

const HEADER_MAP = {
  playerName:        ["playername", "player_name", "nome"],
  duration:          ["duration", "durata"],
  totalDistance:     ["totaldistance", "total_distance", "distanza_totale"],
  highSpeedDistance: ["highspeeddistance", "high_speed_distance", "hsd"],
  sprintDistance:    ["sprintdistance", "sprint_distance", "sprint"],
  maxSpeed:          ["maxspeed", "max_speed", "velocita_max"],
  accelerations:     ["accelerations", "accel"],
  decelerations:     ["decelerations", "decel"],
  playerLoad:        ["playerload", "player_load", "load"],
  rpe:               ["rpe"],
  notes:             ["notes", "note"],
};

const TYPE_LABEL = { training: "Allenamento", match: "Partita", test: "Test" };
const TYPE_TONE  = { training: "blue", match: "green", test: "orange" };

export default function GpsLoad({
  gpsSessions = [], setGpsSessions, players = [] }) {

  const { t } = useTranslation();
  const { showToast, ToastContainer } = useToast();
  const fileInputRef = useRef(null);
  const [pendingRows, setPendingRows] = useState([]);
  const [sessionForm, setSessionForm] = useState({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    type: "training",
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSV(event.target.result);
      if (!rows.length) {
        showToast("Nessuna riga valida trovata nel CSV", "error");
        return;
      }
      setPendingRows(rows.map((row) => matchGpsRowToPlayer(row, players)));
      setShowForm(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleSaveSession() {
    if (!sessionForm.title.trim()) {
      showToast("Inserisci un titolo per la sessione", "warn");
      return;
    }

    const newSession = {
      id: createId("gps"),
      date: sessionForm.date,
      title: sessionForm.title.trim(),
      type: sessionForm.type,
      source: "manual_csv",
      notes: sessionForm.notes,
      rows: pendingRows,
    };

    setGpsSessions((prevSessions) => [...prevSessions, newSession]);
    setPendingRows([]);
    setShowForm(false);
    setSessionForm({ title: "", date: new Date().toISOString().slice(0, 10), type: "training", notes: "" });
    showToast("Sessione GPS salvata", "ok");
  }

  function handleDeleteSession(id) {
    setGpsSessions((prevSessions) => prevSessions.filter((session) => session.id !== id));
    showToast("Sessione eliminata", "ok");
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title={t("pages.gpsLoad.title")}
        subtitle="Importa e analizza dati GPS, carico esterno, sprint e intensità della squadra."
      />

      <AppCard>
        <div style={gl.headerRow}>
          <div>
            <h3 style={gl.cardTitle}>Importa dati GPS</h3>
            <p style={gl.muted}>
              CSV con colonne: playerName, duration, totalDistance, highSpeedDistance, sprintDistance, maxSpeed, accelerations, decelerations, playerLoad, rpe, notes
            </p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()}>
            Importa CSV
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {showForm && (
          <div style={gl.importBox}>
            <h4 style={gl.importTitle}>Configura sessione ({pendingRows.length} atleti importati)</h4>
            <div style={gl.formGrid}>
              <label style={labelStyle}>
                Titolo *
                <input
                  style={inputStyle}
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Es. Allenamento MD-3"
                />
              </label>
              <label style={labelStyle}>
                Data
                <input
                  type="date"
                  style={inputStyle}
                  value={sessionForm.date}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </label>
              <label style={labelStyle}>
                Tipo
                <select
                  style={inputStyle}
                  value={sessionForm.type}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="training">Allenamento</option>
                  <option value="match">Partita</option>
                  <option value="test">Test</option>
                </select>
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Note
                <input
                  style={inputStyle}
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Note opzionali"
                />
              </label>
            </div>
            <div style={gl.actions}>
              <Button onClick={handleSaveSession}>Salva sessione</Button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setPendingRows([]);
                }}
                style={ghostBtn}
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </AppCard>

      {gpsSessions.length === 0 && !showForm && (
        <EmptyState title="Nessuna sessione GPS" description="Importa un file CSV per iniziare a tracciare i carichi." />
      )}

      {gpsSessions.length > 0 && (
        <AppCard>
          <h3 style={gl.cardTitle}>Sessioni salvate</h3>
          <div style={gl.sessionList}>
            {[...gpsSessions].sort((a, b) => b.date.localeCompare(a.date)).map((session) => {
              const isOpen = expandedId === session.id;
              const avgDist = session.rows.length
                ? Math.round(session.rows.reduce((sum, row) => sum + Number(row.totalDistance || 0), 0) / session.rows.length)
                : 0;
              const maxSpeed = session.rows.length
                ? Math.max(...session.rows.map((row) => Number(row.maxSpeed || 0)))
                : 0;

              return (
                <div key={session.id} style={gl.sessionCard}>
                  <button
                    type="button"
                    style={gl.sessionHeader}
                    onClick={() => setExpandedId(isOpen ? null : session.id)}
                  >
                    <div style={gl.sessionTitleRow}>
                      <span style={gl.sessionTitle}>{session.title}</span>
                      <Badge tone={TYPE_TONE[session.type] || "blue"}>{TYPE_LABEL[session.type] || session.type}</Badge>
                      <span style={gl.sessionDate}>{formatDate(session.date)}</span>
                    </div>
                    <div style={gl.sessionMeta}>
                      <span>Atleti {session.rows.length}</span>
                      {avgDist > 0 && <span>{avgDist} m medi</span>}
                      {maxSpeed > 0 && <span>{maxSpeed.toFixed(1)} km/h max</span>}
                      <span>{isOpen ? "Chiudi" : "Apri"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={gl.sessionBody}>
                      <div style={gl.tableWrap}>
                        <table style={gl.table}>
                          <thead>
                            <tr>
                              {["Atleta", "Durata", "Dist (m)", "HSD (m)", "Sprint (m)", "V.Max", "Acc", "Dec", "Load", "RPE"].map((header) => (
                                <th key={header} style={gl.th}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {session.rows.map((row) => (
                              <tr key={row.id} style={gl.tr}>
                                <td style={tdStyle}>{row.playerName}</td>
                                <td style={tdStyle}>{row.duration ? `${row.duration}'` : "-"}</td>
                                <td style={tdStyle}>{row.totalDistance || "-"}</td>
                                <td style={tdStyle}>{row.highSpeedDistance || "-"}</td>
                                <td style={tdStyle}>{row.sprintDistance || "-"}</td>
                                <td style={tdStyle}>{row.maxSpeed ? `${row.maxSpeed} km/h` : "-"}</td>
                                <td style={tdStyle}>{row.accelerations || "-"}</td>
                                <td style={tdStyle}>{row.decelerations || "-"}</td>
                                <td style={tdStyle}>{row.playerLoad || "-"}</td>
                                <td style={tdStyle}>{row.rpe || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={gl.sessionActions}>
                        <button type="button" onClick={() => handleDeleteSession(session.id)} style={ghostBtn}>
                          Elimina sessione
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </AppCard>
      )}

      <ToastContainer />
    </div>
  );
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map(resolveHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, separator);
    const row = { id: createId("gps-row") };
    headers.forEach((field, index) => {
      if (field) row[field] = cells[index]?.trim() || "";
    });
    return row;
  }).filter((row) => row.playerName);
}

function resolveHeader(raw) {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  for (const [field, aliases] of Object.entries(HEADER_MAP)) {
    if (aliases.includes(key)) return field;
  }
  return null;
}

function detectSeparator(headerLine) {
  return headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";
}

function splitCsvLine(line, separator) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function matchGpsRowToPlayer(row, players) {
  const normalizedName = normalizeName(row.playerName);
  const player = players.find((item) => normalizeName(item.name) === normalizedName);
  return {
    ...row,
    playerId: player?.id || "",
    playerName: player?.name || row.playerName,
  };
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const gl = {
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  cardTitle: { margin: 0, color: "#f1f5f9", fontSize: 16 },
  muted: { margin: "4px 0 0", color: "#94a3b8", fontSize: 13, lineHeight: 1.5 },
  importBox: { marginTop: 20, padding: 18, background: "rgba(59,130,246,0.07)", borderRadius: 14, border: "1px solid rgba(59,130,246,0.2)" },
  importTitle: { margin: "0 0 14px", color: "#93c5fd", fontSize: 15 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  actions: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },
  sessionList: { display: "flex", flexDirection: "column", gap: 10, marginTop: 16 },
  sessionCard: { borderRadius: 14, border: "1px solid rgba(255,255,255,0.09)", overflow: "hidden" },
  sessionHeader: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "rgba(255,255,255,0.03)", border: 0, cursor: "pointer", flexWrap: "wrap", gap: 10, textAlign: "left" },
  sessionTitleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sessionTitle: { color: "#f1f5f9", fontWeight: 800, fontSize: 14 },
  sessionDate: { color: "#64748b", fontSize: 12 },
  sessionMeta: { display: "flex", alignItems: "center", gap: 12, color: "#94a3b8", fontSize: 12, flexWrap: "wrap" },
  sessionBody: { display: "grid", gap: 12, paddingBottom: 12 },
  tableWrap: { overflowX: "auto", padding: "0 4px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 },
  th: { padding: "8px 10px", color: "#64748b", fontWeight: 800, textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  sessionActions: { display: "flex", justifyContent: "flex-end", padding: "0 12px" },
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#f1f5f9",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const ghostBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#94a3b8",
  cursor: "pointer",
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 700,
};

const tdStyle = {
  padding: "9px 10px",
  color: "#cbd5e1",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
