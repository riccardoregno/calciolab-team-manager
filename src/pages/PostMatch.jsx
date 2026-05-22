import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { styles } from "../styles/index.js";
import { createId, formatDate } from "../utils/helpers";
import { useTranslation } from "../i18n";
import { OBJECTIVE_STATUS, getObjectiveStatusMeta } from "../constants/objectiveStatus";

const clipCategories = [
  { value: "Tattica",        labelKey: "pages.postMatch.clipCatTactics" },
  { value: "Tecnica",        labelKey: "pages.postMatch.clipCatTechnical" },
  { value: "Fisico",         labelKey: "pages.postMatch.clipCatPhysical" },
  { value: "Palla inattiva", labelKey: "pages.postMatch.clipCatSetPieces" },
  { value: "Errore",         labelKey: "pages.postMatch.clipCatError" },
  { value: "Occasione",      labelKey: "pages.postMatch.clipCatChance" },
  { value: "Transizione",    labelKey: "pages.postMatch.clipCatTransition" },
];
const clipPhases = [
  { value: "Possesso",        labelKey: "pages.postMatch.clipPhasePossession" },
  { value: "Non possesso",    labelKey: "pages.postMatch.clipPhaseNonPossession" },
  { value: "Transizione +",   labelKey: "pages.postMatch.clipPhaseTransitionPos" },
  { value: "Transizione -",   labelKey: "pages.postMatch.clipPhaseTransitionNeg" },
  { value: "Corner",          labelKey: "pages.postMatch.clipPhaseCorner" },
  { value: "Punizione",       labelKey: "pages.postMatch.clipPhaseFreekick" },
  { value: "Rimessa",         labelKey: "pages.postMatch.clipPhaseThrowin" },
  { value: "Rigore",          labelKey: "pages.postMatch.clipPhasePenalty" },
];
const clipAudiences = [
  { value: "Staff",       labelKey: "pages.postMatch.clipAudStaff" },
  { value: "Squadra",     labelKey: "pages.postMatch.clipAudTeam" },
  { value: "Individuale", labelKey: "pages.postMatch.clipAudIndividual" },
  { value: "Reparto",     labelKey: "pages.postMatch.clipAudUnit" },
];

