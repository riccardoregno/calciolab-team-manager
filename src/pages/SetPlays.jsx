import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTabState } from "../hooks/useTabState";
import { useTranslation } from "../i18n";

import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import TacticalMiniPreview from "../components/ui/TacticalMiniPreview";
import { styles } from "../styles/index.js";
import { getCurrentUserRole } from "../utils/helpers";

// ─── Dati iniziali ────────────────────────────────────────────────────────────
function emptySetPlays() {
  return {
    corners: {
      offSchemeName: "",
      offCallCode: "",
      offVariant: "",
      offTrigger: "",
      offQuickNote: "",
      offTakerLeft: "",
      offTakerRight: "",
      offSecondTakerLeft: "",
      offSecondTakerRight: "",
      offAssignments: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, playerId: "", zone: "", role: "" })),
      offNotes: "",
      offDiagram: null,
      defSchemeName: "",
      defCallCode: "",
      defVariant: "",
      defTrigger: "",
      defQuickNote: "",
      defSystem: "zona",
      defPoleSx: "",
      defPoleDx: "",
      defAssignments: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, playerId: "", task: "", opponent: "", zone: "" })),
      defNotes: "",
      defDiagram: null,
    },
    freekicks: {
      offSchemeName: "",
      offCallCode: "",
      offVariant: "",
      offTrigger: "",
      offQuickNote: "",
      offTaker1: "",
      offTaker2: "",
      offSchema: "diretto",
      offAssignments: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, playerId: "", zone: "" })),
      offNotes: "",
      offDiagram: null,
      defSchemeName: "",
      defCallCode: "",
      defVariant: "",
      defTrigger: "",
      defQuickNote: "",
      defWall: ["", "", "", "", "", ""],
      defAssignments: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, playerId: "", task: "", opponent: "", zone: "" })),
      defNotes: "",
      defDiagram: null,
    },
    penalties: {
      takers: ["", "", "", "", ""],
      notes: "",
      diagram: null,
    },
  };
}

// ─── Opzioni zone ─────────────────────────────────────────────────────────────
const CORNER_OFF_ZONES = ["Primo palo", "Secondo palo", "Centro area", "Corto", "Limite area", "Blocco", "Indietro"];
const CORNER_OFF_ROLES = ["Attacco palla", "Blocco", "Ribattuta", "Uscita"];
const CORNER_DEF_ZONES = [
  "Centro porta",
  "Primo palo",
  "Secondo palo",
  "Palo",
  "Corto",
  "Limite area",
  "Vertice area",
  "Palo sx",
  "Palo dx",
  "Prima linea - Primo",
  "Prima linea - Secondo",
  "Prima linea - Terzo",
  "Seconda linea - Primo",
  "Seconda linea - Secondo",
  "Seconda linea - Terzo",
  "Centro davanti",
  "Centro indietro",
  "Zona sx",
  "Zona dx",
  "Fuori area",
];
const FK_OFF_ZONES = ["Prima", "Seconda", "Terzo uomo", "Indietro", "Blocco barriera", "Posizione"];
const FK_DEF_ZONES = ["Barriera", "Uscita", "Primo palo", "Secondo palo", "Zona sx", "Zona dx", "Limite area", "Fuori area"];
const DEF_TASKS = ["Marca uomo", "Difende zona", "Palo", "Barriera", "Uscita", "Ribattuta"];
const WALL_LABELS = ["Primo", "Secondo", "Terzo", "Quarto", "Quinto", "Quello che esce"];

