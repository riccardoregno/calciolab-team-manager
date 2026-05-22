import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import SearchBar from "../components/ui/SearchBar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { styles } from "../styles/index.js";
import { TRAINING_BLOCKS, getBlockFromCategory, createId, getCurrentUserRole, isFeatureUnlocked } from "../utils/helpers";
import { generateExerciseSvg, getExerciseDescription, getExerciseProgressions } from "../utils/exerciseContent";
import { emptyExercise } from "../data/initialData";
import TacticalMiniPreview from "../components/ui/TacticalMiniPreview";
import { useTranslation } from "../i18n";

// Returns the image to show for an exercise card: generated SVG for fp5 catalog, stored image for personal
function exImage(ex) {
  if (ex.source === "fp5" || !ex.image) return generateExerciseSvg(ex);
  return ex.image;
}

// Returns description text: generated for fp5, stored for personal
function exDesc(ex) {
  if (ex.source === "fp5") return getExerciseDescription(ex);
  return ex.description || "";
}

// ─── Costanti ────────────────────────────────────────────────────────────────
const filterDefaults = { category: "Tutte", intensity: "Tutte", phase: "Tutte", ageGroup: "Tutte", players: "Tutti", block: "Tutti" };
const PAGE_SIZES = [25, 50, 100, "Tutti"];

// Fasce giocatori (allineate con il campo players dei prompt AI)
const PLAYER_BUCKETS = [
  { label: "Tutti",   min: 0,  max: Infinity },
  { label: "≤ 8",    min: 0,  max: 8 },
  { label: "9 – 12", min: 9,  max: 12 },
  { label: "13 – 16",min: 13, max: 16 },
  { label: "17 +",   min: 17, max: Infinity },
];

