import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTabState } from "../hooks/useTabState";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";

import {
  PlayerDevelopmentTab,
  PlayerKpiStrip,
  PlayerMedicalTab,
  PlayerPhysicalTab,
  PlayerProfileTab,
  PlayerSidebar,
  PlayerStatsTab,
  PlayerTabs,
  PlayerTechnicalOverview,
  PlayerVideoTab,
} from "../components/players/PlayerDetailSections";
import { getPreventionRecommendations } from "../components/players/playerDetailLogic";
import { styles } from "../styles/index.js";
import { createId, getPlayerSummary } from "../utils/helpers";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";

const DIFFERENTIATED_TYPES = [
  "Defaticante",
  "Recupero infortunio",
  "Lavoro individuale",
  "Rientro parziale in gruppo",
  "Carico ridotto",
];

// Display-label lookup — keeps stored Italian values unchanged
const DIFF_TYPE_LABEL_KEYS = {
  "Defaticante":                "pages.availability.diffTypeWarmDown",
  "Recupero infortunio":        "pages.availability.diffTypeInjRecovery",
  "Lavoro individuale":         "pages.availability.diffTypeIndividual",
  "Rientro parziale in gruppo": "pages.availability.diffTypePartialReturn",
  "Carico ridotto":             "pages.availability.diffTypeReducedLoad",
};

