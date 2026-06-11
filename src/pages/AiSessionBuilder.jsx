import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { generateAiTrainingSession, isOpenAiConfigured } from "../services/aiSessionService";
import { styles } from "../styles/index.js";
import { RPE_BY_MATCH_DAY, createId, formatShortDate, generateGuidedSession } from "../utils/helpers";
import { useTranslation } from "../i18n";

const defaultPrompt = {
  objective: "Pressing",
  category: "Prima squadra",
  duration: 90,
  players: 18,
  field: "Campo intero",
  intensity: "Media",
  matchDayDistance: "MD-3",
  specialConstraints: "",
};

export default function AiSessionBuilder({
  exercises = [], setSessions, players = [] }) {

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const isMobile = useIsMobile();
  const [generatedSession, setGeneratedSession] = useState(null);
  const [generationSource, setGenerationSource] = useState("local");
  const [generationMessage, setGenerationMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  // RPE calcolato in base alla distanza dalla gara
  const rpeTarget = RPE_BY_MATCH_DAY[prompt.matchDayDistance] || RPE_BY_MATCH_DAY["MD-3"];

  // Translated RPE display — uses the same keys already defined in Trainings.jsx
  const RPE_I18N = {
    "MD+1": ["pages.trainings.rpeMDp1Label", "pages.trainings.rpeMDp1Description"],
    "MD-4": ["pages.trainings.rpeMDm4Label", "pages.trainings.rpeMDm4Description"],
    "MD-3": ["pages.trainings.rpeMDm3Label", "pages.trainings.rpeMDm3Description"],
    "MD-2": ["pages.trainings.rpeMDm2Label", "pages.trainings.rpeMDm2Description"],
    "MD-1": ["pages.trainings.rpeMDm1Label", "pages.trainings.rpeMDm1Description"],
  };
  const [rpeLabel, rpeDescription] = (RPE_I18N[prompt.matchDayDistance] || RPE_I18N["MD-3"]).map((k) => t(k));

  // Carica il catalogo FP5 e lo unisce agli esercizi personali
  const [fp5Catalog, setFp5Catalog] = useState([]);
  useEffect(() => {
    import("../data/eserciziarioFp5.js")
      .then(({ eserciziarioFp5 }) => setFp5Catalog(eserciziarioFp5))
      .catch(() => {});
  }, []);

  // Merge: esercizi personali hanno precedenza su FP5 (stesso ID = override)
  const allExercises = useMemo(() => {
    const personalIds = new Set(exercises.map((e) => e.id));
    const fp5Only = fp5Catalog.filter((e) => !personalIds.has(e.id));
    return [...exercises, ...fp5Only];
  }, [exercises, fp5Catalog]);

  const localPreview = useMemo(
    () => generateGuidedSession({ ...prompt, exercises: allExercises, players: prompt.players || players.length }),
    [prompt, allExercises, players.length]
  );
  const generated = generatedSession || localPreview;

  const generatedExercises = generated.exercises.map((item) => {
    const exercise = allExercises.find((candidate) => String(candidate.id) === String(item.exerciseId));
    return { ...item, exercise };
  });
  const totalMinutes = generated.exercises.reduce((sum, item) => sum + Number(item.customDuration || 0), 0);

  function updatePrompt(field, value) {
    setPrompt((prev) => ({ ...prev, [field]: value }));
    setGeneratedSession(null);
    setGenerationSource("local");
    setGenerationMessage("");
  }

  function getRpeBlocks(md) {
    if (md === "MD+1") return "Riscaldamento, Possesso Palla";
    if (md === "MD-1") return "Riscaldamento, Possesso Palla, Giochi di Posizione";
    if (md === "MD-3") return "Small Side Games, Partita a Tema, Partita Finale";
    if (md === "MD-2") return "Giochi di Posizione, Small Side Games, Partita a Tema";
    return "Tutti i blocchi";
  }

  async function generateWithAi() {
    setGenerating(true);
    setGenerationMessage("");

    const enrichedPrompt = {
      ...prompt,
      specialConstraints: [
        `RPE target: ${rpeTarget.min}-${rpeTarget.max}/10 (${rpeTarget.label} — ${rpeTarget.description})`,
        `Priorità blocchi: ${getRpeBlocks(prompt.matchDayDistance)}`,
        prompt.specialConstraints,
      ].filter(Boolean).join("\n"),
    };

    const result = await generateAiTrainingSession({
      prompt: enrichedPrompt,
      exercises: allExercises,
      fallbackSession: localPreview,
    });

    setGeneratedSession(result.session);
    setGenerationSource(result.source);
    setGenerationMessage(result.warning || t("pages.aiSessionBuilder.aiMsg"));
    setGenerating(false);
  }

  function saveSession() {
    const payload = {
      ...generated,
      id: createId("session"),
      duration: totalMinutes,
    };

    setSessions((prevSessions) => [...prevSessions, payload]);
    navigate("/trainings");
  }

  return (
    <div style={builderStyles.page}>
      <PageHeader
        title={t("pages.aiSessionBuilder.title")}
        subtitle={t("pages.aiSessionBuilder.subtitle")}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => navigate("/trainings")}>{t("pages.aiSessionBuilder.backBtn")}</Button>
            <Badge tone={isOpenAiConfigured() ? "green" : "orange"}>
              {isOpenAiConfigured() ? t("pages.aiSessionBuilder.geminiConfigured") : t("pages.aiSessionBuilder.localFallback")}
            </Badge>
          </div>
        }
      />

      <div style={{ ...builderStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "360px 1fr" }}>
        <AppCard title={t("pages.aiSessionBuilder.briefTitle")} subtitle={t("pages.aiSessionBuilder.briefSubtitle")}>
          <div style={builderStyles.formGrid}>
            <Field label={t("pages.aiSessionBuilder.fieldObjective")}>
              <select value={prompt.objective} onChange={(event) => updatePrompt("objective", event.target.value)} style={styles.input}>
                <option value="Possesso">{t("pages.aiSessionBuilder.objPossesso")}</option>
                <option value="Pressing">{t("pages.aiSessionBuilder.objPressing")}</option>
                <option value="Transizione">{t("pages.aiSessionBuilder.objTransizione")}</option>
                <option value="Finalizzazione">{t("pages.aiSessionBuilder.objFinalizzazione")}</option>
                <option value="Fase difensiva">{t("pages.aiSessionBuilder.objDifensiva")}</option>
                <option value="Palla inattiva">{t("pages.aiSessionBuilder.objPallaInattiva")}</option>
              </select>
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldCategory")}>
              <select value={prompt.category} onChange={(event) => updatePrompt("category", event.target.value)} style={styles.input}>
                <option value="Prima squadra">{t("pages.aiSessionBuilder.catPrima")}</option>
                <option value="Juniores">{t("pages.aiSessionBuilder.catJuniores")}</option>
                <option value="Allievi">{t("pages.aiSessionBuilder.catAllievi")}</option>
                <option value="Giovanissimi">{t("pages.aiSessionBuilder.catGiovanissimi")}</option>
              </select>
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldDuration")}>
              <input type="number" min="30" value={prompt.duration} onChange={(event) => updatePrompt("duration", Number(event.target.value))} style={styles.input} />
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldPlayers")}>
              <input type="number" min="6" value={prompt.players} onChange={(event) => updatePrompt("players", Number(event.target.value))} style={styles.input} />
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldField")}>
              <select value={prompt.field} onChange={(event) => updatePrompt("field", event.target.value)} style={styles.input}>
                <option value="Campo intero">{t("pages.aiSessionBuilder.fieldCampoIntero")}</option>
                <option value="Mezzo campo">{t("pages.aiSessionBuilder.fieldMezzoTerzo")}</option>
                <option value="Un quarto campo">{t("pages.aiSessionBuilder.fieldQuartoTerzo")}</option>
                <option value="Palestra">{t("pages.aiSessionBuilder.fieldPalestra")}</option>
              </select>
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldIntensity")}>
              <select value={prompt.intensity} onChange={(event) => updatePrompt("intensity", event.target.value)} style={styles.input}>
                <option value="Bassa">{t("pages.aiSessionBuilder.intBassa")}</option>
                <option value="Media">{t("pages.aiSessionBuilder.intMedia")}</option>
                <option value="Alta">{t("pages.aiSessionBuilder.intAlta")}</option>
              </select>
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldMatchDay")}>
              <select value={prompt.matchDayDistance} onChange={(event) => updatePrompt("matchDayDistance", event.target.value)} style={styles.input}>
                <option>MD+1</option>
                <option>MD-4</option>
                <option>MD-3</option>
                <option>MD-2</option>
                <option>MD-1</option>
              </select>
            </Field>
            <Field label={t("pages.aiSessionBuilder.fieldConstraints")}>
              <textarea
                value={prompt.specialConstraints}
                onChange={(event) => updatePrompt("specialConstraints", event.target.value)}
                placeholder={t("pages.aiSessionBuilder.constraintsPlaceholder")}
                style={{ ...styles.input, minHeight: 110 }}
              />
            </Field>
            <div style={builderStyles.aiActions}>
              <Button
                onClick={generateWithAi}
                disabled={generating || !allExercises.length}
                style={{ opacity: generating ? 0.6 : 1, cursor: generating ? "not-allowed" : "pointer" }}
              >
                {generating ? t("pages.aiSessionBuilder.generating") : t("pages.aiSessionBuilder.generateBtn")}
              </Button>
              <Button variant="ghost" onClick={() => {
                setGeneratedSession(localPreview);
                setGenerationSource("local");
                setGenerationMessage(t("pages.aiSessionBuilder.localFallbackMsg"));
              }}>
                {t("pages.aiSessionBuilder.localFallbackBtn")}
              </Button>
            </div>
          </div>
        </AppCard>

        <AppCard title={t("pages.aiSessionBuilder.previewTitle")} subtitle={t("pages.aiSessionBuilder.previewSubtitle")}>
          {/* Pannello RPE */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
            borderRadius: 12, marginBottom: 16,
            background: rpeTarget.color === "red" ? "rgba(239,68,68,0.08)" :
                        rpeTarget.color === "green" ? "rgba(34,197,94,0.08)" :
                        rpeTarget.color === "blue" ? "rgba(56,189,248,0.08)" :
                        "rgba(255,255,255,0.05)",
            border: `1px solid ${
              rpeTarget.color === "red" ? "rgba(239,68,68,0.25)" :
              rpeTarget.color === "green" ? "rgba(34,197,94,0.25)" :
              rpeTarget.color === "blue" ? "rgba(56,189,248,0.25)" :
              "rgba(255,255,255,0.1)"
            }`,
          }}>
            <div style={{ textAlign: "center", minWidth: 52 }}>
              <div style={{
                fontSize: 22, fontWeight: 900,
                color: rpeTarget.color === "red" ? "#ef4444" :
                       rpeTarget.color === "green" ? "#22c55e" :
                       rpeTarget.color === "blue" ? "#38bdf8" : "#94a3b8",
              }}>
                {rpeTarget.min}–{rpeTarget.max}
              </div>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>RPE</div>
            </div>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                {rpeLabel}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                {rpeDescription} · {t("pages.aiSessionBuilder.rpeBlocks")} {getRpeBlocks(prompt.matchDayDistance)}
              </p>
            </div>
            {/* Barra visiva RPE */}
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", minWidth: 60 }}>
              <div style={{
                height: "100%",
                width: `${(rpeTarget.max / 10) * 100}%`,
                borderRadius: 3,
                background: rpeTarget.color === "red" ? "#ef4444" :
                            rpeTarget.color === "green" ? "#22c55e" :
                            rpeTarget.color === "blue" ? "#38bdf8" : "#94a3b8",
                transition: "width .3s",
              }} />
            </div>
          </div>
          <div style={builderStyles.previewHeader}>
            <div>
              <div style={builderStyles.badges}>
                <Badge tone="blue">{generated.theme}</Badge>
                <Badge tone={generationSource === "gemini" ? "green" : "orange"}>
                  {generationSource === "gemini" ? t("pages.aiSessionBuilder.geminiSource") : t("pages.aiSessionBuilder.localSource")}
                </Badge>
              </div>
              <h2 style={{ margin: "10px 0 6px" }}>{generated.title}</h2>
              <p style={builderStyles.muted}>{formatShortDate(generated.date)} · {totalMinutes} min · {prompt.players} {t("pages.aiSessionBuilder.fieldPlayers").toLowerCase()}</p>
            </div>
            <Button onClick={saveSession} disabled={!generated.exercises.length}>
              {t("pages.aiSessionBuilder.saveSession")}
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
                    <h3>{item.exercise?.title || t("pages.aiSessionBuilder.exerciseFallback")}</h3>
                    <p>{item.exercise?.category || t("pages.aiSessionBuilder.categoryFallback")} · {item.customDuration} min · {item.customPlayers} {t("pages.aiSessionBuilder.fieldPlayers").toLowerCase()}</p>
                    <small>{item.variantNotes}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🧩" title={t("pages.aiSessionBuilder.emptyTitle")} text={t("pages.aiSessionBuilder.emptyText")} />
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
  field: { display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase" },
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