const CORNER_DEF_PRESETS = {
  zona10: [
    { task: "Palo", zone: "Primo palo" },
    { task: "Palo", zone: "Secondo palo" },
    { task: "Difende zona", zone: "Prima linea - Primo" },
    { task: "Difende zona", zone: "Prima linea - Secondo" },
    { task: "Difende zona", zone: "Prima linea - Terzo" },
    { task: "Difende zona", zone: "Seconda linea - Primo" },
    { task: "Difende zona", zone: "Seconda linea - Secondo" },
    { task: "Difende zona", zone: "Corto" },
    { task: "Ribattuta", zone: "Limite area" },
    { task: "Difende zona", zone: "Vertice area" },
  ],
  centroPaloCorto: [
    { task: "Difende zona", zone: "Centro porta" },
    { task: "Palo", zone: "Palo" },
    { task: "Difende zona", zone: "Corto" },
  ],
  mista: [
    { task: "Palo", zone: "Primo palo" },
    { task: "Palo", zone: "Secondo palo" },
    { task: "Marca uomo", zone: "" },
    { task: "Marca uomo", zone: "" },
    { task: "Marca uomo", zone: "" },
    { task: "Difende zona", zone: "Prima linea - Primo" },
    { task: "Difende zona", zone: "Prima linea - Secondo" },
    { task: "Difende zona", zone: "Seconda linea - Primo" },
    { task: "Ribattuta", zone: "Limite area" },
    { task: "Difende zona", zone: "Corto" },
  ],
};

const SAVED_PRESET_CONFIG = {
  corners_off: {
    section: "corners",
    title: "Angolo offensivo",
    fields: ["offSchemeName", "offCallCode", "offVariant", "offTrigger", "offQuickNote", "offTakerLeft", "offTakerRight", "offSecondTakerLeft", "offSecondTakerRight", "offAssignments", "offNotes", "offDiagram"],
  },
  corners_def: {
    section: "corners",
    title: "Angolo difensivo",
    fields: ["defSchemeName", "defCallCode", "defVariant", "defTrigger", "defQuickNote", "defSystem", "defPoleSx", "defPoleDx", "defAssignments", "defNotes", "defDiagram"],
  },
  freekicks_off: {
    section: "freekicks",
    title: "Punizione offensiva",
    fields: ["offSchemeName", "offCallCode", "offVariant", "offTrigger", "offQuickNote", "offTaker1", "offTaker2", "offSchema", "offAssignments", "offNotes", "offDiagram"],
  },
  freekicks_def: {
    section: "freekicks",
    title: "Punizione difensiva",
    fields: ["defSchemeName", "defCallCode", "defVariant", "defTrigger", "defQuickNote", "defWall", "defAssignments", "defNotes", "defDiagram"],
  },
};

function clonePayload(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

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

function DefTaskControl({ value, onChange }) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <ZoneSelect value={value} onChange={onChange} options={DEF_TASKS} />
      {value && <span style={{ ...taskBadge, ...getTaskBadgeStyle(value) }}>{value}</span>}
    </div>
  );
}

function getTaskBadgeStyle(value) {
  if (value === "Marca uomo") {
    return { color: "#fca5a5", borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.12)" };
  }
  if (value === "Difende zona") {
    return { color: "#93c5fd", borderColor: "rgba(147,197,253,0.35)", background: "rgba(59,130,246,0.12)" };
  }
  if (value === "Palo" || value === "Barriera") {
    return { color: "#fde68a", borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.12)" };
  }
  return { color: "#c4b5fd", borderColor: "rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.12)" };
}

function expandAssignments(rows = [], length, fallback = {}) {
  return Array.from({ length }, (_, index) => ({
    id: index + 1,
    ...fallback,
    ...(rows[index] || {}),
  }));
}