// Estrae il numero minimo di giocatori da stringhe tipo "8", "10-14", "16+", "12-16"
function parseMinPlayers(str = "") {
  const m = String(str).match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

function matchPlayersBucket(exPlayers, bucketLabel) {
  if (bucketLabel === "Tutti") return true;
  const bucket = PLAYER_BUCKETS.find((b) => b.label === bucketLabel);
  if (!bucket) return true;
  const n = parseMinPlayers(exPlayers);
  if (isNaN(n)) return false;
  return n >= bucket.min && n <= bucket.max;
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function ExerciseLibrary({
  appSettings = {}, exercises = [], setExercises }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const detailExerciseId = new URLSearchParams(location.search).get("exerciseId");

  // Tab attivo
  const initialTab = new URLSearchParams(location.search).get("tab");
  const [tab, setTab] = useState(initialTab === "miei" ? "miei" : "catalogo"); // "catalogo" | "miei"

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
  const [confirmState, setConfirmState] = useState(null);

  // Paginazione catalogo
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(25);

  // Paginazione "I miei"
  const [myPage, setMyPage]       = useState(1);
  const [myPageSize] = useState(25);

  // Lightbox anteprima disegno
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [detailExercise, setDetailExercise] = useState(null);

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
    ageGroups:   ["Tutte", ...uniq(catalog.map((e) => e.ageGroup))],
    playerBuckets: PLAYER_BUCKETS.map((b) => b.label),
    blocks: ["Tutti", ...TRAINING_BLOCKS.map((b) => b.id)],
  }), [catalog]);

  // ── Catalogo filtrato ───────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => catalog.filter((ex) => {
    const hay = [ex.title, ex.category, ex.objective, ex.description, ...(ex.tags || [])]
      .join(" ").toLowerCase();
    return (
      hay.includes(search.toLowerCase()) &&
      (filters.category  === "Tutte" || ex.category  === filters.category)  &&
      (filters.intensity === "Tutte" || ex.intensity === filters.intensity)  &&
      (filters.phase     === "Tutte" || ex.phase     === filters.phase)     &&
      (filters.ageGroup  === "Tutte" || ex.ageGroup  === filters.ageGroup)  &&
      matchPlayersBucket(ex.players, filters.players) &&
      (filters.block === "Tutti" || (ex.trainingBlock || getBlockFromCategory(ex.category)) === filters.block)
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

  useEffect(() => {
    if (!detailExerciseId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetailExercise(null);
      return;
    }

    const foundExercise = [...catalog, ...myExercises].find((exercise) => String(exercise.id) === String(detailExerciseId));
    if (foundExercise) {
      setDetailExercise(foundExercise);
    }
  }, [catalog, detailExerciseId, myExercises]);

  // ── Reset pagina a 1 quando cambiano filtri ─────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, filters]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyPage(1);
  }, [mySearch]);

  // ── Pagine calcolate ────────────────────────────────────────────────────────
  const catalogTotalPages = pageSize === "Tutti" ? 1 : Math.ceil(filteredCatalog.length / pageSize);
  const catalogSlice = pageSize === "Tutti"
    ? filteredCatalog
    : filteredCatalog.slice((page - 1) * pageSize, page * pageSize);

  const myTotalPages = myPageSize === "Tutti" ? 1 : Math.ceil(filteredMy.length / myPageSize);
  const mySlice = myPageSize === "Tutti"
    ? filteredMy
    : filteredMy.slice((myPage - 1) * myPageSize, myPage * myPageSize);

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
    setExercises((prevExercises) => {
      const existing = prevExercises.some((e) => e.id === editForm.id);
      return existing
        ? prevExercises.map((e) => e.id === editForm.id ? editForm : e)
        : [...prevExercises, editForm];
    });
    setEditModal(false);
    setEditForm(null);
  }

  function deleteFromCatalog(id) {
    setConfirmState({
      message: "Rimuovere questo esercizio dal catalogo?",
      confirmLabel: "Rimuovi",
      confirmTone: "red",
      onConfirm: () => setExercises((prevExercises) => prevExercises.filter((e) => e.id !== id)),
    });
  }

  // Salva l'esercizio nello state (se non c'è già) e apre la lavagna tattica
  function openTacticalBoard() {
    if (!editForm) return;
    setExercises((prevExercises) => {
      const existing = prevExercises.some((e) => e.id === editForm.id);
      return existing
        ? prevExercises.map((e) => e.id === editForm.id ? editForm : e)
        : [...prevExercises, editForm];
    });
    setEditModal(false);
    navigate("/tactical-board", {
      state: { exerciseId: editForm.id, exerciseName: editForm.title },
    });
  }

  function openExerciseDetail(exercise) {
    const params = new URLSearchParams(location.search);
    params.set("exerciseId", exercise.id);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeExerciseDetail() {
    const params = new URLSearchParams(location.search);
    params.delete("exerciseId");
    const searchString = params.toString();
    navigate(
      { pathname: location.pathname, search: searchString ? `?${searchString}` : "" },
      { replace: true }
    );
    setDetailExercise(null);
  }

  function openExerciseInTraining(exercise) {
    const block = exercise.trainingBlock || getBlockFromCategory(exercise.category);
    navigate("/trainings", {
      state: {
        draftTraining: {
          title: exercise.title ? `Seduta - ${exercise.title}` : "Nuova seduta",
          theme: block || exercise.category || "Tecnica",
          objective: exercise.objective || exercise.goal || "",
          exercises: [{
            exerciseId: exercise.id,
            customDuration: exercise.duration || 15,
            customPlayers: exercise.players || "",
            variantNotes: exercise.variants || "",
          }],
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.exerciseLibrary.title")}
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
          📚 Catalogo tecnico
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
              <DarkSelect label="Blocco"      value={filters.block}     options={catOptions.blocks}        onChange={(v) => setFilters({ ...filters, block: v })} />
              <DarkSelect label="Categoria"   value={filters.category}  options={catOptions.categories}    onChange={(v) => setFilters({ ...filters, category: v })} />
              <DarkSelect label="Tipologia"   value={filters.phase}     options={catOptions.phases}        onChange={(v) => setFilters({ ...filters, phase: v })} />
              <DarkSelect label="Intensità"   value={filters.intensity} options={catOptions.intensities}   onChange={(v) => setFilters({ ...filters, intensity: v })} />
              <DarkSelect label="Giocatori"   value={filters.players}   options={catOptions.playerBuckets} onChange={(v) => setFilters({ ...filters, players: v })} />
              <DarkSelect label="Età"         value={filters.ageGroup}  options={catOptions.ageGroups}     onChange={(v) => setFilters({ ...filters, ageGroup: v })} />
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="blue">{filteredCatalog.length} esercizi</Badge>
              {!premiumUnlocked && <Badge tone="orange">🔒 Dettagli riservati agli abbonati Premium</Badge>}
              {isOwner && <Badge tone="green">✏️ Modalità admin</Badge>}
              {/* Reset filtri */}
              {(filters.category !== "Tutte" || filters.phase !== "Tutte" || filters.intensity !== "Tutte" || filters.players !== "Tutti" || filters.ageGroup !== "Tutte" || filters.block !== "Tutti" || search) && (
                <button
                  onClick={() => { setFilters(filterDefaults); setSearch(""); }}
                  style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 12, cursor: "pointer", padding: "2px 6px" }}
                >
                  ✕ Reset filtri
                </button>
              )}
              {/* Selezione dimensione pagina */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Per pagina:</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {PAGE_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setPageSize(s); setPage(1); }}
                      style={{
                        padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                        border: pageSize === s ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
                        background: pageSize === s ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                        color: pageSize === s ? "#38bdf8" : "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
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
            <>
            <div style={libStyles.grid}>
              {catalogSlice.map((ex) => {
                const isExpanded = expandedId === ex.id;
                const locked = !premiumUnlocked;

                return (
                  <AppCard key={ex.id}>
                    {/* ── Anteprima disegno: sempre visibile per FP5; locked/premium per altri ── */}
                    {(() => {
                      const isFp5 = ex.source === "fp5";
                      const hasDiagram = isFp5 || ex.tacticalBoard || ex.image;
                      if (!hasDiagram) return null;

                      const svgMarkup = isFp5 ? exImage(ex) : null;
                      const openLightbox = () => {
                        if (isFp5 && svgMarkup) {
                          setLightboxSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`);
                        } else {
                          setLightboxSrc(ex.image || null);
                        }
                      };

                      if (locked) {
                        return (
                          <div style={{ ...libStyles.thumb, width: "100%", height: 80, marginBottom: 14, cursor: "default", borderRadius: 10, overflow: "hidden" }}>
                            {svgMarkup
                              ? <div dangerouslySetInnerHTML={{ __html: svgMarkup }} style={{ width: "100%", height: "100%", filter: "blur(1px) brightness(0.6)", pointerEvents: "none" }} />
                              : <img src={ex.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            <div style={libStyles.thumbOverlay}>🔒</div>
                          </div>
                        );
                      }

                      return (
                        <div
                          style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", cursor: "zoom-in", position: "relative" }}
                          onClick={openLightbox}
                          title="Clicca per ingrandire"
                        >
                          {ex.tacticalBoard
                            ? <TacticalMiniPreview board={ex.tacticalBoard} height={180} />
                            : svgMarkup
                              ? <div dangerouslySetInnerHTML={{ __html: svgMarkup }} style={{ width: "100%", lineHeight: 0 }} />
                              : <TacticalMiniPreview imageSrc={ex.image} height={180} />}
                          <span style={{
                            position: "absolute", bottom: 8, right: 8,
                            background: "rgba(0,0,0,0.5)", color: "white",
                            fontSize: 11, padding: "2px 7px", borderRadius: 8,
                          }}>
                            🔍 Ingrandisci
                          </span>
                        </div>
                      );
                    })()}

                    {/* Header titolo/badge */}
                    <div style={libStyles.cardHead}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          {(() => {
                            const block = ex.trainingBlock || getBlockFromCategory(ex.category);
                            const blockDef = TRAINING_BLOCKS.find((b) => b.id === block);
                            return blockDef ? <Badge tone={blockDef.color}>{blockDef.icon} {block}</Badge> : null;
                          })()}
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
                        {(() => {
                          const desc = exDesc(ex);
                          if (!desc) return null;
                          // Format multi-line methodology (Obiettivo / Organizzazione / Svolgimento / Regole / Coaching points)
                          const lines = desc.split("\n").filter(Boolean);
                          const isMultiline = lines.length > 1;
                          const renderDesc = isMultiline
                            ? (
                              <div style={libStyles.methodGrid}>
                                {lines.map((line, i) => {
                                  const splitIndex = line.indexOf(":");
                                  const label = splitIndex >= 0 ? line.slice(0, splitIndex).trim() : "Nota";
                                  const body = splitIndex >= 0 ? line.slice(splitIndex + 1).trim() : line;
                                  const isObjective = label.toLowerCase() === "obiettivo";
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        ...libStyles.methodItem,
                                        ...(isObjective ? libStyles.methodItemPrimary : null),
                                      }}
                                    >
                                      <span style={libStyles.methodLabel}>{label}</span>
                                      <p style={libStyles.methodText}>{body}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                            : <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                                {isExpanded || desc.length <= 160 ? desc : `${desc.slice(0, 160)}…`}
                              </p>;
                          return (
                            <div style={{ marginTop: 12 }}>
                              {isExpanded || isMultiline ? renderDesc : renderDesc}
                              {!isMultiline && desc.length > 160 && (
                                <button onClick={() => setExpandedId(isExpanded ? null : ex.id)} style={libStyles.expandBtn}>
                                  {isExpanded ? "Mostra meno ▲" : "Mostra tutto ▼"}
                                </button>
                              )}
                            </div>
                          );
                        })()}

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

                        <div style={libStyles.cardActions}>
                          <Button variant="ghost" onClick={() => openExerciseDetail(ex)}>
                            Apri scheda
                          </Button>
                          <Button variant="ghost" onClick={() => openExerciseInTraining(ex)}>
                            Usa in seduta
                          </Button>
                        </div>
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

            {/* ── Paginazione catalogo ── */}
            {pageSize !== "Tutti" && catalogTotalPages > 1 && (
              <Pagination
                page={page}
                totalPages={catalogTotalPages}
                total={filteredCatalog.length}
                pageSize={pageSize}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(catalogTotalPages, p + 1))}
                onGo={setPage}
              />
            )}
            </>
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
                text="Crea i tuoi esercizi personali oppure modifica una proposta dal Catalogo."
                action={<Button onClick={() => navigate("/exercises")}>+ Nuovo esercizio</Button>}
              />
          ) : (
            <>
            <div style={libStyles.grid}>
              {mySlice.map((ex) => (
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
                    <Button
                      variant="ghost"
                      onClick={() => navigate("/exercises", { state: { editExerciseId: ex.id } })}
                    >
                      ✏️ Modifica
                    </Button>
                  </div>
                </AppCard>
              ))}
            </div>

            {/* ── Paginazione "I miei" ── */}
            {myPageSize !== "Tutti" && myTotalPages > 1 && (
              <Pagination
                page={myPage}
                totalPages={myTotalPages}
                total={filteredMy.length}
                pageSize={myPageSize}
                onPrev={() => setMyPage((p) => Math.max(1, p - 1))}
                onNext={() => setMyPage((p) => Math.min(myTotalPages, p + 1))}
                onGo={setMyPage}
              />
            )}
            </>
          )}
        </>
      )}

      {/* ══════════════════ LIGHTBOX DISEGNO ══════════════════ */}
      {lightboxSrc && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
            display: "grid", placeItems: "center",
            cursor: "zoom-out",
          }}
          onClick={() => setLightboxSrc(null)}
        >
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}>
            <img
              src={lightboxSrc}
              alt="Diagramma tattico"
              style={{ display: "block", maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" }}
            />
          </div>
          <p style={{ position: "absolute", bottom: 24, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            Clicca per chiudere
          </p>
        </div>
      )}

      {detailExercise && (
        <ExerciseDetailModal
          exercise={detailExercise}
          onClose={closeExerciseDetail}
          onUseInTraining={openExerciseInTraining}
          onOpenLightbox={(src) => setLightboxSrc(src)}
        />
      )}

      {/* ══════════════════ MODAL MODIFICA (owner) ══════════════════ */}
      {editModal && editForm && (
        <Modal
          title={editIsNew ? "Nuovo esercizio nel catalogo" : `Modifica: ${editForm.title}`}
          onClose={() => { setEditModal(false); setEditForm(null); }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {/* Anteprima disegno corrente */}
            {(editForm.tacticalBoard || editForm.image) && (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Disegno tattico
                </p>
                <div
                  style={{ borderRadius: 12, overflow: "hidden", cursor: "zoom-in", position: "relative" }}
                  onClick={() => setLightboxSrc(editForm.image || null)}
                >
                  <TacticalMiniPreview
                    board={editForm.tacticalBoard || null}
                    imageSrc={editForm.image || null}
                    height={200}
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={openTacticalBoard}
                  style={{ marginTop: 8, width: "100%" }}
                >
                  🎨 Modifica nella Lavagna Tattica
                </Button>
              </div>
            )}

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

function parseMethodology(desc = "") {
  return desc
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const splitIndex = line.indexOf(":");
      if (splitIndex < 0) return { label: "Nota", body: line };
      return {
        label: line.slice(0, splitIndex).trim(),
        body: line.slice(splitIndex + 1).trim(),
      };
    });
}

function ExerciseDetailModal({ exercise, onClose, onUseInTraining, onOpenLightbox }) {
  const desc = exDesc(exercise);
  const sections = parseMethodology(desc);
  const progressions = getExerciseProgressions(exercise);
  const svgMarkup = exercise.source === "fp5" ? exImage(exercise) : null;
  const block = exercise.trainingBlock || getBlockFromCategory(exercise.category);
  const blockDef = TRAINING_BLOCKS.find((item) => item.id === block);
  const lightboxSrc = svgMarkup
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
    : exercise.image || null;

  return (
    <Modal title={exercise.title || "Scheda esercizio"} onClose={onClose}>
      <div style={libStyles.detailShell}>
        <div style={libStyles.detailHero}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {blockDef && <Badge tone={blockDef.color}>{blockDef.icon} {block}</Badge>}
            {exercise.category && <Badge tone="blue">{exercise.category}</Badge>}
            {exercise.intensity && (
              <Badge tone={exercise.intensity === "Alta" ? "red" : exercise.intensity === "Bassa" ? "blue" : "default"}>
                {exercise.intensity}
              </Badge>
            )}
            {exercise.phase && <Badge tone="default">{exercise.phase}</Badge>}
          </div>
          <h2 style={libStyles.detailTitle}>{exercise.title}</h2>
          <p style={libStyles.detailSubtitle}>
            {exercise.objective || exercise.goal || "Scheda metodologica pronta per la seduta."}
          </p>
          <div style={libStyles.detailActions}>
            <Button onClick={() => onUseInTraining(exercise)}>Usa in seduta</Button>
            {lightboxSrc && (
              <Button variant="ghost" onClick={() => onOpenLightbox(lightboxSrc)}>
                Ingrandisci diagramma
              </Button>
            )}
          </div>
        </div>

        <div style={libStyles.detailGrid}>
          <div style={libStyles.detailDiagramCard}>
            <p style={libStyles.detailSectionKicker}>Diagramma tattico</p>
            <div style={libStyles.detailDiagram} onClick={() => lightboxSrc && onOpenLightbox(lightboxSrc)}>
              {exercise.tacticalBoard ? (
                <TacticalMiniPreview board={exercise.tacticalBoard} height={320} />
              ) : svgMarkup ? (
                <div dangerouslySetInnerHTML={{ __html: svgMarkup }} style={{ width: "100%", lineHeight: 0 }} />
              ) : exercise.image ? (
                <TacticalMiniPreview imageSrc={exercise.image} height={320} />
              ) : (
                <div style={libStyles.detailEmptyDiagram}>Nessun diagramma disponibile</div>
              )}
            </div>
          </div>

          <div style={libStyles.detailSide}>
            <p style={libStyles.detailSectionKicker}>Dati operativi</p>
            <div style={libStyles.detailInfoGrid}>
              {exercise.duration && <InfoChip label="Durata" value={`${exercise.duration} min`} />}
              {exercise.players && <InfoChip label="Giocatori" value={exercise.players} />}
              {exercise.fieldSize && <InfoChip label="Campo" value={exercise.fieldSize} />}
              {exercise.material && <InfoChip label="Materiale" value={exercise.material} />}
              {exercise.ageGroup && <InfoChip label="Età" value={exercise.ageGroup} />}
              {exercise.rpe && <InfoChip label="RPE" value={exercise.rpe} />}
            </div>
            {(exercise.tags || []).length > 0 && (
              <div style={libStyles.detailTags}>
                {(exercise.tags || []).map((tag) => <span key={tag} style={libStyles.tag}>{tag}</span>)}
              </div>
            )}
          </div>
        </div>

        <div style={libStyles.detailMethodology}>
          <p style={libStyles.detailSectionKicker}>Scheda tecnica</p>
          <div style={libStyles.detailMethodGrid}>
            {sections.map((section, index) => {
              const isObjective = section.label.toLowerCase() === "obiettivo";
              return (
                <div
                  key={`${section.label}-${index}`}
                  style={{
                    ...libStyles.methodItem,
                    ...(isObjective ? libStyles.methodItemPrimary : null),
                  }}
                >
                  <span style={libStyles.methodLabel}>{section.label}</span>
                  <p style={libStyles.methodText}>{section.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div style={libStyles.detailProgression}>
          <p style={libStyles.detailSectionKicker}>Progressione didattica</p>
          <div style={libStyles.progressionGrid}>
            {progressions.map((item, index) => (
              <div key={item.level} style={libStyles.progressionCard}>
                <div style={libStyles.progressionTop}>
                  <span style={libStyles.progressionIndex}>{index + 1}</span>
                  <span style={libStyles.progressionLevel}>{item.level}</span>
                </div>
                <h3 style={libStyles.progressionTitle}>{item.title}</h3>
                <p style={libStyles.progressionText}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {exercise.variants && (
          <div style={libStyles.detailVariant}>
            <p style={libStyles.detailSectionKicker}>Varianti e progressioni</p>
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6, fontSize: 14 }}>{exercise.variants}</p>
          </div>
        )}
      </div>
    </Modal>
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

function Pagination({ page, totalPages, total, pageSize, onPrev, onNext, onGo }) {
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Genera range di pagine da mostrare (max 7 bottoni)
  function pageRange() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 12,
      padding: "14px 18px",
      borderRadius: 14,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      {/* Info range */}
      <span style={{ fontSize: 13, color: "#64748b" }}>
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{from}–{to}</span>
        {" "}di{" "}
        <span style={{ color: "#94a3b8", fontWeight: 600 }}>{total}</span>
        {" "}esercizi
      </span>

      {/* Bottoni pagina */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <PagBtn onClick={onPrev} disabled={page === 1}>‹</PagBtn>
        {pageRange().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "#475569", fontSize: 13 }}>…</span>
          ) : (
            <PagBtn key={p} active={p === page} onClick={() => onGo(p)}>{p}</PagBtn>
          )
        )}
        <PagBtn onClick={onNext} disabled={page === totalPages}>›</PagBtn>
      </div>
    </div>
  );
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34, height: 34, padding: "0 8px",
        borderRadius: 9,
        border: active ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.08)",
        background: active ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.04)",
        color: active ? "#38bdf8" : disabled ? "#334155" : "#94a3b8",
        fontSize: 14, fontWeight: active ? 700 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all .12s",
        display: "grid", placeItems: "center",
      }}
    >
      {children}
    </button>
  );
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
    gridTemplateColumns: "1.6fr repeat(6, minmax(100px, 1fr))",
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
  cardActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  methodGrid: {
    display: "grid",
    gap: 8,
  },
  methodItem: {
    padding: "9px 11px",
    borderRadius: 10,
    background: "rgba(15,23,42,0.62)",
    border: "1px solid rgba(148,163,184,0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  },
  methodItemPrimary: {
    background: "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(15,23,42,0.72))",
    border: "1px solid rgba(56,189,248,0.22)",
  },
  methodLabel: {
    display: "block",
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0,
    color: "#7dd3fc",
    textTransform: "uppercase",
  },
  methodText: {
    margin: 0,
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.55,
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
  detailShell: {
    display: "grid",
    gap: 18,
    maxWidth: 1100,
  },
  detailHero: {
    padding: "18px 18px 16px",
    borderRadius: 16,
    background: "linear-gradient(135deg, rgba(14,165,233,0.16), rgba(15,23,42,0.88))",
    border: "1px solid rgba(56,189,248,0.22)",
  },
  detailTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
    fontSize: 28,
    lineHeight: 1.1,
    letterSpacing: 0,
  },
  detailSubtitle: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.55,
    fontSize: 15,
    maxWidth: 820,
  },
  detailActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)",
    gap: 16,
  },
  detailDiagramCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  detailDiagram: {
    borderRadius: 14,
    overflow: "hidden",
    background: "#0f2518",
    cursor: "zoom-in",
  },
  detailEmptyDiagram: {
    minHeight: 260,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    border: "1px dashed rgba(148,163,184,0.25)",
    borderRadius: 14,
  },
  detailSide: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.14)",
    alignSelf: "start",
  },
  detailInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
    gap: 8,
  },
  detailTags: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 12,
  },
  detailMethodology: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  detailMethodGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 10,
  },
  detailVariant: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(251,191,36,0.07)",
    border: "1px solid rgba(251,191,36,0.2)",
  },
  detailProgression: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  progressionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  progressionCard: {
    padding: 13,
    borderRadius: 14,
    background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(15,23,42,0.72))",
    border: "1px solid rgba(255,255,255,0.09)",
    minHeight: 158,
  },
  progressionTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
  },
  progressionIndex: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.15)",
    border: "1px solid rgba(56,189,248,0.25)",
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 950,
  },
  progressionLevel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  progressionTitle: {
    margin: "0 0 7px",
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.25,
  },
  progressionText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.55,
  },
  detailSectionKicker: {
    margin: "0 0 10px",
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
};
