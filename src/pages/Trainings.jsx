import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import ActionBar from "../components/ui/ActionBar";
import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonList } from "../components/ui/Skeleton";
import MetricStrip from "../components/ui/MetricStrip";
import SearchBar from "../components/ui/SearchBar";
import SortableTrainingTimeline from "../components/trainings/SortableTrainingTimeline";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAreaPermission } from "../components/auth/permissionContext";

import { uploadTeamAttachment } from "../services/attachments";
import { styles } from "../styles/index.js";
import { createId, formatDate, getPlayerUnavailabilityOnDate, localDateString, normalizeAppSettings, RPE_BY_MATCH_DAY, TRAINING_BLOCKS, getBlockFromCategory } from "../utils/helpers";
import { emptyExercise } from "../data/initialData";
import { useTranslation } from "../i18n";
import { sendTeamNotification } from "../services/notifications";
import { OBJECTIVE_STATUS, getObjectiveStatusMeta } from "../constants/objectiveStatus";
import { useIsMobile } from "../hooks/useIsMobile";

const THEME_LABEL_KEYS = {
  Costruzione: "pages.trainings.themeCostruzione",
  Possesso: "pages.trainings.themePossesso",
  Pressing: "pages.trainings.themePressing",
  Transizione: "pages.trainings.themeTransizione",
  Finalizzazione: "pages.trainings.themeFinalizzazione",
  "Fase difensiva": "pages.trainings.themeFaseDifensiva",
  "Palla inattiva": "pages.trainings.themePallaInattiva",
  Recupero: "pages.trainings.themeRecupero",
};
const RPE_LABEL_KEYS = {
  "MD+1": ["pages.trainings.rpeMDp1Label", "pages.trainings.rpeMDp1Description"],
  "MD-4": ["pages.trainings.rpeMDm4Label", "pages.trainings.rpeMDm4Description"],
  "MD-3": ["pages.trainings.rpeMDm3Label", "pages.trainings.rpeMDm3Description"],
  "MD-2": ["pages.trainings.rpeMDm2Label", "pages.trainings.rpeMDm2Description"],
  "MD-1": ["pages.trainings.rpeMDm1Label", "pages.trainings.rpeMDm1Description"],
};

function getThemeLabel(theme, t) {
  return t(THEME_LABEL_KEYS[theme] || "pages.trainings.themeFallback");
}

function getRpeDisplayMeta(md, rpe, t) {
  const [labelKey, descriptionKey] = RPE_LABEL_KEYS[md] || RPE_LABEL_KEYS["MD-3"];
  return {
    ...rpe,
    label: t(labelKey),
    description: t(descriptionKey),
  };
}

