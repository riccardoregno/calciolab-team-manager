import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import SortableTrainingTimeline from "../components/trainings/SortableTrainingTimeline";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

import { styles } from "../styles/index.js";
import { createId, formatDate, RPE_BY_MATCH_DAY, TRAINING_BLOCKS, getBlockFromCategory } from "../utils/helpers";

function Trainings({ exercises, sessions, setSessions, players = [] }) {
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [pickerBlock, setPickerBlock] = useState("Tutti");

  // Carica catalogo FP5 in background
  const [fp5Catalog, setFp5Catalog] = useState([]);
  useEffect(() => {
    import("../data/eserciziarioFp5.js")
      .then(({ eserciziarioFp5 }) => setFp5Catalog(eserciziarioFp5))
      .catch(() => {});
  }, []);

  // Merge: esercizi personali + FP5 (personali hanno precedenza)
  const allExercises = useMemo(() => {
    const personalIds = new Set((exercises || []).map((e) => e.id));
    const fp5Only = fp5Catalog.filter((e) => !personalIds.has(e.id));
    return [...(exercises || []), ...fp5Only];
  }, [exercises, fp5Catalog]);

  const [form, setForm] = useState(emptyTraining());

  // RPE calcolato dalla distanza dalla gara
  const rpeTarget = RPE_BY_MATCH_DAY[form.matchDayDistance] || RPE_BY_MATCH_DAY["MD-3"];

  const filteredExercises = allExercises.filter((exercise) => {
    const matchSearch = `${exercise.title} ${exercise.category} ${exercise.objective}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const exBlock = exercise.trainingBlock || getBlockFromCategory(exercise.category);
    const matchBlock = pickerBlock === "Tutti" || exBlock === pickerBlock;
    return matchSearch && matchBlock;
  });

  const selectedExercises = useMemo(() => {
    return form.exercises.map((item) => {
      const exercise = allExercises.find((ex) => ex.id === item.exerciseId);

      return {
        ...exercise,
        ...item,
        title: exercise?.title || "Esercizio",
        category: exercise?.category || "",
        objective: exercise?.objective || "",
        duration: exercise?.duration || item.customDuration || 0,
      };
    });
  }, [form.exercises, allExercises]);

  const totalMinutes = selectedExercises.reduce(
    (sum, item) => sum + Number(item.customDuration || item.duration || 0),
    0
  );

  function toggleExercise(exercise) {
    const alreadySelected = form.exercises.some(
      (item) => item.exerciseId === exercise.id
    );

    if (alreadySelected) {
      setForm((prev) => ({
        ...prev,
        exercises: prev.exercises.filter(
          (item) => item.exerciseId !== exercise.id
        ),
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          exerciseId: exercise.id,
          customDuration: exercise.duration || 15,
          customPlayers: exercise.players || players.length || "",
          variantNotes: "",
        },
      ],
    }));
  }

  function updateVariant(exerciseId, field, value) {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((item) =>
        item.exerciseId === exerciseId ? { ...item, [field]: value } : item
      ),
    }));
  }

  function saveTraining() {
    if (!form.title.trim()) {
      showToast("Inserisci il titolo della seduta", "warn");
      return;
    }

    const payload = {
      ...form,
      id: editingId || createId("session"),
      duration: totalMinutes,
    };

    if (editingId) {
      setSessions(
        sessions.map((session) =>
          session.id === editingId ? payload : session
        )
      );
    } else {
      setSessions([...sessions, payload]);
    }

    setEditingId(null);
    setForm(emptyTraining());
    showToast(editingId ? "Seduta aggiornata" : "Seduta salvata", "ok");
  }

  function editTraining(session) {
    setEditingId(session.id);

    setForm({
      title: session.title || "",
      date: session.date || new Date().toISOString().slice(0, 10),
      type: session.type || "Allenamento",
      theme: session.theme || "Costruzione",
      matchDayDistance: session.matchDayDistance || "MD-3",
      objective: session.objective || "",
      notes: session.notes || "",
      exercises: session.exercises || [],
      attendance: session.attendance || {},
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteTraining(id) {
    setConfirmState({
      message: "Vuoi eliminare questa seduta?",
      confirmLabel: "Elimina",
      confirmTone: "red",
      onConfirm: () => {
        setSessions(sessions.filter((session) => session.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setForm(emptyTraining());
        }
        showToast("Seduta eliminata", "info");
      },
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyTraining());
  }

  return (
    <div style={styles.page}>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <ToastContainer />
      <PageHeader
        title="Sedute"
        subtitle="Costruisci allenamenti, ordina esercizi e gestisci il carico della squadra"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => navigate("/exports")}>PDF seduta</Button>
            <Button onClick={() => navigate("/ai-session-builder")}>Genera con AI</Button>
          </div>
        }
      />

      <div
        className="calciolab-two-column"
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <div className="print-area">
  <AppCard>
    {/* 👇 SOLO PER PDF */}
    <div className="print-only" style={trainingStyles.sessionSummary}>
      <div>
        <span style={trainingStyles.summaryEyebrow}>Seduta</span>
        <h1 style={trainingStyles.summaryTitle}>{form.title || "Seduta da costruire"}</h1>
      </div>

      <div style={trainingStyles.summaryGrid}>
        <SessionMeta label="Data" value={formatDate(form.date)} />
        <SessionMeta label="Tema" value={form.theme} />
        <SessionMeta label="Obiettivo" value={form.objective || "Da definire"} />
        <SessionMeta label="Durata" value={`${totalMinutes} min`} />
      </div>

      {form.notes && (
        <div style={trainingStyles.summaryNotes}>
          <strong>Note staff</strong>
          <span>{form.notes}</span>
        </div>
      )}
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={trainingStyles.stepHeader}>
          <span style={trainingStyles.stepBadge}>1</span>
          <span>Dati seduta</span>
        </div>
        <h3 style={{ margin: 0, lineHeight: 1.2 }}>
          {editingId ? "Modifica seduta" : "Crea seduta"}
        </h3>
        <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
          Inserisci dati base e scegli gli esercizi
        </p>
      </div>

      <Badge tone="blue">{totalMinutes} min</Badge>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 14,
      }}
    >
      <input
        placeholder="Titolo seduta"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        style={styles.input}
      />

      <input
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
        style={styles.input}
      />

      <select
        value={form.theme}
        onChange={(e) => setForm({ ...form, theme: e.target.value })}
        style={styles.input}
      >
        <option>Costruzione</option>
        <option>Possesso</option>
        <option>Pressing</option>
        <option>Transizione</option>
        <option>Finalizzazione</option>
        <option>Fase difensiva</option>
        <option>Palla inattiva</option>
      </select>

      <select
        value={form.matchDayDistance}
        onChange={(e) => setForm({ ...form, matchDayDistance: e.target.value })}
        style={styles.input}
        title="Distanza dalla prossima partita"
      >
        <option value="MD+1">MD+1 — Post-gara</option>
        <option value="MD-4">MD-4 — Carico moderato</option>
        <option value="MD-3">MD-3 — Picco di carico</option>
        <option value="MD-2">MD-2 — Carico medio</option>
        <option value="MD-1">MD-1 — Pre-gara</option>
      </select>

      <input
        placeholder="Obiettivo"
        value={form.objective}
        onChange={(e) => setForm({ ...form, objective: e.target.value })}
        style={styles.input}
      />

      <textarea
        placeholder="Note"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        style={{
          ...styles.input,
          minHeight: 44,
          resize: "vertical",
        }}
      />
    </div>

    {/* Pannello RPE — distanza dalla gara */}
    <RpePanel rpe={rpeTarget} md={form.matchDayDistance} />

    {/* Giocatori disponibili per questa seduta */}
    {players.length > 0 && (
      <AvailablePlayers players={players} />
    )}
  </AppCard>
</div>

          <AppCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={trainingStyles.stepHeader}>
                  <span style={trainingStyles.stepBadge}>2</span>
                  <span>Esercizi</span>
                </div>
                <h3 style={{ margin: 0, lineHeight: 1.2 }}>Libreria esercizi</h3>
                <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
                  Clicca per aggiungere o rimuovere esercizi dalla seduta
                </p>
              </div>

              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Cerca esercizio..."
              />
            </div>

            {/* Filtro per Training Block */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <BlockBtn active={pickerBlock === "Tutti"} onClick={() => setPickerBlock("Tutti")} color="default">
                Tutti
              </BlockBtn>
              {TRAINING_BLOCKS.map((b) => (
                <BlockBtn key={b.id} active={pickerBlock === b.id} onClick={() => setPickerBlock(b.id)} color={b.color}>
                  {b.icon} {b.id}
                </BlockBtn>
              ))}
            </div>

            {filteredExercises.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="Nessun esercizio trovato"
                text="Crea esercizi nella libreria prima di costruire la seduta."
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 12,
                }}
              >
                {filteredExercises.map((exercise) => {
                  const selected = form.exercises.some(
                    (item) => item.exerciseId === exercise.id
                  );

                  return (
                    <button
                      key={exercise.id}
                      onClick={() => toggleExercise(exercise)}
                      style={{
                        borderRadius: 12,
                        padding: 14,
                        textAlign: "left",
                        cursor: "pointer",
                        color: "white",
                        background: selected
                          ? "rgba(56,189,248,0.16)"
                          : "rgba(255,255,255,0.045)",
                        border: selected
                          ? "1px solid rgba(56,189,248,0.35)"
                          : "1px solid rgba(255,255,255,0.08)",
                        minHeight: 100,
                      }}
                    >
                      {/* Block badge */}
                      {(() => {
                        const blk = exercise.trainingBlock || getBlockFromCategory(exercise.category);
                        const blkDef = TRAINING_BLOCKS.find((b) => b.id === blk);
                        return blkDef ? (
                          <span style={{
                            display: "inline-block", marginBottom: 6,
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: "rgba(255,255,255,0.07)", color: "#94a3b8",
                          }}>
                            {blkDef.icon} {blk}
                          </span>
                        ) : null;
                      })()}

                      <strong style={{ display: "block", lineHeight: 1.25, fontSize: 13 }}>
                        {exercise.title}
                      </strong>

                      <p style={{ color: "#94a3b8", margin: "6px 0", fontSize: 12, lineHeight: 1.3 }}>
                        {exercise.category || "Categoria"}
                      </p>

                      <Badge tone={selected ? "green" : "purple"}>
                        {selected ? "✓ Selezionato" : "+ Aggiungi"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </AppCard>

          {selectedExercises.length > 0 && (
            <AppCard>
              <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>Varianti esercizi</h3>

              <div style={{ display: "grid", gap: 12 }}>
                {selectedExercises.map((item) => (
                  <div
                    key={item.exerciseId}
                    className="training-variant-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 100px 100px 1fr",
                      gap: 12,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <strong>{item.title}</strong>

                    <input
                      type="number"
                      min="1"
                      value={item.customDuration}
                      onChange={(e) =>
                        updateVariant(
                          item.exerciseId,
                          "customDuration",
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />

                    <input
                      type="number"
                      min="1"
                      value={item.customPlayers}
                      onChange={(e) =>
                        updateVariant(
                          item.exerciseId,
                          "customPlayers",
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />

                    <input
                      placeholder="Note variante"
                      value={item.variantNotes}
                      onChange={(e) =>
                        updateVariant(
                          item.exerciseId,
                          "variantNotes",
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />
                  </div>
                ))}
              </div>
            </AppCard>
          )}
        </div>

       <div style={{ display: "grid", gap: 20 }}>
  <AppCard style={{ marginTop: 20 }}>
    <div style={trainingStyles.stepHeader}>
      <span style={trainingStyles.stepBadge}>3</span>
      <span>Timeline</span>
    </div>
    <SortableTrainingTimeline
    exercises={selectedExercises}
    onReorder={(ordered) => {
      setForm((prev) => ({
        ...prev,
        exercises: ordered.map((item) => ({
          exerciseId: item.exerciseId,
          customDuration: item.customDuration,
          customPlayers: item.customPlayers,
          variantNotes: item.variantNotes || "",
        })),
      }));
    }}
  />
</AppCard>

          <AppCard>
            <div style={trainingStyles.stepHeader}>
              <span style={trainingStyles.stepBadge}>4</span>
              <span>Anteprima</span>
            </div>
            <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>Anteprima</h3>

            <h2 style={{ marginBottom: 8, lineHeight: 1.1 }}>
              {form.title || "Titolo non inserito"}
            </h2>

            <p style={{ color: "#94a3b8", lineHeight: 1.45 }}>
              {formatDate(form.date)} · {form.theme} · {totalMinutes} min
            </p>

            {form.objective && (
              <p style={{ color: "#cbd5e1" }}>{form.objective}</p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              {editingId && (
                <Button variant="ghost" onClick={cancelEdit}>
                  Annulla
                </Button>
              )}

              <Button onClick={saveTraining}>
                {editingId ? "Aggiorna seduta" : "Salva seduta"}
              </Button>
              <Button variant="ghost" onClick={() => navigate("/exports")}>
                Esporta PDF
              </Button>
            </div>
          </AppCard>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <AppCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ margin: 0, lineHeight: 1.2 }}>Sedute salvate</h3>
              <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
                Archivio allenamenti creati
              </p>
            </div>

            <Badge tone="blue">{sessions.length} sedute</Badge>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Nessuna seduta salvata"
              text="Crea la prima seduta per iniziare la pianificazione."
            />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {sessions.map((session) => {
                const sessionTotal = (session.exercises || []).reduce(
                  (sum, item) => sum + Number(item.customDuration || 0),
                  0
                );

                return (
                  <div
                    key={session.id}
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      background:
                        editingId === session.id
                          ? "rgba(56,189,248,0.12)"
                          : "rgba(255,255,255,0.045)",
                      border:
                        editingId === session.id
                          ? "1px solid rgba(56,189,248,0.35)"
                          : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0, lineHeight: 1.2 }}>{session.title}</h3>

                        <p style={{ color: "#94a3b8", margin: "8px 0", lineHeight: 1.4 }}>
                          {formatDate(session.date)} · {session.theme} ·{" "}
                          {sessionTotal} min
                        </p>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {(session.exercises || []).map((item, index) => {
                            const exercise = exercises.find(
                              (ex) => ex.id === item.exerciseId
                            );

                            return (
                              <Badge key={`${item.exerciseId}-${index}`} tone="purple">
                                {exercise?.title || "Esercizio"} ·{" "}
                                {item.customDuration} min
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/session-attendance/${session.id}`)}
                        >
                          Presenze
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() => editTraining(session)}
                        >
                          Modifica
                        </Button>

                        <Button
                          variant="danger"
                          onClick={() => deleteTraining(session.id)}
                        >
                          Elimina
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>
      </div>
    </div>
  );
}

