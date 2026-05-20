import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import { createId } from "../utils/helpers";
import { useTranslation } from "../i18n";

export default function SessionGenerator({
  exercises = [], setSessions, players = [], matches = [] }) {

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [goal, setGoal] = useState("Possesso");
  const [duration, setDuration] = useState(75);
  const [intensity, setIntensity] = useState("Media");

  const proposal = useMemo(() => {
    const candidates = exercises
      .filter((exercise) =>
        `${exercise.category} ${exercise.phase} ${exercise.objective} ${exercise.title}`
          .toLowerCase()
          .includes(goal.toLowerCase())
      )
      .slice(0, 5);

    return candidates.length ? candidates : exercises.slice(0, 5);
  }, [exercises, goal]);

  function saveProposal() {
    if (proposal.length === 0) {
      showToast("Aggiungi esercizi alla libreria prima di generare una seduta.", "warn");
      return;
    }

    const generated = {
      id: createId("session"),
      type: "Allenamento",
      title: `Seduta ${goal}`,
      date: new Date().toISOString().slice(0, 10),
      theme: goal,
      objective: `Lavoro ${goal.toLowerCase()} con intensita ${intensity.toLowerCase()}`,
      duration,
      notes: "Generata da Coach Generator.",
      exercises: proposal.map((exercise) => ({
        exerciseId: exercise.id,
        customDuration: Math.max(10, Math.round(duration / proposal.length)),
        customPlayers: exercise.players || players.length || "",
        variantNotes: intensity,
      })),
      attendance: {},
    };

    setSessions((prevSessions) => [...prevSessions, generated]);
  }

  const nextMatch = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date)).find((match) => new Date(match.date) >= new Date());

  return (
    <div>
      <ToastContainer />
      <PageHeader
        title={t("pages.sessionGenerator.title")}
        subtitle="Crea una seduta con parametri manuali: obiettivo, durata, intensità e libreria esercizi."
        action={<Button variant="ghost" onClick={() => navigate("/ai-session-builder")}>Passa al Builder AI</Button>}
      />

      <div style={generatorStyles.grid}>
        <AppCard>
          <h3 style={{ marginTop: 0 }}>Parametri</h3>
          <select value={goal} onChange={(event) => setGoal(event.target.value)} style={styles.input}>
            <option>Possesso</option>
            <option>Pressing</option>
            <option>Finalizzazione</option>
            <option>Transizione</option>
            <option>Fase difensiva</option>
            <option>Palla inattiva</option>
          </select>
          <input type="number" value={duration} onChange={(event) => setDuration(Number(event.target.value))} style={styles.input} />
          <select value={intensity} onChange={(event) => setIntensity(event.target.value)} style={styles.input}>
            <option>Bassa</option>
            <option>Media</option>
            <option>Alta</option>
          </select>
          {nextMatch && <p style={generatorStyles.muted}>Prossima partita: {nextMatch.title}</p>}
          <Button onClick={saveProposal}>Salva seduta proposta</Button>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0 }}>Proposta</h3>
          <div style={generatorStyles.list}>
            {proposal.map((exercise) => (
              <div key={exercise.id} style={generatorStyles.item}>
                <Badge tone="green">{exercise.category || "Esercizio"}</Badge>
                <strong>{exercise.title}</strong>
                <span>{exercise.objective || exercise.description || "Obiettivo da definire"}</span>
              </div>
            ))}
          </div>
        </AppCard>
      </div>
    </div>
  );
}

const generatorStyles = {
  grid: { display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 22, alignItems: "start" },
  list: { display: "grid", gap: 12 },
  item: { display: "grid", gap: 8, padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  muted: { color: "#94a3b8", lineHeight: 1.5 },
};