function SavedPresetPanel({
  sectionKey,
  presets,
  presetName,
  onNameChange,
  onSave,
  onApply,
  onDelete,
  canEdit,
}) {
  const sectionPresets = presets.filter((preset) => preset.sectionKey === sectionKey);

  return (
    <div style={savedPresetBox}>
      <div style={savedPresetHeader}>
        <span style={presetLabel}>Preset salvati</span>
        <span style={savedPresetCount}>{sectionPresets.length}</span>
      </div>

      {canEdit && (
        <div style={savedPresetForm}>
          <input
            value={presetName}
            onChange={(event) => onNameChange(sectionKey, event.target.value)}
            placeholder="Nome preset"
            style={savedPresetInput}
          />
          <button type="button" style={presetButton} onClick={() => onSave(sectionKey)}>
            Salva preset
          </button>
        </div>
      )}

      {sectionPresets.length > 0 ? (
        <div style={savedPresetList}>
          {sectionPresets.map((preset) => (
            <div key={preset.id} style={savedPresetItem}>
              <button type="button" style={savedPresetApply} onClick={() => onApply(preset)} disabled={!canEdit}>
                {preset.name}
              </button>
              {canEdit && (
                <button type="button" style={savedPresetDelete} onClick={() => onDelete(preset.id)} aria-label={`Elimina preset ${preset.name}`}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={savedPresetEmpty}>Nessun preset salvato</div>
      )}
    </div>
  );
}

function SchemeMetaFields({ title, values, onChange, canEdit }) {
  return (
    <div style={schemeMetaBox}>
      <div style={schemeMetaTitle}>{title}</div>
      <div style={schemeMetaGrid}>
        <label style={schemeMetaLabel}>
          Nome schema
          <input
            value={values.schemeName || ""}
            onChange={(event) => onChange("schemeName", event.target.value)}
            placeholder="Es. Angolo corto + blocco"
            style={compactInput}
            disabled={!canEdit}
          />
        </label>
        <label style={schemeMetaLabel}>
          Codice chiamata
          <input
            value={values.callCode || ""}
            onChange={(event) => onChange("callCode", event.target.value)}
            placeholder="Es. Blu 2"
            style={compactInput}
            disabled={!canEdit}
          />
        </label>
        <label style={schemeMetaLabel}>
          Variante
          <input
            value={values.variant || ""}
            onChange={(event) => onChange("variant", event.target.value)}
            placeholder="A / B / C"
            style={compactInput}
            disabled={!canEdit}
          />
        </label>
        <label style={schemeMetaLabel}>
          Trigger
          <input
            value={values.trigger || ""}
            onChange={(event) => onChange("trigger", event.target.value)}
            placeholder="Quando usarlo"
            style={compactInput}
            disabled={!canEdit}
          />
        </label>
      </div>
      <label style={{ ...schemeMetaLabel, marginTop: 8 }}>
        Nota rapida giocatori
        <input
          value={values.quickNote || ""}
          onChange={(event) => onChange("quickNote", event.target.value)}
          placeholder="Es. 9 blocca, 5 attacca secondo palo"
          style={compactInput}
          disabled={!canEdit}
        />
      </label>
    </div>
  );
}

// ─── DiagramBox: caricamento immagine o disegno sulla lavagna ────────────────
function DiagramBox({ diagram, onSave, onClear, canEdit, navigate, navSection, navLabel }) {
  const fileRef = useRef();

  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSave({ type: "image", src: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function openBoard() {
    navigate("/tactical-board", {
      state: { setPlaySection: navSection, setPlayLabel: navLabel },
    });
  }

  const hasDiagram = !!diagram;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10, letterSpacing: 0.3 }}>
        Diagramma tattico
      </div>

      {hasDiagram ? (
        <div>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 8 }}>
            {diagram.type === "image" ? (
              <img src={diagram.src} alt="Schema" style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "contain", background: "#0f172a" }} />
            ) : (
              <TacticalMiniPreview board={diagram.snapshot} height={180} />
            )}
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={openBoard} style={btnSmall}>✏️ Modifica sulla lavagna</button>
              <button onClick={onClear} style={{ ...btnSmall, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>🗑️ Rimuovi</button>
            </div>
          )}
        </div>
      ) : (
        canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={openBoard} style={btnSmall}>🎨 Disegna sulla Lavagna Tattica</button>
            <label style={btnSmall} title="Carica da file">
              📁 Carica immagine
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
            </label>
          </div>
        )
      )}
    </div>
  );
}

const btnSmall = {
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  color: "#94a3b8", cursor: "pointer",
};

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

const viewSwitch = {
  display: "flex",
  gap: 6,
  width: "fit-content",
  padding: 5,
  borderRadius: 12,
  background: "rgba(15,23,42,0.74)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const viewButton = {
  padding: "7px 13px",
  borderRadius: 9,
  border: "none",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
};

const viewButtonActive = {
  background: "rgba(59,130,246,0.2)",
  color: "#bfdbfe",
  boxShadow: "inset 0 0 0 1px rgba(147,197,253,0.16)",
};