function PlayerDetail({
  players, setPlayers, sessions = [], matches = [], physicalTests = [], setStaffTasks }) {

  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const player = useMemo(
    () => players.find((item) => String(item.id) === String(id)),
    [players, id]
  );

  const { showToast, ToastContainer } = useToast();
  const [editing, setEditing] = useState(false);
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState(null);
  const [activeTab, setActiveTab] = useTabState("tab", "cartella");
  const [form, setForm] = useState({ ...player });
  const [medicalModal, setMedicalModal] = useState(null);
  const [conflictModal, setConflictModal] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    differentiatedType: DIFFERENTIATED_TYPES[1],
    note: "",
    returnDate: new Date().toISOString().slice(0, 10),
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!player) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ ...player });
    setEditing(false);
    setEditBaseUpdatedAt(player._updatedAt || null);
    setMedicalModal(null);
    setConflictModal(false);
    // Reset intenzionale solo al cambio atleta: includere l'intero player sovrascriverebbe edit/modali dopo ogni update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const summary = useMemo(
    () => getPlayerSummary(player, { sessions, matches, physicalTests }),
    [player, sessions, matches, physicalTests]
  );
  const injuryHistory = useMemo(
    () => [...(player?.injuries || [])].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)),
    [player]
  );
  const activeInjuries = injuryHistory.filter((injury) => !injury.endDate);
  const pastInjuries = injuryHistory.filter((injury) => injury.endDate);
  const totalDaysOut = injuryHistory.reduce((sum, injury) => sum + Number(injury.daysOut || 0), 0);
  const totalSessionsMissed = injuryHistory.reduce((sum, injury) => sum + Number(injury.sessionsMissed || 0), 0);
  const totalMatchesMissed = injuryHistory.reduce((sum, injury) => sum + Number(injury.matchesMissed || 0), 0);
  const preventionRecommendations = useMemo(
    () => getPreventionRecommendations(injuryHistory, player),
    [injuryHistory, player]
  );
  const playerVideoClips = useMemo(
    () => getPlayerVideoClips(matches, player?.id),
    [matches, player?.id]
  );

  if (!player) {
    return (
      <div style={styles.page}>
        <PageHeader title={t("pages.playerDetail.notFound")} subtitle={t("pages.playerDetail.notFoundSubtitle")} />
      </div>
    );
  }

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleImageUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        photo: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  }

  function savePlayer() {
    if (hasPlayerConflict(player, editBaseUpdatedAt)) {
      setConflictModal(true);
      return;
    }
    commitPlayerSave(form);
  }

  function commitPlayerSave(nextForm) {
    // Stampa un nuovo _updatedAt affinché la conflict detection funzioni nei salvataggi successivi.
    const stamped = { ...nextForm, _updatedAt: new Date().toISOString() };
    setPlayers((prev) => prev.map((item) => String(item.id) === String(id) ? stamped : item));
    setEditing(false);
    setEditBaseUpdatedAt(stamped._updatedAt);
    showToast(t("pages.playerDetail.playerSaved"), "ok");
  }

  function forceSavePlayer() {
    commitPlayerSave(form);
    setConflictModal(false);
  }

  function updateMedicalRecord(updater) {
    const nextPlayer = updater(player);
    setPlayers((prev) => prev.map((item) => String(item.id) === String(id) ? nextPlayer : item));
    // Sync sempre i campi medici nel form, anche se l'utente sta modificando il profilo.
    // Senza questo, una save del profilo successiva sovrascriverà le modifiche mediche appena salvate.
    setForm((prevForm) => ({
      ...prevForm,
      injuries:          nextPlayer.injuries,
      injuryNotes:       nextPlayer.injuryNotes       ?? "",
      status:            nextPlayer.status,
      differentiatedType: nextPlayer.differentiatedType ?? "",
      expectedReturn:    nextPlayer.expectedReturn    ?? "",
    }));
  }

  function openDifferentiatedModal() {
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      note: player.injuryNotes || "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("differenziato");
  }

  function saveDifferentiatedWork() {
    const differentiatedType = medicalForm.differentiatedType || DIFFERENTIATED_TYPES[1];
    const note = medicalForm.note.trim();
    updateMedicalRecord((current) => ({
      ...current,
      status: "Differenziato",
      differentiatedType,
      injuryNotes: [current.injuryNotes, note].filter(Boolean).join("\n"),
      injuries: [
        ...(current.injuries || []),
        {
          id: createId("injury"),
          injuryType: differentiatedType,
          differentiatedType,
          status: "Differenziato",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: null,
          expectedReturn: current.expectedReturn || "",
          notes: note,
          sessionsMissed: 0,
          matchesMissed: 0,
        },
      ],
    }));
    setMedicalModal(null);
  }

  function openRecoveredModal() {
    if (!activeInjuries.length) return;
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      note: "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("rientro");
  }

  function saveRecovered() {
    if (!activeInjuries.length) return;
    const returnDate = medicalForm.returnDate || new Date().toISOString().slice(0, 10);
    updateMedicalRecord((current) => {
      const injuries = current.injuries || [];
      if (!injuries.some((injury) => !injury.endDate)) return current;

      return {
        ...current,
        status: "Disponibile",
        injuryType: "",
        differentiatedType: "",
        expectedReturn: "",
        injuryNotes: "",
        injuries: injuries.map((injury) => {
          if (injury.endDate) return injury;
          const start = injury.startDate ? new Date(injury.startDate) : null;
          const daysOut = start ? Math.max(0, Math.floor((new Date(returnDate) - start) / 86400000)) : injury.daysOut;
          return {
            ...injury,
            endDate: returnDate,
            daysOut,
            notes: [injury.notes, medicalForm.note.trim()].filter(Boolean).join("\n"),
          };
        }),
      };
    });
    setMedicalModal(null);
  }

  function openNoteModal() {
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      note: "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("nota");
  }

  function saveMedicalNote() {
    const note = medicalForm.note.trim();
    if (!note) return;
    updateMedicalRecord((current) => {
      const injuries = current.injuries || [];
      if (!injuries.length) {
        return {
          ...current,
          injuryNotes: [current.injuryNotes, note].filter(Boolean).join("\n"),
        };
      }

      const targetIndex = injuries.findIndex((injury) => !injury.endDate);
      const fallbackIndex = injuries.length - 1;
      const noteIndex = targetIndex >= 0 ? targetIndex : fallbackIndex;

      return {
        ...current,
        injuries: injuries.map((injury, index) => index === noteIndex
          ? { ...injury, notes: [injury.notes, note].filter(Boolean).join("\n") }
          : injury
        ),
      };
    });
    setMedicalModal(null);
  }

  function createDevelopmentTask() {
    if (!setStaffTasks || !player) return;
    const description = [
      form.trainingActions && `Azioni: ${form.trainingActions}`,
      form.weeklyGoal && `Obiettivo settimana: ${form.weeklyGoal}`,
      form.thirtyDayGoal && `Obiettivo 30 giorni: ${form.thirtyDayGoal}`,
      form.successMetrics && `Metriche: ${form.successMetrics}`,
      form.videoReviewNotes && `Video: ${form.videoReviewNotes}`,
    ].filter(Boolean).join("\n");

    if (!description.trim()) return;

    setStaffTasks((prev = []) => [
      {
        id: createId("task"),
        title: `Piano individuale - ${player.name}`,
        description,
        status: "todo",
        priority: "medium",
        ownerRole: "assistantCoach",
        dueDate: getRelativeDate(7),
        playerId: String(player.id),
        sourceType: "playerDevelopment",
        sourceId: String(player.id),
        createdAt: new Date().toISOString(),
        completedAt: "",
      },
      ...prev,
    ]);
  }

  return (
    <div style={styles.page}>
      <PageHeader title={player.name} subtitle={t("pages.playerDetail.subtitle")} />

      <div style={{ ...pageStyles.layout, gridTemplateColumns: isMobile ? "1fr" : pageStyles.layout.gridTemplateColumns }}>
        <div style={pageStyles.sidebar}>
          <PlayerSidebar
            form={form}
            editing={editing}
            onImageUpload={handleImageUpload}
            onPhotoSizeChange={(value) => updateField("photoSize", value)}
            summary={summary}
          />
        </div>

        <div style={pageStyles.main}>
          <PlayerTabs activeTab={activeTab} onChange={setActiveTab} />

          {(activeTab === "cartella" || activeTab === "profilo" || activeTab === "statistiche") && (
            <PlayerKpiStrip summary={summary} />
          )}

          {activeTab === "cartella" && (
            <PlayerTechnicalOverview
              player={player}
              summary={summary}
              activeInjuries={activeInjuries}
              injuryHistory={injuryHistory}
              preventionRecommendations={preventionRecommendations}
              onGoToTab={setActiveTab}
            />
          )}

          {activeTab === "profilo" && (
            <PlayerProfileTab
              form={form}
              player={player}
              editing={editing}
              onEdit={(selectedPlayer) => {
                setForm({ ...selectedPlayer });
                setEditBaseUpdatedAt(selectedPlayer._updatedAt || null);
                setEditing(true);
              }}
              onCancel={() => {
                setEditing(false);
                setForm({ ...player });
                setEditBaseUpdatedAt(player._updatedAt || null);
              }}
              onSave={savePlayer}
              onFieldChange={updateField}
            />
          )}

          {activeTab === "statistiche" && <PlayerStatsTab summary={summary} />}

          {activeTab === "video" && <PlayerVideoTab clips={playerVideoClips} />}

          {activeTab === "fisico" && (
            <PlayerPhysicalTab
              form={form}
              editing={editing}
              latestTests={summary.latestTests}
              onFieldChange={updateField}
            />
          )}

          {activeTab === "medico" && (
            <PlayerMedicalTab
              activeInjuries={activeInjuries}
              injuryHistory={injuryHistory}
              pastInjuries={pastInjuries}
              totalDaysOut={totalDaysOut}
              totalSessionsMissed={totalSessionsMissed}
              totalMatchesMissed={totalMatchesMissed}
              generalInjuryNotes={player.injuryNotes}
              preventionRecommendations={preventionRecommendations}
              onCreateDifferentiatedWork={openDifferentiatedModal}
              onAddMedicalNote={openNoteModal}
              onMarkRecovered={openRecoveredModal}
            />
          )}

          {activeTab === "sviluppo" && (
            <PlayerDevelopmentTab
              form={form}
              editing={editing}
              summary={summary}
              videoClips={playerVideoClips}
              onCreateStaffTask={createDevelopmentTask}
              onFieldChange={updateField}
            />
          )}

          <Button variant="ghost" onClick={() => navigate("/players")}>
            {t("pages.playerDetail.back")}
          </Button>
        </div>
      </div>

      {medicalModal && (
        <Modal title={getMedicalModalTitle(medicalModal, t)} onClose={() => setMedicalModal(null)}>
          <MedicalActionForm
            type={medicalModal}
            value={medicalForm}
            onChange={setMedicalForm}
              onCancel={() => setMedicalModal(null)}
            onSubmit={
              medicalModal === "differenziato"
                ? saveDifferentiatedWork
                : medicalModal === "rientro"
                ? saveRecovered
                : saveMedicalNote
            }
          />
        </Modal>
      )}

      {conflictModal && (
        <Modal title={t("pages.playerDetail.conflictTitle")} onClose={() => setConflictModal(false)}>
          <div style={modalStyles.stack}>
            <p style={modalStyles.helpText}>
              {t("pages.playerDetail.conflictText")}
            </p>
            <div style={modalStyles.actions}>
              <Button
                variant="ghost"
                onClick={() => {
                  setForm({ ...player });
                  setEditBaseUpdatedAt(player._updatedAt || null);
                  setConflictModal(false);
                }}
              >
                {t("pages.playerDetail.reloadData")}
              </Button>
              <Button onClick={forceSavePlayer}>
                {t("pages.playerDetail.forceSave")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ToastContainer />
    </div>
  );
}

function hasPlayerConflict(player, editBaseUpdatedAt) {
  if (!player?._updatedAt || !editBaseUpdatedAt) return false;
  return String(player._updatedAt) !== String(editBaseUpdatedAt);
}

function getPlayerVideoClips(matches, playerId) {
  if (!playerId) return [];
  return matches
    .flatMap((match) =>
      (match.videoAnalysis || [])
        .filter((clip) => String(clip.playerId) === String(playerId))
        .map((clip) => ({
          ...clip,
          matchId: match.id,
          matchTitle: match.title || match.opponent || "Partita",
          matchDate: match.date,
          opponent: match.opponent || "",
        }))
    )
    .sort((a, b) => new Date(b.matchDate || 0) - new Date(a.matchDate || 0));
}

function getMedicalModalTitle(type, t) {
  if (type === "differenziato") return t("pages.playerDetail.createDifferentiatedWork");
  if (type === "rientro") return t("pages.playerDetail.markReturn");
  return t("pages.playerDetail.addMedicalNote");
}

function getRelativeDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function MedicalActionForm({ type, value, onChange, onCancel, onSubmit }) {
  const { t } = useTranslation();
  const canSubmit = type !== "nota" || value.note.trim();

  return (
    <div style={modalStyles.stack}>
      {type === "differenziato" && (
        <label style={modalStyles.field}>
          <span style={modalStyles.label}>{t("pages.playerDetail.typology")}</span>
          <select
            value={value.differentiatedType}
            onChange={(event) => onChange((prev) => ({ ...prev, differentiatedType: event.target.value }))}
            style={styles.input}
          >
            {DIFFERENTIATED_TYPES.map((item) => (
              <option key={item} value={item}>
                {DIFF_TYPE_LABEL_KEYS[item] ? t(DIFF_TYPE_LABEL_KEYS[item]) : item}
              </option>
            ))}
          </select>
        </label>
      )}

      {type === "rientro" && (
        <label style={modalStyles.field}>
          <span style={modalStyles.label}>{t("pages.playerDetail.returnDate")}</span>
          <input
            type="date"
            value={value.returnDate}
            onChange={(event) => onChange((prev) => ({ ...prev, returnDate: event.target.value }))}
            style={styles.input}
          />
        </label>
      )}

      <label style={modalStyles.field}>
        <span style={modalStyles.label}>
          {type === "rientro" ? t("pages.playerDetail.finalNote") : type === "differenziato" ? t("pages.playerDetail.operationalNotes") : t("pages.playerDetail.medicalNote")}
        </span>
        <textarea
          value={value.note}
          onChange={(event) => onChange((prev) => ({ ...prev, note: event.target.value }))}
          placeholder={
            type === "rientro"
              ? t("pages.playerDetail.returnNotePlaceholder")
              : type === "differenziato"
              ? t("pages.playerDetail.differentiatedPlaceholder")
              : t("pages.playerDetail.medicalNotePlaceholder")
          }
          style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
        />
      </label>

      <div style={modalStyles.actions}>
        <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

const pageStyles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "340px minmax(0, 1fr)",
    gap: 24,
    alignItems: "start",
  },
  sidebar: {
    display: "grid",
    gap: 20,
    minWidth: 0,
  },
  main: {
    display: "grid",
    gap: 20,
    minWidth: 0,
  },
};

const modalStyles = {
  stack: {
    display: "grid",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  helpText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.55,
  },
};

export default PlayerDetail;