export default function PostMatch({
  matches = [], setMatches, players = [], sessions = [], setStaffTasks }) {

  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  // Se c'è un ID in URL usa quello; altrimenti cade sull'ultima partita giocata
  const match = id
    ? matches.find((m) => String(m.id) === String(id))
    : [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const [lastSaved, setLastSaved] = useState(null);
  const saveTimerRef = useRef(null);

  function updateReport(field, value) {
    if (!match) return;
    setMatches((prevMatches) =>
      prevMatches.map((item) =>
        item.id === match.id
          ? { ...item, postMatch: { ...(item.postMatch || {}), [field]: value } }
          : item
      )
    );
    // Feedback visivo auto-salvataggio
    clearTimeout(saveTimerRef.current);
    setLastSaved(null);
    saveTimerRef.current = setTimeout(() => setLastSaved(Date.now()), 300);
  }

  function updateVideoAnalysis(nextClips) {
    if (!match) return;
    setMatches((prevMatches) =>
      prevMatches.map((item) =>
        item.id === match.id ? { ...item, videoAnalysis: nextClips } : item
      )
    );
    clearTimeout(saveTimerRef.current);
    setLastSaved(null);
    saveTimerRef.current = setTimeout(() => setLastSaved(Date.now()), 300);
  }

  function createStaffTasksFromReport() {
    if (!match || !setStaffTasks) return;

    const report = match.postMatch || {};
    const candidates = [
      {
        title: t("pages.postMatch.taskPrepareSession"),
        description: report.trainingActions || report.nextWeekFocus,
        ownerRole: "headCoach",
        priority: "high",
      },
      {
        title: t("pages.postMatch.taskTacticalCorrection"),
        description: report.tacticalCorrections || report.notWorked,
        ownerRole: "assistantCoach",
        priority: "high",
      },
      {
        title: t("pages.postMatch.taskCheckPhysical"),
        description: report.physicalAlerts,
        ownerRole: "athleticTrainer",
        priority: "high",
      },
      {
        title: t("pages.postMatch.taskSetPieces"),
        description: report.setPiecesReview,
        ownerRole: "assistantCoach",
        priority: "medium",
      },
      {
        title: t("pages.postMatch.taskPrepareClips"),
        description: buildVideoTaskDescription(match.videoAnalysis || [], t),
        ownerRole: "assistantCoach",
        priority: "medium",
      },
    ].filter((task) => String(task.description || "").trim());

    if (!candidates.length) return;

    const dueDate = getRelativeDate(2);
    setStaffTasks((prev = []) => {
      const existingKeys = new Set(prev.map((task) => `${task.sourceType}:${task.sourceId}:${task.title}`));
      const nextTasks = candidates
        .filter((task) => !existingKeys.has(`postMatch:${match.id}:${task.title}`))
        .map((task) => ({
          id: createId("task"),
          title: task.title,
          description: `${task.description}\n\n${t("pages.postMatch.taskOrigin", { label: match.title || match.opponent || t("pages.postMatch.taskOriginFallback") })}`,
          status: "todo",
          priority: task.priority,
          ownerRole: task.ownerRole,
          dueDate,
          playerId: "",
          sourceType: "postMatch",
          sourceId: String(match.id),
          createdAt: new Date().toISOString(),
          completedAt: "",
        }));

      return nextTasks.length ? [...nextTasks, ...prev] : prev;
    });
    setLastSaved("staff-tasks");
  }

  function createTrainingFromReport() {
    if (!match) return;
    const report = match.postMatch || {};
    const objective = report.trainingActions || report.nextWeekFocus || report.tacticalCorrections || "";
    const notes = [
      report.nextWeekFocus && t("pages.postMatch.noteNextWeekFocus", { value: report.nextWeekFocus }),
      report.trainingActions && t("pages.postMatch.noteTrainingActions", { value: report.trainingActions }),
      report.tacticalCorrections && t("pages.postMatch.noteTacticalCorrections", { value: report.tacticalCorrections }),
      report.recoveryPlan && t("pages.postMatch.noteRecoveryPlan", { value: report.recoveryPlan }),
      report.physicalAlerts && t("pages.postMatch.notePhysicalAlerts", { value: report.physicalAlerts }),
      report.setPiecesReview && t("pages.postMatch.noteSetPiecesReview", { value: report.setPiecesReview }),
    ].filter(Boolean).join("\n");

    const draftTraining = {
      title: match.opponent
        ? t("pages.postMatch.trainingTitleVs", { opponent: match.opponent })
        : t("pages.postMatch.trainingTitle"),
      date: getRelativeDate(1),
      type: "Allenamento",
      theme: report.setPiecesReview ? "Palla inattiva" : "Transizione",
      matchDayDistance: "MD+1",
      objective,
      notes: notes ? `${t("pages.postMatch.noteFromReport")}\n${notes}` : "",
      exercises: [],
      attendance: {},
      sourceType: "postMatch",
      sourceMatchId: String(match.id),
      sourceMatchLabel: match.opponent || match.title || "",
      sourceMatchDate: match.date || "",
      sourceSummary: objective,
      objectiveStatus: "todo",
      objectiveReview: "",
    };
    sessionStorage.setItem("trainings_draft", JSON.stringify(draftTraining));
    navigate("/trainings", { state: { draftTraining } });
  }

  if (!match) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <PageHeader
          title={t("pages.postMatch.titleFallback")}
          subtitle={t("pages.postMatch.subtitle")}
        />
        <AppCard>
          <p style={s.muted}>{t("pages.postMatch.notFound")}</p>
          <Button variant="ghost" onClick={() => navigate("/matches")} style={{ marginTop: 12 }}>
            {t("pages.postMatch.backToMatches")}
          </Button>
        </AppCard>
      </div>
    );
  }

  const report   = match.postMatch || {};
  const videoAnalysis = match.videoAnalysis || [];
  const subtitle = [formatDate(match.date), match.location, match.result]
    .filter(Boolean)
    .join(" · ");
  const reportSections = [
    { key: "worked",              label: t("pages.postMatch.sectionWorked") },
    { key: "notWorked",           label: t("pages.postMatch.sectionNotWorked") },
    { key: "keyMoments",          label: t("pages.postMatch.sectionKeyMoments") },
    { key: "performanceScore",    label: t("pages.postMatch.sectionPerformanceScore") },
    { key: "gameModelScore",      label: t("pages.postMatch.sectionGameModelScore") },
    { key: "intensityScore",      label: t("pages.postMatch.sectionIntensityScore") },
    { key: "tacticalCorrections", label: t("pages.postMatch.sectionTacticalCorrections") },
    { key: "nextWeekFocus",       label: t("pages.postMatch.sectionNextWeekFocus") },
    { key: "trainingActions",     label: t("pages.postMatch.sectionTrainingActions") },
    { key: "recoveryPlan",        label: t("pages.postMatch.sectionRecoveryPlan") },
    { key: "positivePlayers",     label: t("pages.postMatch.sectionPositivePlayers") },
    { key: "physicalAlerts",      label: t("pages.postMatch.sectionPhysicalAlerts") },
    { key: "setPiecesReview",     label: t("pages.postMatch.sectionSetPiecesReview") },
    { key: "opponentLessons",     label: t("pages.postMatch.sectionOpponentLessons") },
    { key: "videoAnalysis",       label: t("pages.postMatch.sectionVideoAnalysis") },
  ];
  const completedSections = reportSections.filter((section) =>
    section.key === "videoAnalysis"
      ? videoAnalysis.length > 0
      : String(report[section.key] || "").trim()
  );
  const completion = Math.round((completedSections.length / reportSections.length) * 100);
  const openSections = reportSections.filter((section) =>
    section.key === "videoAnalysis"
      ? videoAnalysis.length === 0
      : !String(report[section.key] || "").trim()
  );
  const linkedSessions = sessions.filter((session) =>
    session.sourceType === "postMatch" && String(session.sourceMatchId) === String(match.id)
  );
  const objectiveStats = linkedSessions.reduce(
    (acc, session) => {
      const status = session.objectiveStatus || "todo";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { todo: 0, worked: 0, solved: 0 }
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <PageHeader
        title={match.opponent
          ? t("pages.postMatch.title", { opponent: match.opponent })
          : t("pages.postMatch.titleFallback")}
        subtitle={subtitle}
      />

      <MatchTabBar
        matchId={match.id}
        active="postgara"
        matchLabel={match.opponent ? `vs ${match.opponent}` : undefined}
        matchData={match}
      />

      {lastSaved && (
        <div style={s.savedBanner}>
          {t("pages.postMatch.savedBanner")}
        </div>
      )}

      {/* Intestazione partita */}
      <AppCard>
        <div style={s.matchHead}>
          <div>
            <Badge tone="orange">{t("pages.postMatch.reportBadge")}</Badge>
            <h2 style={{ margin: "10px 0 4px", lineHeight: 1.15 }}>
              {match.title || `CalcioLab vs ${match.opponent}`}
            </h2>
            <p style={s.muted}>{subtitle}</p>
          </div>

          <div style={s.resultBox}>
            <span style={s.resultLabel}>{t("pages.postMatch.resultLabel")}</span>
            <strong style={s.resultValue}>{match.result || "—"}</strong>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <div style={s.reportHead}>
          <div>
            <p style={s.eyebrow}>{t("pages.postMatch.reportEyebrow")}</p>
            <h3 style={s.reportTitle}>{t("pages.postMatch.reportTitle")}</h3>
            <p style={s.muted}>{t("pages.postMatch.reportSubtitle")}</p>
          </div>
          <div style={s.completionBox}>
            <strong>{completion}%</strong>
            <span>{t("pages.postMatch.sections", { completed: completedSections.length, total: reportSections.length })}</span>
          </div>
        </div>

        <div style={s.progressTrack}>
          <span style={{ ...s.progressFill, width: `${completion}%` }} />
        </div>

        <div style={s.summaryGrid}>
          <SummaryCard
            title={t("pages.postMatch.priorityStaff")}
            value={report.nextWeekFocus || report.notWorked || t("pages.postMatch.priorityStaffFallback")}
          />
          <SummaryCard
            title={t("pages.postMatch.mainCorrection")}
            value={report.tacticalCorrections || report.trainingActions || t("pages.postMatch.correctionFallback")}
          />
          <SummaryCard
            title={t("pages.postMatch.immediateAlerts")}
            value={report.physicalAlerts || t("pages.postMatch.alertFallback")}
          />
          <SummaryCard
            title={t("pages.postMatch.taggedClips")}
            value={videoAnalysis.length
              ? t("pages.postMatch.clipsCount", { count: videoAnalysis.length })
              : t("pages.postMatch.noClips")}
          />
        </div>

        <div style={s.actionRow}>
          <Button variant="ghost" onClick={() => navigate(`/match-stats/${match.id}`)}>{t("pages.postMatch.btnStats")}</Button>
          <Button variant="ghost" onClick={() => navigate(`/match-day/${match.id}`)}>{t("pages.postMatch.btnMatchDay")}</Button>
          <Button variant="ghost" onClick={() => navigate("/microcycle")}>{t("pages.postMatch.btnMicrocycle")}</Button>
          <Button variant="ghost" onClick={() => window.print()}>{t("pages.postMatch.btnPrint")}</Button>
          <Button variant="ghost" onClick={createStaffTasksFromReport}>{t("pages.postMatch.btnCreateTasks")}</Button>
          <Button onClick={createTrainingFromReport}>{t("pages.postMatch.btnCreateSession")}</Button>
        </div>

        {openSections.length > 0 && (
          <div style={s.todoStrip}>
            {openSections.slice(0, 4).map((section) => (
              <span key={section.key}>{t("pages.postMatch.todoComplete", { label: section.label })}</span>
            ))}
          </div>
        )}
      </AppCard>

      <AppCard>
        <div style={s.reportHead}>
          <div>
            <p style={s.eyebrow}>{t("pages.postMatch.linkedSessionsEyebrow")}</p>
            <h3 style={s.reportTitle}>{t("pages.postMatch.linkedSessionsTitle")}</h3>
            <p style={s.muted}>{t("pages.postMatch.linkedSessionsSubtitle")}</p>
          </div>
          <Badge tone={linkedSessions.length ? "green" : "blue"}>
            {linkedSessions.length}
          </Badge>
        </div>

        {linkedSessions.length > 0 && (
          <div style={s.objectiveStatsRow}>
            <Badge tone="orange">{t("pages.postMatch.objectiveTodoBadge", { count: objectiveStats.todo || 0 })}</Badge>
            <Badge tone="blue">{t("pages.postMatch.objectiveWorkedBadge", { count: objectiveStats.worked || 0 })}</Badge>
            <Badge tone="green">{t("pages.postMatch.objectiveSolvedBadge", { count: objectiveStats.solved || 0 })}</Badge>
          </div>
        )}

        {linkedSessions.length ? (
          <div style={s.linkedSessionList}>
            {linkedSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                style={s.linkedSessionRow}
                onClick={() => navigate(`/session-attendance/${session.id}`)}
              >
                <span>
                  <strong>{session.title || t("common.session")}</strong>
                  <small>{formatDate(session.date)} · {session.theme || t("pages.postMatch.sessionThemeFallback")}</small>
                  {session.objectiveReview && <em>{session.objectiveReview}</em>}
                </span>
                <div style={s.sessionBadges}>
                  <Badge tone="purple">{t("pages.postMatch.fromPostMatchBadge")}</Badge>
                  <Badge tone={getObjectiveStatusMeta(session.objectiveStatus).tone}>
                    {t(getObjectiveStatusMeta(session.objectiveStatus).labelKey)}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={s.emptyLinkedSessions}>
            <span>{t("pages.postMatch.noLinkedSessions")}</span>
            <Button variant="ghost" onClick={createTrainingFromReport}>{t("pages.postMatch.btnCreateSession")}</Button>
          </div>
        )}
      </AppCard>

      <div className="print-area">
        <AppCard>
          <div style={s.printHeader}>
            <div>
              <p style={s.eyebrow}>{t("pages.postMatch.printEyebrow")}</p>
              <h2 style={s.printTitle}>{match.title || `CalcioLab vs ${match.opponent || t("pages.postMatch.defaultOpponent")}`}</h2>
              <p style={s.muted}>{subtitle || t("pages.postMatch.defaultSubtitle")}</p>
            </div>
            <div style={s.printScore}>{match.result || "-"}</div>
          </div>

          <div style={s.printKpiGrid}>
            <SummaryCard title={t("pages.postMatch.kpiPerformance")} value={report.performanceScore || t("pages.postMatch.kpiFallback")} />
            <SummaryCard title={t("pages.postMatch.kpiGameModel")} value={report.gameModelScore || t("pages.postMatch.kpiFallback")} />
            <SummaryCard title={t("pages.postMatch.kpiIntensity")} value={report.intensityScore || t("pages.postMatch.kpiFallback")} />
            <SummaryCard title={t("pages.postMatch.kpiClips")} value={videoAnalysis.length} />
          </div>

          <div style={s.printReportGrid}>
            <PrintBox title={t("pages.postMatch.sectionWorked")} value={report.worked} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionNotWorked")} value={report.notWorked} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionKeyMoments")} value={report.keyMoments} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionTacticalCorrections")} value={report.tacticalCorrections} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionNextWeekFocus")} value={report.nextWeekFocus} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionTrainingActions")} value={report.trainingActions} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionPhysicalAlerts")} value={report.physicalAlerts} fallback={t("pages.postMatch.printComplete")} />
            <PrintBox title={t("pages.postMatch.sectionRecoveryPlan")} value={report.recoveryPlan} fallback={t("pages.postMatch.printComplete")} />
          </div>
        </AppCard>
      </div>

      <AppCard>
        <div style={s.reportHead}>
          <div>
            <p style={s.eyebrow}>{t("pages.postMatch.scorecardEyebrow")}</p>
            <h3 style={s.reportTitle}>{t("pages.postMatch.scorecardTitle")}</h3>
            <p style={s.muted}>{t("pages.postMatch.scorecardSubtitle")}</p>
          </div>
        </div>
        <div style={s.scoreGrid}>
          <ScoreField label={t("pages.postMatch.kpiPerformance")} placeholder={t("pages.postMatch.kpiFallback")} value={report.performanceScore} onChange={(v) => updateReport("performanceScore", v)} />
          <ScoreField label={t("pages.postMatch.kpiGameModel")} placeholder={t("pages.postMatch.kpiFallback")} value={report.gameModelScore} onChange={(v) => updateReport("gameModelScore", v)} />
          <ScoreField label={t("pages.postMatch.kpiIntensity")} placeholder={t("pages.postMatch.kpiFallback")} value={report.intensityScore} onChange={(v) => updateReport("intensityScore", v)} />
          <ScoreField label={t("pages.postMatch.scoreStaff")} placeholder={t("pages.postMatch.kpiFallback")} value={report.staffRating} onChange={(v) => updateReport("staffRating", v)} />
        </div>
      </AppCard>

      {/* Griglia analisi */}
      <div style={s.grid}>
        <TextBlock
          title={t("pages.postMatch.blockWorkedTitle")}
          placeholder={t("pages.postMatch.blockWorkedPlaceholder")}
          value={report.worked}
          onChange={(v) => updateReport("worked", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockNotWorkedTitle")}
          placeholder={t("pages.postMatch.blockNotWorkedPlaceholder")}
          value={report.notWorked}
          onChange={(v) => updateReport("notWorked", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockKeyMomentsTitle")}
          placeholder={t("pages.postMatch.blockKeyMomentsPlaceholder")}
          value={report.keyMoments}
          onChange={(v) => updateReport("keyMoments", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockTacticalTitle")}
          placeholder={t("pages.postMatch.blockTacticalPlaceholder")}
          value={report.tacticalCorrections}
          onChange={(v) => updateReport("tacticalCorrections", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockNextWeekTitle")}
          placeholder={t("pages.postMatch.blockNextWeekPlaceholder")}
          value={report.nextWeekFocus}
          onChange={(v) => updateReport("nextWeekFocus", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockTrainingActionsTitle")}
          placeholder={t("pages.postMatch.blockTrainingActionsPlaceholder")}
          value={report.trainingActions}
          onChange={(v) => updateReport("trainingActions", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockRecoveryTitle")}
          placeholder={t("pages.postMatch.blockRecoveryPlaceholder")}
          value={report.recoveryPlan}
          onChange={(v) => updateReport("recoveryPlan", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockPositivePlayersTitle")}
          placeholder={t("pages.postMatch.blockPositivePlayersPlaceholder")}
          value={report.positivePlayers}
          onChange={(v) => updateReport("positivePlayers", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockPhysicalAlertsTitle")}
          placeholder={t("pages.postMatch.blockPhysicalAlertsPlaceholder")}
          value={report.physicalAlerts}
          onChange={(v) => updateReport("physicalAlerts", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockSetPiecesTitle")}
          placeholder={t("pages.postMatch.blockSetPiecesPlaceholder")}
          value={report.setPiecesReview}
          onChange={(v) => updateReport("setPiecesReview", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockOpponentTitle")}
          placeholder={t("pages.postMatch.blockOpponentPlaceholder")}
          value={report.opponentLessons}
          onChange={(v) => updateReport("opponentLessons", v)}
        />
        <TextBlock
          title={t("pages.postMatch.blockStaffDecisionsTitle")}
          placeholder={t("pages.postMatch.blockStaffDecisionsPlaceholder")}
          value={report.staffDecisions}
          onChange={(v) => updateReport("staffDecisions", v)}
        />
      </div>

      <VideoAnalysisPanel
        clips={videoAnalysis}
        players={players}
        onChange={updateVideoAnalysis}
        onAppendReport={(text) => updateReport("videoClips", text)}
        reportNotes={report.videoClips || ""}
      />

      {/* Selezione partita (se accedono da /post-match senza ID) */}
      {!id && matches.length > 1 && (
        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.postMatch.changeMatch")}</h3>
          <div style={s.matchList}>
            {[...matches]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/post-match/${m.id}`)}
                  style={{
                    ...s.matchBtn,
                    ...(m.id === match.id ? s.matchBtnActive : {}),
                  }}
                >
                  <strong style={{ lineHeight: 1.2 }}>{m.title || m.opponent}</strong>
                  <span style={s.muted}>{formatDate(m.date)}</span>
                </button>
              ))}
          </div>
        </AppCard>
      )}
    </div>
  );
}

function VideoAnalysisPanel({ clips, players, onChange, onAppendReport, reportNotes }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(getEmptyClip());

  function updateDraft(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function addClip() {
    const hasContent = [draft.minute, draft.url, draft.tags, draft.note].some((value) =>
      String(value || "").trim()
    );
    if (!hasContent) return;
    onChange([
      ...clips,
      {
        ...draft,
        id: createId("clip"),
        minute: String(draft.minute || "").trim(),
        tags: String(draft.tags || "").trim(),
        note: String(draft.note || "").trim(),
        url: String(draft.url || "").trim(),
      },
    ]);
    setDraft(getEmptyClip());
  }

  function updateClip(clipId, field, value) {
    onChange(clips.map((clip) => (clip.id === clipId ? { ...clip, [field]: value } : clip)));
  }

  function deleteClip(clipId) {
    onChange(clips.filter((clip) => clip.id !== clipId));
  }

  function syncReportNotes() {
    const summary = clips
      .map((clip) => {
        const player = players.find((item) => String(item.id) === String(clip.playerId));
        return `${clip.minute ? `${clip.minute}' ` : ""}${clip.category} · ${clip.phase}${player ? ` · ${player.name}` : ""}: ${clip.note || clip.tags || clip.url || "clip da rivedere"}`;
      })
      .join("\n");
    onAppendReport([reportNotes, summary].filter(Boolean).join("\n\n"));
  }

  return (
    <AppCard>
      <div style={s.videoHead}>
        <div>
          <p style={s.eyebrow}>{t("pages.postMatch.videoEyebrow")}</p>
          <h3 style={s.reportTitle}>{t("pages.postMatch.videoTitle")}</h3>
          <p style={s.muted}>{t("pages.postMatch.videoSubtitle")}</p>
        </div>
        <div style={s.clipCounter}>
          <strong>{clips.length}</strong>
          <span>clip</span>
        </div>
      </div>

      <div style={s.clipForm}>
        <input
          placeholder={t("pages.postMatch.clipMinutePlaceholder")}
          value={draft.minute}
          onChange={(event) => updateDraft("minute", event.target.value.replace(/[^\d+:.-]/g, ""))}
          style={s.smallInput}
        />
        <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} style={styles.input}>
          {clipCategories.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
        </select>
        <select value={draft.phase} onChange={(event) => updateDraft("phase", event.target.value)} style={styles.input}>
          {clipPhases.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
        </select>
        <select value={draft.playerId} onChange={(event) => updateDraft("playerId", event.target.value)} style={styles.input}>
          <option value="">{t("pages.postMatch.clipPlayerPlaceholder")}</option>
          {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
        <select value={draft.audience} onChange={(event) => updateDraft("audience", event.target.value)} style={styles.input}>
          {clipAudiences.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
        </select>
        <input
          placeholder={t("pages.postMatch.clipLinkPlaceholder")}
          value={draft.url}
          onChange={(event) => updateDraft("url", event.target.value)}
          style={styles.input}
        />
        <input
          placeholder={t("pages.postMatch.clipTagsPlaceholder")}
          value={draft.tags}
          onChange={(event) => updateDraft("tags", event.target.value)}
          style={styles.input}
        />
        <input
          placeholder={t("pages.postMatch.clipNotePlaceholder")}
          value={draft.note}
          onChange={(event) => updateDraft("note", event.target.value)}
          style={styles.input}
        />
        <Button onClick={addClip}>{t("pages.postMatch.btnAddClip")}</Button>
      </div>

      {clips.length ? (
        <div style={s.clipList}>
          {clips.map((clip) => {
            const player = players.find((item) => String(item.id) === String(clip.playerId));
            return (
              <div key={clip.id} style={s.clipRow}>
                <input
                  value={clip.minute}
                  onChange={(event) => updateClip(clip.id, "minute", event.target.value)}
                  placeholder="Min."
                  style={s.smallInput}
                />
                <select value={clip.category} onChange={(event) => updateClip(clip.id, "category", event.target.value)} style={styles.input}>
                  {clipCategories.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
                </select>
                <select value={clip.phase} onChange={(event) => updateClip(clip.id, "phase", event.target.value)} style={styles.input}>
                  {clipPhases.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
                </select>
                <div style={s.clipText}>
                  <strong>{player?.name || t("pages.postMatch.noPlayer")}</strong>
                  <span>{clip.tags || clip.note || t("pages.postMatch.noTag")}</span>
                  {clip.url && (
                    <a href={clip.url} target="_blank" rel="noreferrer" style={s.clipLink}>
                      {t("pages.postMatch.openVideo")}
                    </a>
                  )}
                </div>
                <select value={clip.playerId} onChange={(event) => updateClip(clip.id, "playerId", event.target.value)} style={styles.input}>
                  <option value="">{t("pages.postMatch.clipPlayerPlaceholder")}</option>
                  {players.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={clip.audience} onChange={(event) => updateClip(clip.id, "audience", event.target.value)} style={styles.input}>
                  {clipAudiences.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
                </select>
                <Button variant="danger" onClick={() => deleteClip(clip.id)}>{t("pages.postMatch.btnDeleteClip")}</Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={s.emptyClipBox}>
          {t("pages.postMatch.emptyClips")}
        </div>
      )}

      {clips.length > 0 && (
        <div style={s.actionRow}>
          <Button variant="ghost" onClick={syncReportNotes}>{t("pages.postMatch.btnSyncNotes")}</Button>
        </div>
      )}
    </AppCard>
  );
}

function getEmptyClip() {
  return {
    minute: "",
    category: clipCategories[0].value,
    phase: clipPhases[0].value,
    playerId: "",
    audience: clipAudiences[0].value,
    url: "",
    tags: "",
    note: "",
  };
}

function buildVideoTaskDescription(clips, t) {
  if (!clips.length) return "";
  const individualCount = clips.filter((clip) => clip.audience === "Individuale" || clip.playerId).length;
  const staffCount = clips.length - individualCount;
  // Keep these as data strings — they land in staff task descriptions, not UI labels
  return [
    `${clips.length} clip to organise for video review.`,
    individualCount ? `${individualCount} individual clips to send or discuss.` : "",
    staffCount ? `${staffCount} staff/unit clips to summarise.` : "",
  ].filter(Boolean).join(" ");
}

function getRelativeDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ─── TextBlock ─────────────────────────────────────────────── */
function TextBlock({ title, placeholder, value = "", onChange }) {
  return (
    <AppCard>
      <h3 style={{ marginTop: 0, marginBottom: 12, lineHeight: 1.2, fontSize: 15 }}>{title}</h3>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
      />
    </AppCard>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div style={s.summaryCard}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoreField({ label, placeholder = "—", value = "", onChange }) {
  return (
    <label style={s.scoreField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>
        <option value="">{placeholder}</option>
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => (
          <option key={score} value={String(score)}>{score}/10</option>
        ))}
      </select>
    </label>
  );
}

function PrintBox({ title, value, fallback = "—" }) {
  return (
    <div style={s.printBox}>
      <span>{title}</span>
      <p>{value || fallback}</p>
    </div>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */
const s = {
  muted: { color: "#94a3b8", margin: 0, lineHeight: 1.45 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 18,
  },
  matchHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    flexWrap: "wrap",
  },
  resultBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  resultValue: {
    fontSize: 32,
    lineHeight: 1,
    color: "white",
  },
  reportHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 6px",
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  reportTitle: {
    margin: "0 0 6px",
    fontSize: 24,
    lineHeight: 1.12,
  },
  completionBox: {
    minWidth: 118,
    borderRadius: 16,
    padding: "12px 14px",
    display: "grid",
    gap: 4,
    textAlign: "right",
    background: "rgba(56,189,248,0.10)",
    border: "1px solid rgba(56,189,248,0.24)",
    color: "#bfdbfe",
  },
  progressTrack: {
    position: "relative",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    margin: "16px 0",
    background: "rgba(255,255,255,0.08)",
  },
  progressFill: {
    position: "absolute",
    inset: 0,
    borderRadius: 999,
    background: "linear-gradient(90deg,#38bdf8,#22c55e)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 10,
    marginBottom: 14,
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
    marginTop: 16,
  },
  scoreField: {
    display: "grid",
    gap: 7,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 8,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
  },
  printHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  printTitle: {
    margin: "6px 0 4px",
    lineHeight: 1.1,
  },
  printScore: {
    minWidth: 88,
    borderRadius: 14,
    padding: "14px 18px",
    textAlign: "center",
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.24)",
    fontSize: 28,
    fontWeight: 900,
  },
  printKpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 10,
    marginTop: 18,
  },
  printReportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 12,
    marginTop: 18,
  },
  printBox: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  videoHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  clipCounter: {
    minWidth: 86,
    borderRadius: 16,
    padding: "11px 14px",
    display: "grid",
    gap: 3,
    textAlign: "right",
    background: "rgba(251,191,36,0.10)",
    border: "1px solid rgba(251,191,36,0.24)",
    color: "#fde68a",
  },
  clipForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  smallInput: {
    ...styles.input,
    minWidth: 0,
    textAlign: "center",
  },
  clipList: {
    display: "grid",
    gap: 10,
    marginBottom: 14,
  },
  clipRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  clipText: {
    display: "grid",
    gap: 3,
    minWidth: 0,
    color: "#cbd5e1",
    lineHeight: 1.25,
  },
  clipLink: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: 800,
    textDecoration: "none",
  },
  emptyClipBox: {
    borderRadius: 14,
    padding: 16,
    background: "rgba(15,23,42,0.72)",
    border: "1px dashed rgba(148,163,184,0.28)",
    color: "#94a3b8",
    lineHeight: 1.4,
    marginBottom: 14,
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  linkedSessionList: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  objectiveStatsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  linkedSessionRow: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.04)",
    color: "#e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  sessionBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  emptyLinkedSessions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "rgba(15,23,42,0.58)",
    border: "1px dashed rgba(148,163,184,0.26)",
    color: "#94a3b8",
  },
  todoStrip: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.07)",
    color: "#fcd34d",
    fontSize: 12,
    fontWeight: 800,
  },
  matchList: {
    display: "grid",
    gap: 8,
    marginTop: 10,
  },
  savedBanner: {
    padding: "9px 16px",
    borderRadius: 12,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.28)",
    color: "#86efac",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  matchBtn: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.2,
  },
  matchBtnActive: {
    background: "rgba(56,189,248,0.14)",
    border: "1px solid rgba(56,189,248,0.3)",
  },
};
