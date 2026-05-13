import { useMemo, useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import SortableTrainingTimeline from "../components/trainings/SortableTrainingTimeline";

import { styles } from "../styles/index.js";
import { createId, formatDate } from "../utils/helpers";

function Trainings({ exercises, sessions, setSessions, players = [] }) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(emptyTraining());

  const filteredExercises = exercises.filter((exercise) =>
    `${exercise.title} ${exercise.category} ${exercise.objective}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectedExercises = useMemo(() => {
    return form.exercises.map((item) => {
      const exercise = exercises.find((ex) => ex.id === item.exerciseId);

      return {
        ...exercise,
        ...item,
        title: exercise?.title || "Esercizio",
        category: exercise?.category || "",
        objective: exercise?.objective || "",
        duration: exercise?.duration || item.customDuration || 0,
      };
    });
  }, [form.exercises, exercises]);

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
      return alert("Inserisci il titolo della seduta");
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
  }

  function editTraining(session) {
    setEditingId(session.id);

    setForm({
      title: session.title || "",
      date: session.date || new Date().toISOString().slice(0, 10),
      type: session.type || "Allenamento",
      theme: session.theme || "Costruzione",
      objective: session.objective || "",
      notes: session.notes || "",
      exercises: session.exercises || [],
      attendance: session.attendance || {},
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteTraining(id) {
    if (!confirm("Vuoi eliminare questa seduta?")) return;

    setSessions(sessions.filter((session) => session.id !== id));

    if (editingId === id) {
      setEditingId(null);
      setForm(emptyTraining());
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyTraining());
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Sedute"
        subtitle="Costruisci allenamenti, ordina esercizi e gestisci il carico della squadra"
      />

      <div
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
 <div className="print-only" style={{ marginBottom: 30 }}>
  <h1 style={{ margin: 0 }}>{form.title || "Seduta"}</h1>

  <div style={{ marginTop: 10, fontSize: 14 }}>
    <div><strong>Data:</strong> {form.date}</div>
    <div><strong>Tema:</strong> {form.theme}</div>
    <div><strong>Obiettivo:</strong> {form.objective}</div>
    <div><strong>Durata:</strong> {totalMinutes} min</div>
  </div>

  {form.notes && (
    <div style={{ marginTop: 10 }}>
      <strong>Note:</strong> {form.notes}
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
        <h3 style={{ margin: 0 }}>
          {editingId ? "Modifica seduta" : "Crea seduta"}
        </h3>
        <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
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
                <h3 style={{ margin: 0 }}>Libreria esercizi</h3>
                <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
                  Clicca per aggiungere o rimuovere esercizi dalla seduta
                </p>
              </div>

              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Cerca esercizio..."
              />
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
                        borderRadius: 18,
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
                      }}
                    >
                      <strong>{exercise.title}</strong>

                      <p
                        style={{
                          color: "#94a3b8",
                          margin: "8px 0",
                          fontSize: 13,
                        }}
                      >
                        {exercise.category || "Categoria"} ·{" "}
                        {exercise.duration || 0} min
                      </p>

                      <Badge tone={selected ? "green" : "purple"}>
                        {selected ? "Selezionato" : "Aggiungi"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </AppCard>

          {selectedExercises.length > 0 && (
            <AppCard>
              <h3 style={{ marginTop: 0 }}>Varianti esercizi</h3>

              <div style={{ display: "grid", gap: 12 }}>
                {selectedExercises.map((item) => (
                  <div
                    key={item.exerciseId}
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
            <h3 style={{ marginTop: 0 }}>Anteprima</h3>

            <h2 style={{ marginBottom: 8 }}>
              {form.title || "Titolo non inserito"}
            </h2>

            <p style={{ color: "#94a3b8" }}>
              {formatDate(form.date)} · {form.theme} · {totalMinutes} min
            </p>

            {form.objective && (
              <p style={{ color: "#cbd5e1" }}>{form.objective}</p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {editingId && (
                <Button variant="ghost" onClick={cancelEdit}>
                  Annulla
                </Button>
              )}

              <Button onClick={saveTraining}>
                {editingId ? "Aggiorna seduta" : "Salva seduta"}
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
              <h3 style={{ margin: 0 }}>Sedute salvate</h3>
              <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
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
                      borderRadius: 20,
                      padding: 18,
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
                        <h3 style={{ margin: 0 }}>{session.title}</h3>

                        <p style={{ color: "#94a3b8", margin: "8px 0" }}>
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

                      <div style={{ display: "flex", gap: 10 }}>
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
    objective: "",
    notes: "",
    exercises: [],
    attendance: {},
  };
}

export default Trainings;
