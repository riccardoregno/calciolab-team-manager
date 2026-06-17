import { useEffect, useMemo, useState } from "react";
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

import { styles } from "../styles/index.js";
import { createId, formatDate, normalizeAppSettings, RPE_BY_MATCH_DAY, TRAINING_BLOCKS, getBlockFromCategory } from "../utils/helpers";
import { useTranslation } from "../i18n";
import { sendTeamNotification } from "../services/notifications";
import RpeMatrix from "../components/statistics/RpeMatrix";
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
  exercises, sessions, setSessions, players = [], matches = [], appSettings = {}, loading = false, teamId = null }) {

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
      // Pulisce il backup sessionStorage subito, così un successivo
      // back+forward non ricarica la bozza originale sovrascrivendo le modifiche
      try {
        sessionStorage.removeItem("trainings_draft");
      } catch {
        /* sessionStorage can be unavailable in restricted browsers */
      }
      return getInitialTrainingForm(fromState);
    }
    try {
      const stored = sessionStorage.getItem("trainings_draft");
      if (stored) {
        sessionStorage.removeItem("trainings_draft");
        return getInitialTrainingForm(JSON.parse(stored));
      }
    } catch {
      /* Ignore stale or unreadable draft backups */
    }
    return getInitialTrainingForm(null);
  });

  useEffect(() => {
    const draftTraining = location.state?.draftTraining;
    if (!draftTraining) return;

    showToast(t("pages.trainings.draftLoaded"), "info");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, showToast, t]);

  // RPE calcolato dalla distanza dalla gara
  const rpeTarget = RPE_BY_MATCH_DAY[form.matchDayDistance] || RPE_BY_MATCH_DAY["MD-3"];

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

  const totalMinutes = selectedExercises.reduce(
    (sum, item) => sum + Number(item.customDuration || item.duration || 0),
    0
  );
  const availablePlayersCount = players.filter(
    (player) => !UNAVAILABLE_STATUSES.includes(player.status || "Disponibile")
  ).length;
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
      value: players.length ? `${availablePlayersCount}/${players.length}` : "-",
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
      date: session.date || new Date().toISOString().slice(0, 10),
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
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
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

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyTraining());
    setFormErrors({});
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

      <ActionBar
        eyebrow={clubName}
        title={form.title || t("pages.trainings.printTitlePlaceholder")}
        subtitle={`${getThemeLabel(form.theme, t)} · ${form.matchDayDistance}`}
        meta={<Badge tone="blue">{t("pages.trainings.savedCount", { count: sessions.length })}</Badge>}
      >
        <MetricStrip items={trainingMetricItems} min={isMobile ? 118 : 132} style={{ marginTop: isMobile ? 8 : 14 }} className="mobile-scroll-x" />
      </ActionBar>

      <RpeMatrix teamId={teamId} players={players} sessions={sessions} matches={matches} />

      <div
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
                    value={players.length ? `${availablePlayersCount}/${players.length}` : "-"}
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
          style={{
            ...styles.input,
            minHeight: 44,
            resize: "vertical",
          }}
        />
      </FieldLabel>
    </div>

    {/* Pannello RPE — distanza dalla gara */}
    <RpePanel rpe={rpeTarget} md={form.matchDayDistance} />

    {/* Giocatori disponibili per questa seduta */}
    {players.length > 0 && (
      <AvailablePlayers players={players} />
    )}
  </AppCard>

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
              <div>
                <div style={trainingStyles.stepHeader}>
                  <span style={trainingStyles.stepBadge}>2</span>
                  <span>{t("pages.trainings.step2")}</span>
                </div>
                <h3 style={{ margin: 0, lineHeight: 1.2 }}>{t("pages.trainings.libraryTitle")}</h3>
                <p style={{ color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
                  {t("pages.trainings.librarySubtitle")}
                </p>
              </div>

              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder={t("pages.trainings.searchPlaceholder")}
              />
            </div>

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
          </AppCard>

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
            <div style={trainingStyles.stepHeader}>
              <span style={trainingStyles.stepBadge}>4</span>
              <span>{t("pages.trainings.step4")}</span>
            </div>
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

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
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
              <Button variant="ghost" onClick={() => navigate("/exports")}>
                {t("pages.trainings.exportPdfAction")}
              </Button>
            </div>
          </AppCard>
        </div>
      </div>

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

            <Badge tone="blue">{t("pages.trainings.savedCount", { count: sessions.length })}</Badge>
          </div>

          {loading && sessions.length === 0 ? (
            <SkeletonList rows={3} cols={2} />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="📋"
              title={t("pages.trainings.noSavedTitle")}
              text={t("pages.trainings.noSavedText")}
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
              {sessions.map((session) => {
                const sessionTotal = (session.exercises || []).reduce(
                  (sum, item) => sum + Number(item.customDuration || 0),
                  0
                );

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
                        <h3 style={{ margin: 0, lineHeight: 1.2 }}>{session.title}</h3>

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
        </AppCard>
      </div>
    </div>
  );
}

function emptyTraining() {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
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
const UNAVAILABLE_STATUSES = ["Infortunato", "Squalificato"];

function AvailablePlayers({ players }) {
  const { t } = useTranslation();
  const available = players.filter(
    (p) => !UNAVAILABLE_STATUSES.includes(p.status || "Disponibile")
  );
  const unavailable = players.filter(
    (p) => UNAVAILABLE_STATUSES.includes(p.status || "Disponibile")
  );

  return (
    <div style={{
      marginTop: 16,
      paddingTop: 16,
      borderTop: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {t("pages.trainings.availablePlayers")}
        </h4>
        <span style={{
          fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
          background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e",
        }}>
          {available.length} / {players.length}
        </span>
        {unavailable.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
            background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171",
          }}>
            {t("pages.trainings.unavailablePlayers", { count: unavailable.length })}
          </span>
        )}
      </div>

      {/* Chip disponibili */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {available.map((p) => {
          const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
          return (
            <span key={p.id} style={{
              fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
              background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac",
            }}>
              {p.shirtNumber ? `#${p.shirtNumber} ` : ""}{name}
            </span>
          );
        })}
      </div>

      {/* Chip non disponibili */}
      {unavailable.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {unavailable.map((p) => {
            const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
            const isInjured = p.status === "Infortunato";
            return (
              <span key={p.id} title={`${p.status}${p.injuryType ? ` · ${p.injuryType}` : ""}`} style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                background: isInjured ? "rgba(248,113,113,0.08)" : "rgba(168,85,247,0.08)",
                border: isInjured ? "1px solid rgba(248,113,113,0.2)" : "1px solid rgba(168,85,247,0.2)",
                color: isInjured ? "#fca5a5" : "#d8b4fe",
                textDecoration: "line-through",
                opacity: 0.75,
              }}>
                {isInjured ? "🚑" : "🟥"} {name}
              </span>
            );
          })}
        </div>
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

export default Trainings;
