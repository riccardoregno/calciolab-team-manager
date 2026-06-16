import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";

import { styles } from "../styles/index.js";
import { emptyExercise } from "../data/initialData";
import { createUuid } from "../utils/helpers";
import TacticalMiniPreview from "../components/ui/TacticalMiniPreview";
import { useTranslation } from "../i18n";

function Exercises({
  exercises, setExercises }) {

  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, ToastContainer } = useToast();

  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const [form, setForm] = useState({
    ...emptyExercise(),
    intensity: "Media",
  });

  // Quando si torna dalla lavagna con un esercizio già creato, apri direttamente
  // la modale in modalità modifica per completare i dettagli
  useEffect(() => {
    const fromBoard = location.state?.fromBoard;
    const editExerciseId = fromBoard?.exerciseId || location.state?.editExerciseId;
    if (!editExerciseId) return;

    const ex = exercises.find((e) => e.id === editExerciseId);
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
      showToast(t("pages.exercises.titleRequired"), "warn");
      return;
    }

    const payload = {
      ...form,
      id: editingId || createUuid(),
    };

    if (editingId) {
      setExercises((prevExercises) =>
        prevExercises.map((exercise) =>
          exercise.id === editingId ? payload : exercise
        )
      );
    } else {
      setExercises((prevExercises) => [...prevExercises, payload]);
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
    setConfirmState({
      message: t("pages.exercises.deleteConfirm"),
      confirmLabel: t("pages.exercises.deleteLabel"),
      confirmTone: "red",
      onConfirm: () => setExercises((prevExercises) => prevExercises.filter((exercise) => exercise.id !== id)),
    });
  }

  function removeTacticalBoard(exerciseId) {
    setConfirmState({
      message: t("pages.exercises.removeBoardConfirm"),
      confirmLabel: t("pages.exercises.removeBoardLabel"),
      confirmTone: "red",
      onConfirm: () => setExercises((prevExercises) => prevExercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, tacticalBoard: undefined } : ex
      )),
    });
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.exercises.title")}
        subtitle={t("pages.exercises.subtitle")}
        action={<Button variant="ghost" onClick={() => navigate("/exercise-library?tab=miei")}>{t("pages.exercises.backBtn")}</Button>}
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
          placeholder={t("pages.exercises.searchPlaceholder")}
        />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Badge tone="blue">
            {t("pages.exercises.exerciseCount", { count: exercises.length })}
          </Badge>

          <Button onClick={() => setOpenModal(true)}>
            {t("pages.exercises.newExercise")}
          </Button>
        </div>
      </div>

      {filteredExercises.length === 0 ? (
        <EmptyState
          icon="⚽"
          title={t("pages.exercises.noExercises")}
          text={t("pages.exercises.noExercisesText")}
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
                    title={t("pages.exercises.editBoardBtn")}
                  >
                    {t("pages.exercises.editBoardBtn")}
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
                    {exercise.category || t("pages.exercises.categoryFallback")} ·{" "}
                    {exercise.level || t("pages.exercises.levelFallback")}
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
                {exercise.description || t("pages.exercises.descriptionFallback")}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                <MiniInfo label={t("pages.exercises.infoLabelDuration")} value={`${exercise.duration || 0} min`} />
                <MiniInfo label={t("pages.exercises.infoLabelPlayers")} value={exercise.players || "-"} />
                <MiniInfo label={t("pages.exercises.infoLabelField")} value={exercise.fieldSize || "-"} />
              </div>

              {exercise.coachingPoints && (
                <div style={{ marginTop: 18 }}>
                  <h4 style={{ marginBottom: 8 }}>{t("pages.exercises.coachingPointsTitle")}</h4>

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
                  {t("pages.exercises.editBtn")}
                </Button>

                {/* Disegno nella lavagna */}
                {!exercise.tacticalBoard ? (
                  <button
                    type="button"
                    onClick={() => navigate("/tactical-board", {
                      state: { exerciseId: exercise.id, exerciseName: exercise.title },
                    })}
                    style={exCardStyles.addBoardBtn}
                    title={t("pages.exercises.addBoardBtn")}
                  >
                    {t("pages.exercises.addBoardBtn")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeTacticalBoard(exercise.id)}
                    style={{ ...exCardStyles.addBoardBtn, borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5", background: "rgba(239,68,68,0.08)" }}
                  >
                    {t("pages.exercises.removeBoardBtn")}
                  </button>
                )}

                <Button
                  variant="danger"
                  onClick={() => deleteExercise(exercise.id)}
                  style={{ flex: 1, minWidth: 80 }}
                >
                  {t("pages.exercises.deleteBtn")}
                </Button>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {openModal && (
        <Modal
          title={editingId ? t("pages.exercises.modalEditTitle") : t("pages.exercises.modalAddTitle")}
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
              placeholder={t("pages.exercises.fieldTitle")}
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder={t("pages.exercises.fieldCategory")}
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder={t("pages.exercises.fieldDuration")}
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder={t("pages.exercises.fieldPlayers")}
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
              <option value="Bassa">{t("pages.exercises.intBassa")}</option>
              <option value="Media">{t("pages.exercises.intMedia")}</option>
              <option value="Alta">{t("pages.exercises.intAlta")}</option>
            </select>

            <input
              placeholder={t("pages.exercises.fieldFieldSize")}
              value={form.fieldSize}
              onChange={(e) =>
                setForm({ ...form, fieldSize: e.target.value })
              }
              style={styles.input}
            />

            <textarea
              placeholder={t("pages.exercises.fieldDescription")}
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
              placeholder={t("pages.exercises.fieldCoachingPoints")}
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
                {t("pages.exercises.uploadImage")}
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
                  if (!name) {
                    showToast(t("pages.exercises.titleRequired"), "warn");
                    return;
                  }
                  const id = editingId || createUuid();
                  const payload = { ...form, id };
                  if (editingId) {
                    setExercises((prevExercises) => prevExercises.map((ex) => ex.id === editingId ? payload : ex));
                  } else {
                    setExercises((prevExercises) => [...prevExercises, payload]);
                  }
                  setOpenModal(false);
                  setEditingId(null);
                  setForm({ ...emptyExercise(), intensity: "Media" });
                  navigate("/tactical-board", { state: { exerciseId: id, exerciseName: name } });
                }}
                style={exCardStyles.boardShortcutBtn}
              >
                {t("pages.exercises.drawBoardBtn")}
              </button>
            </div>
          </div>

          {/* Anteprima disegno tattico nel form */}
          {form.tacticalBoard && (
            <div style={{ marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
              <TacticalMiniPreview board={form.tacticalBoard} height={180} />
              <p style={{ color: "#64748b", fontSize: 12, margin: "8px 0 0", fontWeight: 700 }}>
                {t("pages.exercises.tacticalBoardAttached")}
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
              {t("pages.exercises.cancel")}
            </Button>

            <Button onClick={saveExercise}>
              {editingId ? t("pages.exercises.updateExercise") : t("pages.exercises.saveExercise")}
            </Button>
          </div>
        </Modal>
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
