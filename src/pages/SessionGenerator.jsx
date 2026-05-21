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
      showToast(t("pages.sessionGenerator.noExercisesWarn"), "warn");
      return;
    }

    const generated = {
      id: createId("session"),
      type: "Allenamento",
      title: t("pages.sessionGenerator.generatedTitle", { goal }),
      date: new Date().toISOString().slice(0, 10),
      theme: goal,
      objective: t("pages.sessionGenerator.generatedObjective", { goal: goal.toLowerCase(), intensity: intensity.toLowerCase() }),
      duration,
      notes: t("pages.sessionGenerator.generatedNotes"),
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
        subtitle={t("pages.sessionGenerator.subtitle")}
        action={<Button variant="ghost" onClick={() => navigate("/ai-session-builder")}>{t("pages.sessionGenerator.aiBuilder")}</Button>}
      />

      <div style={generatorStyles.grid}>
        <AppCard>
          <h3 style={{ marginTop: 0 }}>{t("pages.sessionGenerator.parametersTitle")}</h3>
          <select value={goal} onChange={(event) => setGoal(event.target.value)} style={styles.input}>
            <option value="Possesso">{t("pages.sessionGenerator.goalPossesso")}</option>
            <option value="Pressing">{t("pages.sessionGenerator.goalPressing")}</option>
            <option value="Finalizzazione">{t("pages.sessionGenerator.goalFinalizzazione")}</option>
            <option value="Transizione">{t("pages.sessionGenerator.goalTransizione")}</option>
            <option value="Fase difensiva">{t("pages.sessionGenerator.goalFaseDifensiva")}</option>
            <option value="Palla inattiva">{t("pages.sessionGenerator.goalPallaInattiva")}</option>
          </select>
          <input type="number" value={duration} onChange={(event) => setDuration(Number(event.target.value))} style={styles.input} />
          <select value={intensity} onChange={(event) => setIntensity(event.target.value)} style={styles.input}>
            <option value="Bassa">{t("pages.sessionGenerator.intensityBassa")}</option>
            <option value="Media">{t("pages.sessionGenerator.intensityMedia")}</option>
            <option value="Alta">{t("pages.sessionGenerator.intensityAlta")}</option>
          </select>
          {nextMatch && <p style={generatorStyles.muted}>{t("pages.sessionGenerator.nextMatch", { title: nextMatch.title })}</p>}
          <Button onClick={saveProposal}>{t("pages.sessionGenerator.saveProposal")}</Button>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0 }}>{t("pages.sessionGenerator.proposalTitle")}</h3>
          <div style={generatorStyles.list}>
            {proposal.map((exercise) => (
              <div key={exercise.id} style={generatorStyles.item}>
                <Badge tone="green">{exercise.category || t("pages.sessionGenerator.categoryFallback")}</Badge>
                <strong>{exercise.title}</strong>
                <span>{exercise.objective || exercise.description || t("pages.sessionGenerator.objectiveFallback")}</span>
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
