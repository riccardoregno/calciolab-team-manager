import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    ...emptyExercise(),
    intensity: "Media",
  });

  // Quando si torna dalla lavagna con un esercizio già creato, apri direttamente
  // la modale in modalità modifica per completare i dettagli
  useEffect(() => {
    const fromBoard = location.state?.fromBoard;
    if (!fromBoard?.exerciseId) return;

    const ex = exercises.find((e) => e.id === fromBoard.exerciseId);
    if (ex) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingId(ex.id);
      setForm(ex);
      setOpenModal(true);
      // Pulisce lo state per evitare re-apertura al refresh
      window.history.replaceState({}, "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
              {/* Anteprima lavagna tattica */}
              {exercise.tacticalBoard && (
                <div style={{ marginBottom: 18, borderRadius: 14, overflow: "hidden", position: "relative" }}>
                  <TacticalMiniPreview board={exercise.tacticalBoard} />
                  <button
                    type="button"
                    onClick={() => navigate("/tactical-board", {
                      state: { exerciseId: exercise.id, exerciseName: exercise.title },
                    })}
                    style={exCardStyles.editBoardBtn}
                    title="Modifica disegno nella lavagna tattica"
                  >
                    ✏️ Modifica disegno
                  </button>
                </div>
              )}

              {/* Immagine caricata (se non c'è la lavagna) */}
              {!exercise.tacticalBoard && exercise.image && (
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

              <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  onClick={() => editExercise(exercise)}
                  style={{ flex: 1, minWidth: 90 }}
                >
                  Modifica
                </Button>

                {/* Disegno nella lavagna */}
                {!exercise.tacticalBoard ? (
                  <button
                    type="button"
                    onClick={() => navigate("/tactical-board", {
                      state: { exerciseId: exercise.id, exerciseName: exercise.title },
                    })}
                    style={exCardStyles.addBoardBtn}
                    title="Crea un disegno tattico per questo esercizio"
                  >
                    🖊️ Aggiungi disegno
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      // rimuove il disegno
                      if (!confirm("Vuoi rimuovere il disegno tattico da questo esercizio?")) return;
                      setExercises(exercises.map((ex) =>
                        ex.id === exercise.id ? { ...ex, tacticalBoard: undefined } : ex
                      ));
                    }}
                    style={{ ...exCardStyles.addBoardBtn, borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5", background: "rgba(239,68,68,0.08)" }}
                  >
                    🗑 Rimuovi disegno
                  </button>
                )}

                <Button
                  variant="danger"
                  onClick={() => deleteExercise(exercise.id)}
                  style={{ flex: 1, minWidth: 80 }}
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

            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ ...styles.input, cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                📷 Carica immagine
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleImageUpload(e.target.files[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  // Prima salva l'esercizio, poi naviga alla lavagna
                  const name = form.title.trim();
                  if (!name) { alert("Inserisci prima il titolo esercizio"); return; }
                  const id = editingId || createId("exercise");
                  const payload = { ...form, id };
                  if (editingId) {
                    setExercises(exercises.map((ex) => ex.id === editingId ? payload : ex));
                  } else {
                    setExercises([...exercises, payload]);
                  }
                  setOpenModal(false);
                  setEditingId(null);
                  setForm({ ...emptyExercise(), intensity: "Media" });
                  navigate("/tactical-board", { state: { exerciseId: id, exerciseName: name } });
                }}
                style={exCardStyles.boardShortcutBtn}
              >
                🖊️ Disegna su lavagna
              </button>
            </div>
          </div>

          {/* Anteprima disegno tattico nel form */}
          {form.tacticalBoard && (
            <div style={{ marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
              <TacticalMiniPreview board={form.tacticalBoard} height={180} />
              <p style={{ color: "#64748b", fontSize: 12, margin: "8px 0 0", fontWeight: 700 }}>
                Disegno tattico allegato — modifica dalla lavagna una volta salvato.
              </p>
            </div>
          )}

          {form.image && !form.tacticalBoard && (
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

/* ─── Anteprima lavagna tattica ──────────────────────────────────────────── */
function TacticalMiniPreview({ board, height = 160 }) {
  if (!board) return null;
  const { boardPlayers = [], lines = [], boardObjects = [] } = board;
  // Viewport SVG: 100 × 60 units (proporzionale al campo)
  const W = 100, H = 60;

  return (
    <div style={{ position: "relative", background: "#166534", borderRadius: 12, overflow: "hidden", height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Campo */}
        <rect x={0} y={0} width={W} height={H} fill="#15803d" />
        <rect x={2} y={2} width={W - 4} height={H - 4} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
        {/* Cerchio centrale */}
        <circle cx={W / 2} cy={H / 2} r={8} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
        <line x1={W / 2} y1={2} x2={W / 2} y2={H - 2} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
        {/* Porte */}
        <rect x={2} y={H / 2 - 6} width={4} height={12} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
        <rect x={W - 6} y={H / 2 - 6} width={4} height={12} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />

        {/* Linee / frecce */}
        {lines.map((line, i) => {
          const pts = (line.points || []).map((p) => `${p.x},${p.y}`).join(" ");
          if (!pts) return null;
          return (
            <polyline
              key={i}
              points={pts}
              fill="none"
              stroke={line.color || "white"}
              strokeWidth={0.8}
              strokeLinecap="round"
              opacity={0.75}
            />
          );
        })}

        {/* Oggetti campo (palla, coni…) */}
        {boardObjects.map((obj) => (
          <circle
            key={obj.id}
            cx={obj.x}
            cy={(obj.y / 100) * H}
            r={1.5}
            fill={obj.type === "ball" ? "white" : "#fbbf24"}
            opacity={0.9}
          />
        ))}

        {/* Giocatori */}
        {boardPlayers.map((p) => {
          // Le coordinate sono 0-100 rispetto al campo verticale; mappiamo su SVG
          const cx = p.x;
          const cy = (p.y / 100) * H;
          const isOwn = p.team !== "opp";
          return (
            <g key={p.id}>
              <circle
                cx={cx}
                cy={cy}
                r={2.6}
                fill={isOwn ? "#38bdf8" : "#f87171"}
                stroke="white"
                strokeWidth={0.4}
              />
              <text
                x={cx}
                y={cy + 0.9}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={1.8}
                fill="white"
                fontWeight="bold"
              >
                {p.number || ""}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Badge formazione */}
      {board.ownFormation && board.ownFormation !== "Nessuno" && (
        <span style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(0,0,0,0.55)",
          color: "white",
          fontSize: 10,
          fontWeight: 900,
          padding: "3px 7px",
          borderRadius: 8,
          lineHeight: 1.2,
        }}>
          {board.ownFormation}
        </span>
      )}
    </div>
  );
}

/* ─── Card button styles ──────────────────────────────────────────────────── */
const exCardStyles = {
  editBoardBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
    borderRadius: 9,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    lineHeight: 1.2,
  },
  addBoardBtn: {
    flex: 1,
    minWidth: 120,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.3)",
    background: "rgba(37,99,235,0.1)",
    color: "#93c5fd",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    lineHeight: 1.2,
  },
  boardShortcutBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.3)",
    background: "rgba(37,99,235,0.14)",
    color: "#93c5fd",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
};

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
