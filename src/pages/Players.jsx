import { useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

import PlayerCard from "../components/players/PlayerCard";

import { styles } from "../styles/index.js";
import { emptyPlayer } from "../data/initialData";
import { createId } from "../utils/helpers";

function Players({ players, setPlayers }) {
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);

  const [form, setForm] = useState({
    ...emptyPlayer(),
    status: "Disponibile",
  });

  const filteredPlayers = players.filter((player) =>
    `${player.name} ${player.role}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

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

  function addPlayer() {
    if (!form.name.trim()) {
      return alert("Inserisci il nome del giocatore");
    }

    setPlayers([
      ...players,
      {
        ...form,
        id: createId("player"),
      },
    ]);

    setForm({
      ...emptyPlayer(),
      status: "Disponibile",
    });

    setOpenModal(false);
  }

  function deletePlayer(id) {
    if (!confirm("Vuoi eliminare questo giocatore?")) return;

    setPlayers(players.filter((p) => p.id !== id));
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Gestione Rosa"
        subtitle="Database giocatori e gestione squadra"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 24,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cerca giocatore..."
        />

        <div style={{ display: "flex", gap: 12 }}>
          <Badge tone="blue">
            {players.length} giocatori
          </Badge>

          <Button onClick={() => setOpenModal(true)}>
            + Nuovo giocatore
          </Button>
        </div>
      </div>

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
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 22,
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
        <Modal
          title="Nuovo giocatore"
          onClose={() => setOpenModal(false)}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            <input
              placeholder="Nome giocatore"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder="Ruolo"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value })
              }
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
              onChange={(e) =>
                setForm({ ...form, status: e.target.value })
              }
              style={styles.input}
            >
              <option>Disponibile</option>
              <option>Infortunato</option>
              <option>Squalificato</option>
            </select>

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handlePhotoUpload(e.target.files[0])
              }
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
            <Button
              variant="ghost"
              onClick={() => setOpenModal(false)}
            >
              Annulla
            </Button>

            <Button onClick={addPlayer}>
              Salva giocatore
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Players;
