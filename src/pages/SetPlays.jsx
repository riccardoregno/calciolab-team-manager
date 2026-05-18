import { useEffect, useMemo, useState } from "react";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { getCurrentUserRole } from "../utils/helpers";

// ─── Dati iniziali ────────────────────────────────────────────────────────────
function emptySetPlays() {
  return {
    corners: {
      offTakerLeft: "",
      offTakerRight: "",
      offAssignments: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, playerId: "", zone: "", role: "" })),
      offNotes: "",
      defSystem: "zona",
      defPoleSx: "",
      defPoleDx: "",
      defAssignments: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, playerId: "", zone: "" })),
      defNotes: "",
    },
    freekicks: {
      offTaker1: "",
      offTaker2: "",
      offSchema: "diretto",
      offAssignments: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, playerId: "", zone: "" })),
      offNotes: "",
      defWall: ["", "", "", ""],
      defAssignments: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, playerId: "", zone: "" })),
      defNotes: "",
    },
    penalties: {
      takers: ["", "", "", "", ""],
      notes: "",
    },
  };
}

// ─── Opzioni zone ─────────────────────────────────────────────────────────────
const CORNER_OFF_ZONES = ["Primo palo", "Secondo palo", "Centro area", "Corto", "Limite area", "Blocco", "Indietro"];
const CORNER_OFF_ROLES = ["Attacco palla", "Blocco", "Ribattuta", "Uscita"];
const CORNER_DEF_ZONES = ["Palo sx", "Palo dx", "Centro davanti", "Centro indietro", "Zona sx", "Zona dx", "Fuori area"];
const FK_OFF_ZONES = ["Prima", "Seconda", "Terzo uomo", "Indietro", "Blocco barriera", "Posizione"];
const FK_DEF_ZONES = ["Barriera", "Marcatura", "Zona sx", "Zona dx", "Secondo palo", "Fuori area"];

// ─── Componenti helper ────────────────────────────────────────────────────────
function PlayerSelect({ value, onChange, players, placeholder = "— Nessuno —" }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "7px 10px",
        borderRadius: 8,
        background: "#1e293b",
        border: "1px solid rgba(255,255,255,0.12)",
        color: value ? "#f1f5f9" : "#64748b",
        fontSize: 13,
        width: "100%",
        cursor: "pointer",
      }}
    >
      <option value="">{placeholder}</option>
      {players.map(p => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
        return (
          <option key={p.id} value={p.id}>
            {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{name}
          </option>
        );
      })}
    </select>
  );
}

function ZoneSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "7px 10px",
        borderRadius: 8,
        background: "#1e293b",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#f1f5f9",
        fontSize: 13,
        width: "100%",
        cursor: "pointer",
      }}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Stili comuni ─────────────────────────────────────────────────────────────
const card = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 20,
};

const sectionTitle = {
  margin: "0 0 14px 0",
  fontSize: 14,
  fontWeight: 700,
  color: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle = {
  background: "rgba(255,255,255,0.06)",
  color: "#94a3b8",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tdStyle = {
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  verticalAlign: "middle",
  color: "#cbd5e1",
};

const numBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  borderRadius: 8,
  background: "rgba(37,99,235,0.25)",
  border: "1px solid rgba(37,99,235,0.45)",
  color: "#93c5fd",
  fontWeight: 800,
  fontSize: 12,
};

const labelSmall = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 5,
  fontWeight: 600,
};

const textarea = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#f1f5f9",
  fontSize: 13,
  resize: "vertical",
  minHeight: 72,
  boxSizing: "border-box",
};

