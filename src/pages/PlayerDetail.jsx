import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

import {
  PlayerDevelopmentTab,
  PlayerKpiStrip,
  PlayerMedicalTab,
  PlayerPhysicalTab,
  PlayerProfileTab,
  PlayerSidebar,
  PlayerStatsTab,
  PlayerTabs,
} from "../components/players/PlayerDetailSections";
import { getPreventionRecommendations } from "../components/players/playerDetailLogic";
import { styles } from "../styles/index.js";
import { createId, getPlayerSummary } from "../utils/helpers";

const DIFFERENTIATED_TYPES = [
  "Defaticante",
  "Recupero infortunio",
  "Lavoro individuale",
  "Rientro parziale in gruppo",
  "Carico ridotto",
];

function PlayerDetail({ players, setPlayers, sessions = [], matches = [], physicalTests = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const player = useMemo(
    () => players.find((item) => String(item.id) === String(id)),
    [players, id]
  );

  const [editing, setEditing] = useState(false);
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState(null);
  const [activeTab, setActiveTab] = useState("profilo");
  const [form, setForm] = useState({ ...player });
  const [medicalModal, setMedicalModal] = useState(null);
  const [conflictModal, setConflictModal] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    differentiatedType: DIFFERENTIATED_TYPES[1],
    note: "",
    returnDate: new Date().toISOString().slice(0, 10),
  });
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 760
  );

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

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 759px)");
    const handler = (event) => setIsMobile(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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

  if (!player) {
    return (
      <div style={styles.page}>
        <PageHeader title="Giocatore non trovato" subtitle="Il profilo richiesto non esiste" />
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

  return (
    <div style={styles.page}>
      <PageHeader title={player.name} subtitle="Scheda giocatore e database individuale" />

      <div style={{ ...pageStyles.layout, gridTemplateColumns: isMobile ? "1fr" : pageStyles.layout.gridTemplateColumns }}>
        <div style={pageStyles.sidebar}>
          <PlayerSidebar
            form={form}
            editing={editing}
            onImageUpload={handleImageUpload}
            summary={summary}
          />
        </div>

        <div style={pageStyles.main}>
          <PlayerTabs activeTab={activeTab} onChange={setActiveTab} />

          {(activeTab === "profilo" || activeTab === "statistiche") && (
            <PlayerKpiStrip summary={summary} />
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
            <PlayerDevelopmentTab form={form} editing={editing} onFieldChange={updateField} />
          )}

          <Button variant="ghost" onClick={() => navigate("/players")}>
            ← Torna alla rosa
          </Button>
        </div>
      </div>

      {medicalModal && (
        <Modal title={getMedicalModalTitle(medicalModal)} onClose={() => setMedicalModal(null)}>
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
        <Modal title="Dati aggiornati da un'altra sessione" onClose={() => setConflictModal(false)}>
          <div style={modalStyles.stack}>
            <p style={modalStyles.helpText}>
              Questo giocatore risulta aggiornato dopo l'apertura della modifica. Per evitare sovrascritture, puoi
              ricaricare i dati attuali o forzare il salvataggio delle modifiche locali.
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
                Ricarica dati attuali
              </Button>
              <Button onClick={forceSavePlayer}>
                Forza salvataggio
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function hasPlayerConflict(player, editBaseUpdatedAt) {
  if (!player?._updatedAt || !editBaseUpdatedAt) return false;
  return String(player._updatedAt) !== String(editBaseUpdatedAt);
}

function getMedicalModalTitle(type) {
  if (type === "differenziato") return "Crea lavoro differenziato";
  if (type === "rientro") return "Segna rientro";
  return "Aggiungi nota medica";
}

function MedicalActionForm({ type, value, onChange, onCancel, onSubmit }) {
  const canSubmit = type !== "nota" || value.note.trim();

  return (
    <div style={modalStyles.stack}>
      {type === "differenziato" && (
        <label style={modalStyles.field}>
          <span style={modalStyles.label}>Tipologia</span>
          <select
            value={value.differentiatedType}
            onChange={(event) => onChange((prev) => ({ ...prev, differentiatedType: event.target.value }))}
            style={styles.input}
          >
            {DIFFERENTIATED_TYPES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      )}

      {type === "rientro" && (
        <label style={modalStyles.field}>
          <span style={modalStyles.label}>Data rientro</span>
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
          {type === "rientro" ? "Nota finale" : type === "differenziato" ? "Note operative" : "Nota medica"}
        </span>
        <textarea
          value={value.note}
          onChange={(event) => onChange((prev) => ({ ...prev, note: event.target.value }))}
          placeholder={
            type === "rientro"
              ? "Es. rientro completato senza dolore, monitorare carico per 7 giorni..."
              : type === "differenziato"
              ? "Es. lavoro aerobico leggero, no cambi direzione, controllo dolore post seduta..."
              : "Es. dolore riferito, indicazioni staff medico, prevenzione consigliata..."
          }
          style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
        />
      </label>

      <div style={modalStyles.actions}>
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          Salva
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
