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

// ─── Injury types ─────────────────────────────────────────────────────────
const INJURY_TYPES = ["Muscolare", "Articolare", "Contusione", "Altro"];

function emptyInjury() {
  return {
    id:             createId("inj"),
    type:           "Muscolare",
    dateStart:      new Date().toISOString().slice(0, 10),
    dateExpected:   "",
    dateActual:     "",
    recidiva:       false,
    notes:          "",
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
export default function GpsLoad({ gpsSessions = [], setGpsSessions, players = [], setPlayers }) {
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
  const [injuryForm, setInjuryForm] = useState(null); // null = hidden
  const [editingInjuryId, setEditingInjuryId] = useState(null);

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
  const selectedPlayer = players.find((p) => String(p.id) === String(selectedPlayerId));
  const injuryHistory  = selectedPlayer?.injuryHistory || [];

  function handleSaveInjury() {
    if (!injuryForm) return;
    if (!selectedPlayerId) { showToast("Seleziona un giocatore", "warn"); return; }

    const updated = editingInjuryId
      ? injuryHistory.map((inj) => inj.id === editingInjuryId ? { ...injuryForm } : inj)
      : [...injuryHistory, { ...injuryForm }];

    if (setPlayers) {
      setPlayers(players.map((p) =>
        String(p.id) === String(selectedPlayerId)
          ? { ...p, injuryHistory: updated }
          : p
      ));
    }
    showToast("Infortunio salvato", "ok");
    setInjuryForm(null);
    setEditingInjuryId(null);
  }

  function handleDeleteInjury(injId) {
    const updated = injuryHistory.filter((inj) => inj.id !== injId);
    if (setPlayers) {
      setPlayers(players.map((p) =>
        String(p.id) === String(selectedPlayerId)
          ? { ...p, injuryHistory: updated }
          : p
      ));
    }
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
          <AppCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 16 }}>Storico infortuni</h3>
                <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Seleziona un giocatore per visualizzare o aggiungere infortuni.</p>
              </div>
              {selectedPlayerId && (
                <Button onClick={() => { setInjuryForm(emptyInjury()); setEditingInjuryId(null); }}>
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
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim()}</option>
                  ))}
                </select>
              </label>
            </div>
          </AppCard>

          {/* Inline injury form */}
          {injuryForm && (
            <AppCard>
              <h4 style={{ margin: "0 0 14px", color: "#93c5fd", fontSize: 15 }}>
                {editingInjuryId ? "Modifica infortunio" : "Nuovo infortunio"}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                <label style={labelStyle}>
                  Tipo
                  <select style={inputStyle} value={injuryForm.type} onChange={(e) => setInjuryForm((p) => ({ ...p, type: e.target.value }))}>
                    {INJURY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Data inizio
                  <input type="date" style={inputStyle} value={injuryForm.dateStart} onChange={(e) => setInjuryForm((p) => ({ ...p, dateStart: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Rientro previsto
                  <input type="date" style={inputStyle} value={injuryForm.dateExpected} onChange={(e) => setInjuryForm((p) => ({ ...p, dateExpected: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Rientro effettivo
                  <input type="date" style={inputStyle} value={injuryForm.dateActual} onChange={(e) => setInjuryForm((p) => ({ ...p, dateActual: e.target.value }))} />
                </label>
                <label style={{ ...labelStyle, display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={injuryForm.recidiva}
                    onChange={(e) => setInjuryForm((p) => ({ ...p, recidiva: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>Recidiva</span>
                </label>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                  Note
                  <input style={inputStyle} value={injuryForm.notes} onChange={(e) => setInjuryForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note opzionali" />
                </label>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <Button onClick={handleSaveInjury}>Salva</Button>
                <button onClick={() => { setInjuryForm(null); setEditingInjuryId(null); }} style={ghostBtn}>Annulla</button>
              </div>
            </AppCard>
          )}

          {/* Injury list */}
          {selectedPlayerId && injuryHistory.length === 0 && !injuryForm && (
            <EmptyState title="Nessun infortunio registrato" description="Clicca su 'Aggiungi infortunio' per iniziare." />
          )}

          {selectedPlayerId && injuryHistory.length > 0 && (
            <AppCard>
              <h4 style={{ margin: "0 0 14px", color: "#f1f5f9", fontSize: 15 }}>
                Infortuni — {selectedPlayer?.name || selectedPlayer?.firstName}
              </h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Tipo", "Data inizio", "Rientro previsto", "Rientro effettivo", "Recidiva", "Note", ""].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", color: "#64748b", fontWeight: 700, textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...injuryHistory].sort((a, b) => b.dateStart.localeCompare(a.dateStart)).map((inj) => (
                      <tr key={inj.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={tdStyle}><Badge tone="orange">{inj.type}</Badge></td>
                        <td style={tdStyle}>{inj.dateStart || "-"}</td>
                        <td style={tdStyle}>{inj.dateExpected || "-"}</td>
                        <td style={tdStyle}>{inj.dateActual || "-"}</td>
                        <td style={tdStyle}>{inj.recidiva ? <Badge tone="red">Sì</Badge> : <Badge tone="green">No</Badge>}</td>
                        <td style={tdStyle}>{inj.notes || "-"}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => { setInjuryForm({ ...inj }); setEditingInjuryId(inj.id); }}
                              style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }}
                            >✏️</button>
                            <button
                              onClick={() => handleDeleteInjury(inj.id)}
                              style={{ ...ghostBtn, padding: "4px 10px", fontSize: 12 }}
                            >🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
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
