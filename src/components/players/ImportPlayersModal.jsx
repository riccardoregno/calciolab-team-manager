import { useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { createUuid } from "../../utils/helpers";
import { emptyPlayer } from "../../data/initialData";

// ─── CSV Parser ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === "," || ch === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, "").trim());
  const rows = lines.slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const cells = parseLine(l).map((c) => c.replace(/^["']|["']$/g, "").trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
      return obj;
    });

  return { headers, rows };
}

// ─── Campi target del player ─────────────────────────────────────────────────
const TARGET_FIELDS = [
  { key: "firstName", label: "Nome",         required: true,  aliases: ["nome", "first name", "firstname", "name", "first_name"] },
  { key: "lastName",  label: "Cognome",       required: true,  aliases: ["cognome", "last name", "lastname", "surname", "last_name"] },
  { key: "role",      label: "Ruolo",         required: false, aliases: ["ruolo", "role", "posizione", "position", "pos"] },
  { key: "birthDate", label: "Data nascita",  required: false, aliases: ["data nascita", "data_nascita", "birthdate", "birth_date", "nato", "dob", "nascita"] },
  { key: "shirtNumber", label: "Maglia",      required: false, aliases: ["maglia", "numero", "shirt", "shirt_number", "shirtnumber", "number", "#"] },
  { key: "foot",      label: "Piede",         required: false, aliases: ["piede", "foot", "pied"] },
  { key: "height",    label: "Altezza (cm)",  required: false, aliases: ["altezza", "height", "cm", "alt"] },
  { key: "weight",    label: "Peso (kg)",     required: false, aliases: ["peso", "weight", "kg"] },
  { key: "nationality", label: "Nazionalità", required: false, aliases: ["nazionalità", "nazionalita", "nationality", "naz"] },
  { key: "gruppo",    label: "Gruppo",        required: false, aliases: ["gruppo", "group", "categoria", "team"] },
];

// Auto-detect: prova a mappare header CSV → campo player
function autoDetectMapping(headers) {
  const mapping = {};
  for (const field of TARGET_FIELDS) {
    const match = headers.find((h) =>
      field.aliases.some((alias) => h.toLowerCase().trim() === alias)
    );
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

// Normalizza data in YYYY-MM-DD
function normalizeDate(raw) {
  if (!raw) return "";
  // già ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // DD/MM/YYYY o DD.MM.YYYY
  const dmY = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  // MM/DD/YYYY
  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdY) return `${mdY[3]}-${mdY[1].padStart(2, "0")}-${mdY[2].padStart(2, "0")}`;
  return raw;
}

// Normalizza piede
function normalizeFoot(raw) {
  const v = (raw || "").toLowerCase();
  if (["dx", "destra", "right", "r", "d"].includes(v)) return "Dx";
  if (["sx", "sinistra", "left", "l", "s"].includes(v)) return "Sx";
  if (["entrambi", "both", "ambidestro"].includes(v)) return "Entrambi";
  return "Dx";
}

// Converte una row CSV in player object
function rowToPlayer(row, mapping) {
  const get = (key) => {
    const col = mapping[key];
    return col ? (row[col] || "").trim() : "";
  };

  const firstName = get("firstName");
  const lastName  = get("lastName");

  if (!firstName && !lastName) return null;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    ...emptyPlayer(),
    id:          createUuid(),
    name:        fullName,
    firstName,
    lastName,
    role:        get("role"),
    birthDate:   normalizeDate(get("birthDate")),
    shirtNumber: get("shirtNumber"),
    foot:        get("foot") ? normalizeFoot(get("foot")) : "Dx",
    height:      get("height"),
    weight:      get("weight"),
    nationality: get("nationality"),
    gruppo:      get("gruppo") || "prima",
    status:      "Disponibile",
    attendance:  {},
    ratings:     {},
    injuries:    [],
  };
}

// ─── Template CSV scaricabile ─────────────────────────────────────────────────
const CSV_TEMPLATE = `Nome,Cognome,Ruolo,Data Nascita,Maglia,Piede,Altezza,Peso,Nazionalità
Mario,Rossi,Portiere,2000-01-15,1,Dx,185,80,Italiana
Luca,Bianchi,Difensore,2001-03-22,5,Sx,178,75,Italiana
Marco,Verdi,Centrocampista,1999-07-10,8,Dx,175,72,Italiana
`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "calciolab_rosa_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function ImportPlayersModal({ onClose, onImport }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [step, setStep]       = useState(1); // 1=upload, 2=mapping, 3=preview
  const [parsed, setParsed]   = useState(null);  // { headers, rows }
  const [mapping, setMapping] = useState({});     // { fieldKey: csvHeader }
  const [dragOver, setDragOver] = useState(false);
  const [error, setError]     = useState("");

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "txt"].includes(ext)) {
      setError(t("pages.players.importErrorFormat"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const result = parseCSV(text);
      if (result.headers.length === 0) {
        setError(t("pages.players.importErrorEmpty"));
        return;
      }
      setParsed(result);
      setMapping(autoDetectMapping(result.headers));
      setError("");
      setStep(2);
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function handleConfirm() {
    const players = parsed.rows
      .map((row) => rowToPlayer(row, mapping))
      .filter(Boolean);

    if (players.length === 0) {
      setError(t("pages.players.importErrorNoPlayers"));
      return;
    }

    onImport(players);
    onClose();
  }

  const previewPlayers = parsed
    ? parsed.rows.slice(0, 8).map((row) => rowToPlayer(row, mapping)).filter(Boolean)
    : [];

  const requiredMapped = TARGET_FIELDS
    .filter((f) => f.required)
    .every((f) => mapping[f.key]);

  return (
    <div style={im.overlay} onClick={onClose}>
      <div style={im.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={im.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{t("pages.players.importTitle")}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              {step === 1 && t("pages.players.importStep1")}
              {step === 2 && t("pages.players.importStep2")}
              {step === 3 && t("pages.players.importStep3", { count: previewPlayers.length })}
            </p>
          </div>
          <button onClick={onClose} style={im.closeBtn}>×</button>
        </div>

        {/* Step indicator */}
        <div style={im.steps}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                ...im.stepDot,
                background: step >= s ? "#2563eb" : "rgba(255,255,255,0.1)",
                border: step === s ? "2px solid #60a5fa" : "2px solid transparent",
              }}>
                {s}
              </div>
              {s < 3 && <div style={{ width: 32, height: 2, background: step > s ? "#2563eb" : "rgba(255,255,255,0.1)", borderRadius: 1 }} />}
            </div>
          ))}
        </div>

        {error && (
          <div style={im.errorBanner}>{error}</div>
        )}

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div>
            <div
              style={{ ...im.dropZone, background: dragOver ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.03)", borderColor: dragOver ? "#2563eb" : "rgba(255,255,255,0.1)" }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <span style={{ fontSize: 36 }}>📂</span>
              <strong style={{ color: "#e2e8f0" }}>{t("pages.players.importDropLabel")}</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>{t("pages.players.importDropSub")}</span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={downloadTemplate} style={im.templateBtn}>
                ⬇️ {t("pages.players.importDownloadTemplate")}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Mapping ── */}
        {step === 2 && parsed && (
          <div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
              {t("pages.players.importMappingHint")} <strong style={{ color: "#e2e8f0" }}>{parsed.headers.length}</strong> {t("pages.players.importColumnsFound")}
            </p>

            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {TARGET_FIELDS.map((field) => (
                <div key={field.key} style={im.mappingRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: field.required ? "#60a5fa" : "#94a3b8" }}>
                      {field.label}
                      {field.required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
                    </span>
                  </div>
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || undefined })}
                    style={im.mappingSelect}
                  >
                    <option value="">— {t("pages.players.importIgnore")} —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={im.footer}>
              <button onClick={() => setStep(1)} style={im.cancelBtn}>{t("common.back")}</button>
              <button
                onClick={() => setStep(3)}
                disabled={!requiredMapped}
                style={{ ...im.primaryBtn, opacity: requiredMapped ? 1 : 0.45, cursor: requiredMapped ? "pointer" : "not-allowed" }}
              >
                {t("pages.players.importPreviewBtn")} →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview + conferma ── */}
        {step === 3 && (
          <div>
            <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
              <table style={im.table}>
                <thead>
                  <tr>
                    {["Nome", "Ruolo", "Nascita", "Maglia", "Gruppo"].map((h) => (
                      <th key={h} style={im.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewPlayers.map((p, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <td style={im.td}><strong>{p.name}</strong></td>
                      <td style={im.td}>{p.role || "—"}</td>
                      <td style={im.td}>{p.birthDate || "—"}</td>
                      <td style={im.td}>{p.shirtNumber || "—"}</td>
                      <td style={im.td}>{p.gruppo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed && parsed.rows.length > 8 && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
                  + {parsed.rows.length - 8} {t("pages.players.importMoreRows")}
                </p>
              )}
            </div>

            <div style={im.footer}>
              <button onClick={() => setStep(2)} style={im.cancelBtn}>{t("common.back")}</button>
              <button onClick={handleConfirm} style={im.primaryBtn}>
                ✓ {t("pages.players.importConfirmBtn", { count: previewPlayers.length + Math.max(0, (parsed?.rows.length || 0) - previewPlayers.length) })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stili ────────────────────────────────────────────────────────────────────
const im = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  },
  modal: {
    background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20, padding: 24, width: "100%", maxWidth: 520,
    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
    display: "flex", flexDirection: "column", gap: 16,
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  },
  closeBtn: {
    background: "none", border: "none", color: "#64748b",
    fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0,
  },
  steps: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
  },
  stepDot: {
    width: 26, height: 26, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 900, color: "white",
  },
  dropZone: {
    border: "2px dashed",
    borderRadius: 16, padding: "32px 20px",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 8, cursor: "pointer", transition: "all 0.2s",
    textAlign: "center",
  },
  templateBtn: {
    background: "none", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "7px 16px",
    color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  mappingRow: {
    display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center",
    padding: "6px 10px", borderRadius: 8,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
  },
  mappingSelect: {
    width: "100%", padding: "6px 10px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)", color: "#e2e8f0",
    fontSize: 12, outline: "none",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 900,
    color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  td: { padding: "7px 10px", color: "#e2e8f0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  footer: {
    display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8,
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  cancelBtn: {
    background: "none", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "8px 16px",
    color: "#94a3b8", cursor: "pointer", fontWeight: 700, fontSize: 13,
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    border: "none", borderRadius: 10, padding: "8px 18px",
    color: "white", cursor: "pointer", fontWeight: 800, fontSize: 13,
  },
  errorBanner: {
    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#fca5a5",
  },
};