function emptyTraining() {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    type: "Allenamento",
    theme: "Costruzione",
    matchDayDistance: "MD-3",
    objective: "",
    notes: "",
    exercises: [],
    attendance: {},
  };
}

function SessionMeta({ label, value }) {
  return (
    <div style={trainingStyles.metaPill}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ─────────────────────────────────────────────
// Box giocatori disponibili nel form seduta
// ─────────────────────────────────────────────
const UNAVAILABLE_STATUSES = ["Infortunato", "Squalificato"];

function AvailablePlayers({ players }) {
  const available = players.filter(
    (p) => !UNAVAILABLE_STATUSES.includes(p.status || "Disponibile")
  );
  const unavailable = players.filter(
    (p) => UNAVAILABLE_STATUSES.includes(p.status || "Disponibile")
  );

  return (
    <div style={{
      marginTop: 16,
      paddingTop: 16,
      borderTop: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Giocatori disponibili
        </h4>
        <span style={{
          fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
          background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e",
        }}>
          {available.length} / {players.length}
        </span>
        {unavailable.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
            background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171",
          }}>
            {unavailable.length} non disponibili
          </span>
        )}
      </div>

      {/* Chip disponibili */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {available.map((p) => {
          const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
          return (
            <span key={p.id} style={{
              fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
              background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac",
            }}>
              {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{name}
            </span>
          );
        })}
      </div>

      {/* Chip non disponibili */}
      {unavailable.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {unavailable.map((p) => {
            const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
            const isInjured = p.status === "Infortunato";
            return (
              <span key={p.id} title={`${p.status}${p.injuryType ? ` · ${p.injuryType}` : ""}`} style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                background: isInjured ? "rgba(248,113,113,0.08)" : "rgba(168,85,247,0.08)",
                border: isInjured ? "1px solid rgba(248,113,113,0.2)" : "1px solid rgba(168,85,247,0.2)",
                color: isInjured ? "#fca5a5" : "#d8b4fe",
                textDecoration: "line-through",
                opacity: 0.75,
              }}>
                {isInjured ? "🚑" : "🟥"} {name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RPE Panel ────────────────────────────────────────────────────────────────
function RpePanel({ rpe, md }) {
  const colorMap = {
    red:    { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "#ef4444" },
    orange: { bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.25)",  text: "#fb923c" },
    green:  { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)",   text: "#22c55e" },
    blue:   { bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.25)",  text: "#38bdf8" },
    default:{ bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "#94a3b8" },
  };
  const c = colorMap[rpe.color] || colorMap.default;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", borderRadius: 12, marginTop: 14,
      background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <div style={{ textAlign: "center", minWidth: 52 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: c.text, lineHeight: 1 }}>
          {rpe.min}–{rpe.max}
        </div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>RPE</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{rpe.label}</p>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{rpe.description} · {md}</p>
      </div>
      <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ height: "100%", width: `${(rpe.max / 10) * 100}%`, borderRadius: 3, background: c.text, transition: "width .3s" }} />
      </div>
    </div>
  );
}

// ─── BlockBtn — pulsante filtro blocco nel picker ─────────────────────────────
function BlockBtn({ active, onClick, children, color }) {
  const colorBg = {
    orange:  active ? "rgba(251,146,60,0.2)"  : "rgba(255,255,255,0.04)",
    blue:    active ? "rgba(56,189,248,0.2)"  : "rgba(255,255,255,0.04)",
    green:   active ? "rgba(34,197,94,0.2)"   : "rgba(255,255,255,0.04)",
    default: active ? "rgba(148,163,184,0.2)" : "rgba(255,255,255,0.04)",
  };
  const colorBorder = {
    orange:  active ? "rgba(251,146,60,0.4)"  : "rgba(255,255,255,0.08)",
    blue:    active ? "rgba(56,189,248,0.4)"  : "rgba(255,255,255,0.08)",
    green:   active ? "rgba(34,197,94,0.4)"   : "rgba(255,255,255,0.08)",
    default: active ? "rgba(148,163,184,0.4)" : "rgba(255,255,255,0.08)",
  };
  const colorText = {
    orange:  active ? "#fb923c" : "#64748b",
    blue:    active ? "#38bdf8" : "#64748b",
    green:   active ? "#22c55e" : "#64748b",
    default: active ? "#94a3b8" : "#64748b",
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
        border: `1px solid ${colorBorder[color] || colorBorder.default}`,
        background: colorBg[color] || colorBg.default,
        color: colorText[color] || colorText.default,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const trainingStyles = {
  sessionSummary: {
    marginBottom: 26,
    padding: 18,
    borderRadius: 16,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  summaryEyebrow: {
    display: "block",
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 6,
  },
  summaryTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.08,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))",
    gap: 10,
    marginTop: 16,
  },
  metaPill: {
    display: "grid",
    gap: 5,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  summaryNotes: {
    display: "grid",
    gap: 5,
    marginTop: 12,
    color: "#cbd5e1",
    lineHeight: 1.45,
  },
  stepHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.16)",
    border: "1px solid rgba(56,189,248,0.3)",
    color: "#bae6fd",
    fontSize: 12,
  },
};

export default Trainings;