function Trainings({
  exercises, setExercises, sessions, setSessions, players = [], _matches = [], appSettings = {}, loading = false, teamId = null }) {

  const { t } = useTranslation();
  const isMobile = useIsMobile(760);
  const navigate = useNavigate();
  const location = useLocation();
  const { canManage } = useAreaPermission();
  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [pickerBlock, setPickerBlock] = useState("Tutti");
  const [sessionsView, setSessionsView] = useState("lista"); // "lista" | "settimana"
  const [libraryCollapsed, setLibraryCollapsed] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = settimana corrente
  const formCardRef = useRef(null);

  function scrollToTrainingForm() {
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Disponibilità giocatori dalla tabella player_availability (per includere juniores disponibili)
  const [availabilityRecords, setAvailabilityRecords] = useState([]);
  useEffect(() => {
    if (!teamId) return;
    async function load() {
      const { fetchPlayerAvailability } = await import("../services/playerAvailability");
      const { data } = await fetchPlayerAvailability({ teamId });
      if (data) setAvailabilityRecords(data);
    }
    load();
  }, [teamId]);

  // Carica catalogo FP5 in background
  const [fp5Catalog, setFp5Catalog] = useState([]);
  useEffect(() => {
    import("../data/eserciziarioFp5.js")
      .then(({ eserciziarioFp5 }) => setFp5Catalog(eserciziarioFp5))
      .catch(() => {});
  }, []);

  // Merge: esercizi personali + FP5 (personali hanno precedenza)
  const allExercises = useMemo(() => {
    const personalIds = new Set((exercises || []).map((e) => e.id));
    const fp5Only = fp5Catalog.filter((e) => !personalIds.has(e.id));
    return [...(exercises || []), ...fp5Only];
  }, [exercises, fp5Catalog]);

  const [form, setForm] = useState(() => {
    const fromState = location.state?.draftTraining;
    if (fromState) {
      try { sessionStorage.removeItem("trainings_draft"); } catch { /* ignore */ }
      return getInitialTrainingForm(fromState);
    }
    try {
      const stored = sessionStorage.getItem("trainings_draft");
      if (stored) {
        sessionStorage.removeItem("trainings_draft");
        return getInitialTrainingForm(JSON.parse(stored));
      }
    } catch { /* ignore */ }
    return getInitialTrainingForm(null);
  });

  useEffect(() => {
    const draftTraining = location.state?.draftTraining;
    const newSession = location.state?.newSession;

    if (draftTraining) {
      showToast(t("pages.trainings.draftLoaded"), "info");
    }

    if (newSession || draftTraining) {
      navigate(location.pathname, { replace: true, state: null });
    }

    if (newSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingId(null);
      setForm(emptyTraining());
      setFormErrors({});
      setTimeout(scrollToTrainingForm, 150);
    }
  }, [location.pathname, location.state, navigate, showToast, t]);

  // RPE calcolato dalla distanza dalla gara
  const rpeTarget = RPE_BY_MATCH_DAY[form.matchDayDistance] || RPE_BY_MATCH_DAY["MD-3"];

  // L'elenco "Sedute salvate" deve seguire l'ordine cronologico delle sedute,
  // non l'ordine grezzo con cui arrivano dal backend (che può essere
  // qualsiasi cosa, es. ordine di sincronizzazione).
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [sessions]
  );

  // Prossima seduta disponibile (da oggi in poi, quella con data più vicina)
  const nextSession = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sortedSessions.filter((s) => s.date >= today)[0] || null;
  }, [sortedSessions]);

  const filteredExercises = allExercises.filter((exercise) => {
    const matchSearch = `${exercise.title} ${exercise.category} ${exercise.objective}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const exBlock = exercise.trainingBlock || getBlockFromCategory(exercise.category);
    const matchBlock = pickerBlock === "Tutti" || exBlock === pickerBlock;
    return matchSearch && matchBlock;
  });

  const selectedExercises = useMemo(() => {
    return form.exercises.map((item) => {
      const exercise = allExercises.find((ex) => ex.id === item.exerciseId);

      return {
        ...exercise,
        ...item,
        title: exercise?.title || t("pages.trainings.exerciseFallback"),
        category: exercise?.category || "",
        objective: exercise?.objective || "",
        duration: exercise?.duration || item.customDuration || 0,
      };
    });
  }, [form.exercises, allExercises, t]);

  const totalMinutes =
    selectedExercises.reduce((sum, item) => sum + Number(item.customDuration || item.duration || 0), 0) +
    (form.sessionBlocks || []).reduce((sum, b) => sum + (Number(b.duration) || 0), 0);
  const sessionAvailability = useMemo(
    () => getSessionAvailability(players, form.date, availabilityRecords),
    [players, form.date, availabilityRecords]
  );
  const sessionAssignablePlayers = useMemo(
    () => sessionAvailability.available.filter((player) => isPlayerAvailableForSession(player, form.attendance)),
    [sessionAvailability.available, form.attendance]
  );
  const objectiveStatusMeta = getObjectiveStatusMeta(form.objectiveStatus);
  const trainingMetricItems = [
    {
      key: "duration",
      label: t("pages.trainings.printMetaDuration"),
      value: `${totalMinutes} min`,
      color: "#60a5fa",
    },
    {
      key: "exercises",
      label: t("pages.trainings.previewMetaExercises"),
      value: selectedExercises.length,
      color: "#a78bfa",
    },
    {
      key: "rpe",
      label: t("pages.trainings.printRpeTarget"),
      value: `${rpeTarget.min}-${rpeTarget.max}`,
      color: "#fb923c",
    },
    {
      key: "available",
      label: t("pages.trainings.printAvailablePlayers"),
      value: (() => {
        const primaPresent = sessionAvailability.available.filter((p) => {
          if (p._juniores) return false;
          return form.attendance[String(p.id)]?.status !== "Assente";
        }).length;
        return sessionAvailability.total ? `${primaPresent}/${sessionAvailability.total}` : "-";
      })(),
      color: "#22c55e",
    },
  ];

  function toggleExercise(exercise) {
    if (!canManage) return;
    const alreadySelected = form.exercises.some(
      (item) => item.exerciseId === exercise.id
    );

    if (alreadySelected) {
      setForm((prev) => ({
        ...prev,
        exercises: prev.exercises.filter(
          (item) => item.exerciseId !== exercise.id
        ),
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          exerciseId: exercise.id,
          customDuration: exercise.duration || 15,
          customPlayers: exercise.players || players.length || "",
          variantNotes: "",
        },
      ],
    }));
  }

  function updateVariant(exerciseId, field, value) {
    if (!canManage) return;
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((item) =>
        item.exerciseId === exerciseId ? { ...item, [field]: value } : item
      ),
    }));
  }

  function saveTraining() {
    if (!canManage) return;
    const errors = {};
    if (!form.title.trim()) errors.title = true;
    if (!form.date) errors.date = true;
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast(t("pages.trainings.titleRequired"), "warn");
      return;
    }
    setFormErrors({});

    const payload = {
      ...form,
      id: editingId || createId("session"),
      duration: totalMinutes,
    };

    if (editingId) {
      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === editingId ? payload : session
        )
      );
    } else {
      setSessions((prevSessions) => [...prevSessions, payload]);
      if (teamId) {
        sendTeamNotification({
          teamId,
          type: "new_session",
          payload: { title: payload.title, date: payload.date || "" },
        });
      }
    }

    setEditingId(null);
    setForm(emptyTraining());
    showToast(editingId ? t("pages.trainings.sessionUpdated") : t("pages.trainings.sessionSaved"), "ok");
  }

  function editTraining(session) {
    if (!canManage) return;
    setEditingId(session.id);

    setForm({
      title: session.title || "",
      date: session.date || localDateString(),
      type: session.type || "Allenamento",
      theme: session.theme || "Costruzione",
      matchDayDistance: session.matchDayDistance || "MD-3",
      objective: session.objective || "",
      notes: session.notes || "",
      exercises: session.exercises || [],
      attendance: session.attendance || {},
      sourceType: session.sourceType || "",
      sourceMatchId: session.sourceMatchId || "",
      sourceMatchLabel: session.sourceMatchLabel || "",
      sourceMatchDate: session.sourceMatchDate || "",
      sourceSummary: session.sourceSummary || "",
      objectiveStatus: session.objectiveStatus || "todo",
      objectiveReview: session.objectiveReview || "",
      sessionBlocks: session.sessionBlocks || [],
      numTeams: session.numTeams || 2,
      teamAssignments: session.teamAssignments || {},
      partitella: session.partitella || null,
      teamFormations: session.teamFormations || {},
      materials: session.materials || "",
      completed: Boolean(session.completed),
      completedAt: session.completedAt || "",
    });

    requestAnimationFrame(scrollToTrainingForm);
  }

  function deleteTraining(id) {
    if (!canManage) return;
    const removed = sessions.find((s) => s.id === id);
    if (!removed) return;
    setConfirmState({
      message: t("pages.trainings.deleteConfirm"),
      confirmLabel: t("common.delete"),
      confirmTone: "red",
      onConfirm: () => {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setForm(emptyTraining());
        }
        showToast(t("pages.trainings.sessionDeleted"), "info", {
          duration: 5000,
          action: {
            label: t("common.undo"),
            fn: () => setSessions((prev) => [...prev, removed]),
          },
        });
      },
    });
  }

  function toggleTrainingCompleted(id) {
    if (!canManage) return;
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id !== id) return session;
        const completed = !session.completed;
        return {
          ...session,
          completed,
          completedAt: completed ? new Date().toISOString() : "",
        };
      })
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyTraining());
    setFormErrors({});
  }

  async function exportSessionPlanPDF() {
    try {
      const { generateSessionPlanPDF } = await import("../utils/generateSessionPlanPDF");
      await generateSessionPlanPDF({ session: form, appSettings });
    } catch (err) {
      console.error("PDF export failed:", err);
      showToast("Errore nella generazione del PDF", "error");
    }
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.trainings.title")}
        subtitle={t("pages.trainings.subtitle")}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => navigate("/exports")}>{t("pages.trainings.exportPdf")}</Button>
            <Button variant="ghost" onClick={() => navigate("/attendance-register")}>{t("pages.trainings.attendanceRegister")}</Button>
            {canManage && <Button onClick={() => navigate("/ai-session-builder")}>{t("pages.trainings.generateAi")}</Button>}
          </div>
        }
      />

      {editingId && (
        <ActionBar
          eyebrow={clubName}
          title={form.title || t("pages.trainings.printTitlePlaceholder")}
          subtitle={`${getThemeLabel(form.theme, t)} · ${form.matchDayDistance}`}
          meta={<Badge tone="blue">{t("pages.trainings.savedCount", { count: sessions.length })}</Badge>}
        >
          <MetricStrip items={trainingMetricItems} min={isMobile ? 118 : 132} style={{ marginTop: isMobile ? 8 : 14 }} className="mobile-scroll-x" />
        </ActionBar>
      )}

      {/* Anteprima prossima seduta */}
      {nextSession && !editingId && (
        <AppCard style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Prossima seduta
              </p>
              <h3 style={{ margin: "0 0 6px", fontSize: 20 }}>{nextSession.title || "Allenamento"}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{formatDate(nextSession.date)}</span>
                {nextSession.theme && <span style={{ fontSize: 13, color: "#94a3b8" }}>· {nextSession.theme}</span>}
                {nextSession.matchDayDistance && <span style={{ fontSize: 13, color: "#94a3b8" }}>· {nextSession.matchDayDistance}</span>}
                {(nextSession.sessionBlocks?.length > 0) && (
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>· {nextSession.sessionBlocks.length} blocchi · {nextSession.sessionBlocks.reduce((s, b) => s + (Number(b.duration) || 0), 0)} min</span>
                )}
              </div>
              {nextSession.objective && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>{nextSession.objective}</p>}
            </div>
            {canManage && (
              <Button onClick={() => editTraining(nextSession)} style={{ flexShrink: 0 }}>
                Modifica
              </Button>
            )}
          </div>
        </AppCard>
      )}

      {(editingId || !nextSession) && <div
        className="calciolab-two-column"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
          gap: 24,
          alignItems: "start",
          minWidth: 0,
        }}
      >
        <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
          <div className="print-area">
            <section className="print-template">
              <article>
                <header className="print-header">
                  <div>
                    <p>{t("pages.trainings.printSectionEyebrow")}</p>
                    <h1>{form.title || t("pages.trainings.printTitlePlaceholder")}</h1>
                  </div>
                  <div className="print-meta">
                    <span>{formatDate(form.date)}</span>
                    <span>{getThemeLabel(form.theme, t)}</span>
                    <span>{form.matchDayDistance}</span>
                    <span>{clubName}</span>
                  </div>
                </header>

                <section className="print-kpis">
                  <PrintKpi title={t("pages.trainings.printMetaDuration")} value={`${totalMinutes} min`} />
                  <PrintKpi title={t("pages.trainings.previewMetaExercises")} value={selectedExercises.length} />
                  <PrintKpi title={t("pages.trainings.printRpeTarget")} value={`${rpeTarget.min}-${rpeTarget.max}`} />
                  <PrintKpi
                    title={t("pages.trainings.printAvailablePlayers")}
                    value={sessionAvailability.total ? `${sessionAvailability.available.length}/${sessionAvailability.total}` : "-"}
                  />
                </section>

                <section className="print-section">
                  <h2>{t("pages.trainings.printPlanTitle")}</h2>
                  <div className="print-grid two">
                    <PrintBox
                      title={t("pages.trainings.printMetaObjective")}
                      value={form.objective || t("pages.trainings.printMetaObjectiveFallback")}
                    />
                    <PrintBox
                      title={t("pages.trainings.printMetaTheme")}
                      value={`${getThemeLabel(form.theme, t)} · ${form.matchDayDistance}`}
                    />
                    {form.sourceType === "postMatch" && (
                      <PrintBox
                        title={t("pages.trainings.printOrigin")}
                        value={`${t("pages.trainings.sourcePostMatch")}${form.sourceMatchLabel ? ` vs ${form.sourceMatchLabel}` : ""} · ${formatDate(form.sourceMatchDate)}`}
                      />
                    )}
                    {form.sourceType === "postMatch" && (
                      <PrintBox
                        title={t("pages.trainings.printObjectiveStatus")}
                        value={t(objectiveStatusMeta.labelKey)}
                      />
                    )}
                    {form.objectiveReview && (
                      <PrintBox title={t("pages.trainings.printObjectiveReview")} value={form.objectiveReview} />
                    )}
                    {form.notes && (
                      <PrintBox title={t("pages.trainings.printNotesStaff")} value={form.notes} />
                    )}
                  </div>
                </section>

                <section className="print-section">
                  <h2>{t("pages.trainings.printTimelineTitle")}</h2>
                  {selectedExercises.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t("pages.trainings.printExercise")}</th>
                          <th>{t("pages.trainings.printDuration")}</th>
                          <th>{t("pages.trainings.printPlayers")}</th>
                          <th>{t("pages.trainings.printVariantNotes")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExercises.map((item, index) => (
                          <tr key={item.id || item.exerciseId || index}>
                            <td>{index + 1}</td>
                            <td>
                              <strong>{item.title}</strong>
                              <small>{item.category || t("pages.trainings.categoryFallback")}</small>
                            </td>
                            <td>{Number(item.customDuration || item.duration || 0)} min</td>
                            <td>{item.customPlayers || "-"}</td>
                            <td>{item.variantNotes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <PrintBox title={t("pages.trainings.printExercise")} value={t("pages.trainings.printNoExercises")} />
                  )}
                </section>

                <footer style={trainingStyles.printFooter}>
                  {t("pages.trainings.printFooter", { clubName })} · {formatDate(new Date().toISOString())}
                </footer>
              </article>
            </section>
          </div>

  <div ref={formCardRef}>
  <AppCard>
    <div style={trainingStyles.formHero}>
      <div style={{ minWidth: 0 }}>
        <div style={trainingStyles.stepHeader}>
          <span style={trainingStyles.stepBadge}>1</span>
          <span>{t("pages.trainings.step1")}</span>
        </div>
        <h3 style={trainingStyles.formTitle}>
          {editingId ? t("pages.trainings.formTitleEdit") : t("pages.trainings.formTitleCreate")}
        </h3>
        <p style={trainingStyles.formSubtitle}>
          {t("pages.trainings.formSubtitle")}
        </p>
      </div>

      <div style={trainingStyles.durationBadge}>
        <span>{t("pages.trainings.durationLabel")}</span>
        <strong>{totalMinutes} min</strong>
      </div>
    </div>

    <div style={trainingStyles.sessionPreviewStrip}>
      <SessionMeta label={t("pages.trainings.fieldDate")} value={formatDate(form.date)} />
                <SessionMeta label={t("pages.trainings.fieldTheme")} value={getThemeLabel(form.theme, t)} />
      <SessionMeta label={t("pages.trainings.fieldObjective")} value={form.objective || t("pages.trainings.printMetaObjectiveFallback")} />
      <SessionMeta label={t("pages.trainings.fieldLoad")} value={form.matchDayDistance} />
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(min(190px,100%),1fr))",
        gap: 14,
      }}
    >
      <FieldLabel label={t("pages.trainings.fieldTitle")}>
        <input
          placeholder={t("pages.trainings.titlePlaceholder")}
          value={form.title}
          onChange={(e) => { setForm({ ...form, title: e.target.value }); if (formErrors.title) setFormErrors((p) => ({ ...p, title: false })); }}
          style={{ ...styles.input, ...(formErrors.title ? trainingStyles.inputError : {}) }}
        />
        {formErrors.title && <span style={trainingStyles.errorMsg}>{t("pages.trainings.titleRequired")}</span>}
      </FieldLabel>

      <FieldLabel label={t("pages.trainings.fieldDate")}>
        <input
          type="date"
          value={form.date}
          onChange={(e) => { setForm({ ...form, date: e.target.value }); if (formErrors.date) setFormErrors((p) => ({ ...p, date: false })); }}
          style={{ ...styles.input, ...(formErrors.date ? trainingStyles.inputError : {}) }}
        />
        {formErrors.date && <span style={trainingStyles.errorMsg}>{t("pages.trainings.dateRequired")}</span>}
      </FieldLabel>

      <FieldLabel label={t("pages.trainings.fieldTheme")}>
        <select
          value={form.theme}
          onChange={(e) => setForm({ ...form, theme: e.target.value })}
          style={styles.input}
        >
          <option value="Costruzione">{t("pages.trainings.themeCostruzione")}</option>
          <option value="Possesso">{t("pages.trainings.themePossesso")}</option>
          <option value="Pressing">{t("pages.trainings.themePressing")}</option>
          <option value="Transizione">{t("pages.trainings.themeTransizione")}</option>
          <option value="Finalizzazione">{t("pages.trainings.themeFinalizzazione")}</option>
          <option value="Fase difensiva">{t("pages.trainings.themeFaseDifensiva")}</option>
          <option value="Palla inattiva">{t("pages.trainings.themePallaInattiva")}</option>
          <option value="Recupero">{t("pages.trainings.themeRecupero")}</option>
        </select>
      </FieldLabel>

      <FieldLabel label={t("pages.trainings.fieldLoad")}>
        <select
          value={form.matchDayDistance}
          onChange={(e) => setForm({ ...form, matchDayDistance: e.target.value })}
          style={styles.input}
          title={t("pages.trainings.loadTooltip")}
        >
          <option value="MD+1">{t("pages.trainings.loadMDp1")}</option>
          <option value="MD-4">{t("pages.trainings.loadMDm4")}</option>
          <option value="MD-3">{t("pages.trainings.loadMDm3")}</option>
          <option value="MD-2">{t("pages.trainings.loadMDm2")}</option>
          <option value="MD-1">{t("pages.trainings.loadMDm1")}</option>
        </select>
      </FieldLabel>

      <FieldLabel label={t("pages.trainings.fieldObjective")}>
        <input
          placeholder={t("pages.trainings.objectivePlaceholder")}
          value={form.objective}
          onChange={(e) => setForm({ ...form, objective: e.target.value })}
          style={styles.input}
        />
      </FieldLabel>

      <FieldLabel label={t("pages.trainings.fieldNotes")}>
        <textarea
          placeholder={t("pages.trainings.notesPlaceholder")}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{ ...styles.input, minHeight: 44, resize: "vertical" }}
        />
      </FieldLabel>

      <FieldLabel label="Materiali">
        <input
          placeholder="Es. Palloni, cinesini, casacche..."
          value={form.materials || ""}
          onChange={(e) => setForm({ ...form, materials: e.target.value })}
          style={styles.input}
        />
      </FieldLabel>
    </div>

    {/* Pannello RPE — distanza dalla gara */}
    <RpePanel rpe={rpeTarget} md={form.matchDayDistance} />

    {/* Giocatori disponibili per questa seduta */}
    {players.length > 0 && (
      <AvailablePlayers
        players={players}
        date={form.date}
        availabilityRecords={availabilityRecords}
        attendance={form.attendance}
        onToggle={(playerId) => setForm((f) => {
          const current = f.attendance[String(playerId)]?.status;
          const isJun = (players.find((p) => String(p.id) === String(playerId))?.gruppo || "prima") === "juniores";
          // Juniores: default assente → primo click = Presente; prima: default presente → primo click = Assente
          const next = isJun
            ? (current === "Presente" ? "Assente" : "Presente")
            : (current === "Assente" ? "Presente" : "Assente");
          return { ...f, attendance: { ...f.attendance, [String(playerId)]: { status: next } } };
        })}
      />
    )}
  </AppCard>
  </div>

  {/* ── Session Builder: blocchi strutturati ── */}
  <SessionBlockBuilder
    blocks={form.sessionBlocks || []}
    onChange={(blocks) => setForm((prev) => ({ ...prev, sessionBlocks: blocks }))}
    onSave={canManage ? saveTraining : null}
    saveLabel={editingId ? t("pages.trainings.updateSession") : t("pages.trainings.saveSession")}
    teamId={teamId}
    canManage={canManage}
    setExercises={setExercises}
    existingExercises={exercises}
  />

          <AppCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setLibraryCollapsed((v) => !v)}
                  title={libraryCollapsed ? t("pages.trainings.libraryExpand") : t("pages.trainings.libraryCollapse")}
                  aria-label={libraryCollapsed ? "Espandi libreria" : "Comprimi libreria"}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: 13,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {libraryCollapsed ? "▸" : "▾"}
                </button>
                <div>
                  <div style={trainingStyles.stepHeader}>
                    <span style={trainingStyles.stepBadge}>2</span>
                    <span>{t("pages.trainings.step2")}</span>
                  </div>
                  <h3 style={{ margin: 0, lineHeight: 1.2 }}>{t("pages.trainings.libraryTitle")}</h3>
                  {!libraryCollapsed && (
                    <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
                      {t("pages.trainings.librarySubtitle")}
                    </p>
                  )}
                </div>
              </div>

              {!libraryCollapsed && (
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder={t("pages.trainings.searchPlaceholder")}
                />
              )}
            </div>

            {libraryCollapsed ? null : (
              <>
            {/* Filtro per Training Block */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <BlockBtn active={pickerBlock === "Tutti"} onClick={() => setPickerBlock("Tutti")} color="default">
                {t("pages.trainings.filterAll")}
              </BlockBtn>
              {TRAINING_BLOCKS.map((b) => (
                <BlockBtn key={b.id} active={pickerBlock === b.id} onClick={() => setPickerBlock(b.id)} color={b.color}>
                  {b.icon} {b.id}
                </BlockBtn>
              ))}
            </div>

            {filteredExercises.length === 0 ? (
              <EmptyState
                icon="🎯"
                title={t("pages.trainings.noExercisesFound")}
                text={t("pages.trainings.noExercisesFoundText")}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 12,
                }}
              >
                {filteredExercises.map((exercise) => {
                  const selected = form.exercises.some(
                    (item) => item.exerciseId === exercise.id
                  );

                  return (
                    <button
                      key={exercise.id}
                      onClick={() => toggleExercise(exercise)}
                      style={{
                        borderRadius: 12,
                        padding: 14,
                        textAlign: "left",
                        cursor: "pointer",
                        color: "white",
                        background: selected
                          ? "rgba(56,189,248,0.16)"
                          : "rgba(255,255,255,0.045)",
                        border: selected
                          ? "1px solid rgba(56,189,248,0.35)"
                          : "1px solid rgba(255,255,255,0.08)",
                        minHeight: 100,
                      }}
                    >
                      {/* Block badge */}
                      {(() => {
                        const blk = exercise.trainingBlock || getBlockFromCategory(exercise.category);
                        const blkDef = TRAINING_BLOCKS.find((b) => b.id === blk);
                        return blkDef ? (
                          <span style={{
                            display: "inline-block", marginBottom: 6,
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: "rgba(255,255,255,0.07)", color: "#94a3b8",
                          }}>
                            {blkDef.icon} {blk}
                          </span>
                        ) : null;
                      })()}

                      <strong style={{ display: "block", lineHeight: 1.25, fontSize: 13 }}>
                        {exercise.title}
                      </strong>

                      <p style={{ color: "#94a3b8", margin: "6px 0", fontSize: 12, lineHeight: 1.3 }}>
                        {exercise.category || t("pages.trainings.categoryFallback")}
                      </p>

                      <Badge tone={selected ? "green" : "purple"}>
                        {selected ? t("pages.trainings.badgeSelected") : t("pages.trainings.badgeAdd")}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
              </>
            )}
          </AppCard>

          {(form.sessionBlocks || []).length > 0 && (
            <AppCard>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0 }}>🧱 Struttura seduta</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge tone="blue">
                    {(form.sessionBlocks || []).reduce((s, b) => s + (Number(b.duration) || 0), 0)} min totali
                  </Badge>
                  <Button
                    variant="ghost"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={exportSessionPlanPDF}
                  >
                    📄 PDF
                  </Button>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(form.sessionBlocks || []).map((block) => {
                  const phaseColor = PHASE_OPTIONS.find((p) => p.id === block.phase)?.color || "#94a3b8";
                  return (
                    <div key={block.id} style={{
                      display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap",
                      padding: "10px 14px", borderRadius: 12,
                      background: "rgba(15,23,42,0.5)", border: `1px solid ${phaseColor}33`,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: phaseColor, flexShrink: 0, paddingTop: 2 }}>{block.phase.toUpperCase()}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{block.name || "—"}</span>
                      <span style={{ color: "#94a3b8", fontSize: 12, flexShrink: 0 }}>{block.duration} min · Int. {block.intensity}/10</span>
                      {block.notes && <span style={{ width: "100%", color: "#64748b", fontSize: 12, paddingLeft: 2 }}>{block.notes}</span>}
                    </div>
                  );
                })}
              </div>
            </AppCard>
          )}

          {selectedExercises.length > 0 && (
            <AppCard>
              <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.trainings.variantsTitle")}</h3>

              <div style={{ display: "grid", gap: 12 }}>
                {selectedExercises.map((item) => (
                  <div
                    key={item.exerciseId}
                    className="training-variant-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 100px 100px 1fr",
                      gap: 12,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <strong>{item.title}</strong>

                    <input
                      type="number"
                      min="1"
                      title={t("pages.trainings.printDuration")}
                      aria-label={t("pages.trainings.printDuration")}
                      value={item.customDuration}
                      onChange={(e) =>
                        updateVariant(
                          item.exerciseId,
                          "customDuration",
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />

                    <input
                      type="number"
                      min="1"
                      title={t("pages.trainings.printPlayers")}
                      aria-label={t("pages.trainings.printPlayers")}
                      value={item.customPlayers}
                      onChange={(e) =>
                        updateVariant(
                          item.exerciseId,
                          "customPlayers",
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />

                    <input
                      placeholder={t("pages.trainings.variantNotesPlaceholder")}
                      value={item.variantNotes}
                      onChange={(e) =>
                        updateVariant(
                          item.exerciseId,
                          "variantNotes",
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />
                  </div>
                ))}
              </div>
            </AppCard>
          )}
        </div>

       <div className="no-print" style={{ display: "grid", gap: 20, minWidth: 0 }}>
  <AppCard>
    <div style={trainingStyles.stepHeader}>
      <span style={trainingStyles.stepBadge}>3</span>
      <span>{t("pages.trainings.step3")}</span>
    </div>
    <SortableTrainingTimeline
    exercises={selectedExercises}
    onReorder={(ordered) => {
      setForm((prev) => ({
        ...prev,
        exercises: ordered.map((item) => ({
          exerciseId: item.exerciseId,
          customDuration: item.customDuration,
          customPlayers: item.customPlayers,
          variantNotes: item.variantNotes || "",
        })),
      }));
    }}
  />
</AppCard>

          <AppCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {editingId && (
                  <Button variant="ghost" onClick={cancelEdit}>
                    {t("pages.trainings.cancel")}
                  </Button>
                )}
                {canManage && (
                  <Button onClick={saveTraining}>
                    {editingId ? t("pages.trainings.updateSession") : t("pages.trainings.saveSession")}
                  </Button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" style={{ fontSize: 12 }} onClick={() => setShowPreview((v) => !v)}>
                  {showPreview ? "Nascondi anteprima" : "👁 Anteprima PDF"}
                </Button>
                <Button variant="ghost" style={{ fontSize: 12 }} onClick={exportSessionPlanPDF}>
                  📄 Scarica PDF
                </Button>
              </div>
            </div>

            {showPreview && (
              <div style={trainingStyles.previewCard}>
                <div>
                  <p style={trainingStyles.previewEyebrow}>{t("pages.trainings.previewEyebrow")}</p>
                  <h2 style={trainingStyles.previewTitle}>
                    {form.title || t("pages.trainings.previewTitleFallback")}
                  </h2>
                </div>
                <div style={trainingStyles.previewMetaGrid}>
                  <SessionMeta label={t("pages.trainings.previewMetaDate")} value={formatDate(form.date)} />
                  <SessionMeta label={t("pages.trainings.previewMetaTheme")} value={getThemeLabel(form.theme, t)} />
                  <SessionMeta label={t("pages.trainings.previewMetaDuration")} value={`${totalMinutes} min`} />
                  <SessionMeta label={t("pages.trainings.previewMetaExercises")} value={selectedExercises.length} />
                </div>
                {form.objective && (
                  <p style={trainingStyles.previewObjective}>{form.objective}</p>
                )}
                {form.sourceType === "postMatch" && (
                  <div style={trainingStyles.sourceBox}>
                    <Badge tone="purple">{t("pages.trainings.sourcePostMatch")}</Badge>
                    <span>
                      {form.sourceMatchLabel ? `vs ${form.sourceMatchLabel}` : t("pages.trainings.sourceLinked")}
                      {form.sourceSummary ? ` · ${form.sourceSummary}` : ""}
                    </span>
                  </div>
                )}
                {form.sourceType === "postMatch" && (
                  <div style={trainingStyles.objectiveReviewBox}>
                    <label style={trainingStyles.field}>
                      <span>{t("pages.trainings.objectiveStatus")}</span>
                      <select
                        value={form.objectiveStatus || "todo"}
                        onChange={(event) => setForm({ ...form, objectiveStatus: event.target.value })}
                        style={styles.input}
                      >
                        {Object.entries(OBJECTIVE_STATUS).map(([value, meta]) => (
                          <option key={value} value={value}>{t(meta.labelKey)}</option>
                        ))}
                      </select>
                    </label>
                    <label style={trainingStyles.field}>
                      <span>{t("pages.trainings.staffReview")}</span>
                      <textarea
                        placeholder={t("pages.trainings.staffReviewPlaceholder")}
                        value={form.objectiveReview || ""}
                        onChange={(event) => setForm({ ...form, objectiveReview: event.target.value })}
                        style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </AppCard>

          <TeamGenerator
            availablePlayers={sessionAssignablePlayers}
            numTeams={form.numTeams || 2}
            assignments={form.teamAssignments || {}}
            partitella={form.partitella}
            onChange={({ assignments, numTeams }) => {
              setForm((f) => ({ ...f, teamAssignments: assignments, numTeams }));
              if (editingId) {
                setSessions((prevSessions) =>
                  prevSessions.map((session) =>
                    session.id === editingId
                      ? { ...session, teamAssignments: assignments, numTeams }
                      : session
                  )
                );
              }
            }}
            onPartitellaChange={(data) => {
              setForm((f) => ({ ...f, partitella: data }));
              if (editingId) {
                setSessions((prevSessions) =>
                  prevSessions.map((session) =>
                    session.id === editingId ? { ...session, partitella: data } : session
                  )
                );
              }
            }}
          />
          {(() => {
            const allAvail = sessionAssignablePlayers;
            const assignments = form.teamAssignments || {};
            const numTeams = form.numTeams || 2;
            const teams = Array.from({ length: numTeams }, (_, i) =>
              allAvail.filter((p) => assignments[String(p.id)] === i)
            );
            const hasAnyTeam = teams.some((t) => t.length > 0);
            if (!hasAnyTeam) return null;
            return (
              <FormationView
                teams={teams}
                teamColors={TEAM_COLORS}
                numTeams={numTeams}
                savedFormations={form.teamFormations || {}}
                onSave={(data) => {
                  setForm((f) => ({ ...f, teamFormations: data }));
                  if (editingId) {
                    setSessions((prevSessions) =>
                      prevSessions.map((session) =>
                        session.id === editingId ? { ...session, teamFormations: data } : session
                      )
                    );
                  }
                }}
              />
            );
          })()}
        </div>
      </div>}

      <MiniMatchStats sessions={sessions} players={players} />

      <div className="no-print" style={{ marginTop: 28 }}>
        <AppCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ margin: 0, lineHeight: 1.2 }}>{t("pages.trainings.savedTitle")}</h3>
              <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
                {t("pages.trainings.savedSubtitle")}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge tone="blue">{t("pages.trainings.savedCount", { count: sessions.length })}</Badge>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, gap: 2 }}>
                {[["lista","≡"],["settimana","◫"]].map(([v, icon]) => (
                  <button key={v} onClick={() => setSessionsView(v)} style={{
                    padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
                    background: sessionsView === v ? "rgba(56,189,248,0.2)" : "transparent",
                    color: sessionsView === v ? "#38bdf8" : "#64748b",
                  }} title={v === "lista" ? "Vista lista" : "Vista settimana"}>{icon}</button>
                ))}
              </div>
            </div>
          </div>

          {sessionsView === "settimana" && (
            <WeekView
              sessions={sessions}
              weekOffset={weekOffset}
              onPrevWeek={() => setWeekOffset((o) => o - 1)}
              onNextWeek={() => setWeekOffset((o) => o + 1)}
              onThisWeek={() => setWeekOffset(0)}
              onEditSession={(session) => {
                editTraining(session);
              }}
              onCreateSession={canManage ? (dateStr) => {
                setEditingId(null);
                setForm({ ...emptyTraining(), date: dateStr });
                setFormErrors({});
                requestAnimationFrame(scrollToTrainingForm);
              } : null}
              onNavigateAttendance={(id) => navigate(`/session-attendance/${id}`)}
              canManage={canManage}
            />
          )}

          {sessionsView === "lista" && <>
          {loading && sessions.length === 0 ? (
            <SkeletonList rows={3} cols={2} />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="📋"
              title={t("pages.trainings.noSavedTitle")}
              text={t("pages.trainings.noSavedText")}
              steps={canManage ? [
                { title: "Crea una nuova seduta", text: "Usa il modulo qui sopra: scegli data, tema e giocatori." },
                { title: "Registra le presenze", text: "Dopo l'allenamento segna chi era presente, assente o infortunato." },
                { title: "Analizza il carico", text: "Il sistema calcola automaticamente carico e minuti per ogni giocatore." },
              ] : undefined}
              action={
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
                  {canManage && <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    style={{
                      padding: "9px 20px", borderRadius: 10,
                      background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)",
                      color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    ⬆ {t("pages.trainings.scrollToBuilder")}
                  </button>}
                </div>
              }
            />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {sortedSessions.map((session) => {
                const sessionTotal =
                  (session.exercises || []).reduce((sum, item) => sum + Number(item.customDuration || 0), 0) +
                  (session.sessionBlocks || []).reduce((sum, b) => sum + (Number(b.duration) || 0), 0);
                const canMarkCompleted = Boolean(session.date && session.date < localDateString());
                const isCompleted = Boolean(session.completed);

                return (
                  <div
                    key={session.id}
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      background:
                        editingId === session.id
                          ? "rgba(56,189,248,0.12)"
                          : "rgba(255,255,255,0.045)",
                      border:
                        editingId === session.id
                          ? "1px solid rgba(56,189,248,0.35)"
                          : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, lineHeight: 1.2 }}>{session.title}</h3>
                          {isCompleted && <Badge tone="green">Effettuata</Badge>}
                        </div>

                        <p style={{ color: "#94a3b8", margin: "8px 0", lineHeight: 1.4 }}>
                          {formatDate(session.date)} · {getThemeLabel(session.theme, t)} ·{" "}
                          {sessionTotal} min
                        </p>

                        {session.sourceType === "postMatch" && (
                          <div style={trainingStyles.sourceInline}>
                            <Badge tone="purple">{t("pages.trainings.sourcePostMatch")}</Badge>
                            <Badge tone={getObjectiveStatusMeta(session.objectiveStatus).tone}>
                              {t(getObjectiveStatusMeta(session.objectiveStatus).labelKey)}
                            </Badge>
                            <span>
                              {session.sourceMatchLabel ? `vs ${session.sourceMatchLabel}` : t("pages.trainings.sourceLinked")}
                              {session.sourceSummary ? ` · ${session.sourceSummary}` : ""}
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {(session.exercises || []).map((item, index) => {
                            const exercise = exercises.find(
                              (ex) => ex.id === item.exerciseId
                            );

                            return (
                              <Badge key={`${item.exerciseId}-${index}`} tone="purple">
                                {exercise?.title || t("pages.trainings.exerciseFallback")} ·{" "}
                                {item.customDuration} min
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {canManage && canMarkCompleted && (
                          <Button
                            variant="ghost"
                            aria-pressed={isCompleted}
                            title={isCompleted ? "Segna come da effettuare" : "Segna come effettuata"}
                            onClick={() => toggleTrainingCompleted(session.id)}
                            style={{
                              background: isCompleted ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.06)",
                              border: isCompleted ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.10)",
                              color: isCompleted ? "#86efac" : "white",
                            }}
                          >
                            {isCompleted ? "✓ Effettuata" : "□ Effettuata"}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/session-attendance/${session.id}`)}
                        >
                          {t("pages.trainings.attendance")}
                        </Button>

                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => editTraining(session)}
                            >
                              {t("pages.trainings.edit")}
                            </Button>

                            <Button
                              variant="danger"
                              onClick={() => deleteTraining(session.id)}
                            >
                              {t("pages.trainings.delete")}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>}
        </AppCard>
      </div>
    </div>
  );
}