const taskBadge = {
  justifySelf: "start",
  border: "1px solid",
  borderRadius: 999,
  padding: "2px 7px",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const presetBar = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 14,
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const presetLabel = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
};

const presetButton = {
  padding: "6px 10px",
  borderRadius: 9,
  border: "1px solid rgba(147,197,253,0.2)",
  background: "rgba(59,130,246,0.1)",
  color: "#bfdbfe",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
};

const savedPresetBox = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 12,
  background: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const savedPresetHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 9,
};

const savedPresetCount = {
  minWidth: 22,
  height: 22,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(59,130,246,0.16)",
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 900,
};

const savedPresetForm = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 1fr) auto",
  gap: 8,
  marginBottom: 10,
};

const savedPresetInput = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#f1f5f9",
  fontSize: 13,
  boxSizing: "border-box",
  minWidth: 0,
};

const savedPresetList = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const savedPresetItem = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(255,255,255,0.045)",
};

const savedPresetApply = {
  border: "none",
  background: "transparent",
  color: "#e2e8f0",
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const savedPresetDelete = {
  border: "none",
  borderLeft: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(248,113,113,0.1)",
  color: "#fca5a5",
  width: 30,
  alignSelf: "stretch",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
};

const savedPresetEmpty = {
  color: "#64748b",
  fontSize: 12,
};

const schemeMetaBox = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 12,
  background: "rgba(59,130,246,0.055)",
  border: "1px solid rgba(147,197,253,0.12)",
};

const schemeMetaTitle = {
  color: "#bfdbfe",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 9,
};

const schemeMetaGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
};

const schemeMetaLabel = {
  display: "grid",
  gap: 5,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 800,
};

const compactInput = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#f1f5f9",
  fontSize: 13,
  boxSizing: "border-box",
};

