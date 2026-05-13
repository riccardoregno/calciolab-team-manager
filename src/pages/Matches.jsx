import { useState } from "react";
import { Link } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";

import { styles } from "../styles/index.js";
import { createId, formatDate } from "../utils/helpers";

function Matches({ matches, setMatches, players = [] }) {
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyMatch());

  function handleLogoUpload(field, file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        [field]: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  }

  function saveMatch() {
    if (!form.opponent.trim()) {
      return alert("Inserisci l’avversario");
    }

    const payload = {
      ...form,
      id: editingId || createId("match"),
      type: "Partita",
      title: `CalcioLab - ${form.opponent}`,
    };

    if (editingId) {
      setMatches(matches.map((m) => (m.id === editingId ? payload : m)));
    } else {
      setMatches([...matches, payload]);
    }

    setForm(emptyMatch());
    setEditingId(null);
    setOpenModal(false);
  }

  function editMatch(match) {
    setEditingId(match.id);

    setForm({
      opponent: match.opponent || "",
      date: match.date || new Date().toISOString().slice(0, 10),
      location: match.location || "Casa",
      result: match.result || "",
      formation: match.formation || "4-2-3-1",
      notes: match.notes || "",
      attendance: match.attendance || {},
      homeLogo: match.homeLogo || "",
      awayLogo: match.awayLogo || "",
      lineup: match.lineup || emptyLineup(),
      matchPlan: match.matchPlan || "",
      staffNotes: match.staffNotes || "",
    });

    setOpenModal(true);
  }

  function deleteMatch(id) {
    if (!confirm("Vuoi eliminare questa partita?")) return;
    setMatches(matches.filter((match) => match.id !== id));
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Partite"
        subtitle="Match center, risultati, loghi squadre e note tecniche"
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
        <Badge tone="blue">{matches.length} partite</Badge>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/match-day" style={{ textDecoration: "none" }}>
            <Button variant="ghost">Match Day</Button>
          </Link>
          <Button onClick={() => setOpenModal(true)}>+ Nuova partita</Button>
        </div>
      </div>

      {matches.length === 0 ? (
        <EmptyState
          icon="🏟️"
          title="Nessuna partita salvata"
          text="Aggiungi la prima gara per iniziare lo storico."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(430px,1fr))",
            gap: 22,
          }}
        >
          {matches.map((match) => (
            <AppCard key={match.id}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: 18,
                  alignItems: "center",
                  marginBottom: 22,
                }}
              >
                <TeamBox
                  logo={match.homeLogo}
                  name="CalcioLab"
                  fallback="CL"
                  gradient="linear-gradient(135deg,#2563eb,#38bdf8)"
                />

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      marginBottom: 6,
                    }}
                  >
                    {match.result || "-"}
                  </div>

                  <p style={{ color: "#94a3b8", margin: 0 }}>
                    {formatDate(match.date)}
                  </p>
                </div>

                <TeamBox
                  logo={match.awayLogo}
                  name={match.opponent}
                  fallback={match.opponent?.[0] || "A"}
                  gradient="linear-gradient(135deg,#7c3aed,#c084fc)"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <MiniInfo label="Campo" value={match.location || "-"} />
                <MiniInfo label="Modulo" value={match.formation || "-"} />
                <MiniInfo
                  label="Convocati"
                  value={`${match.lineup?.calledUpIds?.length || 0}/${players.length}`}
                />
              </div>

              <div
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minHeight: 90,
                }}
              >
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Note partita
                </div>

                <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
                  {match.notes || "Nessuna nota inserita."}
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                <Link
                  to={`/match-day/${match.id}`}
                  style={{ flex: 1, textDecoration: "none" }}
                >
                  <Button variant="ghost" style={{ width: "100%" }}>
                    Scheda gara
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  onClick={() => editMatch(match)}
                  style={{ flex: 1 }}
                >
                  Modifica
                </Button>

                <Button
                  variant="danger"
                  onClick={() => deleteMatch(match.id)}
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
          title={editingId ? "Modifica partita" : "Nuova partita"}
          onClose={() => {
            setOpenModal(false);
            setEditingId(null);
            setForm(emptyMatch());
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
              placeholder="Avversario"
              value={form.opponent}
              onChange={(e) => setForm({ ...form, opponent: e.target.value })}
              style={styles.input}
            />

            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={styles.input}
            />

            <select
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              style={styles.input}
            >
              <option>Casa</option>
              <option>Trasferta</option>
              <option>Neutro</option>
            </select>

            <input
              placeholder="Risultato es. 2-1"
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              style={styles.input}
            />

            <select
              value={form.formation}
              onChange={(e) => setForm({ ...form, formation: e.target.value })}
              style={styles.input}
            >
              <option>4-2-3-1</option>
              <option>4-3-3</option>
              <option>4-4-2</option>
              <option>3-5-2</option>
              <option>3-4-2-1</option>
              <option>4-3-1-2</option>
            </select>

            <LogoUploader
              label="Logo CalcioLab"
              value={form.homeLogo}
              onChange={(file) => handleLogoUpload("homeLogo", file)}
            />

            <LogoUploader
              label="Logo avversario"
              value={form.awayLogo}
              onChange={(file) => handleLogoUpload("awayLogo", file)}
            />

            <textarea
              placeholder="Note partita"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={{
                ...styles.input,
                minHeight: 120,
                gridColumn: "1 / -1",
              }}
            />
          </div>

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
              onClick={() => {
                setOpenModal(false);
                setEditingId(null);
                setForm(emptyMatch());
              }}
            >
              Annulla
            </Button>

            <Button onClick={saveMatch}>
              {editingId ? "Aggiorna partita" : "Salva partita"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TeamBox({ logo, name, fallback, gradient }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          style={{
            width: 78,
            height: 78,
            objectFit: "cover",
            borderRadius: 20,
            marginBottom: 10,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
      ) : (
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 20,
            background: gradient,
            display: "grid",
            placeItems: "center",
            marginBottom: 10,
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          {fallback}
        </div>
      )}

      <strong
        style={{
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </strong>
    </div>
  );
}

function LogoUploader({ label, value, onChange }) {
  return (
    <div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files[0])}
        style={styles.input}
      />

      {value && (
        <img
          src={value}
          alt={label}
          style={{
            width: 58,
            height: 58,
            objectFit: "cover",
            borderRadius: 14,
            marginTop: 10,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
      )}
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function emptyMatch() {
  return {
    opponent: "",
    date: new Date().toISOString().slice(0, 10),
    location: "Casa",
    result: "",
    formation: "4-2-3-1",
    notes: "",
    attendance: {},
    lineup: emptyLineup(),
    matchPlan: "",
    staffNotes: "",
    homeLogo: "",
    awayLogo: "",
  };
}

function emptyLineup() {
  return {
    calledUpIds: [],
    starterIds: [],
    benchIds: [],
  };
}

export default Matches;