function emptyTraining() {
  return {
    title: "",
    date: localDateString(),
    type: "Allenamento",
    theme: "Costruzione",
    matchDayDistance: "MD-3",
    objective: "",
    notes: "",
    exercises: [],
    attendance: {},
    sourceType: "",
    sourceMatchId: "",
    sourceMatchLabel: "",
    sourceMatchDate: "",
    sourceSummary: "",
    objectiveStatus: "todo",
    objectiveReview: "",
    sessionBlocks: [],
    numTeams: 2,
    teamAssignments: {},
    partitella: null,
    teamFormations: {},
    materials: "",
    completed: false,
    completedAt: "",
  };
}

function getInitialTrainingForm(draftTraining) {
  if (!draftTraining) return emptyTraining();
  return {
    ...emptyTraining(),
    ...draftTraining,
    exercises: draftTraining.exercises || [],
    attendance: draftTraining.attendance || {},
  };
}

function SessionMeta({ label, value }) {
  return (
    <div style={trainingStyles.metaPill}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PrintKpi({ title, value }) {
  return (
    <div className="print-kpi">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PrintBox({ title, value }) {
  return (
    <div className="print-box">
      <span>{title}</span>
      <p>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Box giocatori disponibili nel form seduta
// ─────────────────────────────────────────────
const SESSION_AVAILABLE_ATTENDANCE = new Set(["Presente", "Recupero"]);
const ATTENDANCE_UNAVAILABLE_LABELS = {
  Assente: "Assente nel registro",
  Infortunato: "Infortunato nel registro",
  Permesso: "Permesso nel registro",
  Squalificato: "Squalificato nel registro",
};

function isPlayerAvailableForSession(player, attendance = {}) {
  const savedStatus = attendance[String(player.id)]?.status;
  if (player._defaultAbsent) return savedStatus === "Presente";
  return !savedStatus || SESSION_AVAILABLE_ATTENDANCE.has(savedStatus);
}

function getSessionAvailability(players, date, _availabilityRecords = []) {
  const available = [];
  const unavailable = [];

  const UNAVAILABLE_STATUSES = ["Infortunato", "Recupero", "Differenziato", "Squalificato"];

  players.forEach((player) => {
    const isJun = (player.gruppo || "prima") === "juniores";
    if (isJun) {
      // Juniores compaiono sempre nella lista; di default sono Assenti finché il coach non li abilita
      if (!getPlayerUnavailabilityOnDate(player, date) && !UNAVAILABLE_STATUSES.includes(player.status)) {
        available.push({ ...player, _juniores: true, _defaultAbsent: true });
      }
      return;
    }
    const unav = getPlayerUnavailabilityOnDate(player, date);
    if (!unav && !UNAVAILABLE_STATUSES.includes(player.status)) {
      available.push(player);
    } else {
      unavailable.push({ player, reason: unav?.label || player.status || "" });
    }
  });

  const primaryTotal = players.filter((p) => (p.gruppo || "prima") !== "juniores").length;
  return { available, unavailable, total: primaryTotal };
}

const PHASE_OPTIONS = [
  { id: "Riscaldamento",    color: "#fb923c" },
  { id: "Tecnico-tattica",  color: "#38bdf8" },
  { id: "Parte principale", color: "#a78bfa" },
  { id: "Fisico",           color: "#4ade80" },
  { id: "Defaticamento",    color: "#94a3b8" },
  { id: "Partita",          color: "#fb923c" },
];

function AvailablePlayers({ players, date, availabilityRecords = [], attendance = {}, onToggle }) {
  const { t } = useTranslation();
  const sessionAvailability = getSessionAvailability(players, date, availabilityRecords);
  const available = [];
  const unavailable = [...sessionAvailability.unavailable];

  sessionAvailability.available.forEach((player) => {
    const savedStatus = attendance[String(player.id)]?.status;
    if (!player._defaultAbsent && savedStatus && !SESSION_AVAILABLE_ATTENDANCE.has(savedStatus)) {
      unavailable.push({
        player,
        reason: ATTENDANCE_UNAVAILABLE_LABELS[savedStatus] || `${savedStatus || "Assente"} nel registro`,
      });
      return;
    }
    available.push(player);
  });
  const total = sessionAvailability.total;

  const primaAvailable = available.filter((p) => !p._juniores);
  const junAvailable = available.filter((p) => p._juniores);
  const primaPresent = primaAvailable.filter((p) => {
    const s = attendance[String(p.id)]?.status;
    return !s || s === "Presente";
  }).length;
  const junPresent = junAvailable.filter((p) => attendance[String(p.id)]?.status === "Presente").length;

  function PlayerChip({ p }) {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
    const isAbsent = !isPlayerAvailableForSession(p, attendance);
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => onToggle?.(p.id)}
        title={isAbsent ? "Assente — clicca per segnare presente" : "Presente — clicca per segnare assente"}
        style={{
          fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
          cursor: onToggle ? "pointer" : "default",
          display: "inline-flex", alignItems: "center", gap: 5,
          border: "1px solid",
          background: isAbsent ? "rgba(248,113,113,0.08)" : "rgba(34,197,94,0.09)",
          borderColor: isAbsent ? "rgba(248,113,113,0.3)" : "rgba(34,197,94,0.2)",
          color: isAbsent ? "#fca5a5" : "#86efac",
          textDecoration: isAbsent ? "line-through" : "none",
          opacity: isAbsent ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{name}
      </button>
    );
  }

  const labelStyle = { fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 0 5px" };

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: 13, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {t("pages.trainings.availablePlayers")}
        </h4>
        <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
          {primaPresent} / {total} prima
        </span>
        {junAvailable.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>
            +{junPresent} juniores
          </span>
        )}
        {unavailable.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
            {unavailable.length} non disp.
          </span>
        )}
        {onToggle && <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>Tocca per segnare assente/presente</span>}
      </div>

      {/* Prima squadra */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {primaAvailable.map((p) => <PlayerChip key={p.id} p={p} />)}
        {unavailable.map(({ player: p, reason }) => {
          const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
          const isInjured = p.status === "Infortunato" || String(reason).toLowerCase().includes("infortun");
          return (
            <span key={p.id} title={reason || p.status || "Non disponibile"} style={{
              fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
              background: isInjured ? "rgba(248,113,113,0.08)" : "rgba(168,85,247,0.08)",
              border: isInjured ? "1px solid rgba(248,113,113,0.2)" : "1px solid rgba(168,85,247,0.2)",
              color: isInjured ? "#fca5a5" : "#d8b4fe", textDecoration: "line-through", opacity: 0.75,
            }}>
              {name}
            </span>
          );
        })}
      </div>

      {/* Juniores — sezione separata */}
      {junAvailable.length > 0 && (
        <>
          <div style={labelStyle}>Juniores — clicca per abilitare</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {junAvailable.map((p) => <PlayerChip key={p.id} p={p} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── RPE Panel ────────────────────────────────────────────────────────────────
function RpePanel({ rpe, md }) {
  const { t } = useTranslation();
  const displayRpe = getRpeDisplayMeta(md, rpe, t);
  const colorMap = {
    red:    { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   text: "#ef4444" },
    orange: { bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.25)",  text: "#fb923c" },
    green:  { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)",   text: "#22c55e" },
    blue:   { bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.25)",  text: "#38bdf8" },
    default:{ bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "#94a3b8" },
  };
  const c = colorMap[displayRpe.color] || colorMap.default;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", borderRadius: 12, marginTop: 14,
      background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <div style={{ textAlign: "center", minWidth: 52 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: c.text, lineHeight: 1 }}>
          {displayRpe.min}–{displayRpe.max}
        </div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>RPE</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{displayRpe.label}</p>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{displayRpe.description} · {md}</p>
      </div>
      <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ height: "100%", width: `${(displayRpe.max / 10) * 100}%`, borderRadius: 3, background: c.text, transition: "width .3s" }} />
      </div>
    </div>
  );
}

// ─── BlockBtn — pulsante filtro blocco nel picker ─────────────────────────────
function BlockBtn({ active, onClick, children, color }) {
  const colorBg = {
    orange:  active ? "rgba(251,146,60,0.2)"  : "rgba(255,255,255,0.04)",
    blue:    active ? "rgba(56,189,248,0.2)"  : "rgba(255,255,255,0.04)",
    green:   active ? "rgba(34,197,94,0.2)"   : "rgba(255,255,255,0.04)",
    default: active ? "rgba(148,163,184,0.2)" : "rgba(255,255,255,0.04)",
  };
  const colorBorder = {
    orange:  active ? "rgba(251,146,60,0.4)"  : "rgba(255,255,255,0.08)",
    blue:    active ? "rgba(56,189,248,0.4)"  : "rgba(255,255,255,0.08)",
    green:   active ? "rgba(34,197,94,0.4)"   : "rgba(255,255,255,0.08)",
    default: active ? "rgba(148,163,184,0.4)" : "rgba(255,255,255,0.08)",
  };
  const colorText = {
    orange:  active ? "#fb923c" : "#64748b",
    blue:    active ? "#38bdf8" : "#64748b",
    green:   active ? "#22c55e" : "#64748b",
    default: active ? "#94a3b8" : "#64748b",
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
        border: `1px solid ${colorBorder[color] || colorBorder.default}`,
        background: colorBg[color] || colorBg.default,
        color: colorText[color] || colorText.default,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label style={trainingStyles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

// ─── WeekView ──────────────────────────────────────────────────────
const DAYS_IT_SHORT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

function getWeekStart(offset) {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // 0=Mon
  d.setDate(d.getDate() - dow + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function WeekView({ sessions, weekOffset, onPrevWeek, onNextWeek, onThisWeek, onEditSession, onCreateSession, onNavigateAttendance }) {
  const weekStart = getWeekStart(weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = localDateString();
  const weekLabel = `${days[0].toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}`;

  const sessionsByDay = {};
  days.forEach((d) => { sessionsByDay[localDateString(d)] = []; });
  sessions.forEach((s) => {
    if (s.date && sessionsByDay[s.date]) sessionsByDay[s.date].push(s);
  });

  const navBtn = {
    background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#94a3b8", cursor: "pointer", padding: "5px 12px", fontSize: 16,
  };

  return (
    <div>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={onPrevWeek} style={navBtn} aria-label="Settimana precedente">‹</button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{weekLabel}</span>
        {weekOffset !== 0 && (
          <button onClick={onThisWeek} style={{ ...navBtn, fontSize: 12, padding: "5px 10px", color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)" }}>
            Oggi
          </button>
        )}
        <button onClick={onNextWeek} style={navBtn} aria-label="Settimana successiva">›</button>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
        {days.map((d, i) => {
          const dateStr = localDateString(d);
          const isToday = dateStr === todayStr;
          const daySessions = sessionsByDay[dateStr] || [];
          return (
            <div
              key={dateStr}
              style={{
                borderRadius: 10, minHeight: 90, padding: "8px 6px",
                background: isToday ? "rgba(56,189,248,0.07)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${isToday ? "rgba(56,189,248,0.3)" : "rgba(255,255,255,0.06)"}`,
                cursor: daySessions.length === 0 && onCreateSession ? "pointer" : "default",
              }}
              onClick={() => {
                if (daySessions.length === 0 && onCreateSession) onCreateSession(dateStr);
              }}
              title={daySessions.length === 0 && onCreateSession ? "Crea seduta" : undefined}
            >
              <div style={{ marginBottom: 6, textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>{DAYS_IT_SHORT[i]}</div>
                <div style={{ fontSize: 14, fontWeight: isToday ? 900 : 600, color: isToday ? "#38bdf8" : "#cbd5e1" }}>
                  {d.getDate()}
                </div>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {daySessions.length === 0 && onCreateSession && (
                  <div style={{ textAlign: "center", paddingTop: 10, color: "#334155", fontSize: 18, lineHeight: 1 }}>+</div>
                )}
                {daySessions.map((s) => (
                  <div key={s.id} style={{
                    borderRadius: 6, padding: "5px 7px",
                    background: "rgba(56,189,248,0.13)", border: "1px solid rgba(56,189,248,0.25)",
                    cursor: "pointer",
                  }}
                    onClick={() => onEditSession(s)}
                    title={s.title || "Allenamento"}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title || "Allenamento"}
                    </div>
                    {s.exercises?.length > 0 && (
                      <div style={{ fontSize: 10, color: "#64748b" }}>
                        {s.exercises.reduce((t, e) => t + Number(e.customDuration || 0), 0)} min
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigateAttendance(s.id); }}
                      style={{ marginTop: 4, width: "100%", fontSize: 11, fontWeight: 700, padding: "6px 0", borderRadius: 4, border: "1px solid rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.08)", color: "#38bdf8", cursor: "pointer" }}
                    >
                      Presenze
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const trainingStyles = {
  inputError: { border: "1px solid #f87171", boxShadow: "0 0 0 2px rgba(248,113,113,0.15)" },
  errorMsg:   { display: "block", marginTop: 4, fontSize: 11, fontWeight: 700, color: "#f87171" },
  formHero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
    flexWrap: "wrap",
    minWidth: 0,
  },
  formTitle: {
    margin: 0,
    lineHeight: 1.12,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: 0,
  },
  formSubtitle: {
    color: "#94a3b8",
    margin: "7px 0 0",
    lineHeight: 1.45,
    fontSize: 14,
  },
  durationBadge: {
    display: "grid",
    gap: 3,
    minWidth: 88,
    padding: "9px 13px",
    borderRadius: 14,
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.3)",
    color: "#bae6fd",
    textAlign: "right",
  },
  sessionPreviewStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
    gap: 10,
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    background: "rgba(15,23,42,0.45)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  previewCard: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(15,23,42,0.52))",
    border: "1px solid rgba(56,189,248,0.18)",
  },
  previewEyebrow: {
    margin: "0 0 6px",
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  previewTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  previewMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))",
    gap: 9,
  },
  previewObjective: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.45,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  sourceBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(168,85,247,0.10)",
    border: "1px solid rgba(168,85,247,0.24)",
    color: "#e9d5ff",
    lineHeight: 1.4,
  },
  sourceInline: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    margin: "0 0 10px",
    color: "#c4b5fd",
    fontSize: 12,
    lineHeight: 1.35,
  },
  objectiveReviewBox: {
    display: "grid",
    gap: 12,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  sessionSummary: {
    marginBottom: 26,
    padding: 18,
    borderRadius: 16,
    background: "rgba(15,23,42,0.58)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  summaryEyebrow: {
    display: "block",
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 6,
  },
  summaryTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.08,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))",
    gap: 10,
    marginTop: 16,
  },
  metaPill: {
    display: "grid",
    gap: 5,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  summaryNotes: {
    display: "grid",
    gap: 5,
    marginTop: 12,
    color: "#cbd5e1",
    lineHeight: 1.45,
  },
  stepHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.16)",
    border: "1px solid rgba(56,189,248,0.3)",
    color: "#bae6fd",
    fontSize: 12,
  },
  printFooter: {
    borderTop: "1px solid #dbe3ef",
    color: "#64748b",
    fontSize: 11,
    paddingTop: 12,
  },
};

/* ── Session Builder ──────────────────────────────────────────── */

function emptyBlock() {
  return {
    id: Math.random().toString(36).slice(2),
    phase: "Parte principale",
    name: "",
    duration: 15,
    intensity: 5,
    notes: "",
    description: "",
    image: null,
  };
}

function SessionBlockBuilder({ blocks, onChange, onSave, saveLabel, teamId, canManage, setExercises, existingExercises = [] }) {
  const [uploading, setUploading] = useState({});
  const [savedToLib, setSavedToLib] = useState({}); // blockId → true quando appena salvato

  function saveBlockToLibrary(block) {
    if (!block.name?.trim()) return;
    // Controlla se esiste già un esercizio con lo stesso titolo (evita duplicati)
    const alreadyExists = existingExercises.some(
      (e) => e.title?.trim().toLowerCase() === block.name.trim().toLowerCase()
    );
    if (alreadyExists) {
      setSavedToLib((s) => ({ ...s, [block.id]: "exists" }));
      setTimeout(() => setSavedToLib((s) => ({ ...s, [block.id]: null })), 2500);
      return;
    }
    const intensityLabel = block.intensity >= 8 ? "Alta" : block.intensity >= 5 ? "Media" : "Bassa";
    // Usa l'URL immagine solo se è permanente (non blob: e non in upload)
    const imageUrl = block.image?.url || "";
    const isPermanentUrl = imageUrl && !imageUrl.startsWith("blob:") && !block.image?.uploading;
    const newExercise = {
      ...emptyExercise(),
      id: createId("ex"),
      title: block.name.trim(),
      category: block.phase || "Parte principale",
      description: block.description || block.notes || "",
      duration: String(block.duration || ""),
      intensity: intensityLabel,
      image: isPermanentUrl ? imageUrl : "",
    };
    setExercises?.((prev) => [newExercise, ...prev]);
    setSavedToLib((s) => ({ ...s, [block.id]: "saved" }));
    setTimeout(() => setSavedToLib((s) => ({ ...s, [block.id]: null })), 2500);
  }

  async function handleImageUpload(blockId, file) {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    onChange(blocks.map((b) => b.id === blockId ? { ...b, image: { url: localUrl, uploading: true } } : b));

    if (teamId) {
      setUploading((u) => ({ ...u, [blockId]: true }));
      try {
        const att = await uploadTeamAttachment({ teamId, folder: "session-blocks", file });
        onChange(blocks.map((b) => b.id === blockId ? { ...b, image: { url: att.url, path: att.path } } : b));
      } catch {
        onChange(blocks.map((b) => b.id === blockId ? { ...b, image: { url: localUrl } } : b));
      } finally {
        setUploading((u) => ({ ...u, [blockId]: false }));
      }
    }
  }

  function addBlock() { onChange([...blocks, emptyBlock()]); }
  function removeBlock(id) { onChange(blocks.filter((b) => b.id !== id)); }
  function updateBlock(id, field, value) {
    onChange(blocks.map((b) => b.id === id ? { ...b, [field]: value } : b));
  }
  function moveBlock(idx, dir) {
    const next = [...blocks];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }

  const totalMin = blocks.reduce((s, b) => s + (Number(b.duration) || 0), 0);

  return (
    <AppCard>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={trainingStyles.stepHeader}>
            <span style={trainingStyles.stepBadge}>2</span>
            <span>Piano della seduta</span>
          </div>
          <h3 style={{ margin: "4px 0 0", lineHeight: 1.2 }}>Blocchi e esercitazioni</h3>
          <p style={{ color: "#64748b", margin: "6px 0 0", fontSize: 13, lineHeight: 1.45 }}>
            Costruisci la seduta blocco per blocco: tipo, durata, descrizione e foto opzionale.
          </p>
        </div>
        {blocks.length > 0 && <Badge tone="blue">{blocks.length} blocchi · {totalMin} min</Badge>}
      </div>

      {/* Blocchi */}
      {blocks.length === 0 && (
        <div style={{ textAlign: "center", padding: "28px 0", color: "#475569", fontSize: 13 }}>
          Nessun blocco ancora — clicca <strong style={{ color: "#94a3b8" }}>+ Aggiungi blocco</strong> per iniziare.
        </div>
      )}

      <div style={{ display: "grid", gap: 14, marginBottom: blocks.length ? 16 : 0 }}>
        {blocks.map((block, idx) => {
          const phase = PHASE_OPTIONS.find((p) => p.id === block.phase) || PHASE_OPTIONS[2];
          return (
            <div
              key={block.id}
              style={{
                borderRadius: 14,
                background: "rgba(15,23,42,0.6)",
                border: `1px solid rgba(255,255,255,0.07)`,
                borderLeft: `4px solid ${phase.color}`,
                overflow: "hidden",
              }}
            >
              {/* Fase + controlli */}
              <div style={{
                display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
                padding: "10px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(0,0,0,0.15)",
              }}>
                {PHASE_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => updateBlock(block.id, "phase", p.id)}
                    style={{
                      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                      cursor: "pointer",
                      border: `1px solid ${p.color}55`,
                      background: block.phase === p.id ? `${p.color}22` : "transparent",
                      color: block.phase === p.id ? p.color : "#475569",
                      transition: "all .15s",
                    }}
                  >{p.id}</button>
                ))}
                <div style={{ display: "flex", gap: 4, marginLeft: "auto", alignItems: "center" }}>
                  {setExercises && block.name?.trim() && (
                    <button
                      onClick={() => saveBlockToLibrary(block)}
                      title="Salva nella libreria esercizi"
                      style={{
                        ...sbtnStyle,
                        fontSize: 12, padding: "2px 8px", borderRadius: 8,
                        color: savedToLib[block.id] === "saved" ? "#4ade80" : savedToLib[block.id] === "exists" ? "#fb923c" : "#38bdf8",
                        borderColor: savedToLib[block.id] === "saved" ? "rgba(74,222,128,0.4)" : savedToLib[block.id] === "exists" ? "rgba(251,146,60,0.4)" : "rgba(56,189,248,0.3)",
                        background: savedToLib[block.id] === "saved" ? "rgba(74,222,128,0.08)" : savedToLib[block.id] === "exists" ? "rgba(251,146,60,0.08)" : "rgba(56,189,248,0.07)",
                        width: "auto",
                      }}
                    >
                      {savedToLib[block.id] === "saved" ? "✓ Salvato" : savedToLib[block.id] === "exists" ? "Già presente" : "📚 Libreria"}
                    </button>
                  )}
                  <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} style={sbtnStyle} aria-label="Sposta su">↑</button>
                  <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} style={sbtnStyle} aria-label="Sposta giù">↓</button>
                  <button onClick={() => removeBlock(block.id)} style={{ ...sbtnStyle, color: "#f87171" }} aria-label="Elimina">✕</button>
                </div>
              </div>

              {/* Corpo blocco */}
              <div style={{ padding: "12px 14px", display: "grid", gap: 10 }}>
                {/* Nome + durata */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    placeholder="Nome esercitazione…"
                    value={block.name}
                    onChange={(e) => updateBlock(block.id, "name", e.target.value)}
                    style={{ ...styles.input, flex: 1, fontSize: 14, fontWeight: 600 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <input
                      type="number" min={1} max={120}
                      value={block.duration}
                      onChange={(e) => updateBlock(block.id, "duration", Number(e.target.value))}
                      style={{ ...styles.input, width: 58, textAlign: "center", fontSize: 14, fontWeight: 700 }}
                    />
                    <span style={{ color: "#64748b", fontSize: 12 }}>min</span>
                  </div>
                </div>

                {/* Descrizione */}
                <textarea
                  placeholder="Descrizione, varianti, note tattiche…"
                  value={block.description || block.notes || ""}
                  onChange={(e) => updateBlock(block.id, "description", e.target.value)}
                  rows={3}
                  style={{ ...styles.input, resize: "vertical", fontSize: 13, lineHeight: 1.55, color: "#cbd5e1" }}
                />

                {/* Foto */}
                {block.image?.url ? (
                  <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
                    <img
                      src={block.image.url}
                      alt="Esercizio"
                      style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", display: "block" }}
                    />
                    <button
                      onClick={() => updateBlock(block.id, "image", null)}
                      style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 999, color: "#f87171", cursor: "pointer", width: 26, height: 26, fontSize: 13, lineHeight: "26px", textAlign: "center" }}
                      aria-label="Rimuovi immagine"
                    >✕</button>
                    {uploading[block.id] && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>
                        Caricamento…
                      </div>
                    )}
                  </div>
                ) : (
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                    padding: "7px 14px", borderRadius: 9,
                    border: "1px dashed rgba(255,255,255,0.13)",
                    color: "#64748b", fontSize: 12,
                    background: "rgba(255,255,255,0.025)",
                    width: "fit-content",
                  }}>
                    📷 Aggiungi foto / disegno
                    <input
                      type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => handleImageUpload(block.id, e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Azioni */}
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="ghost" onClick={addBlock} style={{ flex: 1 }}>
          + Aggiungi blocco
        </Button>
        {onSave && canManage && (
          <Button onClick={onSave} style={{ flex: 1 }}>
            💾 {saveLabel}
          </Button>
        )}
      </div>
    </AppCard>
  );
}

const sbtnStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 7, padding: "3px 8px",
  cursor: "pointer", fontSize: 13, color: "#94a3b8",
};

/* ── Team Generator ─────────────────────────────────────────────── */

const ROLE_ORDER = { P: 0, D: 1, C: 2, A: 3 };
const ROLE_COLORS = { P: "#facc15", D: "#60a5fa", C: "#4ade80", A: "#f87171" };

function getRoleTag(role) {
  if (!role) return null;
  const r = role.trim().toUpperCase();
  if (r.startsWith("P")) return "P";
  if (r.startsWith("D")) return "D";
  if (r.startsWith("C")) return "C";
  if (r.startsWith("A")) return "A";
  return null;
}

function sortByRole(players) {
  return [...players].sort((a, b) => {
    const ra = ROLE_ORDER[getRoleTag(a.role)] ?? 99;
    const rb = ROLE_ORDER[getRoleTag(b.role)] ?? 99;
    return ra - rb;
  });
}

const TEAM_COLORS = [
  { label: "Squadra A", color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
  { label: "Squadra B", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  { label: "Squadra C", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
  { label: "Squadra D", color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)" },
];

// bench per squadra: team i → 100+i
const BENCH_BASE = 100;
const benchKey = (i) => BENCH_BASE + i;
const isBenchKey = (v) => typeof v === "number" && v >= BENCH_BASE;
const assignmentTeamIndex = (v) => {
  if (typeof v !== "number") return null;
  if (v === 99) return 0;
  if (v >= BENCH_BASE) return v - BENCH_BASE;
  return v;
};

function getPlayerFullName(player) {
  return [player?.firstName, player?.lastName].filter(Boolean).join(" ") || player?.name || "—";
}

function getPlayerLastName(player) {
  const lastName = player?.lastName || "";
  if (lastName) return lastName;
  const parts = (player?.name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}

function getPlayerFirstInitial(player) {
  const firstName = player?.firstName || "";
  if (firstName) return firstName.trim().charAt(0).toUpperCase();
  const parts = (player?.name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[0].charAt(0).toUpperCase() : "";
}

function getDuplicateLastNames(players = []) {
  const counts = new Map();
  players.forEach((player) => {
    const key = getPlayerLastName(player).toLowerCase();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function getPlayerTeamLabel(player, duplicateLastNames = new Set()) {
  const lastName = getPlayerLastName(player);
  const isDuplicate = duplicateLastNames.has(lastName.toLowerCase());
  if (isDuplicate && lastName) {
    const initial = getPlayerFirstInitial(player);
    return initial ? `${initial}. ${lastName}` : lastName;
  }
  return getPlayerFullName(player);
}

function TeamGenerator({ availablePlayers = [], numTeams, assignments, partitella, onChange, onPartitellaChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [playersPerTeam, setPlayersPerTeam] = useState(11);
  const miniGoals = partitella?.goals || {};
  const duplicateLastNames = useMemo(() => getDuplicateLastNames(availablePlayers), [availablePlayers]);

  const benches = Array.from({ length: numTeams }, (_, i) =>
    availablePlayers.filter((p) => {
      const v = assignments[String(p.id)];
      if (v === benchKey(i)) return true;
      if (i === 0 && v === 99) return true; // retrocompatibilità vecchio BENCH=99
      return false;
    })
  );
  const unassigned = availablePlayers.filter((p) => assignments[String(p.id)] === undefined);
  const teams = Array.from({ length: numTeams }, (_, i) =>
    availablePlayers.filter((p) => assignments[String(p.id)] === i)
  );

  function assign(playerId, teamIndex) {
    onChange({ assignments: { ...assignments, [String(playerId)]: teamIndex }, numTeams });
  }

  function unassign(playerId) {
    const next = { ...assignments };
    delete next[String(playerId)];
    onChange({ assignments: next, numTeams });
  }

  function changeTeams(n) {
    const next = {};
    Object.entries(assignments).forEach(([id, t]) => {
      if (typeof t === "number" && t < n) next[id] = t;
      else if (isBenchKey(t) && (t - BENCH_BASE) < n) next[id] = t;
    });
    onChange({ assignments: next, numTeams: n });
  }

  function shuffle() {
    const totalSlots = playersPerTeam * numTeams;
    const isJuniores = (p) => p._juniores || p.gruppo === "juniores";
    const shuffled = (arr) => [...arr].sort(() => Math.random() - 0.5);

    // Separa portieri dagli altri
    const portieri = shuffled(availablePlayers.filter((p) => getRoleTag(p.role) === "P"));
    const altri = shuffled(availablePlayers.filter((p) => getRoleTag(p.role) !== "P"));

    // Max 1 portiere per squadra — gli extra (juniores prima) vanno a disposizione
    const portieriInGame = [];
    const portieriBench = [];
    // Ordina: prima i prima, poi i juniores (i juniores escono per primi se in eccesso)
    const portieriOrdinati = [...portieri.filter((p) => !isJuniores(p)), ...portieri.filter((p) => isJuniores(p))];
    portieriOrdinati.forEach((p, i) => {
      if (i < numTeams) portieriInGame.push(p);
      else portieriBench.push(p);
    });

    // Slot rimanenti dopo i portieri
    const slotsRimasti = totalSlots - portieriInGame.length;
    // Juniores vanno a disposizione per primi tra gli altri
    const altriOrdinati = [...altri.filter((p) => !isJuniores(p)), ...altri.filter((p) => isJuniores(p))];
    const altriInGame = altriOrdinati.slice(0, slotsRimasti);
    const altriBench = altriOrdinati.slice(slotsRimasti);

    const onBench = [...portieriBench, ...altriBench];

    // Distribuisce: 1 portiere per squadra, poi round-robin per ruolo
    const next = {};
    portieriInGame.forEach((p, i) => { next[String(p.id)] = i; });

    const byRole = { D: [], C: [], A: [], "?": [] };
    altriInGame.forEach((p) => { const tag = getRoleTag(p.role) || "?"; byRole[tag].push(String(p.id)); });
    let teamIdx = 0;
    ["D", "C", "A", "?"].forEach((role) => {
      byRole[role].sort(() => Math.random() - 0.5).forEach((id) => {
        next[id] = teamIdx % numTeams;
        teamIdx++;
      });
    });
    // bench condiviso: distribuisce round-robin tra squadre esistenti
    onBench.forEach((p, idx) => { next[String(p.id)] = benchKey(idx % numTeams); });
    onChange({ assignments: next, numTeams });
  }

  function reset() { onChange({ assignments: {}, numTeams }); }
  function sendToBench(playerId, teamIndex) { onChange({ assignments: { ...assignments, [String(playerId)]: benchKey(teamIndex) }, numTeams }); }
  function pullFromBench(playerId) { const next = { ...assignments }; delete next[String(playerId)]; onChange({ assignments: next, numTeams }); }
  function updatePartitella(partial) {
    onPartitellaChange?.({ ...(partitella || {}), ...partial });
  }
  function setMiniGoals(playerId, value) {
    const goals = Math.max(0, Number(value) || 0);
    const nextGoals = { ...miniGoals };
    if (goals > 0) nextGoals[String(playerId)] = goals;
    else delete nextGoals[String(playerId)];
    updatePartitella({ goals: nextGoals });
  }
  function renderGoalInput(playerId) {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748b", fontSize: 10, fontWeight: 800 }}>
        Gol
        <input
          type="number"
          min="0"
          value={miniGoals[String(playerId)] || 0}
          onChange={(event) => setMiniGoals(playerId, event.target.value)}
          style={{
            width: 34,
            height: 22,
            padding: "0 4px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15,23,42,0.55)",
            color: "#e2e8f0",
            fontSize: 11,
            fontWeight: 800,
            textAlign: "center",
          }}
        />
      </label>
    );
  }

  function printTeams() {
    const ROLE_PRINT_ORDER = { P: 0, D: 1, C: 2, A: 3 };
    const ROLE_COLORS_PRINT = { P: "#ca8a04", D: "#2563eb", C: "#16a34a", A: "#dc2626" };
    const sortForPrint = (arr) => [...arr].sort((a, b) => {
      const ra = ROLE_PRINT_ORDER[getRoleTag(a.role)] ?? 99;
      const rb = ROLE_PRINT_ORDER[getRoleTag(b.role)] ?? 99;
      if (ra !== rb) return ra - rb;
      return (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "it");
    });
    const playerRow = (p) => {
      const tag = getRoleTag(p.role);
      const color = tag ? ROLE_COLORS_PRINT[tag] || "#666" : "#666";
      const name = getPlayerTeamLabel(p, duplicateLastNames);
      return `<p style="margin:4px 0;font-size:13px;display:flex;align-items:center;gap:6px">
        <span style="font-size:10px;font-weight:900;color:${color};min-width:12px">${tag || ""}</span>
        ${name}
      </p>`;
    };
    const win = window.open("", "_blank");
    const rows = teams.map((members, i) =>
      `<div style="flex:1;min-width:140px;border:1px solid ${TEAM_COLORS[i].border};border-radius:10px;padding:12px">
        <h3 style="margin:0 0 10px;color:${TEAM_COLORS[i].color};font-size:13px;text-transform:uppercase">${TEAM_COLORS[i].label} (${members.length})</h3>
        ${sortForPrint(members).map(playerRow).join("")}
      </div>`
    ).join("");
    const allBench = benches.flat();
    const benchHtml = allBench.length
      ? benches.map((b, i) => b.length ? `<div style="margin-top:16px;border:1px solid ${TEAM_COLORS[i].border};border-radius:10px;padding:12px"><h3 style="margin:0 0 10px;color:${TEAM_COLORS[i].color};font-size:13px;text-transform:uppercase">A disposizione ${TEAM_COLORS[i].label} (${b.length})</h3>${sortForPrint(b).map(playerRow).join("")}</div>` : "").join("")
      : "";
    win.document.write(`<html><head><title>Squadre</title><style>body{font-family:sans-serif;padding:24px}h2{margin-bottom:16px}.teams{display:flex;gap:12px;flex-wrap:wrap}@media print{button{display:none}}</style></head>
      <body><h2>Squadre — ${new Date().toLocaleDateString("it")}</h2>
      <div class="teams">${rows}</div>${benchHtml}
      <br><button onclick="window.print()">Stampa</button></body></html>`);
    win.document.close();
  }

  return (
    <AppCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setCollapsed((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 0 }}>
            {collapsed ? "▶" : "▼"}
          </button>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Generatore squadre</h4>
        </div>
        {!collapsed && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[2, 3, 4].map((n) => (
              <button key={n} onClick={() => changeTeams(n)} style={{
                padding: "4px 10px", borderRadius: 7, border: "1px solid",
                borderColor: numTeams === n ? "rgba(56,189,248,0.5)" : "rgba(255,255,255,0.1)",
                background: numTeams === n ? "rgba(56,189,248,0.15)" : "transparent",
                color: numTeams === n ? "#38bdf8" : "#64748b",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>{n} squadre</button>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Gioc./squadra</span>
              <input
                type="number" min={1} max={30} value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(Math.max(1, Number(e.target.value)))}
                style={{ width: 44, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e2e8f0", fontSize: 12, fontWeight: 700, textAlign: "center" }}
              />
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Giocatori non assegnati */}
          {unassigned.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Da assegnare ({unassigned.length})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sortByRole(unassigned).map((p) => {
                  const tag = getRoleTag(p.role);
                  const name = getPlayerTeamLabel(p, duplicateLastNames);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1",
                        display: "flex", alignItems: "center", gap: 5,
                      }} title={getPlayerFullName(p)}>
                        {tag && (
                          <span style={{ fontSize: 10, fontWeight: 900, color: ROLE_COLORS[tag], lineHeight: 1 }}>{tag}</span>
                        )}
                        {name}
                      </span>
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        {Array.from({ length: numTeams }, (_, i) => (
                          <button key={i} onClick={() => assign(p.id, i)} title={TEAM_COLORS[i].label} style={{
                            width: 16, height: 16, borderRadius: 4, border: "none", cursor: "pointer",
                            background: TEAM_COLORS[i].color, opacity: 0.85,
                          }} />
                        ))}
                        {Array.from({ length: numTeams }, (_, i) => (
                          <button key={i} onClick={() => sendToBench(p.id, i)} title={`A disposizione ${TEAM_COLORS[i].label}`} style={{ background: "none", border: "none", cursor: "pointer", color: TEAM_COLORS[i].color, fontSize: 10, padding: "0 2px", fontWeight: 700 }}>Disp.{String.fromCharCode(65+i)}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Squadre */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {teams.map((members, i) => (
              <div key={i} style={{
                borderRadius: 10, padding: "10px 12px",
                background: TEAM_COLORS[i].bg,
                border: `1px solid ${TEAM_COLORS[i].border}`,
                minHeight: 60,
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 900, color: TEAM_COLORS[i].color, textTransform: "uppercase" }}>
                  {TEAM_COLORS[i].label} <span style={{ opacity: 0.7 }}>({members.length})</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sortByRole(members).map((p) => {
                    const tag = getRoleTag(p.role);
                    const name = getPlayerTeamLabel(p, duplicateLastNames);
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                        <span title={getPlayerFullName(p)} style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 5 }}>
                          {tag && <span style={{ fontSize: 10, fontWeight: 900, color: ROLE_COLORS[tag], minWidth: 10 }}>{tag}</span>}
                          {name}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {renderGoalInput(p.id)}
                          <button onClick={() => sendToBench(p.id, i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 10, padding: "0 2px", lineHeight: 1 }} title="A disposizione">Disp.</button>
                          <button onClick={() => unassign(p.id)} style={{
                            background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13, padding: "0 2px", lineHeight: 1,
                          }} title="Rimuovi">✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* A disposizione per squadra */}
          {benches.some((b) => b.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              {benches.map((b, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: TEAM_COLORS[i].bg, border: `1px solid ${TEAM_COLORS[i].border}` }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: TEAM_COLORS[i].color, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    A disp. {TEAM_COLORS[i].label} ({b.length})
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {sortByRole(b).map((p) => {
                      const tag = getRoleTag(p.role);
                      const isJ = p._juniores || p.gruppo === "juniores";
                      const name = getPlayerTeamLabel(p, duplicateLastNames);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                          <span title={getPlayerFullName(p)} style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
                            {tag && <span style={{ fontSize: 10, fontWeight: 900, color: ROLE_COLORS[tag] }}>{tag}</span>}
                            {name}
                            {isJ && <span style={{ fontSize: 10, color: "#475569" }}>Jun</span>}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {renderGoalInput(p.id)}
                            {Array.from({ length: numTeams }, (_, j) => (
                              <button key={j} onClick={() => assign(p.id, j)} title={TEAM_COLORS[j].label} style={{
                                width: 14, height: 14, borderRadius: 3, border: "none", cursor: "pointer",
                                background: TEAM_COLORS[j].color, opacity: 0.75,
                              }} />
                            ))}
                            <button onClick={() => pullFromBench(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 12, padding: "0 2px" }}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Risultato partitella */}
          {teams.some((t) => t.length > 0) && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {numTeams === 3 ? (
                /* ── Podio 3 squadre ── */
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>Podio:</span>
                  {[
                    { pos: 1, medal: "🥇", fine: 0,  fineTxt: "free",  color: "#f59e0b" },
                    { pos: 2, medal: "🥈", fine: 1,  fineTxt: "1€",   color: "#94a3b8" },
                    { pos: 3, medal: "🥉", fine: 2,  fineTxt: "2€",   color: "#b45309" },
                  ].map(({ pos, medal, fineTxt, color }) => {
                    const podium = partitella?.podium || {};
                    return (
                      <div key={pos} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color, minWidth: 46 }}>
                          {medal} {pos}° <span style={{ fontSize: 10, fontWeight: 500, color: "#64748b" }}>({fineTxt})</span>
                        </span>
                        {Array.from({ length: numTeams }, (_, teamIdx) => {
                          const selected = podium[teamIdx] === pos;
                          return (
                            <button
                              key={teamIdx}
                              onClick={() => {
                                const next = { ...podium };
                                // rimuovi squadra da posizione precedente
                                Object.keys(next).forEach((k) => { if (Number(k) === teamIdx) delete next[k]; });
                                // rimuovi chi era già in questa posizione
                                Object.keys(next).forEach((k) => { if (next[k] === pos) delete next[k]; });
                                if (!selected) next[teamIdx] = pos;
                                const hasPodium = Object.keys(next).length > 0;
                                onPartitellaChange?.({ ...(partitella || {}), podium: hasPodium ? next : null, winner: undefined });
                              }}
                              style={{
                                padding: "3px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                border: `1px solid ${selected ? TEAM_COLORS[teamIdx].color : "rgba(255,255,255,0.1)"}`,
                                background: selected ? `${TEAM_COLORS[teamIdx].color}22` : "transparent",
                                color: selected ? TEAM_COLORS[teamIdx].color : "#64748b",
                              }}
                            >{TEAM_COLORS[teamIdx].label.replace("Squadra ", "")}</button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {partitella?.podium && (
                    <button onClick={() => onPartitellaChange?.(miniGoals && Object.keys(miniGoals).length ? { goals: miniGoals } : null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 11, marginLeft: 4 }}>✕ Cancella</button>
                  )}
                </div>
              ) : (
                /* ── Vince/perde/pareggia (2 squadre) ── */
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>Risultato:</span>
                  {Array.from({ length: numTeams }, (_, i) => (
                    <button key={i} onClick={() => updatePartitella({ winner: i })} style={{
                      padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${partitella?.winner === i ? TEAM_COLORS[i].color : "rgba(255,255,255,0.1)"}`,
                      background: partitella?.winner === i ? `${TEAM_COLORS[i].color}22` : "transparent",
                      color: partitella?.winner === i ? TEAM_COLORS[i].color : "#64748b",
                    }}>🏆 {TEAM_COLORS[i].label}</button>
                  ))}
                  <button onClick={() => updatePartitella({ winner: "draw" })} style={{
                    padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${partitella?.winner === "draw" ? "#f59e0b" : "rgba(255,255,255,0.1)"}`,
                    background: partitella?.winner === "draw" ? "rgba(245,158,11,0.15)" : "transparent",
                    color: partitella?.winner === "draw" ? "#f59e0b" : "#64748b",
                  }}>🤝 Pareggio</button>
                  {partitella?.winner != null && (
                    <button onClick={() => onPartitellaChange?.(miniGoals && Object.keys(miniGoals).length ? { goals: miniGoals } : null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 11 }}>✕ Cancella risultato</button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Azioni */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={shuffle} style={{
              flex: 1, padding: "7px 0", borderRadius: 8,
              background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)",
              color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>🔀 Genera casuale</button>
            <button onClick={printTeams} style={{
              padding: "7px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>🖨 Stampa</button>
            <button onClick={reset} style={{
              padding: "7px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>Reset</button>
          </div>
        </>
      )}
    </AppCard>
  );
}

// ── Formazioni ────────────────────────────────────────────────────────────────
const FORMATIONS_DEF = {
  "4-3-3": [
    { role:"P", x:50, y:88 },
    { role:"D", x:15, y:65 },{ role:"D", x:35, y:70 },{ role:"D", x:65, y:70 },{ role:"D", x:85, y:65 },
    { role:"C", x:25, y:43 },{ role:"C", x:50, y:49 },{ role:"C", x:75, y:43 },
    { role:"A", x:18, y:20 },{ role:"A", x:50, y:16 },{ role:"A", x:82, y:20 },
  ],
  "4-4-2": [
    { role:"P", x:50, y:88 },
    { role:"D", x:15, y:65 },{ role:"D", x:35, y:70 },{ role:"D", x:65, y:70 },{ role:"D", x:85, y:65 },
    { role:"C", x:15, y:42 },{ role:"C", x:38, y:49 },{ role:"C", x:62, y:49 },{ role:"C", x:85, y:42 },
    { role:"A", x:33, y:18 },{ role:"A", x:67, y:18 },
  ],
  "4-3-1-2": [
    { role:"P", x:50, y:88 },
    { role:"D", x:15, y:65 },{ role:"D", x:35, y:70 },{ role:"D", x:65, y:70 },{ role:"D", x:85, y:65 },
    { role:"C", x:25, y:50 },{ role:"C", x:50, y:55 },{ role:"C", x:75, y:50 },
    { role:"C", x:50, y:32 },
    { role:"A", x:35, y:16 },{ role:"A", x:65, y:16 },
  ],
  "4-2-3-1": [
    { role:"P", x:50, y:88 },
    { role:"D", x:15, y:65 },{ role:"D", x:35, y:70 },{ role:"D", x:65, y:70 },{ role:"D", x:85, y:65 },
    { role:"C", x:35, y:52 },{ role:"C", x:65, y:52 },
    { role:"C", x:18, y:35 },{ role:"C", x:50, y:33 },{ role:"C", x:82, y:35 },
    { role:"A", x:50, y:15 },
  ],
  "3-5-2": [
    { role:"P", x:50, y:88 },
    { role:"D", x:25, y:65 },{ role:"D", x:50, y:70 },{ role:"D", x:75, y:65 },
    { role:"C", x:12, y:48 },{ role:"C", x:30, y:44 },{ role:"C", x:50, y:50 },{ role:"C", x:70, y:44 },{ role:"C", x:88, y:48 },
    { role:"A", x:33, y:18 },{ role:"A", x:67, y:18 },
  ],
  "3-4-3": [
    { role:"P", x:50, y:88 },
    { role:"D", x:25, y:65 },{ role:"D", x:50, y:70 },{ role:"D", x:75, y:65 },
    { role:"C", x:18, y:48 },{ role:"C", x:40, y:45 },{ role:"C", x:60, y:45 },{ role:"C", x:82, y:48 },
    { role:"A", x:18, y:20 },{ role:"A", x:50, y:16 },{ role:"A", x:82, y:20 },
  ],
  "5-3-2": [
    { role:"P", x:50, y:88 },
    { role:"D", x:10, y:68 },{ role:"D", x:28, y:73 },{ role:"D", x:50, y:75 },{ role:"D", x:72, y:73 },{ role:"D", x:90, y:68 },
    { role:"C", x:25, y:45 },{ role:"C", x:50, y:50 },{ role:"C", x:75, y:45 },
    { role:"A", x:33, y:18 },{ role:"A", x:67, y:18 },
  ],
};

function autoAssignFormation(players, formation) {
  const slots = FORMATIONS_DEF[formation] || [];
  const byRole = { P:[], D:[], C:[], A:[] };
  players.forEach((p) => { const t = getRoleTag(p.role) || "A"; if (byRole[t]) byRole[t].push(p); });
  const assigned = {};
  slots.forEach((slot, idx) => {
    const pool = byRole[slot.role];
    if (pool.length > 0) {
      assigned[idx] = pool.shift();
    }
  });
  // fill remaining slots with leftover players
  const leftover = Object.values(byRole).flat();
  slots.forEach((_, idx) => {
    if (!assigned[idx] && leftover.length > 0) assigned[idx] = leftover.shift();
  });
  return assigned;
}

function FormationView({ teams, teamColors, numTeams, savedFormations = {}, onSave }) {
  const [activeTeam, setActiveTeam] = useState(0);
  const [formations, setFormations] = useState({});
  const [slotMaps, setSlotMaps] = useState({});
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(false);

  // Carica dati salvati al primo render
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !Object.keys(savedFormations).length) return;
    loadedRef.current = true;
    const restoredFormations = {};
    const restoredSlotMaps = {};
    Object.entries(savedFormations).forEach(([ti, data]) => {
      const teamIdx = Number(ti);
      restoredFormations[teamIdx] = data.formation || "4-3-3";
      const allPlayers = teams.flat();
      const slotMap = {};
      Object.entries(data.slots || {}).forEach(([slotIdx, playerId]) => {
        const p = allPlayers.find((pl) => String(pl.id) === String(playerId));
        if (p) slotMap[Number(slotIdx)] = p;
      });
      restoredSlotMaps[teamIdx] = slotMap;
    });
    setFormations(restoredFormations);
    setSlotMaps(restoredSlotMaps);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const players = teams[activeTeam] || [];
  const duplicateLastNames = useMemo(() => getDuplicateLastNames(teams.flat()), [teams]);
  const formation = formations[activeTeam] || "4-3-3";

  function setFormation(f) {
    setFormations((prev) => ({ ...prev, [activeTeam]: f }));
    setSlotMaps((prev) => ({ ...prev, [activeTeam]: autoAssignFormation([...players], f) }));
    setSelected(null);
    setSaved(false);
  }

  function selectTeam(teamIdx) {
    setActiveTeam(teamIdx);
    setSelected(null);
    setSlotMaps((prev) => {
      if (prev[teamIdx] !== undefined) return prev;
      const teamPlayers = teams[teamIdx] || [];
      const teamFormation = formations[teamIdx] || "4-3-3";
      return { ...prev, [teamIdx]: autoAssignFormation([...teamPlayers], teamFormation) };
    });
  }

  const slotMap = slotMaps[activeTeam] ?? autoAssignFormation([...players], formation);

  function handleSave() {
    const data = {};
    const allFormations = { ...formations };
    const allSlotMaps = { ...slotMaps };
    Array.from({ length: numTeams }, (_, i) => {
      const fm = allFormations[i] || "4-3-3";
      const sm = allSlotMaps[i] || {};
      const slots = {};
      Object.entries(sm).forEach(([slotIdx, p]) => { if (p) slots[slotIdx] = String(p.id); });
      data[i] = { formation: fm, slots };
    });
    onSave?.(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const slots = FORMATIONS_DEF[formation] || [];
  const ROLE_BADGE_COLORS = { P:"#ca8a04", D:"#2563eb", C:"#16a34a", A:"#dc2626" };

  function clickSlot(idx) {
    if (selected === null) { setSelected(idx); return; }
    if (selected === idx) { setSelected(null); return; }
    const next = { ...slotMap, [selected]: slotMap[idx], [idx]: slotMap[selected] };
    setSlotMaps((prev) => ({ ...prev, [activeTeam]: next }));
    setSelected(null);
  }

  function printFormation() {
    const W = 400, H = 580;
    const svgSlots = slots.map((slot, idx) => {
      const p = slotMap[idx];
      const cx = slot.x / 100 * W;
      const cy = slot.y / 100 * H;
      const tag = p ? (getRoleTag(p.role) || "") : "";
      const col = ROLE_BADGE_COLORS[tag] || "#888";
      const name = p ? getPlayerTeamLabel(p, duplicateLastNames).slice(0, 12) : "—";
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="18" fill="${col}" opacity="0.85"/>
        <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="sans-serif">${tag}</text>
        <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="8" fill="white" font-family="sans-serif">${name}</text>
      </g>`;
    }).join("");
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#166534" rx="8"/>
      <rect x="20" y="20" width="${W-40}" height="${H-40}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <line x1="20" y1="${H/2}" x2="${W-20}" y2="${H/2}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <circle cx="${W/2}" cy="${H/2}" r="40" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <rect x="${W/2-50}" y="20" width="100" height="60" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <rect x="${W/2-50}" y="${H-80}" width="100" height="60" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      ${svgSlots}
    </svg>`;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Schieramento</title><style>body{margin:0;padding:24px;font-family:sans-serif;background:#f8fafc}h2{margin-bottom:12px}@media print{button{display:none}}</style></head>
      <body><h2>${teamColors[activeTeam]?.label || "Squadra"} — ${formation}</h2>${svg}
      <br><button onclick="window.print()">Stampa</button></body></html>`);
    win.document.close();
  }

  const FW = 280, FH = 400;

  return (
    <AppCard style={{ marginTop: 12 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <h4 style={{ margin:0, fontSize:14, fontWeight:800 }}>Schieramento</h4>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {Array.from({ length: numTeams }, (_, i) => (
            <button key={i} onClick={() => selectTeam(i)} style={{
              padding:"4px 10px", borderRadius:7, border:"1px solid",
              borderColor: activeTeam===i ? teamColors[i]?.color : "rgba(255,255,255,0.1)",
              background: activeTeam===i ? `${teamColors[i]?.color}22` : "transparent",
              color: activeTeam===i ? teamColors[i]?.color : "#64748b",
              fontSize:12, fontWeight:700, cursor:"pointer",
            }}>{teamColors[i]?.label}</button>
          ))}
          <select value={formation} onChange={(e) => setFormation(e.target.value)} style={{
            padding:"4px 8px", borderRadius:7, border:"1px solid rgba(255,255,255,0.12)",
            background:"rgba(255,255,255,0.06)", color:"#e2e8f0", fontSize:12, fontWeight:700, cursor:"pointer",
          }}>
            {Object.keys(FORMATIONS_DEF).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button onClick={printFormation} style={{
            padding:"4px 12px", borderRadius:7, border:"1px solid rgba(255,255,255,0.1)",
            background:"rgba(255,255,255,0.04)", color:"#94a3b8", fontSize:12, fontWeight:700, cursor:"pointer",
          }}>🖨 Stampa</button>
          <button onClick={handleSave} style={{
            padding:"4px 12px", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer",
            border: saved ? "1px solid #22c55e" : "1px solid rgba(56,189,248,0.3)",
            background: saved ? "rgba(34,197,94,0.12)" : "rgba(56,189,248,0.1)",
            color: saved ? "#22c55e" : "#38bdf8",
          }}>{saved ? "✓ Salvato" : "💾 Salva"}</button>
        </div>
      </div>
      <p style={{ margin:"0 0 10px", fontSize:11, color:"#64748b" }}>Clicca due giocatori per scambiarli di posizione</p>

      {/* Campo SVG */}
      <div style={{ display:"flex", justifyContent:"center" }}>
        <svg width={FW} height={FH} style={{ borderRadius:8, overflow:"hidden" }}>
          {/* Campo verde */}
          <rect width={FW} height={FH} fill="#15803d" rx="8"/>
          {/* Righe campo */}
          <rect x="14" y="14" width={FW-28} height={FH-28} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
          <line x1="14" y1={FH/2} x2={FW-14} y2={FH/2} stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          <circle cx={FW/2} cy={FH/2} r="36" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          <circle cx={FW/2} cy={FH/2} r="3" fill="rgba(255,255,255,0.4)"/>
          <rect x={FW/2-38} y="14" width="76" height="50" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          <rect x={FW/2-18} y="14" width="36" height="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          <rect x={FW/2-38} y={FH-64} width="76" height="50" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          <rect x={FW/2-18} y={FH-36} width="36" height="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
          {/* Strisce alternate */}
          {[0,1,2,3,4,5].map((i) => (
            <rect key={i} x="14" y={14 + i*(FH-28)/6} width={FW-28} height={(FH-28)/6}
              fill={i%2===0 ? "rgba(0,0,0,0.04)" : "transparent"} />
          ))}
          {/* Slot vuoti (sfondo) */}
          {slots.map((slot, idx) => {
            const p = slotMap[idx];
            if (p) return null;
            const cx = slot.x / 100 * FW;
            const cy = slot.y / 100 * FH;
            const col = ROLE_BADGE_COLORS[slot.role] || "#475569";
            const isSelected = selected === idx;
            return (
              <g key={`empty-${idx}`} onClick={() => clickSlot(idx)} style={{ cursor: isSelected ? "pointer" : "default" }}>
                <circle cx={cx} cy={cy} r="17" fill={isSelected ? "#facc1544" : "rgba(255,255,255,0.08)"}
                  stroke={col} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
                <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill={col} fontFamily="sans-serif" fontWeight="700" opacity="0.7">{slot.role}</text>
              </g>
            );
          })}
          {/* Giocatori */}
          {slots.map((slot, idx) => {
            const p = slotMap[idx];
            if (!p) return null;
            const cx = slot.x / 100 * FW;
            const cy = slot.y / 100 * FH;
            // usa il ruolo della posizione in campo (non il ruolo anagrafico)
            const posRole = slot.role;
            const col = ROLE_BADGE_COLORS[posRole] || "#475569";
            const isSelected = selected === idx;
            const name = getPlayerTeamLabel(p, duplicateLastNames).slice(0, 10);
            const origRole = getRoleTag(p.role) || "";
            const isDifferentRole = origRole && origRole !== posRole;
            return (
              <g key={idx} onClick={() => clickSlot(idx)} style={{ cursor:"pointer" }}>
                <title>{name}{isDifferentRole ? ` (${origRole}→${posRole})` : ""}</title>
                <circle cx={cx} cy={cy} r="17"
                  fill={isSelected ? "#facc15" : col}
                  stroke={isSelected ? "#fbbf24" : isDifferentRole ? "#f97316" : "rgba(255,255,255,0.4)"}
                  strokeWidth={isSelected ? 2.5 : isDifferentRole ? 2 : 1.5}
                  opacity="0.93"
                />
                <text x={cx} y={cy-3} textAnchor="middle" fontSize="9" fontWeight="900" fill="white" fontFamily="sans-serif">{posRole}</text>
                <text x={cx} y={cy+8} textAnchor="middle" fontSize="7.5" fill="white" fontFamily="sans-serif" fontWeight="600">{name}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </AppCard>
  );
}

// multa per posizione nel podio: 1°=0€, 2°=1€, 3°=2€
const PODIUM_FINE = { 1: 0, 2: 1, 3: 2 };

// ── Statistiche Partitelle ────────────────────────────────────────────────────
function MiniMatchStats({ sessions = [], players = [] }) {
  const stats = useMemo(() => {
    const map = {}; // playerId → { wins, seconds, thirds, losses, draws, fine }
    sessions.forEach((s) => {
      const assignments = s.teamAssignments || {};
      const p = s.partitella;
      if (!p) return;

      if (p.podium && Object.keys(p.podium).length > 0) {
        // ── modalità podio (3 squadre) ──
        Object.entries(assignments).forEach(([pid, teamVal]) => {
          const teamIdx = assignmentTeamIndex(teamVal);
          if (teamIdx == null) return;
          const placement = p.podium[teamIdx]; // 1, 2 o 3
          if (!placement) return;
          if (!map[pid]) map[pid] = { wins: 0, seconds: 0, thirds: 0, losses: 0, draws: 0, fine: 0 };
          if (placement === 1) map[pid].wins++;
          else if (placement === 2) { map[pid].seconds++; map[pid].losses++; }
          else if (placement === 3) { map[pid].thirds++; map[pid].losses++; }
          map[pid].fine += PODIUM_FINE[placement] ?? 0;
        });
      } else if (p.winner != null) {
        // ── modalità classica (2 squadre o vecchio formato) ──
        Object.entries(assignments).forEach(([pid, teamVal]) => {
          const teamIdx = assignmentTeamIndex(teamVal);
          if (teamIdx == null) return;
          if (!map[pid]) map[pid] = { wins: 0, seconds: 0, thirds: 0, losses: 0, draws: 0, fine: 0 };
          if (p.winner === "draw") { map[pid].draws++; }
          else if (p.winner === teamIdx) { map[pid].wins++; }
          else { map[pid].losses++; map[pid].fine += 1; }
        });
      }
    });
    return map;
  }, [sessions]);

  const rows = useMemo(() => {
    return players
      .filter((p) => stats[String(p.id)])
      .map((p) => ({ p, ...stats[String(p.id)] }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.fine - b.fine;
      });
  }, [players, stats]);

  if (!rows.length) return null;

  const totalSessions = sessions.filter((s) => s.partitella?.winner != null || s.partitella?.podium).length;

  return (
    <AppCard style={{ marginTop: 12 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>
        Statistiche partitelle
        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "#64748b" }}>{totalSessions} partite registrate</span>
      </h4>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Giocatore", "Vinte", "Perse", "Pari", "Multa (€)"].map((h) => (
                <th key={h} style={{ padding: "6px 10px", textAlign: h === "Giocatore" ? "left" : "center", color: "#64748b", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, wins, losses, draws, fine }) => (
              <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "7px 10px", color: "#e2e8f0", fontWeight: 600 }}>{p.name}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#22c55e", fontWeight: 700 }}>{wins}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#ef4444", fontWeight: 700 }}>{losses}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#94a3b8" }}>{draws}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: fine > 0 ? "#f97316" : "#64748b", fontWeight: fine > 0 ? 700 : 400 }}>
                  {fine > 0 ? `€ ${fine}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}

export default Trainings;