// ─── Componente principale ────────────────────────────────────────────────────
export default function SetPlays({ players = [], setPlays = {}, setSetPlays, appSettings = {} }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabState("tab", "corners");
  const [activeView, setActiveView] = useTabState("view", "all");
  const [, setSearchParams] = useSearchParams();
  const [presetNames, setPresetNames] = useState({});
  const navigate = useNavigate();
  const role = getCurrentUserRole(appSettings);
  const canEdit = ["owner", "headCoach", "assistantCoach"].includes(role);
  // ref per accedere ai dati aggiornati dall'useEffect di mount
  const setPlaysRef = useRef(setPlays);

  useEffect(() => {
    setPlaysRef.current = setPlays;
  }, [setPlays]);

  // Merge con empty per gestire dati parziali
  const data = useMemo(() => {
    const empty = emptySetPlays();
    const corners = { ...empty.corners, ...(setPlays.corners || {}) };
    const freekicks = { ...empty.freekicks, ...(setPlays.freekicks || {}) };
    return {
      corners:   {
        ...corners,
        defAssignments: expandAssignments(corners.defAssignments, 10, { playerId: "", task: "", opponent: "", zone: "" }),
      },
      freekicks: {
        ...freekicks,
        defWall: [...(freekicks.defWall || []), "", "", "", "", "", ""].slice(0, 6),
        defAssignments: expandAssignments(freekicks.defAssignments, 6, { playerId: "", task: "", opponent: "", zone: "" }),
      },
      penalties: { ...empty.penalties, ...(setPlays.penalties || {}) },
      presets: Array.isArray(setPlays.presets) ? setPlays.presets : [],
    };
  }, [setPlays]);

  function patch(section, updates) {
    if (!canEdit || !setSetPlays) return;
    setSetPlays({ ...data, [section]: { ...data[section], ...updates } });
  }

  function applyCornerDefPreset(presetKey) {
    const preset = CORNER_DEF_PRESETS[presetKey] || [];
    const updated = expandAssignments(data.corners.defAssignments, 10, { playerId: "", task: "", opponent: "", zone: "" })
      .map((row, index) => ({
        ...row,
        opponent: preset[index]?.task === "Marca uomo" ? row.opponent || "" : "",
        task: preset[index]?.task || "",
        zone: preset[index]?.zone || "",
      }));

    patch("corners", {
      defSystem: presetKey === "mista" ? "uomo" : "zona",
      defAssignments: updated,
    });
  }

  function applyFreekickDefPreset() {
    patch("freekicks", {
      defWall: [...data.freekicks.defWall, "", "", "", "", "", ""].slice(0, 6),
      defAssignments: expandAssignments(data.freekicks.defAssignments, 6, { playerId: "", task: "", opponent: "", zone: "" })
        .map((row, index) => {
          const preset = [
            { task: "Barriera", zone: "Barriera" },
            { task: "Barriera", zone: "Barriera" },
            { task: "Difende zona", zone: "Secondo palo" },
            { task: "Difende zona", zone: "Zona sx" },
            { task: "Ribattuta", zone: "Limite area" },
            { task: "Uscita", zone: "Uscita" },
          ][index];
          return { ...row, opponent: "", task: preset.task, zone: preset.zone };
        }),
    });
  }

  function updatePresetName(sectionKey, value) {
    setPresetNames((prev) => ({ ...prev, [sectionKey]: value }));
  }

  function captureSavedPresetPayload(sectionKey) {
    const config = SAVED_PRESET_CONFIG[sectionKey];
    if (!config) return {};

    return config.fields.reduce((payload, field) => {
      payload[field] = clonePayload(data[config.section]?.[field]);
      return payload;
    }, {});
  }

  function saveCurrentPreset(sectionKey) {
    if (!canEdit || !setSetPlays) return;
    const config = SAVED_PRESET_CONFIG[sectionKey];
    if (!config) return;

    const name = (presetNames[sectionKey] || "").trim() || `${config.title} ${new Date().toLocaleDateString("it-IT")}`;
    const preset = {
      id: `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sectionKey,
      name,
      payload: captureSavedPresetPayload(sectionKey),
      updatedAt: new Date().toISOString(),
    };

    setSetPlays({ ...data, presets: [...data.presets, preset] });
    setPresetNames((prev) => ({ ...prev, [sectionKey]: "" }));
  }

  function applySavedPreset(preset) {
    if (!canEdit || !setSetPlays) return;
    const config = SAVED_PRESET_CONFIG[preset.sectionKey];
    if (!config) return;

    setSetPlays({
      ...data,
      [config.section]: {
        ...data[config.section],
        ...clonePayload(preset.payload || {}),
      },
    });
  }

  function deleteSavedPreset(presetId) {
    if (!canEdit || !setSetPlays) return;
    setSetPlays({
      ...data,
      presets: data.presets.filter((preset) => preset.id !== presetId),
    });
  }

  function renderSavedPresetPanel(sectionKey) {
    return (
      <SavedPresetPanel
        sectionKey={sectionKey}
        presets={data.presets}
        presetName={presetNames[sectionKey] || ""}
        onNameChange={updatePresetName}
        onSave={saveCurrentPreset}
        onApply={applySavedPreset}
        onDelete={deleteSavedPreset}
        canEdit={canEdit}
      />
    );
  }

  function renderSchemeMetaFields(section, prefix, title) {
    const field = (name) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;

    return (
      <SchemeMetaFields
        title={title}
        canEdit={canEdit}
        values={{
          schemeName: data[section][field("schemeName")] || "",
          callCode: data[section][field("callCode")] || "",
          variant: data[section][field("variant")] || "",
          trigger: data[section][field("trigger")] || "",
          quickNote: data[section][field("quickNote")] || "",
        }}
        onChange={(key, value) => patch(section, { [field(key)]: value })}
      />
    );
  }

  // ── Rientro dalla Lavagna Tattica: legge diagramma da sessionStorage ──────────
  useEffect(() => {
    const raw = sessionStorage.getItem("setPlayDiagramResult");
    if (!raw || !setSetPlays) return;
    try {
      const { section, snapshot } = JSON.parse(raw);
      sessionStorage.removeItem("setPlayDiagramResult");
      const parts = section.split("_"); // "corners_off" → ["corners","off"]
      const sec   = parts[0];           // "corners" | "freekicks" | "penalties"
      const side  = parts[1];           // "off" | "def" | undefined
      const field = side === "off" ? "offDiagram" : side === "def" ? "defDiagram" : "diagram";
      const sp = setPlaysRef.current;
      const empty = emptySetPlays();
      const current = {
        corners:   { ...empty.corners,   ...(sp.corners   || {}) },
        freekicks: { ...empty.freekicks, ...(sp.freekicks || {}) },
        penalties: { ...empty.penalties, ...(sp.penalties || {}) },
        presets: Array.isArray(sp.presets) ? sp.presets : [],
      };
      setSetPlays({ ...current, [sec]: { ...current[sec], [field]: { type: "board", snapshot } } });
    } catch { /* ignore malformed data */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const viewTabs = [
    { key: "all", label: "Tutto" },
    { key: "off", label: "Offensivo" },
    { key: "def", label: "Difensivo" },
  ];

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div className="no-print">
        <PageHeader
          title={t("pages.setPlays.title")}
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
            onClick={() => {
              setSearchParams(
                (prev) => { const n = new URLSearchParams(prev); n.set("tab", t.key); n.set("view", "all"); return n; },
                { replace: true }
              );
            }}
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

      {activeTab !== "penalties" && (
        <div className="no-print" style={viewSwitch}>
          {viewTabs.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => setActiveView(view.key)}
              style={{
                ...viewButton,
                ...(activeView === view.key ? viewButtonActive : {}),
              }}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}

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
          {(activeView === "all" || activeView === "off") && (
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#86efac" }}>
              <span>⬆️</span> Angolo Offensivo
            </h3>

            {renderSavedPresetPanel("corners_off")}

            {renderSchemeMetaFields("corners", "off", "Chiamata schema")}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={labelSmall}>Battitore sinistro</div>
                <PlayerSelect
                  value={data.corners.offTakerLeft}
                  onChange={v => patch("corners", { offTakerLeft: v })}
                  players={players}
                />
              </div>
              <div>
                <div style={labelSmall}>Secondo battitore sx</div>
                <PlayerSelect
                  value={data.corners.offSecondTakerLeft}
                  onChange={v => patch("corners", { offSecondTakerLeft: v })}
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
              <div>
                <div style={labelSmall}>Secondo battitore dx</div>
                <PlayerSelect
                  value={data.corners.offSecondTakerRight}
                  onChange={v => patch("corners", { offSecondTakerRight: v })}
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
            <DiagramBox
              diagram={data.corners.offDiagram}
              onSave={v => patch("corners", { offDiagram: v })}
              onClear={() => patch("corners", { offDiagram: null })}
              canEdit={canEdit}
              navigate={navigate}
              navSection="corners_off"
              navLabel="Angolo Offensivo"
            />
          </div>
          )}

          {/* Difensivo */}
          {(activeView === "all" || activeView === "def") && (
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

            <div style={presetBar}>
              <span style={presetLabel}>Preset</span>
              <button type="button" style={presetButton} onClick={() => applyCornerDefPreset("zona10")} disabled={!canEdit}>
                Zona 10
              </button>
              <button type="button" style={presetButton} onClick={() => applyCornerDefPreset("centroPaloCorto")} disabled={!canEdit}>
                Centro + palo + corto
              </button>
              <button type="button" style={presetButton} onClick={() => applyCornerDefPreset("mista")} disabled={!canEdit}>
                Mista
              </button>
            </div>

            {renderSavedPresetPanel("corners_def")}

            {renderSchemeMetaFields("corners", "def", "Chiamata difensiva")}

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
                  <th style={thStyle}>Compito</th>
                  <th style={thStyle}>Avversario</th>
                  <th style={thStyle}>Zona</th>
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
                      <DefTaskControl
                        value={row.task}
                        onChange={v => {
                          const updated = [...data.corners.defAssignments];
                          updated[idx] = { ...updated[idx], task: v };
                          patch("corners", { defAssignments: updated });
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={row.opponent || ""}
                        onChange={e => {
                          const updated = [...data.corners.defAssignments];
                          updated[idx] = { ...updated[idx], opponent: e.target.value };
                          patch("corners", { defAssignments: updated });
                        }}
                        placeholder="N° / nome"
                        style={compactInput}
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
            <DiagramBox
              diagram={data.corners.defDiagram}
              onSave={v => patch("corners", { defDiagram: v })}
              onClear={() => patch("corners", { defDiagram: null })}
              canEdit={canEdit}
              navigate={navigate}
              navSection="corners_def"
              navLabel="Angolo Difensivo"
            />
          </div>
          )}
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
          {(activeView === "all" || activeView === "off") && (
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#86efac" }}>
              <span>⬆️</span> Punizione Offensiva
            </h3>

            {renderSavedPresetPanel("freekicks_off")}

            {renderSchemeMetaFields("freekicks", "off", "Chiamata schema")}

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
            <DiagramBox
              diagram={data.freekicks.offDiagram}
              onSave={v => patch("freekicks", { offDiagram: v })}
              onClear={() => patch("freekicks", { offDiagram: null })}
              canEdit={canEdit}
              navigate={navigate}
              navSection="freekicks_off"
              navLabel="Punizione Offensiva"
            />
          </div>
          )}

          {/* Difensivo */}
          {(activeView === "all" || activeView === "def") && (
          <div style={card}>
            <h3 style={{ ...sectionTitle, color: "#fca5a5" }}>
              <span>⬇️</span> Punizione Difensiva
            </h3>

            <div style={{ marginBottom: 16 }}>
              <div style={labelSmall}>Barriera contro (5 + uscita)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 6 }}>
                {data.freekicks.defWall.map((pid, idx) => (
                  <div key={idx}>
                    <div style={{ ...labelSmall, color: "#64748b" }}>{WALL_LABELS[idx] || `Pos. ${idx + 1}`}</div>
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

            <div style={presetBar}>
              <span style={presetLabel}>Preset</span>
              <button type="button" style={presetButton} onClick={applyFreekickDefPreset} disabled={!canEdit}>
                Barriera 5 + uscita
              </button>
            </div>

            {renderSavedPresetPanel("freekicks_def")}

            {renderSchemeMetaFields("freekicks", "def", "Chiamata difensiva")}

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>#</th>
                  <th style={thStyle}>Giocatore</th>
                  <th style={thStyle}>Compito</th>
                  <th style={thStyle}>Avversario</th>
                  <th style={thStyle}>Zona</th>
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
                      <DefTaskControl
                        value={row.task}
                        onChange={v => {
                          const updated = [...data.freekicks.defAssignments];
                          updated[idx] = { ...updated[idx], task: v };
                          patch("freekicks", { defAssignments: updated });
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        value={row.opponent || ""}
                        onChange={e => {
                          const updated = [...data.freekicks.defAssignments];
                          updated[idx] = { ...updated[idx], opponent: e.target.value };
                          patch("freekicks", { defAssignments: updated });
                        }}
                        placeholder="N° / nome"
                        style={compactInput}
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
            <DiagramBox
              diagram={data.freekicks.defDiagram}
              onSave={v => patch("freekicks", { defDiagram: v })}
              onClear={() => patch("freekicks", { defDiagram: null })}
              canEdit={canEdit}
              navigate={navigate}
              navSection="freekicks_def"
              navLabel="Punizione Difensiva"
            />
          </div>
          )}
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
            <DiagramBox
              diagram={data.penalties.diagram}
              onSave={v => patch("penalties", { diagram: v })}
              onClear={() => patch("penalties", { diagram: null })}
              canEdit={canEdit}
              navigate={navigate}
              navSection="penalties"
              navLabel="Rigori"
            />
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

  function renderPrintMeta(record, prefix = "") {
    const field = (name) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
    const items = [
      ["Schema", record[field("schemeName")]],
      ["Codice", record[field("callCode")]],
      ["Variante", record[field("variant")]],
      ["Trigger", record[field("trigger")]],
      ["Nota rapida", record[field("quickNote")]],
    ].filter(([, value]) => value);

    if (!items.length) return null;

    return (
      <p>
        {items.map(([label, value], index) => (
          <span key={label}>
            {index > 0 ? " | " : ""}
            <strong>{label}:</strong> {value}
          </span>
        ))}
      </p>
    );
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
              {renderPrintMeta(data.corners, "off")}
              <p>
                <strong>Battitore sx:</strong> {playerName(data.corners.offTakerLeft)} &nbsp;|&nbsp;
                <strong>2° sx:</strong> {playerName(data.corners.offSecondTakerLeft)} &nbsp;|&nbsp;
                <strong>Battitore dx:</strong> {playerName(data.corners.offTakerRight)} &nbsp;|&nbsp;
                <strong>2° dx:</strong> {playerName(data.corners.offSecondTakerRight)}
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
              {data.corners.offDiagram?.type === "image" && (
                <img src={data.corners.offDiagram.src} alt="Schema" style={{ width: "100%", maxHeight: 200, objectFit: "contain", marginTop: 8, border: "1px solid #ccc" }} />
              )}
            </div>
            <div>
              <h3>Angolo Difensivo</h3>
              {renderPrintMeta(data.corners, "def")}
              <p>
                <strong>Sistema:</strong> {data.corners.defSystem === "zona" ? "A zona" : "A uomo"} &nbsp;|&nbsp;
                <strong>Palo sx:</strong> {playerName(data.corners.defPoleSx)} &nbsp;|&nbsp;
                <strong>Palo dx:</strong> {playerName(data.corners.defPoleDx)}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Giocatore</th><th>Compito</th><th>Avversario</th><th>Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {data.corners.defAssignments.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{playerName(row.playerId)}</td>
                      <td>{row.task || "—"}</td>
                      <td>{row.opponent || "—"}</td>
                      <td>{row.zone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.corners.defNotes && <p><em>Note: {data.corners.defNotes}</em></p>}
              {data.corners.defDiagram?.type === "image" && (
                <img src={data.corners.defDiagram.src} alt="Schema" style={{ width: "100%", maxHeight: 200, objectFit: "contain", marginTop: 8, border: "1px solid #ccc" }} />
              )}
            </div>
          </div>
        </div>

        {/* Punizioni */}
        <div className="print-section">
          <h2>⚡ Calci di Punizione</h2>
          <div className="print-cols">
            <div>
              <h3>Punizione Offensiva</h3>
              {renderPrintMeta(data.freekicks, "off")}
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
              {data.freekicks.offDiagram?.type === "image" && (
                <img src={data.freekicks.offDiagram.src} alt="Schema" style={{ width: "100%", maxHeight: 200, objectFit: "contain", marginTop: 8, border: "1px solid #ccc" }} />
              )}
            </div>
            <div>
              <h3>Punizione Difensiva</h3>
              {renderPrintMeta(data.freekicks, "def")}
              <p><strong>Barriera:</strong> {data.freekicks.defWall.map((id, i) => `${WALL_LABELS[i] || `Pos. ${i + 1}`}: ${playerName(id)}`).join(" | ")}</p>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Giocatore</th><th>Compito</th><th>Avversario</th><th>Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {data.freekicks.defAssignments.map(row => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{playerName(row.playerId)}</td>
                      <td>{row.task || "—"}</td>
                      <td>{row.opponent || "—"}</td>
                      <td>{row.zone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.freekicks.defNotes && <p><em>Note: {data.freekicks.defNotes}</em></p>}
              {data.freekicks.defDiagram?.type === "image" && (
                <img src={data.freekicks.defDiagram.src} alt="Schema" style={{ width: "100%", maxHeight: 200, objectFit: "contain", marginTop: 8, border: "1px solid #ccc" }} />
              )}
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
          {data.penalties.diagram?.type === "image" && (
            <img src={data.penalties.diagram.src} alt="Schema" style={{ width: "100%", maxWidth: 340, maxHeight: 200, objectFit: "contain", marginTop: 8, border: "1px solid #ccc" }} />
          )}
        </div>
      </div>
    </div>
  );
}
