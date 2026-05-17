import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { generateAiTrainingSession, isOpenAiConfigured } from "../services/aiSessionService";
import { styles } from "../styles/index.js";
import { createId, formatShortDate, generateGuidedSession } from "../utils/helpers";

const defaultPrompt = {
  objective: "Pressing",
  category: "Adulti",
  duration: 90,
  players: 18,
  field: "Campo intero",
  intensity: "Media",
  matchDayDistance: "MD-3",
  specialConstraints: "",
};

export default function AiSessionBuilder({ exercises = [], sessions = [], setSessions, players = [] }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [generatedSession, setGeneratedSession] = useState(null);
  const [generationSource, setGenerationSource] = useState("local");
  const [generationMessage, setGenerationMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  const localPreview = useMemo(
    () => generateGuidedSession({ ...prompt, exercises, players: prompt.players || players.length }),
    [prompt, exercises, players.length]
  );
  const generated = generatedSession || localPreview;

  const generatedExercises = generated.exercises.map((item) => {
    const exercise = exercises.find((candidate) => String(candidate.id) === String(item.exerciseId));
    return { ...item, exercise };
  });
  const totalMinutes = generated.exercises.reduce((sum, item) => sum + Number(item.customDuration || 0), 0);

  function updatePrompt(field, value) {
    setPrompt((prev) => ({ ...prev, [field]: value }));
    setGeneratedSession(null);
    setGenerationSource("local");
    setGenerationMessage("");
  }

  async function generateWithAi() {
    setGenerating(true);
    setGenerationMessage("");

    const result = await generateAiTrainingSession({
      prompt,
      exercises,
      fallbackSession: localPreview,
    });

    setGeneratedSession(result.session);
    setGenerationSource(result.source);
    setGenerationMessage(result.warning || "Seduta generata con OpenAI.");
    setGenerating(false);
  }

  function saveSession() {
    const payload = {
      ...generated,
      id: createId("session"),
      duration: totalMinutes,
    };

    setSessions([...sessions, payload]);
    navigate("/trainings");
  }

  return (
    <div style={builderStyles.page}>
      <PageHeader
        title="Builder AI"
        subtitle="Genera una seduta da brief tecnico: obiettivo, categoria, giocatori, campo e distanza dalla gara."
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => navigate("/trainings")}>Crea manualmente</Button>
            <Badge tone={isOpenAiConfigured() ? "green" : "orange"}>
              {isOpenAiConfigured() ? "OpenAI configurato" : "Fallback locale"}
            </Badge>
          </div>
        }
      />

      <div style={builderStyles.grid}>
        <AppCard title="Brief seduta" subtitle="Questa e' la base del futuro prompt AI.">
          <div style={builderStyles.formGrid}>
            <Field label="Obiettivo">
              <select value={prompt.objective} onChange={(event) => updatePrompt("objective", event.target.value)} style={styles.input}>
                <option>Possesso</option>
                <option>Pressing</option>
                <option>Transizione</option>
                <option>Finalizzazione</option>
                <option>Fase difensiva</option>
                <option>Palla inattiva</option>
              </select>
            </Field>
            <Field label="Categoria">
              <select value={prompt.category} onChange={(event) => updatePrompt("category", event.target.value)} style={styles.input}>
                <option>Adulti</option>
                <option>Juniores</option>
                <option>Allievi</option>
                <option>Giovanissimi</option>
              </select>
            </Field>
            <Field label="Durata">
              <input type="number" min="30" value={prompt.duration} onChange={(event) => updatePrompt("duration", Number(event.target.value))} style={styles.input} />
            </Field>
            <Field label="Giocatori">
              <input type="number" min="6" value={prompt.players} onChange={(event) => updatePrompt("players", Number(event.target.value))} style={styles.input} />
            </Field>
            <Field label="Campo">
              <select value={prompt.field} onChange={(event) => updatePrompt("field", event.target.value)} style={styles.input}>
                <option>Campo intero</option>
                <option>Mezzo campo</option>
                <option>Un quarto campo</option>
                <option>Palestra</option>
              </select>
            </Field>
            <Field label="Intensita">
              <select value={prompt.intensity} onChange={(event) => updatePrompt("intensity", event.target.value)} style={styles.input}>
                <option>Bassa</option>
                <option>Media</option>
                <option>Alta</option>
              </select>
            </Field>
            <Field label="Distanza gara">
              <select value={prompt.matchDayDistance} onChange={(event) => updatePrompt("matchDayDistance", event.target.value)} style={styles.input}>
                <option>MD+1</option>
                <option>MD-4</option>
                <option>MD-3</option>
                <option>MD-2</option>
                <option>MD-1</option>
              </select>
            </Field>
            <Field label="Vincoli speciali">
              <textarea
                value={prompt.specialConstraints}
                onChange={(event) => updatePrompt("specialConstraints", event.target.value)}
                placeholder="Es. 2 rientri da infortunio, niente contrasti, campo pesante, 4 assenti..."
                style={{ ...styles.input, minHeight: 110 }}
              />
            </Field>
            <div style={builderStyles.aiActions}>
              <Button
                onClick={generateWithAi}
                disabled={generating || !exercises.length}
                style={{ opacity: generating ? 0.6 : 1, cursor: generating ? "not-allowed" : "pointer" }}
              >
                {generating ? "⏳ Generazione in corso…" : "Genera con AI"}
              </Button>
              <Button variant="ghost" onClick={() => {
                setGeneratedSession(localPreview);
                setGenerationSource("local");
                setGenerationMessage("Anteprima rigenerata localmente.");
              }}>
                Usa fallback locale
              </Button>
            </div>
          </div>
        </AppCard>

        <AppCard title="Anteprima generata" subtitle="Puoi salvarla nelle sedute e rifinirla dal planner.">
          <div style={builderStyles.previewHeader}>
            <div>
              <div style={builderStyles.badges}>
                <Badge tone="blue">{generated.theme}</Badge>
                <Badge tone={generationSource === "openai" ? "green" : "orange"}>
                  {generationSource === "openai" ? "OpenAI" : "Locale"}
                </Badge>
              </div>
              <h2 style={{ margin: "10px 0 6px" }}>{generated.title}</h2>
              <p style={builderStyles.muted}>{formatShortDate(generated.date)} · {totalMinutes} min · {prompt.players} giocatori</p>
            </div>
            <Button onClick={saveSession} disabled={!generated.exercises.length}>
              Salva in Sedute
            </Button>
          </div>

          <p style={builderStyles.objective}>{generated.objective}</p>
          {generationMessage && (
            <p style={builderStyles.message}>{generationMessage}</p>
          )}

          {generatedExercises.length ? (
            <div style={builderStyles.timeline}>
              {generatedExercises.map((item, index) => (
                <div key={`${item.exerciseId}-${index}`} style={builderStyles.block}>
                  <div style={builderStyles.blockNumber}>{index + 1}</div>
                  <div>
                    <h3>{item.exercise?.title || "Esercizio"}</h3>
                    <p>{item.exercise?.category || "Categoria"} · {item.customDuration} min · {item.customPlayers} giocatori</p>
                    <small>{item.variantNotes}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🧩" title="Nessun esercizio disponibile" text="Aggiungi esercizi alla libreria per generare una seduta." />
          )}
        </AppCard>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={builderStyles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const builderStyles = {
  page: { display: "grid", gap: 22 },
  grid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 22, alignItems: "start" },
  formGrid: { display: "grid", gap: 12 },
  field: { display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  aiActions: { display: "grid", gap: 10, marginTop: 4 },
  previewHeader: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
  badges: { display: "flex", gap: 8, flexWrap: "wrap" },
  muted: { color: "#94a3b8", margin: 0 },
  objective: { color: "#cbd5e1", lineHeight: 1.55, padding: 14, borderRadius: 16, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)" },
  message: { color: "#facc15", lineHeight: 1.45, padding: 12, borderRadius: 14, background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.16)" },
  timeline: { display: "grid", gap: 12, marginTop: 16 },
  block: { display: "grid", gridTemplateColumns: "44px 1fr", gap: 12, padding: 14, borderRadius: 18, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  blockNumber: { width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(56,189,248,0.14)", color: "#bae6fd", fontWeight: 900 },
};
