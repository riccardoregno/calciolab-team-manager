import { useState } from "react";
import { useLocation } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import AppCard from "../components/ui/AppCard";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

import PlayerCard from "../components/players/PlayerCard";

import { styles } from "../styles/index.js";
import { emptyPlayer } from "../data/initialData";
import { createId } from "../utils/helpers";

const GROUP_LABELS = {
  prima:        "Prima Squadra",
  juniores:     "Juniores",
  allievi:      "Allievi",
  giovanissimi: "Giovanissimi",
  esordienti:   "Esordienti",
};

function Players({ players, setPlayers }) {
  const location = useLocation();
  const urlGruppo = new URLSearchParams(location.search).get("gruppo") || "tutti";

  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const [search, setSearch] = useState("");
  const [gruppoFilter, setGruppoFilter] = useState(urlGruppo);
  const [openModal, setOpenModal] = useState(false);

  const [form, setForm] = useState({
    ...emptyPlayer(),
    firstName: "",
    lastName: "",
    status: "Disponibile",
    gruppo: gruppoFilter !== "tutti" ? gruppoFilter : "prima",
  });

  // Gruppi presenti nella rosa
  const presentGroups = [...new Set(players.map((p) => p.gruppo || "prima"))];
  const showTabs = presentGroups.length > 1 || presentGroups.some((g) => g !== "prima");

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = `${player.first_name || player.firstName || ""} ${
      player.last_name || player.lastName || ""
    } ${player.name || ""} ${player.role || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGroup = gruppoFilter === "tutti" || (player.gruppo || "prima") === gruppoFilter;
    return matchesSearch && matchesGroup;
  });

  // Contatori per gruppo
  const countByGroup = players.reduce((acc, p) => {
    const g = p.gruppo || "prima";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  function handlePhotoUpload(file) {
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

  // CRITICO fix: rimossi insert/delete Supabase diretti con schema flat (user_id, first_name, ...).
  // Quegli insert bypassavano useTeamData e usavano un schema diverso da { id, team_id, data }.
  // Ora usiamo setPlayers() — la persistenza Supabase avviene tramite useTeamData con schema corretto.
  function addPlayer() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("Inserisci nome e cognome del giocatore", "warn");
      return;
    }

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const newPlayer = {
      id:          createId("player"),
      name:        fullName,
      firstName:   form.firstName.trim(),
      lastName:    form.lastName.trim(),
      role:        form.role        || "",
      shirtNumber: form.shirtNumber || "",
      status:      form.status      || "Disponibile",
      gruppo:      form.gruppo      || "prima",
      photo:       form.photo       || "",
      ratings:     {},
      injuries:    [],
    };

    setPlayers([...players, newPlayer]);

    setForm({
      ...emptyPlayer(),
      firstName: "",
      lastName:  "",
      status:    "Disponibile",
      gruppo:    gruppoFilter !== "tutti" ? gruppoFilter : "prima",
    });

    setOpenModal(false);
    showToast("Giocatore aggiunto", "ok");
  }

  function deletePlayer(id) {
    setConfirmState({
      message: "Vuoi eliminare questo giocatore?",
      confirmLabel: "Elimina",
      confirmTone: "red",
      onConfirm: () => {
        // Confronto string→string per coerenza con FIX #12 (ID sempre stringa)
        setPlayers(players.filter((p) => String(p.id) !== String(id)));
        showToast("Giocatore eliminato", "info");
      },
    });
  }

  return (
    <div style={styles.page}>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <ToastContainer />
      <PageHeader
        title="Gestione Rosa"
        subtitle="Database giocatori e gestione squadra"
        action={<Button onClick={() => setOpenModal(true)}>+ Nuovo giocatore</Button>}
      />

      <AppCard style={{ marginBottom: 22 }}>
        <div style={pStyles.toolbar}>
          <div style={pStyles.counterGrid}>
            <MetricCard label="Giocatori totali" value={players.length} tone="blue" />
            <MetricCard
              label="Disponibili"
              value={players.filter((p) => (p.status || "Disponibile") === "Disponibile").length}
              tone="green"
            />
            <MetricCard
              label="Infortunati"
              value={players.filter((p) => p.status === "Infortunato").length}
              tone="red"
            />
            {Object.entries(countByGroup).map(([g, n]) => (
              <MetricCard key={g} label={GROUP_LABELS[g] || g} value={n} />
            ))}
          </div>

          <div style={pStyles.searchWrap}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Cerca per nome, ruolo..."
            />
          </div>
        </div>

        {/* Tab filtro gruppo — visibili solo se ci sono più gruppi */}
        {showTabs && (
          <div style={pStyles.tabs}>
            {["tutti", ...presentGroups].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGruppoFilter(g)}
                style={{
                  ...pStyles.tab,
                  background: gruppoFilter === g ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                  border: gruppoFilter === g ? "1px solid rgba(96,165,250,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: gruppoFilter === g ? "#e2e8f0" : "#94a3b8",
                }}
              >
                {g === "tutti" ? `Tutti (${players.length})` : `${GROUP_LABELS[g] || g} (${countByGroup[g] || 0})`}
              </button>
            ))}
          </div>
        )}
      </AppCard>

      {filteredPlayers.length === 0 ? (
        <EmptyState
          icon="⚽"
          title="Nessun giocatore trovato"
          text="Crea il primo giocatore della tua rosa."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 18,
          }}
        >
          {filteredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onDelete={() => deletePlayer(player.id)}
            />
          ))}
        </div>
      )}

      {openModal && (
        <Modal title="Nuovo giocatore" onClose={() => setOpenModal(false)}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            <input
              placeholder="Nome"
              value={form.firstName}
              onChange={(e) =>
                setForm({ ...form, firstName: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder="Cognome"
              value={form.lastName}
              onChange={(e) =>
                setForm({ ...form, lastName: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder="Ruolo"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder="Numero"
              value={form.shirtNumber}
              onChange={(e) =>
                setForm({ ...form, shirtNumber: e.target.value })
              }
              style={styles.input}
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={styles.input}
            >
              <option>Disponibile</option>
              <option>Infortunato</option>
              <option>Squalificato</option>
            </select>

            <select
              value={form.gruppo}
              onChange={(e) => setForm({ ...form, gruppo: e.target.value })}
              style={styles.input}
            >
              <option value="prima">Prima Squadra</option>
              <option value="juniores">Juniores</option>
              <option value="allievi">Allievi</option>
              <option value="giovanissimi">Giovanissimi</option>
              <option value="esordienti">Esordienti</option>
            </select>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => handlePhotoUpload(e.target.files[0])}
              style={styles.input}
            />
          </div>

          {form.photo && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <img
                src={form.photo}
                alt="preview"
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 24,
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.12)",
                }}
              />
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 26,
              gap: 12,
            }}
          >
            <Button variant="ghost" onClick={() => setOpenModal(false)}>
              Annulla
            </Button>

            <Button onClick={addPlayer}>Salva giocatore</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone = "slate" }) {
  const tones = {
    blue: "#60a5fa",
    green: "#22c55e",
    red: "#f87171",
    slate: "#cbd5e1",
  };

  return (
    <div style={pStyles.metricCard}>
      <strong style={{ ...pStyles.metricValue, color: tones[tone] }}>
        {value}
      </strong>
      <span style={pStyles.metricLabel}>{label}</span>
    </div>
  );
}

const pStyles = {
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  counterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(124px,1fr))",
    gap: 10,
    flex: "1 1 520px",
  },
  searchWrap: {
    flex: "0 1 360px",
    width: "100%",
  },
  metricCard: {
    minHeight: 70,
    padding: "12px 13px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0,
    marginTop: 7,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginTop: 18,
    flexWrap: "wrap",
  },
  tab: {
    borderRadius: 10,
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

export default Players;
