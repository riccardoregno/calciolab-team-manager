import { useRef, useState } from "react";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { createId, formatDate } from "../utils/helpers";
import { styles } from "../styles/index.js";

// ─── CSV header aliases ────────────────────────────────────────────────────
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

function resolveHeader(raw) {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  for (const [field, aliases] of Object.entries(HEADER_MAP)) {
    if (aliases.includes(key)) return field;
  }
  return null;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map(resolveHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, separator);
    const row = { id: createId("gps-row") };
    headers.forEach((field, i) => {
      if (field) row[field] = cells[i]?.trim() || "";
    });
    return row;
  }).filter((row) => row.playerName);
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

const TYPE_LABEL = { training: "Allenamento", match: "Partita", test: "Test" };
const TYPE_TONE  = { training: "blue", match: "green", test: "orange" };

// ─── Injury metadata ──────────────────────────────────────────────────────
const INJURY_TYPES  = ["Muscolare", "Articolare/Legamentoso", "Tendineo", "Osseo/Frattura", "Contusione", "Altro"];
const BODY_AREAS    = ["Coscia", "Polpaccio", "Caviglia", "Ginocchio", "Anca", "Addominale/Pubalgico", "Spalla", "Altro"];
const SEVERITIES    = [{ value: "lieve", label: "Lieve", tone: "green" }, { value: "media", label: "Media", tone: "orange" }, { value: "grave", label: "Grave", tone: "red" }];
const STATUSES      = [{ value: "attivo", label: "Attivo", tone: "red" }, { value: "recupero", label: "In recupero", tone: "orange" }, { value: "rientrato", label: "Rientrato", tone: "green" }];

const SEV_TONE   = { lieve: "green", media: "orange", grave: "red" };
const SEV_LABEL  = { lieve: "Lieve", media: "Media", grave: "Grave" };
const STAT_TONE  = { attivo: "red", recupero: "orange", rientrato: "green" };
const STAT_LABEL = { attivo: "Attivo", recupero: "Recupero", rientrato: "Rientrato" };

function emptyInjury(playerId = "") {
  return {
    id:               createId("inj"),
    playerId,
    dateStart:        new Date().toISOString().slice(0, 10),
    dateEndExpected:  "",
    dateEndActual:    "",
    bodyArea:         "Coscia",
    injuryType:       "Muscolare",
    severity:         "media",
    status:           "attivo",
    recurrence:       false,
    daysLost:         0,
    notes:            "",
    preventionPlan: {
      focus:             "",
      exercises:         "",
      weeklyRoutine:     "",
      loadLimits:        "",
      returnToPlayNotes: "",
    },
  };
}

// ─── Prevention cards ─────────────────────────────────────────────────────
const PREVENTION_CARDS = [
  {
    icon: "🦵",
    title: "Distorsione caviglia",
    badge: "Prevenzione",
    badgeTone: "blue",
    points: [
      "Esercizi propriocettivi su superfici instabili",
      "Rinforzo peronei con elastici e bilancieri",
      "Lavoro di equilibrio monopodalico",
      "Progressione da statico a dinamico-sport",
    ],
  },
  {
    icon: "🦵",
    title: "Lesione muscolare coscia",
    badge: "Prevenzione",
    badgeTone: "blue",
    points: [
      "Nordic Hamstring 2x/settimana fuori stagione",
      "Allungamento progressivo post-allenamento",
      "Monitoraggio carico settimanale (RPE x volume)",
      "Identificazione spike acuti nel carico",
    ],
  },
  {
    icon: "🦵",
    title: "Pubalgia",
    badge: "Prevenzione",
    badgeTone: "blue",
    points: [
      "Core stability: plank, deadbug, palloff press",
      "Rinforzo adduttori con Copenhagen Adduction",
      "Riduzione carico asimmetrico nei cambi direzione",
      "Monitoraggio dolori inguinali settimanale",
    ],
  },
  {
    icon: "🦵",
    title: "Lesione LCA",
    badge: "Prevenzione",
    badgeTone: "blue",
    points: [
      "Pliometria progressiva: doppio → monopodalico",
      "Propriocezione con instabilità e distrazione",
      "Rinforzo integrato quadricipite/femorali/glutei",
      "Tecnica di atterraggio e deceleration training",
    ],
  },
  {
    icon: "💪",
    title: "Sovraccarico funzionale",
    badge: "Prevenzione",
    badgeTone: "orange",
    points: [
      "Monitoraggio RPE giornaliero e ratio acuto/cronico",
      "Finestre di scarico ogni 3-4 settimane di carico",
      "Sleep tracking: < 7h aumenta rischio infortuni",
      "Indicatori soggettivi: umore, energia, dolori",
    ],
  },
  {
    icon: "🩺",
    title: "Recidiva muscolare",
    badge: "Return to Play",
    badgeTone: "green",
    points: [
      "Protocollo Return-to-Play: Asymptomatic → Running → Sport-specific",
      "Test funzionali graduali prima del rientro in gruppo",
      "Soglia forza: ≥90% arto sano prima del contatto",
      "Rientro progressivo: 50% → 75% → 100% intensità",
    ],
  },
];

