import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import SearchBar from "../components/ui/SearchBar";
import { styles } from "../styles/index.js";
import { createId, getCurrentUserRole, isFeatureUnlocked } from "../utils/helpers";
import { emptyExercise } from "../data/initialData";

// ─── Costanti ────────────────────────────────────────────────────────────────
const filterDefaults = { category: "Tutte", intensity: "Tutte", phase: "Tutte" };

// ─── Componente principale ────────────────────────────────────────────────────
export default function ExerciseLibrary({ appSettings = {}, exercises = [], setExercises }) {
  const navigate = useNavigate();

  // Tab attivo
  const [tab, setTab] = useState("catalogo"); // "catalogo" | "miei"

  // Catalogo FP5
  const [fp5Raw, setFp5Raw] = useState([]);
  const [fp5Loading, setFp5Loading] = useState(true);

  // Filtri catalogo
  const [search, setSearch]   = useState("");
  const [filters, setFilters] = useState(filterDefaults);

  // Filtri "I miei"
  const [mySearch, setMySearch] = useState("");

  // Espandi descrizione
  const [expandedId, setExpandedId] = useState(null);

  // Modal modifica (solo owner)
  const [editModal, setEditModal]   = useState(false);
  const [editForm, setEditForm]     = useState(null);
  const [editIsNew, setEditIsNew]   = useState(false);

  // Ruolo corrente
  const currentRole     = getCurrentUserRole(appSettings);
  const isOwner         = currentRole === "owner";
  const premiumUnlocked = isOwner || isFeatureUnlocked("exerciseLibrary", appSettings);

  // ── Carica FP5 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    import("../data/eserciziarioFp5.js")
      .then(({ eserciziarioFp5 }) => setFp5Raw(eserciziarioFp5))
      .catch(() => setFp5Raw([]))
      .finally(() => setFp5Loading(false));
  }, []);

  // ── Merge FP5 + eventuali override dell'owner (stessi ID fp5-*) ────────────
  const catalog = useMemo(() => {
    const overrides = Object.fromEntries(
      exercises.filter((e) => e.id.startsWith("fp5-")).map((e) => [e.id, e])
    );
    return fp5Raw.map((ex) => overrides[ex.id] ?? ex);
  }, [fp5Raw, exercises]);

  // ── Opzioni filtri catalogo ─────────────────────────────────────────────────
  const catOptions = useMemo(() => ({
    categories:  ["Tutte", ...uniq(catalog.map((e) => e.category))],
    intensities: ["Tutte", ...uniq(catalog.map((e) => e.intensity))],
    phases:      ["Tutte", ...uniq(catalog.map((e) => e.phase))],
  }), [catalog]);

  // ── Catalogo filtrato ───────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => catalog.filter((ex) => {
    const hay = [ex.title, ex.category, ex.objective, ex.description, ...(ex.tags || [])]
      .join(" ").toLowerCase();
    return (
      hay.includes(search.toLowerCase()) &&
      (filters.category  === "Tutte" || ex.category  === filters.category)  &&
      (filters.intensity === "Tutte" || ex.intensity === filters.intensity)  &&
      (filters.phase     === "Tutte" || ex.phase     === filters.phase)
    );
  }), [catalog, search, filters]);

  // ── "I miei esercizi" = esercizi utente senza prefisso fp5- ────────────────
  const myExercises = useMemo(() =>
    exercises.filter((e) => !e.id.startsWith("fp5-")),
  [exercises]);

  const filteredMy = useMemo(() =>
    myExercises.filter((e) =>
      [e.title, e.category, e.objective, ...(e.tags || [])]
        .join(" ").toLowerCase()
        .includes(mySearch.toLowerCase())
    ),
  [myExercises, mySearch]);

  // ── Modifica esercizio (owner) ──────────────────────────────────────────────
  function openEdit(ex) {
    setEditForm({ ...ex });
    setEditIsNew(false);
    setEditModal(true);
  }

  function openNew() {
    setEditForm({ ...emptyExercise(), id: createId("fp5-custom"), intensity: "Media" });
    setEditIsNew(true);
    setEditModal(true);
  }

  function saveEdit() {
    if (!editForm) return;
    const existing = exercises.findIndex((e) => e.id === editForm.id);
    if (existing >= 0) {
      setExercises(exercises.map((e) => e.id === editForm.id ? editForm : e));
    } else {
      setExercises([...exercises, editForm]);
    }
    setEditModal(false);
    setEditForm(null);
  }

  function deleteFromCatalog(id) {
    if (!confirm("Rimuovere questo esercizio dal catalogo?")) return;
    // Se è un override fp5, lo rimuoviamo dallo state (torna al FP5 originale)
    // Se è un custom fp5-custom-*, lo eliminiamo
    if (id.startsWith("fp5-custom")) {
      setExercises(exercises.filter((e) => e.id !== id));
    } else {
      // Rimuovi override — il prossimo render userà di nuovo il dato statico
      setExercises(exercises.filter((e) => e.id !== id));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        title="Eserciziario"
        subtitle={
          tab === "catalogo"
            ? `${catalog.length} esercizi nel catalogo${premiumUnlocked ? "" : " · Sblocca Premium per vedere i dettagli"}`
            : `${myExercises.length} esercizi creati`
        }
        action={
          isOwner && tab === "catalogo" ? (
            <Button onClick={openNew}>+ Aggiungi al catalogo</Button>
          ) : !premiumUnlocked ? (
            <Button onClick={() => navigate("/premium")}>🔓 Sblocca Premium</Button>
          ) : null
        }
      />

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div style={libStyles.tabs}>
        <TabBtn active={tab === "catalogo"} onClick={() => setTab("catalogo")}>
          📚 Catalogo FP5
        </TabBtn>
        <TabBtn active={tab === "miei"} onClick={() => setTab("miei")}>
          ⭐ I miei esercizi
          {myExercises.length > 0 && (
            <span style={libStyles.tabBadge}>{myExercises.length}</span>
          )}
        </TabBtn>
      </div>

      {/* ══════════════════ TAB: CATALOGO ══════════════════ */}
      {tab === "catalogo" && (
        <>
          {/* Filtri */}
          <AppCard>
            <div style={libStyles.toolbar}>
              <SearchBar value={search} onChange={setSearch} placeholder="Cerca per titolo, categoria, tag..." />
              <DarkSelect label="Categoria"  value={filters.category}  options={catOptions.categories}  onChange={(v) => setFilters({ ...filters, category: v })} />
              <DarkSelect label="Fase"       value={filters.phase}     options={catOptions.phases}      onChange={(v) => setFilters({ ...filters, phase: v })} />
              <DarkSelect label="Intensità"  value={filters.intensity} options={catOptions.intensities} onChange={(v) => setFilters({ ...filters, intensity: v })} />
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="blue">{filteredCatalog.length} esercizi</Badge>
              {!premiumUnlocked && <Badge tone="orange">🔒 Dettagli riservati agli abbonati Premium</Badge>}
              {isOwner && <Badge tone="green">✏️ Modalità admin — puoi modificare il catalogo</Badge>}
            </div>
          </AppCard>

          {/* Griglia esercizi */}
          {fp5Loading ? (
            <AppCard>
              <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <p style={{ margin: 0 }}>Caricamento 893 esercizi...</p>
              </div>
            </AppCard>
          ) : filteredCatalog.length === 0 ? (
            <EmptyState icon="🎯" title="Nessun esercizio trovato" text="Modifica i filtri di ricerca." />
          ) : (
            <div style={libStyles.grid}>
              {filteredCatalog.map((ex) => {
                const isExpanded = expandedId === ex.id;
                const locked = !premiumUnlocked;

                return (
                  <AppCard key={ex.id}>
                    {/* Header */}
                    <div style={libStyles.cardHead}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          <Badge tone={locked ? "orange" : "green"}>{locked ? "🔒 Premium" : "Premium"}</Badge>
                          <Badge tone={ex.intensity === "Alta" ? "red" : ex.intensity === "Bassa" ? "blue" : "default"}>
                            {ex.intensity || "Media"}
                          </Badge>
                          {ex.phase && <Badge tone="default">{ex.phase}</Badge>}
                        </div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                          {ex.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                          {ex.category}{ex.duration ? ` · ${ex.duration} min` : ""}{ex.players ? ` · ${ex.players} gioc.` : ""}
                        </p>
                      </div>

                      {/* Thumbnail SVG */}
                      {ex.image && (
                        <div style={libStyles.thumb}>
                          <img
                            src={ex.image}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                          />
                          {locked && <div style={libStyles.thumbOverlay}>🔒</div>}
                        </div>
                      )}
                    </div>

                    {/* Tag */}
                    {(ex.tags || []).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        {(ex.tags || []).slice(0, 5).map((tag) => (
                          <span key={tag} style={libStyles.tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Contenuto: locked o visibile */}
                    {locked ? (
                      <div style={libStyles.lockBanner}>
                        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#94a3b8" }}>
                          Sblocca Premium per accedere a descrizione, diagramma tattico, varianti e coaching points.
                        </p>
                        <Button variant="ghost" onClick={() => navigate("/premium")}>
                          Scopri Premium →
                        </Button>
                      </div>
                    ) : (
                      <>
                        {ex.description && (
                          <div style={{ marginTop: 12 }}>
                            <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                              {isExpanded || ex.description.length <= 160
                                ? ex.description
                                : `${ex.description.slice(0, 160)}…`}
                            </p>
                            {ex.description.length > 160 && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                                style={libStyles.expandBtn}
                              >
                                {isExpanded ? "Mostra meno ▲" : "Mostra tutto ▼"}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Dettagli */}
                        <div style={libStyles.details}>
                          {ex.fieldSize  && <InfoChip label="Campo"     value={ex.fieldSize} />}
                          {ex.material   && <InfoChip label="Materiale" value={ex.material} />}
                          {ex.ageGroup   && <InfoChip label="Età"       value={ex.ageGroup} />}
                          {ex.players    && <InfoChip label="Giocatori" value={ex.players} />}
                          {ex.goal       && <InfoChip label="Focus"     value={ex.goal} />}
                        </div>

                        {isExpanded && ex.variants && (
                          <div style={libStyles.variantBox}>
                            <p style={libStyles.variantLabel}>Varianti</p>
                            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>
                              {ex.variants}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Azioni owner */}
                    {isOwner && (
                      <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                        <Button variant="ghost" onClick={() => openEdit(ex)}>✏️ Modifica</Button>
                        <Button variant="ghost" onClick={() => deleteFromCatalog(ex.id)}>🗑️</Button>
                      </div>
                    )}
                  </AppCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ TAB: I MIEI ESERCIZI ══════════════════ */}
      {tab === "miei" && (
        <>
          <AppCard>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <SearchBar value={mySearch} onChange={setMySearch} placeholder="Cerca nei tuoi esercizi..." />
              </div>
              <Badge tone="blue">{myExercises.length} esercizi creati</Badge>
              <Button onClick={() => navigate("/exercises")}>
                + Nuovo esercizio
              </Button>
            </div>
          </AppCard>

          {filteredMy.length === 0 ? (
            <EmptyState
              icon="✏️"
              title="Nessun esercizio personale"
              text="Crea i tuoi esercizi dalla pagina Esercizi, oppure modificane uno dal Catalogo."
              action={<Button onClick={() => navigate("/exercises")}>Vai a Esercizi</Button>}
            />
          ) : (
            <div style={libStyles.grid}>
              {filteredMy.map((ex) => (
                <AppCard key={ex.id}>
                  <div style={libStyles.cardHead}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        {ex.category && <Badge tone="blue">{ex.category}</Badge>}
                        {ex.intensity && (
                          <Badge tone={ex.intensity === "Alta" ? "red" : "default"}>{ex.intensity}</Badge>
                        )}
                      </div>
                      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                        {ex.title || "Esercizio senza titolo"}
                      </h3>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                        {ex.duration ? `${ex.duration} min` : ""}{ex.players ? ` · ${ex.players} gioc.` : ""}
                      </p>
                    </div>
                    {ex.image && (
                      <div style={libStyles.thumb}>
                        <img src={ex.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                      </div>
                    )}
                  </div>

                  {ex.description && (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>
                      {ex.description.length > 140 ? `${ex.description.slice(0, 140)}…` : ex.description}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Button variant="ghost" onClick={() => navigate("/exercises")}>
                      ✏️ Modifica
                    </Button>
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ MODAL MODIFICA (owner) ══════════════════ */}
      {editModal && editForm && (
        <Modal
          title={editIsNew ? "Nuovo esercizio nel catalogo" : `Modifica: ${editForm.title}`}
          onClose={() => { setEditModal(false); setEditForm(null); }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Titolo">
              <input
                style={styles.input}
                value={editForm.title || ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Titolo esercizio"
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Categoria">
                <input
                  style={styles.input}
                  value={editForm.category || ""}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="es. Possesso"
                />
              </Field>
              <Field label="Fase">
                <input
                  style={styles.input}
                  value={editForm.phase || ""}
                  onChange={(e) => setEditForm({ ...editForm, phase: e.target.value })}
                  placeholder="es. Tattica"
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Durata (min)">
                <input
                  style={styles.input}
                  type="number"
                  value={editForm.duration || ""}
                  onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })}
                />
              </Field>
              <Field label="Giocatori">
                <input
                  style={styles.input}
                  value={editForm.players || ""}
                  onChange={(e) => setEditForm({ ...editForm, players: e.target.value })}
                  placeholder="es. 12-16"
                />
              </Field>
              <Field label="Intensità">
                <select
                  style={styles.input}
                  value={editForm.intensity || "Media"}
                  onChange={(e) => setEditForm({ ...editForm, intensity: e.target.value })}
                >
                  {["Bassa", "Media", "Alta"].map((v) => <option key={v}>{v}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Campo">
                <input
                  style={styles.input}
                  value={editForm.fieldSize || ""}
                  onChange={(e) => setEditForm({ ...editForm, fieldSize: e.target.value })}
                  placeholder="es. 20x30m"
                />
              </Field>
              <Field label="Materiale">
                <input
                  style={styles.input}
                  value={editForm.material || ""}
                  onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                  placeholder="es. Palloni, cinesini"
                />
              </Field>
            </div>

            <Field label="Descrizione">
              <textarea
                style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Descrizione dell'esercizio..."
              />
            </Field>

            <Field label="Obiettivo">
              <input
                style={styles.input}
                value={editForm.objective || ""}
                onChange={(e) => setEditForm({ ...editForm, objective: e.target.value })}
              />
            </Field>

            <Field label="Varianti">
              <textarea
                style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
                value={editForm.variants || ""}
                onChange={(e) => setEditForm({ ...editForm, variants: e.target.value })}
              />
            </Field>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8 }}>
              <Button variant="ghost" onClick={() => { setEditModal(false); setEditForm(null); }}>
                Annulla
              </Button>
              <Button onClick={saveEdit}>
                {editIsNew ? "Aggiungi al catalogo" : "Salva modifiche"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...libStyles.tabBtn, ...(active ? libStyles.tabBtnActive : {}) }}>
      {children}
    </button>
  );
}

function DarkSelect({ label, value, options, onChange }) {
  return (
    <label style={{ display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#f1f5f9",
          fontSize: 14,
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: 32,
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: "#1e293b", color: "#f1f5f9" }}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</span>
      {children}
    </label>
  );
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

// ─── Stili ────────────────────────────────────────────────────────────────────
const libStyles = {
  tabs: {
    display: "flex",
    gap: 4,
    padding: 4,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    width: "fit-content",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 18px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
  },
  tabBtnActive: {
    background: "rgba(56,189,248,0.15)",
    color: "#38bdf8",
    border: "1px solid rgba(56,189,248,0.25)",
  },
  tabBadge: {
    padding: "1px 7px",
    borderRadius: 20,
    background: "rgba(56,189,248,0.2)",
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: 700,
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "1.4fr repeat(3, minmax(120px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 18,
  },
  cardHead: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  thumb: {
    position: "relative",
    width: 90,
    height: 64,
    flexShrink: 0,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.6)",
    fontSize: 20,
    backdropFilter: "blur(3px)",
  },
  tag: {
    padding: "2px 8px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 11,
    color: "#64748b",
  },
  lockBanner: {
    marginTop: 14,
    padding: "14px 16px",
    borderRadius: 12,
    background: "rgba(251,191,36,0.06)",
    border: "1px solid rgba(251,191,36,0.2)",
  },
  details: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  variantBox: {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  variantLabel: {
    margin: "0 0 4px",
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
  },
  expandBtn: {
    marginTop: 6,
    background: "none",
    border: "none",
    color: "#38bdf8",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
};
