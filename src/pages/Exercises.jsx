import { useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";

import { styles } from "../styles/index.js";
import { emptyExercise } from "../data/initialData";
import { createId } from "../utils/helpers";

function Exercises({ exercises, setExercises }) {
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    ...emptyExercise(),
    intensity: "Media",
  });

  const filteredExercises = exercises.filter((exercise) =>
    `${exercise.title} ${exercise.category} ${exercise.objective}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function handleImageUpload(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        image: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  }

  function saveExercise() {
    if (!form.title.trim()) {
      return alert("Inserisci il titolo esercizio");
    }

    const payload = {
      ...form,
      id: editingId || createId("exercise"),
    };

    if (editingId) {
      setExercises(
        exercises.map((exercise) =>
          exercise.id === editingId ? payload : exercise
        )
      );
    } else {
      setExercises([...exercises, payload]);
    }

    setEditingId(null);
    setOpenModal(false);

    setForm({
      ...emptyExercise(),
      intensity: "Media",
    });
  }

  function editExercise(exercise) {
    setEditingId(exercise.id);
    setForm(exercise);
    setOpenModal(true);
  }

  function deleteExercise(id) {
    if (!confirm("Vuoi eliminare questo esercizio?")) return;

    setExercises(exercises.filter((exercise) => exercise.id !== id));
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Libreria Esercizi"
        subtitle="Archivio esercizi tecnico-tattici della stagione"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cerca esercizio..."
        />

        <div style={{ display: "flex", gap: 12 }}>
          <Badge tone="blue">
            {exercises.length} esercizi
          </Badge>

          <Button onClick={() => setOpenModal(true)}>
            + Nuovo esercizio
          </Button>
        </div>
      </div>

      {filteredExercises.length === 0 ? (
        <EmptyState
          icon="⚽"
          title="Nessun esercizio trovato"
          text="Crea il primo esercizio della libreria."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
            gap: 22,
          }}
        >
          {filteredExercises.map((exercise) => (
            <AppCard key={exercise.id}>
              {exercise.image && (
                <div
                  style={{
                    marginBottom: 18,
                    borderRadius: 18,
                    overflow: "hidden",
                    height: 180,
                  }}
                >
                  <img
                    src={exercise.image}
                    alt={exercise.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>{exercise.title}</h3>

                  <p
                    style={{
                      color: "#94a3b8",
                      margin: "6px 0 0",
                    }}
                  >
                    {exercise.category || "Categoria"} ·{" "}
                    {exercise.level || "Livello"}
                  </p>
                </div>

                <Badge
                  tone={
                    exercise.intensity === "Alta"
                      ? "red"
                      : exercise.intensity === "Media"
                      ? "orange"
                      : "green"
                  }
                >
                  {exercise.intensity || "Media"}
                </Badge>
              </div>

              <p
                style={{
                  color: "#cbd5e1",
                  lineHeight: 1.5,
                }}
              >
                {exercise.description || "Nessuna descrizione"}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                <MiniInfo label="Durata" value={`${exercise.duration || 0} min`} />
                <MiniInfo label="Giocatori" value={exercise.players || "-"} />
                <MiniInfo label="Campo" value={exercise.fieldSize || "-"} />
              </div>

              {exercise.coachingPoints && (
                <div style={{ marginTop: 18 }}>
                  <h4 style={{ marginBottom: 8 }}>Coaching points</h4>

                  <p style={{ color: "#94a3b8", lineHeight: 1.5 }}>
                    {exercise.coachingPoints}
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 22,
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => editExercise(exercise)}
                  style={{ flex: 1 }}
                >
                  Modifica
                </Button>

                <Button
                  variant="danger"
                  onClick={() => deleteExercise(exercise.id)}
                  style={{ flex: 1 }}
                >
                  Elimina
                </Button>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {openModal && (
        <Modal
          title={editingId ? "Modifica esercizio" : "Nuovo esercizio"}
          onClose={() => {
            setOpenModal(false);
            setEditingId(null);

            setForm({
              ...emptyExercise(),
              intensity: "Media",
            });
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 14,
            }}
          >
            <input
              placeholder="Titolo esercizio"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder="Categoria"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder="Durata"
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder="N. giocatori"
              value={form.players}
              onChange={(e) =>
                setForm({ ...form, players: e.target.value })
              }
              style={styles.input}
            />

            <select
              value={form.intensity}
              onChange={(e) =>
                setForm({ ...form, intensity: e.target.value })
              }
              style={styles.input}
            >
              <option>Bassa</option>
              <option>Media</option>
              <option>Alta</option>
            </select>

            <input
              placeholder="Dimensioni campo"
              value={form.fieldSize}
              onChange={(e) =>
                setForm({ ...form, fieldSize: e.target.value })
              }
              style={styles.input}
            />

            <textarea
              placeholder="Descrizione"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              style={{
                ...styles.input,
                minHeight: 100,
                gridColumn: "1 / -1",
              }}
            />

            <textarea
              placeholder="Coaching points"
              value={form.coachingPoints}
              onChange={(e) =>
                setForm({ ...form, coachingPoints: e.target.value })
              }
              style={{
                ...styles.input,
                minHeight: 100,
                gridColumn: "1 / -1",
              }}
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleImageUpload(e.target.files[0])
              }
              style={styles.input}
            />
          </div>

          {form.image && (
            <div
              style={{
                marginTop: 18,
                borderRadius: 18,
                overflow: "hidden",
                height: 220,
              }}
            >
              <img
                src={form.image}
                alt="preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 24,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => setOpenModal(false)}
            >
              Annulla
            </Button>

            <Button onClick={saveExercise}>
              {editingId ? "Aggiorna esercizio" : "Salva esercizio"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 800,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

export default Exercises;