// ─── Main component ────────────────────────────────────────────────────────
export default function GpsLoad({ gpsSessions = [], setGpsSessions, players = [], injuryRecords = [], setInjuryRecords }) {
  const { showToast, ToastContainer } = useToast();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("gps");

  // GPS tab state
  const [pendingRows, setPendingRows] = useState([]);
  const [sessionForm, setSessionForm] = useState({ title: "", date: new Date().toISOString().slice(0, 10), type: "training", notes: "" });
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Injury tab state
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [injuryForm, setInjuryForm] = useState(null);   // null = hidden
  const [editingInjuryId, setEditingInjuryId] = useState(null);
  const [expandedPrevId, setExpandedPrevId] = useState(null); // expanded preventionPlan card

  // ── CSV import ─────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
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
      id:     createId("gps"),
      date:   sessionForm.date,
      title:  sessionForm.title.trim(),
      type:   sessionForm.type,
      source: "manual_csv",
      notes:  sessionForm.notes,
      rows:   pendingRows,
    };
    setGpsSessions([...gpsSessions, newSession]);
    setPendingRows([]);
    setShowForm(false);
    setSessionForm({ title: "", date: new Date().toISOString().slice(0, 10), type: "training", notes: "" });
    showToast("Sessione GPS salvata", "ok");
  }

  function handleDeleteSession(id) {
    setGpsSessions(gpsSessions.filter((s) => s.id !== id));
    showToast("Sessione eliminata", "ok");
  }

  // ── Injury helpers ─────────────────────────────────────────────────────
  const selectedPlayer   = players.find((p) => String(p.id) === String(selectedPlayerId));
  const playerInjuries   = injuryRecords.filter((r) => String(r.playerId) === String(selectedPlayerId));

  // KPI across all players
  const activeInjuries   = injuryRecords.filter((r) => r.status === "attivo").length;
  const recoveryCount    = injuryRecords.filter((r) => r.status === "recupero").length;
  const totalInjuries    = injuryRecords.length;

  function handleSaveInjury() {
    if (!injuryForm) return;
    if (!selectedPlayerId) { showToast("Seleziona un giocatore", "warn"); return; }

    const record = { ...injuryForm, playerId: selectedPlayerId };
    const updated = editingInjuryId
      ? injuryRecords.map((r) => r.id === editingInjuryId ? record : r)
      : [...injuryRecords, record];

    if (setInjuryRecords) setInjuryRecords(updated);
    showToast("Infortunio salvato", "ok");
    setInjuryForm(null);
    setEditingInjuryId(null);
  }

  function handleDeleteInjury(injId) {
    if (setInjuryRecords) setInjuryRecords(injuryRecords.filter((r) => r.id !== injId));
    showToast("Infortunio rimosso", "ok");
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <PageHeader title="GPS & Load" subtitle="Importa dati GPS, storico infortuni e schede prevenzione" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { key: "gps",       label: "Sessioni GPS" },
          { key: "injuries",  label: "Storico infortuni" },
          { key: "prevention",label: "Prevenzione" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 18px",
              borderRadius: 12,
              border: activeTab === tab.key ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)",
              background: activeTab === tab.key ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
              color: activeTab === tab.key ? "#93c5fd" : "#94a3b8",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: GPS ────────────────────────────────────────────────── */}
      {activeTab === "gps" && (
        <>
          <AppCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 16 }}>Importa dati GPS</h3>
                <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>
                  CSV con colonne: playerName, duration, totalDistance, highSpeedDistance, sprintDistance, maxSpeed, accelerations, decelerations, playerLoad, rpe, notes
                </p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()}>
                📥 Importa CSV
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
              <div style={{ marginTop: 20, padding: 18, background: "rgba(59,130,246,0.07)", borderRadius: 14, border: "1px solid rgba(59,130,246,0.2)" }}>
                <h4 style={{ margin: "0 0 14px", color: "#93c5fd", fontSize: 15 }}>
                  Configura sessione ({pendingRows.length} atleti importati)
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  <label style={labelStyle}>
                    Titolo *
                    <input
                      style={inputStyle}
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Es. Allenamento MD-3"
                    />
                  </label>
                  <label style={labelStyle}>
                    Data
                    <input
                      type="date"
                      style={inputStyle}
                      value={sessionForm.date}
                      onChange={(e) => setSessionForm((p) => ({ ...p, date: e.target.value }))}
                    />
                  </label>
                  <label style={labelStyle}>
                    Tipo
                    <select
                      style={inputStyle}
                      value={sessionForm.type}
                      onChange={(e) => setSessionForm((p) => ({ ...p, type: e.target.value }))}
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
                      onChange={(e) => setSessionForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Note opzionali"
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <Button onClick={handleSaveSession}>Salva sessione</Button>
                  <button
                    onClick={() => { setShowForm(false); setPendingRows([]); }}
                    style={{ ...ghostBtn }}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </AppCard>

          {/* Sessions list */}
          {gpsSessions.length === 0 && !showForm && (
            <EmptyState title="Nessuna sessione GPS" description="Importa un file CSV per iniziare a tracciare i carichi." />
          )}

          {gpsSessions.length > 0 && (
            <AppCard>
              <h3 style={{ margin: "0 0 16px", color: "#f1f5f9", fontSize: 16 }}>Sessioni salvate</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...gpsSessions].sort((a, b) => b.date.localeCompare(a.date)).map((session) => {
                  const isOpen = expandedId === session.id;
                  const avgDist = session.rows.length
                    ? Math.round(session.rows.reduce((s, r) => s + Number(r.totalDistance || 0), 0) / session.rows.length)
                    : 0;
                  const maxSpd  = session.rows.length
                    ? Math.max(...session.rows.map((r) => Number(r.maxSpeed || 0)))
                    : 0;

                  return (
                    <div key={session.id} style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.09)", overflow: "hidden" }}>
                      <div
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "rgba(255,255,255,0.03)", cursor: "pointer", flexWrap: "wrap", gap: 8 }}
                        onClick={() => setExpandedId(isOpen ? null : session.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{session.title}</span>
                          <Badge tone={TYPE_TONE[session.type] || "blue"}>{TYPE_LABEL[session.type] || session.type}</Badge>
                          <span style={{ color: "#64748b", fontSize: 12 }}>{formatDate(session.date)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>👤 {session.rows.length}</span>
                          {avgDist > 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>📏 {avgDist} m</span>}
                          {maxSpd > 0  && <span style={{ color: "#94a3b8", fontSize: 12 }}>⚡ {maxSpd.toFixed(1)} km/h</span>}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                            style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }}
                          >
                            🗑
                          </button>
                          <span style={{ color: "#64748b", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {isOpen && session.rows.length > 0 && (
                        <div style={{ overflowX: "auto", padding: "0 4px 12px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                            <thead>
                              <tr>
                                {["Atleta", "Durata", "Dist (m)", "HSD (m)", "Sprint (m)", "V.Max", "Acc", "Dec", "Load", "RPE"].map((h) => (
                                  <th key={h} style={{ padding: "8px 10px", color: "#64748b", fontWeight: 700, textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {session.rows.map((row) => (
                                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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
                      )}
                    </div>
                  );
                })}
              </div>
            </AppCard>
          )}
        </>
      )}

      {/* ── TAB: INJURIES ────────────────────────────────────────────── */}
      {activeTab === "injuries" && (
        <>
          {/* KPI bar */}
          {totalInjuries > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <InjKpi icon="🩹" label="Totali" value={totalInjuries} color="#94a3b8" />
              <InjKpi icon="🚑" label="Attivi" value={activeInjuries} color="#f87171" />
              <InjKpi icon="🔄" label="In recupero" value={recoveryCount} color="#fbbf24" />
              <InjKpi icon="✅" label="Rientrati" value={totalInjuries - activeInjuries - recoveryCount} color="#22c55e" />
            </div>
          )}

          {/* Header + player selector */}
          <AppCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 16 }}>Storico infortuni</h3>
                <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Seleziona un giocatore per visualizzare o aggiungere infortuni.</p>
              </div>
              {selectedPlayerId && (
                <Button onClick={() => { setInjuryForm(emptyInjury(selectedPlayerId)); setEditingInjuryId(null); }}>
                  + Aggiungi infortunio
                </Button>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>
                Giocatore
                <select
                  style={{ ...inputStyle, maxWidth: 320 }}
                  value={selectedPlayerId}
                  onChange={(e) => { setSelectedPlayerId(e.target.value); setInjuryForm(null); setEditingInjuryId(null); }}
                >
                  <option value="">— Seleziona —</option>
                  {players.map((p) => {
                    const cnt = injuryRecords.filter((r) => String(r.playerId) === String(p.id) && r.status === "attivo").length;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim()}{cnt > 0 ? ` 🚑` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
          </AppCard>

          {/* ── Injury form ── */}
          {injuryForm && (
            <AppCard>
              <h4 style={{ margin: "0 0 16px", color: "#93c5fd", fontSize: 15 }}>
                {editingInjuryId ? "Modifica infortunio" : "Nuovo infortunio"} — {selectedPlayer?.name}
              </h4>

              {/* Main fields */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                <label style={labelStyle}>
                  Distretto corporeo
                  <select style={inputStyle} value={injuryForm.bodyArea} onChange={(e) => setInjuryForm((p) => ({ ...p, bodyArea: e.target.value }))}>
                    {BODY_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Tipo infortunio
                  <select style={inputStyle} value={injuryForm.injuryType} onChange={(e) => setInjuryForm((p) => ({ ...p, injuryType: e.target.value }))}>
                    {INJURY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Gravità
                  <select style={inputStyle} value={injuryForm.severity} onChange={(e) => setInjuryForm((p) => ({ ...p, severity: e.target.value }))}>
                    {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Stato
                  <select style={inputStyle} value={injuryForm.status} onChange={(e) => setInjuryForm((p) => ({ ...p, status: e.target.value }))}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Data inizio
                  <input type="date" style={inputStyle} value={injuryForm.dateStart} onChange={(e) => setInjuryForm((p) => ({ ...p, dateStart: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Rientro previsto
                  <input type="date" style={inputStyle} value={injuryForm.dateEndExpected} onChange={(e) => setInjuryForm((p) => ({ ...p, dateEndExpected: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Rientro effettivo
                  <input type="date" style={inputStyle} value={injuryForm.dateEndActual} onChange={(e) => setInjuryForm((p) => ({ ...p, dateEndActual: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Giorni persi
                  <input type="number" min="0" style={inputStyle} value={injuryForm.daysLost} onChange={(e) => setInjuryForm((p) => ({ ...p, daysLost: Number(e.target.value) || 0 }))} />
                </label>
                <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={injuryForm.recurrence}
                    onChange={(e) => setInjuryForm((p) => ({ ...p, recurrence: e.target.checked }))}
                    style={{ width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>Recidiva</span>
                </label>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                  Note cliniche
                  <input style={inputStyle} value={injuryForm.notes} onChange={(e) => setInjuryForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Diagnosi, terapie, annotazioni…" />
                </label>
              </div>

              {/* Prevention plan sub-section */}
              <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#22c55e", letterSpacing: 0.5 }}>Piano di prevenzione / RTP</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {[
                    { key: "focus",             label: "Focus preventivo",          ph: "Es. Rinforzo ischio-crurali" },
                    { key: "exercises",         label: "Esercizi specifici",        ph: "Es. Nordic Hamstring, RDL…" },
                    { key: "weeklyRoutine",     label: "Routine settimanale",       ph: "Es. 2x/settimana lunedì e giovedì" },
                    { key: "loadLimits",        label: "Limiti di carico",          ph: "Es. Max 80% RPE per 2 settimane" },
                    { key: "returnToPlayNotes", label: "Note Return-to-Play",       ph: "Es. Rientro progressivo 50→75→100%" },
                  ].map(({ key, label, ph }) => (
                    <label key={key} style={labelStyle}>
                      {label}
                      <input
                        style={inputStyle}
                        value={injuryForm.preventionPlan[key]}
                        onChange={(e) => setInjuryForm((p) => ({ ...p, preventionPlan: { ...p.preventionPlan, [key]: e.target.value } }))}
                        placeholder={ph}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Button onClick={handleSaveInjury}>Salva infortunio</Button>
                <button onClick={() => { setInjuryForm(null); setEditingInjuryId(null); }} style={ghostBtn}>Annulla</button>
              </div>
            </AppCard>
          )}

          {/* Injury list */}
          {selectedPlayerId && playerInjuries.length === 0 && !injuryForm && (
            <EmptyState title="Nessun infortunio registrato" description="Clicca su '+ Aggiungi infortunio' per iniziare." />
          )}

          {selectedPlayerId && playerInjuries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h4 style={{ margin: 0, color: "#f1f5f9", fontSize: 15, paddingLeft: 4 }}>
                Infortuni — {selectedPlayer?.name} ({playerInjuries.length})
              </h4>
              {[...playerInjuries].sort((a, b) => b.dateStart.localeCompare(a.dateStart)).map((inj) => {
                const isExpPrev = expandedPrevId === inj.id;
                const hasPrev = Object.values(inj.preventionPlan || {}).some(Boolean);
                return (
                  <AppCard key={inj.id}>
                    {/* Row header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <Badge tone={SEV_TONE[inj.severity] || "orange"}>{SEV_LABEL[inj.severity] || inj.severity}</Badge>
                        <Badge tone={STAT_TONE[inj.status] || "blue"}>{STAT_LABEL[inj.status] || inj.status}</Badge>
                        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{inj.bodyArea}</span>
                        <span style={{ color: "#94a3b8", fontSize: 13 }}>·</span>
                        <span style={{ color: "#cbd5e1", fontSize: 13 }}>{inj.injuryType}</span>
                        {inj.recurrence && <Badge tone="red">Recidiva</Badge>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setInjuryForm({ ...inj }); setEditingInjuryId(inj.id); }} style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }}>✏️</button>
                        <button onClick={() => handleDeleteInjury(inj.id)} style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }}>🗑</button>
                      </div>
                    </div>

                    {/* Date chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                      <DateChip label="Inizio" value={inj.dateStart} />
                      <DateChip label="Rientro previsto" value={inj.dateEndExpected} />
                      <DateChip label="Rientro effettivo" value={inj.dateEndActual} />
                      {inj.daysLost > 0 && <DateChip label="Giorni persi" value={`${inj.daysLost}gg`} />}
                    </div>

                    {/* Notes */}
                    {inj.notes && (
                      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>{inj.notes}</p>
                    )}

                    {/* Prevention plan toggle */}
                    {hasPrev && (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedPrevId(isExpPrev ? null : inj.id)}
                          style={{ ...ghostBtn, width: "100%", marginTop: 12, textAlign: "center", fontSize: 12 }}
                        >
                          {isExpPrev ? "▲ Nascondi piano prevenzione" : "▼ Piano prevenzione / RTP"}
                        </button>
                        {isExpPrev && (
                          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                            {[
                              { key: "focus",             label: "Focus" },
                              { key: "exercises",         label: "Esercizi" },
                              { key: "weeklyRoutine",     label: "Routine settimanale" },
                              { key: "loadLimits",        label: "Limiti carico" },
                              { key: "returnToPlayNotes", label: "Return-to-Play" },
                            ].filter(({ key }) => inj.preventionPlan?.[key]).map(({ key, label }) => (
                              <div key={key} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.14)" }}>
                                <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "#22c55e" }}>{label}</p>
                                <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>{inj.preventionPlan[key]}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </AppCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: PREVENTION ──────────────────────────────────────────── */}
      {activeTab === "prevention" && (
        <>
          <AppCard>
            <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 16 }}>Schede prevenzione infortuni</h3>
            <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 13 }}>
              Protocolli pratici per le patologie più comuni nel calcio. Usa queste schede come riferimento per il lavoro preventivo con il gruppo.
            </p>
          </AppCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {PREVENTION_CARDS.map((card) => (
              <AppCard key={card.title}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 26 }}>{card.icon}</span>
                    <h4 style={{ margin: 0, color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{card.title}</h4>
                  </div>
                  <Badge tone={card.badgeTone}>{card.badge}</Badge>
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {card.points.map((pt) => (
                    <li key={pt} style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>{pt}</li>
                  ))}
                </ul>
              </AppCard>
            ))}
          </div>
        </>
      )}

      <ToastContainer />
    </div>
  );
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

// ─── Injury micro-components ──────────────────────────────────────────────
function InjKpi({ icon, label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>{label}</p>
        <strong style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</strong>
      </div>
    </div>
  );
}

function DateChip({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 10px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>{value}</span>
    </div>
  );
}

// ─── Shared micro-styles ─────────────────────────────────────────────────
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
  fontWeight: 600,
};

const tdStyle = {
  padding: "9px 10px",
  color: "#cbd5e1",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