// ─── Componente principale ────────────────────────────────────────────────────
export default function SetPlays({ players = [], setPlays = {}, setSetPlays, appSettings = {} }) {
  const [activeTab, setActiveTab] = useState("corners");
  const role = getCurrentUserRole(appSettings);
  const canEdit = ["owner", "headCoach", "assistantCoach"].includes(role);

  // Merge con empty per gestire dati parziali
  const data = useMemo(() => {
    const empty = emptySetPlays();
    return {
      corners: { ...empty.corners, ...(setPlays.corners || {}) },
      freekicks: { ...empty.freekicks, ...(setPlays.freekicks || {}) },
      penalties: { ...empty.penalties, ...(setPlays.penalties || {}) },
    };
  }, [setPlays]);

  function patch(section, updates) {
    if (!canEdit || !setSetPlays) return;
    setSetPlays({ ...data, [section]: { ...data[section], ...updates } });
  }

  // Inject print styles
  useEffect(() => {
    const id = "set-plays-print-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @media print {
          .no-print { display: none !important; }
          .set-plays-print { display: block !important; }
          body { background: #fff !important; color: #000 !important; }
          .set-plays-print table { border-collapse: collapse; width: 100%; }
          .set-plays-print th, .set-plays-print td { border: 1px solid #ccc; padding: 5px 8px; font-size: 12px; }
          .set-plays-print h2 { font-size: 18px; margin: 18px 0 8px; }
          .set-plays-print h3 { font-size: 14px; margin: 12px 0 6px; }
          .set-plays-print .print-section { margin-bottom: 28px; page-break-inside: avoid; }
          .set-plays-print .print-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  const tabs = [
    { key: "corners", label: "Calci d'angolo", icon: "📐" },
    { key: "freekicks", label: "Calci di punizione", icon: "⚡" },
    { key: "penalties", label: "Rigori", icon: "🎯" },
  ];

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div className="no-print">
        <PageHeader
          title="Palle Inattive"
          subtitle="Angoli, punizioni e rigori — schemi offensivi e difensivi"
          badge={<Badge tone="blue">Set Plays</Badge>}
          action={
            <Button onClick={() => window.print()} variant="secondary" size="sm">
              🖨️ Stampa scheda
            </Button>
          }
        />
      </div>

      {/* ── Tab switcher ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 6,
          width: "fit-content",
        }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              transition: "all 0.2s",
              background: activeTab === t.key
                ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                : "transparent",
              color: activeTab === t.key ? "#fff" : "#94a3b8",
              boxShadow: activeTab === t.key ? "0 4px 12px rgba(37,99,235,0.35)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Calci d'angolo ── */}
      {activeTab === "corners" && (
        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {/* Offensivo */}
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#86efac" }}>
              <span>⬆️</span> Angolo Offensivo
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={labelSmall}>Battitore sinistro</div>
                <PlayerSelect
                  value={data.corners.offTakerLeft}
                  onChange={v => patch("corners", { offTakerLeft: v })}
                  players={players}
                />
              </div>
              <div>
                <div style={labelSmall}>Battitore destro</div>
                <PlayerSelect
                  value={data.corners.offTakerRight}
                  onChange={v => patch("corners", { offTakerRight: v })}
                  players={players}
                />
              </div>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={thStyle}>Giocatore</th>
                  <th style={thStyle}>Zona / Destinazione</th>
                  <th style={thStyle}>Ruolo</th>
                </tr>
              </thead>
              <tbody>
                {data.corners.offAssignments.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={tdStyle}><span style={numBadge}>{row.id}</span></td>
                    <td style={tdStyle}>
                      <PlayerSelect
                        value={row.playerId}
                        onChange={v => {
                          const updated = [...data.corners.offAssignments];
                          updated[idx] = { ...updated[idx], playerId: v };
                          patch("corners", { offAssignments: updated });
                        }}
                        players={players}
                      />
                    </td>
                    <td style={tdStyle}>
                      <ZoneSelect
                        value={row.zone}
                        onChange={v => {
                          const updated = [...data.corners.offAssignments];
                          updated[idx] = { ...updated[idx], zone: v };
                          patch("corners", { offAssignments: updated });
                        }}
                        options={CORNER_OFF_ZONES}
                      />
                    </td>
                    <td style={tdStyle}>
                      <ZoneSelect
                        value={row.role}
                        onChange={v => {
                          const updated = [...data.corners.offAssignments];
                          updated[idx] = { ...updated[idx], role: v };
                          patch("corners", { offAssignments: updated });
                        }}
                        options={CORNER_OFF_ROLES}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14 }}>
              <div style={labelSmall}>Note schema</div>
              <textarea
                style={textarea}
                value={data.corners.offNotes}
                onChange={e => patch("corners", { offNotes: e.target.value })}
                placeholder="Descrizione schema, movimenti chiave..."
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Difensivo */}
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#fca5a5" }}>
              <span>⬇️</span> Angolo Difensivo
            </h3>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSmall}>Sistema difensivo</div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                {["zona", "uomo"].map(sys => (
                  <label key={sys} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#cbd5e1", fontSize: 13 }}>
                    <input
                      type="radio"
                      name="defSystem"
                      value={sys}
                      checked={data.corners.defSystem === sys}
                      onChange={() => patch("corners", { defSystem: sys })}
                      disabled={!canEdit}
                    />
                    {sys === "zona" ? "A zona" : "A uomo"}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={labelSmall}>Palo sinistro</div>
                <PlayerSelect
                  value={data.corners.defPoleSx}
                  onChange={v => patch("corners", { defPoleSx: v })}
                  players={players}
                />
              </div>
              <div>
                <div style={labelSmall}>Palo destro</div>
                <PlayerSelect
                  value={data.corners.defPoleDx}
                  onChange={v => patch("corners", { defPoleDx: v })}
                  players={players}
                />
              </div>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={thStyle}>Giocatore</th>
                  <th style={thStyle}>Zona / Marcatura</th>
                </tr>
              </thead>
              <tbody>
                {data.corners.defAssignments.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={tdStyle}><span style={numBadge}>{row.id}</span></td>
                    <td style={tdStyle}>
                      <PlayerSelect
                        value={row.playerId}
                        onChange={v => {
                          const updated = [...data.corners.defAssignments];
                          updated[idx] = { ...updated[idx], playerId: v };
                          patch("corners", { defAssignments: updated });
                        }}
                        players={players}
                      />
                    </td>
                    <td style={tdStyle}>
                      <ZoneSelect
                        value={row.zone}
                        onChange={v => {
                          const updated = [...data.corners.defAssignments];
                          updated[idx] = { ...updated[idx], zone: v };
                          patch("corners", { defAssignments: updated });
                        }}
                        options={CORNER_DEF_ZONES}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14 }}>
              <div style={labelSmall}>Note schema</div>
              <textarea
                style={textarea}
                value={data.corners.defNotes}
                onChange={e => patch("corners", { defNotes: e.target.value })}
                placeholder="Marcature, responsabilità, trigger..."
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Calci di punizione ── */}
      {activeTab === "freekicks" && (
        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {/* Offensivo */}
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#86efac" }}>
              <span>⬆️</span> Punizione Offensiva
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={labelSmall}>Battitore 1</div>
                <PlayerSelect
                  value={data.freekicks.offTaker1}
                  onChange={v => patch("freekicks", { offTaker1: v })}
                  players={players}
                />
              </div>
              <div>
                <div style={labelSmall}>Battitore 2</div>
                <PlayerSelect
                  value={data.freekicks.offTaker2}
                  onChange={v => patch("freekicks", { offTaker2: v })}
                  players={players}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelSmall}>Schema</div>
              <select
                value={data.freekicks.offSchema}
                onChange={e => patch("freekicks", { offSchema: e.target.value })}
                disabled={!canEdit}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#f1f5f9",
                  fontSize: 13,
                  width: "100%",
                  cursor: "pointer",
                }}
              >
                <option value="diretto">Tiro diretto</option>
                <option value="combinazione">Combinazione</option>
                <option value="schema2">Schema a 2</option>
                <option value="schema3">Schema a 3</option>
              </select>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={thStyle}>Giocatore</th>
                  <th style={thStyle}>Zona / Movimento</th>
                </tr>
              </thead>
              <tbody>
                {data.freekicks.offAssignments.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={tdStyle}><span style={numBadge}>{row.id}</span></td>
                    <td style={tdStyle}>
                      <PlayerSelect
                        value={row.playerId}
                        onChange={v => {
                          const updated = [...data.freekicks.offAssignments];
                          updated[idx] = { ...updated[idx], playerId: v };
                          patch("freekicks", { offAssignments: updated });
                        }}
                        players={players}
                      />
                    </td>
                    <td style={tdStyle}>
                      <ZoneSelect
                        value={row.zone}
                        onChange={v => {
                          const updated = [...data.freekicks.offAssignments];
                          updated[idx] = { ...updated[idx], zone: v };
                          patch("freekicks", { offAssignments: updated });
                        }}
                        options={FK_OFF_ZONES}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14 }}>
              <div style={labelSmall}>Note schema</div>
              <textarea
                style={textarea}
                value={data.freekicks.offNotes}
                onChange={e => patch("freekicks", { offNotes: e.target.value })}
                placeholder="Movimenti, segnali, varianti..."
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Difensivo */}
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#fca5a5" }}>
              <span>⬇️</span> Punizione Difensiva
            </h3>

            <div style={{ marginBottom: 16 }}>
              <div style={labelSmall}>Barriera (4 giocatori)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                {data.freekicks.defWall.map((pid, idx) => (
                  <div key={idx}>
                    <div style={{ ...labelSmall, color: "#64748b" }}>Pos. {idx + 1}</div>
                    <PlayerSelect
                      value={pid}
                      onChange={v => {
                        const updated = [...data.freekicks.defWall];
                        updated[idx] = v;
                        patch("freekicks", { defWall: updated });
                      }}
                      players={players}
                    />
                  </div>
                ))}
              </div>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={thStyle}>Giocatore</th>
                  <th style={thStyle}>Zona / Compito</th>
                </tr>
              </thead>
              <tbody>
                {data.freekicks.defAssignments.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={tdStyle}><span style={numBadge}>{row.id}</span></td>
                    <td style={tdStyle}>
                      <PlayerSelect
                        value={row.playerId}
                        onChange={v => {
                          const updated = [...data.freekicks.defAssignments];
                          updated[idx] = { ...updated[idx], playerId: v };
                          patch("freekicks", { defAssignments: updated });
                        }}
                        players={players}
                      />
                    </td>
                    <td style={tdStyle}>
                      <ZoneSelect
                        value={row.zone}
                        onChange={v => {
                          const updated = [...data.freekicks.defAssignments];
                          updated[idx] = { ...updated[idx], zone: v };
                          patch("freekicks", { defAssignments: updated });
                        }}
                        options={FK_DEF_ZONES}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14 }}>
              <div style={labelSmall}>Note schema</div>
              <textarea
                style={textarea}
                value={data.freekicks.defNotes}
                onChange={e => patch("freekicks", { defNotes: e.target.value })}
                placeholder="Disposizione barriera, marcature, uscita portiere..."
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Rigori ── */}
      {activeTab === "penalties" && (
        <div className="no-print" style={{ maxWidth: 480 }}>
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#fbbf24" }}>
              <span>🎯</span> Rigoristi — Ordine di priorità
            </h3>

            <div
              style={{
                background: "rgba(251,191,36,0.07)",
                border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 18,
                fontSize: 12,
                color: "#fde68a",
              }}
            >
              I rigoristi vengono selezionati in ordine di priorità. Il primo della lista batte il primo calcio di rigore disponibile.
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {data.penalties.takers.map((pid, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      ...numBadge,
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: idx === 0 ? "rgba(251,191,36,0.25)" : "rgba(37,99,235,0.2)",
                      border: idx === 0 ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(37,99,235,0.4)",
                      color: idx === 0 ? "#fde68a" : "#93c5fd",
                      flexShrink: 0,
                      fontSize: 14,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <PlayerSelect
                      value={pid}
                      onChange={v => {
                        const updated = [...data.penalties.takers];
                        updated[idx] = v;
                        patch("penalties", { takers: updated });
                      }}
                      players={players}
                      placeholder={idx === 0 ? "— 1° rigorista —" : `— ${idx + 1}° rigorista —`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={labelSmall}>Note (portiere nei rigori, varianti...)</div>
              <textarea
                style={textarea}
                value={data.penalties.notes}
                onChange={e => patch("penalties", { notes: e.target.value })}
                placeholder="Es. portiere studia angoli; rigori in allenamento settimanali..."
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Vista stampa (nascosta a schermo, visibile in @media print) ── */}
      <PrintView data={data} players={players} appSettings={appSettings} />
    </div>
  );
}

// ─── Vista stampa ─────────────────────────────────────────────────────────────
function PrintView({ data, players, appSettings }) {
  const teamName = appSettings?.workspaceProfile?.teamName || appSettings?.teamName || "";

  function playerName(id) {
    if (!id) return "—";
    const p = players.find(x => String(x.id) === String(id));
    if (!p) return "—";
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
    return p.shirtNumber ? `#${p.shirtNumber} ${name}` : name;
  }

  return (
    <div className="set-plays-print" style={{ display: "none" }}>
      <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#000", padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>
          Palle Inattive{teamName ? ` — ${teamName}` : ""}
        </h1>
        <p style={{ color: "#555", marginBottom: 28 }}>
          Schema completo: angoli, punizioni, rigori
        </p>

        {/* Angoli */}
        <div className="print-section">
          <h2>📐 Calci d'Angolo</h2>
          <div className="print-cols">
            <div>
              <h3>Angolo Offensivo</h3>
              <p>
                <strong>Battitore sx:</strong> {playerName(data.corners.offTakerLeft)} &nbsp;|&nbsp;
                <strong>Battitore dx:</strong> {playerName(data.corners.offTakerRight)}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Giocatore</th><th>Zona</th><th>Ruolo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.corners.offAssignments.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{playerName(row.playerId)}</td>
                      <td>{row.zone || "—"}</td>
                      <td>{row.role || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.corners.offNotes && <p><em>Note: {data.corners.offNotes}</em></p>}
            </div>
            <div>
              <h3>Angolo Difensivo</h3>
              <p>
                <strong>Sistema:</strong> {data.corners.defSystem === "zona" ? "A zona" : "A uomo"} &nbsp;|&nbsp;
                <strong>Palo sx:</strong> {playerName(data.corners.defPoleSx)} &nbsp;|&nbsp;
                <strong>Palo dx:</strong> {playerName(data.corners.defPoleDx)}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Giocatore</th><th>Zona / Marcatura</th>
                  </tr>
                </thead>
                <tbody>
                  {data.corners.defAssignments.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{playerName(row.playerId)}</td>
                      <td>{row.zone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.corners.defNotes && <p><em>Note: {data.corners.defNotes}</em></p>}
            </div>
          </div>
        </div>

        {/* Punizioni */}
        <div className="print-section">
          <h2>⚡ Calci di Punizione</h2>
          <div className="print-cols">
            <div>
              <h3>Punizione Offensiva</h3>
              <p>
                <strong>Battitore 1:</strong> {playerName(data.freekicks.offTaker1)} &nbsp;|&nbsp;
                <strong>Battitore 2:</strong> {playerName(data.freekicks.offTaker2)} &nbsp;|&nbsp;
                <strong>Schema:</strong> {data.freekicks.offSchema}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Giocatore</th><th>Zona / Movimento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.freekicks.offAssignments.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{playerName(row.playerId)}</td>
                      <td>{row.zone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.freekicks.offNotes && <p><em>Note: {data.freekicks.offNotes}</em></p>}
            </div>
            <div>
              <h3>Punizione Difensiva</h3>
              <p><strong>Barriera:</strong> {data.freekicks.defWall.map((id, i) => `${i + 1}. ${playerName(id)}`).join(" | ")}</p>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Giocatore</th><th>Zona / Compito</th>
                  </tr>
                </thead>
                <tbody>
                  {data.freekicks.defAssignments.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{playerName(row.playerId)}</td>
                      <td>{row.zone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.freekicks.defNotes && <p><em>Note: {data.freekicks.defNotes}</em></p>}
            </div>
          </div>
        </div>

        {/* Rigori */}
        <div className="print-section">
          <h2>🎯 Rigori</h2>
          <table style={{ maxWidth: 340 }}>
            <thead>
              <tr><th>Priorità</th><th>Rigorista</th></tr>
            </thead>
            <tbody>
              {data.penalties.takers.map((id, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{playerName(id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.penalties.notes && <p><em>Note: {data.penalties.notes}</em></p>}
        </div>
      </div>
    </div>
  );
}
