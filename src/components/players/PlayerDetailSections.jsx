import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

import { useTranslation } from "../../i18n";
import { styles } from "../../styles/index.js";
import { formatShortDate, getPhysicalReference, parsePlayerBirthDate } from "../../utils/helpers";

const PLAYER_TABS = [
  { key: "cartella",    labelKey: "pages.playerDetail.tabs.cartella" },
  { key: "profilo",     labelKey: "pages.playerDetail.tabs.profilo" },
  { key: "statistiche", labelKey: "pages.playerDetail.tabs.statistiche" },
  { key: "video",       labelKey: "pages.playerDetail.tabs.video" },
  { key: "fisico",      labelKey: "pages.playerDetail.tabs.fisico" },
  { key: "medico",      labelKey: "pages.playerDetail.tabs.medico" },
  { key: "sviluppo",    labelKey: "pages.playerDetail.tabs.sviluppo" },
];

function formatBirthDateDisplay(raw) {
  if (!raw) return "-";
  const d = parsePlayerBirthDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PlayerSidebar({ form, editing, onImageUpload, onPhotoSizeChange, onPhotoOffsetChange, summary }) {
  const { t } = useTranslation();
  const photoSize    = Math.min(180, Math.max(60,  Number(form.photoSize    || 100)));
  const photoOffsetX = Math.min(50,  Math.max(-50, Number(form.photoOffsetX || 0)));
  const photoOffsetY = Math.min(50,  Math.max(-50, Number(form.photoOffsetY || 0)));
  return (
    <>
      <AppCard>
        <div style={sectionStyles.sidebarProfile}>
          {form.photo ? (
            <div style={sectionStyles.avatarFrame}>
              <img
                src={form.photo}
                alt={form.name}
                style={{
                  ...sectionStyles.avatarImage,
                  transform: `scale(${photoSize / 100}) translate(${photoOffsetX}%, ${photoOffsetY}%)`,
                }}
              />
            </div>
          ) : (
            <div style={sectionStyles.avatarFallback}>{form.name?.[0] || "P"}</div>
          )}

          <h2 style={{ marginBottom: 6 }}>{form.name}</h2>
          <p style={{ color: "#94a3b8" }}>{form.role || t("pages.playerDetail.sidebar.roleEmpty")}</p>

          <div style={sectionStyles.badgeRow}>
            <Badge tone="blue">#{form.shirtNumber || "-"}</Badge>
            <Badge tone={getStatusTone(form.status)}>{form.status || t("pages.playerDetail.statusField.available")}</Badge>
          </div>

          {editing && (
            <div style={{ marginTop: 20, width: "100%" }}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onImageUpload(event.target.files[0])}
                style={styles.input}
              />
              {form.photo && (
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={sectionStyles.photoSizeControl}>
                    {t("pages.playerDetail.photoSize", { value: photoSize })}
                    <input
                      type="range" min="60" max="180" step="5"
                      value={photoSize}
                      onChange={(e) => onPhotoSizeChange(Number(e.target.value))}
                    />
                  </label>
                  <label style={sectionStyles.photoSizeControl}>
                    {t("pages.playerDetail.photoOffsetX", { value: photoOffsetX })}
                    <input
                      type="range" min="-50" max="50" step="2"
                      value={photoOffsetX}
                      onChange={(e) => onPhotoOffsetChange("photoOffsetX", Number(e.target.value))}
                    />
                  </label>
                  <label style={sectionStyles.photoSizeControl}>
                    {t("pages.playerDetail.photoOffsetY", { value: photoOffsetY })}
                    <input
                      type="range" min="-50" max="50" step="2"
                      value={photoOffsetY}
                      onChange={(e) => onPhotoOffsetChange("photoOffsetY", Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>{t("pages.playerDetail.sidebar.alertTitle")}</h3>
        {summary.alerts.length ? (
          <div style={sectionStyles.alertList}>
            {summary.alerts.map((alert) => (
              <Badge key={alert} tone="orange">{alert}</Badge>
            ))}
          </div>
        ) : (
          <p style={sectionStyles.muted}>{t("pages.playerDetail.sidebar.noAlerts")}</p>
        )}
      </AppCard>
    </>
  );
}

export function PlayerTabs({ activeTab, onChange }) {
  const { t } = useTranslation();
  return (
    <div style={sectionStyles.tabRow}>
      {PLAYER_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          style={{
            ...sectionStyles.tabButton,
            ...(activeTab === tab.key ? sectionStyles.tabButtonActive : {}),
          }}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}

export function PlayerKpiStrip({ summary }) {
  const { t } = useTranslation();
  return (
    <div style={sectionStyles.kpiGrid}>
      <MiniKpi label={t("pages.playerDetail.kpi.presences")} value={summary.stats.presences} />
      <MiniKpi label={t("pages.playerDetail.kpi.minutes")}   value={summary.stats.minutes} />
      <MiniKpi label={t("pages.playerDetail.kpi.goals")}     value={summary.stats.goals} />
      <MiniKpi label={t("pages.playerDetail.kpi.assists")}   value={summary.stats.assists} />
      <MiniKpi label={t("pages.playerDetail.kpi.avgRpe")}    value={summary.stats.avgRpe || "-"} />
      <MiniKpi label={t("pages.playerDetail.kpi.load")}      value={summary.stats.load || "-"} />
    </div>
  );
}

export function PlayerProfileTab({ form, player, editing, onEdit, onCancel, onSave, onFieldChange, onInvitePortal, invitingPortal, portalInvitePending, portalAccountLinked, onRevokePortal, revokingPortal }) {
  const { t } = useTranslation();
  return (
    <AppCard>
      <div style={sectionStyles.cardHeader}>
        <div>
          <h3 style={{ margin: 0 }}>{t("pages.playerDetail.profile.title")}</h3>
          <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.profile.subtitle")}</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {editing ? (
            <>
              <Button variant="ghost" onClick={onCancel}>{t("pages.playerDetail.profile.cancel")}</Button>
              <Button onClick={onSave}>{t("pages.playerDetail.profile.save")}</Button>
            </>
          ) : (
            <>
              {portalAccountLinked && onRevokePortal ? (
                <Button variant="ghost" onClick={onRevokePortal} disabled={revokingPortal}>
                  {revokingPortal
                    ? t("pages.playerDetail.profile.invitePortalSending")
                    : t("pages.playerDetail.profile.revokePortal")}
                </Button>
              ) : onInvitePortal && (
                <Button
                  variant="ghost"
                  onClick={onInvitePortal}
                  disabled={invitingPortal || !form.email}
                  title={!form.email ? t("pages.playerDetail.profile.invitePortalNoEmail") : undefined}
                >
                  {invitingPortal
                    ? t("pages.playerDetail.profile.invitePortalSending")
                    : portalInvitePending
                    ? t("pages.playerDetail.profile.invitePortalPending")
                    : t("pages.playerDetail.profile.invitePortal")}
                </Button>
              )}
              <Button onClick={() => onEdit(player)}>{t("pages.playerDetail.profile.edit")}</Button>
            </>
          )}
        </div>
      </div>

      <div style={sectionStyles.formGrid}>
        <Field label={t("pages.playerDetail.profile.fieldName")}        value={form.name}        editing={editing} onChange={(v) => onFieldChange("name", v)} />
        <Field label={t("pages.playerDetail.profile.fieldRole")}        value={form.role}        editing={editing} onChange={(v) => onFieldChange("role", v)} />
        <Field label={t("pages.playerDetail.profile.fieldShirt")}       value={form.shirtNumber} editing={editing} onChange={(v) => onFieldChange("shirtNumber", v)} />
        <Field label={t("pages.playerDetail.profile.fieldFoot")}        value={form.foot}        editing={editing} onChange={(v) => onFieldChange("foot", v)} />
        <Field label={t("pages.playerDetail.profile.fieldHeight")}      value={form.height}      editing={editing} onChange={(v) => onFieldChange("height", v)} />
        <Field label={t("pages.playerDetail.profile.fieldWeight")}      value={form.weight}      editing={editing} onChange={(v) => onFieldChange("weight", v)} />
        <Field label={t("pages.playerDetail.profile.fieldNationality")} value={form.nationality} editing={editing} onChange={(v) => onFieldChange("nationality", v)} />
        <Field label={t("pages.playerDetail.profile.fieldEmail")} type="email" value={form.email} editing={editing} onChange={(v) => onFieldChange("email", v)} />
        <Field
          label={t("pages.playerDetail.profile.fieldBirthDate")}
          type="date"
          value={form.birthDate}
          displayValue={formatBirthDateDisplay(form.birthDate)}
          editing={editing}
          onChange={(v) => onFieldChange("birthDate", v)}
        />
      </div>
    </AppCard>
  );
}

export function PlayerTechnicalOverview({
  player,
  summary,
  activeInjuries,
  injuryHistory,
  preventionRecommendations,
  onGoToTab,
}) {
  const { t } = useTranslation();
  const availabilityScore = getAvailabilityScore(player, activeInjuries);
  const workloadTone = summary.stats.load > 900 ? "orange" : summary.stats.load > 0 ? "green" : "blue";
  const readinessTone = availabilityScore >= 80 ? "green" : availabilityScore >= 50 ? "orange" : "red";
  const latestEvent = summary.recentEvents[0];
  const latestTest = summary.latestTests[0];

  const priorities = [
    player.status && player.status !== "Disponibile"
      ? player.expectedReturn
        ? t("pages.playerDetail.priorities.manageStatusWithReturn", { status: player.status, return: player.expectedReturn })
        : t("pages.playerDetail.priorities.manageStatus", { status: player.status })
      : "",
    summary.stats.load > 900 ? t("pages.playerDetail.priorities.highLoad") : "",
    !latestTest ? t("pages.playerDetail.priorities.scheduleTest") : "",
    !player.weeklyGoal ? t("pages.playerDetail.priorities.setWeeklyGoal") : "",
    preventionRecommendations.length ? t("pages.playerDetail.priorities.applyPrevention") : "",
  ].filter(Boolean);

  return (
    <div style={sectionStyles.overviewGrid}>
      <AppCard>
        <div style={sectionStyles.overviewHead}>
          <div>
            <p style={sectionStyles.eyebrow}>{t("pages.playerDetail.overview.eyebrow")}</p>
            <h3 style={sectionStyles.overviewTitle}>{t("pages.playerDetail.overview.title")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.overview.subtitle")}</p>
          </div>
          <div style={sectionStyles.readinessBox}>
            <strong>{availabilityScore}%</strong>
            <span>{t("pages.playerDetail.overview.readiness")}</span>
          </div>
        </div>

        <div style={sectionStyles.overviewKpis}>
          <MiniStatus label={t("pages.playerDetail.overview.availability")} value={player.status || t("pages.playerDetail.statusField.available")} tone={readinessTone} />
          <MiniStatus label={t("pages.playerDetail.overview.load")}    value={summary.stats.load || "-"} tone={workloadTone} />
          <MiniStatus label={t("pages.playerDetail.overview.minutes")} value={summary.stats.minutes || "-"} tone="blue" />
          <MiniStatus label={t("pages.playerDetail.overview.lastTest")} value={latestTest?.date ? formatShortDate(latestTest.date) : "-"} tone={latestTest ? "green" : "orange"} />
        </div>
      </AppCard>

      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.overview.staffPriorities")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.overview.staffPrioritiesSubtitle")}</p>
          </div>
          <Badge tone={priorities.length ? "orange" : "green"}>{priorities.length || "Ok"}</Badge>
        </div>
        {priorities.length ? (
          <div style={sectionStyles.priorityList}>
            {priorities.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : (
          <p style={sectionStyles.muted}>{t("pages.playerDetail.overview.noPriorities")}</p>
        )}
      </AppCard>

      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.overview.individualGoals")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.overview.goalsSubtitle")}</p>
          </div>
          <Button variant="ghost" onClick={() => onGoToTab("sviluppo")}>{t("pages.playerDetail.overview.openDevelopment")}</Button>
        </div>
        <div style={sectionStyles.objectiveGrid}>
          <ReadOnlyText label={t("pages.playerDetail.overview.strengths")}    value={player.strengths} />
          <ReadOnlyText label={t("pages.playerDetail.overview.improvements")} value={player.improvements} />
          <ReadOnlyText label={t("pages.playerDetail.overview.weeklyGoal")}   value={player.weeklyGoal} />
        </div>
      </AppCard>

      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.overview.recentTrend")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.overview.recentEvents")}</p>
          </div>
          <Button variant="ghost" onClick={() => onGoToTab("statistiche")}>{t("pages.playerDetail.overview.detailButton")}</Button>
        </div>
        {latestEvent ? (
          <div style={sectionStyles.list}>
            {summary.recentEvents.slice(0, 4).map(({ event, data }) => (
              <div key={`${event.type}-${event.id}`} style={sectionStyles.listItem}>
                <Badge tone={event.type === "Partita" ? "orange" : "green"}>{event.type}</Badge>
                <strong>{event.title}</strong>
                <span>{formatShortDate(event.date)} · {data.status || "—"} · RPE {data.rpe || "-"} · {data.minutes || 0} min</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={sectionStyles.muted}>{t("pages.playerDetail.overview.noRecentEvents")}</p>
        )}
      </AppCard>

      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.overview.medicalTitle")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.overview.medicalSubtitle")}</p>
          </div>
          <Button variant="ghost" onClick={() => onGoToTab("medico")}>{t("pages.playerDetail.overview.openMedical")}</Button>
        </div>
        <div style={sectionStyles.overviewKpis}>
          <MiniStatus label={t("pages.playerDetail.overview.activeInjuries")} value={activeInjuries.length} tone={activeInjuries.length ? "red" : "green"} />
          <MiniStatus label={t("pages.playerDetail.overview.history")}    value={injuryHistory.length} tone="blue" />
          <MiniStatus label={t("pages.playerDetail.overview.prevention")} value={preventionRecommendations.length || "-"} tone={preventionRecommendations.length ? "orange" : "green"} />
        </div>
        {preventionRecommendations[0] && (
          <p style={{ ...sectionStyles.muted, marginTop: 12 }}>
            {t("pages.playerDetail.overview.preventionSuggested", { title: preventionRecommendations[0].title })}
          </p>
        )}
      </AppCard>
    </div>
  );
}

export function PlayerDevelopmentTab({ form, editing, summary, videoClips = [], onCreateStaffTask, onFieldChange }) {
  const { t } = useTranslation();
  const actionCount = [
    form.weeklyGoal,
    form.thirtyDayGoal,
    form.trainingActions,
    form.successMetrics,
    form.videoReviewNotes,
  ].filter((value) => String(value || "").trim()).length;

  return (
    <div style={sectionStyles.developmentGrid}>
      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <p style={sectionStyles.eyebrow}>{t("pages.playerDetail.development.eyebrow")}</p>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.development.title")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.development.subtitle")}</p>
          </div>
          <Badge tone={actionCount >= 4 ? "green" : "orange"}>{actionCount}/5</Badge>
        </div>

        <div style={sectionStyles.developmentKpis}>
          <MiniStatus label={t("pages.playerDetail.kpi.minutes")} value={summary.stats.minutes || "-"} tone="blue" />
          <MiniStatus label={t("pages.playerDetail.kpi.avgRpe")}  value={summary.stats.avgRpe || "-"} tone="orange" />
          <MiniStatus label={t("pages.playerDetail.development.clip")} value={videoClips.length} tone={videoClips.length ? "purple" : "blue"} />
          <MiniStatus label={t("pages.playerDetail.kpi.load")}    value={summary.stats.load || "-"} tone="green" />
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>{t("pages.playerDetail.development.technicalProfile")}</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <TextAreaField label={t("pages.playerDetail.overview.strengths")}          value={form.strengths}        editing={editing} onChange={(v) => onFieldChange("strengths", v)} />
          <TextAreaField label={t("pages.playerDetail.overview.improvements")}       value={form.improvements}     editing={editing} onChange={(v) => onFieldChange("improvements", v)} />
          <TextAreaField label={t("pages.playerDetail.development.developmentFocus")} value={form.developmentFocus} editing={editing} onChange={(v) => onFieldChange("developmentFocus", v)} />
        </div>
      </AppCard>

      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.development.goalsTitle")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.development.goalsSubtitle")}</p>
          </div>
          {onCreateStaffTask && (
            <Button variant="ghost" onClick={onCreateStaffTask}>
              {t("pages.playerDetail.development.createStaffAction")}
            </Button>
          )}
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <TextAreaField label={t("pages.playerDetail.development.weeklyGoal")}     value={form.weeklyGoal}      editing={editing} onChange={(v) => onFieldChange("weeklyGoal", v)} />
          <TextAreaField label={t("pages.playerDetail.development.thirtyDayGoal")}  value={form.thirtyDayGoal}   editing={editing} onChange={(v) => onFieldChange("thirtyDayGoal", v)} />
          <TextAreaField label={t("pages.playerDetail.development.trainingActions")} value={form.trainingActions} editing={editing} onChange={(v) => onFieldChange("trainingActions", v)} />
          <TextAreaField label={t("pages.playerDetail.development.successMetrics")} value={form.successMetrics}  editing={editing} onChange={(v) => onFieldChange("successMetrics", v)} />
        </div>
      </AppCard>

      <AppCard>
        <div style={sectionStyles.cardHeader}>
          <div>
            <h3 style={{ margin: 0 }}>{t("pages.playerDetail.development.videoTitle")}</h3>
            <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.development.videoSubtitle")}</p>
          </div>
          <Badge tone={videoClips.length ? "blue" : "orange"}>{videoClips.length} {t("pages.playerDetail.development.clip")}</Badge>
        </div>

        {videoClips.length ? (
          <div style={sectionStyles.list}>
            {videoClips.slice(0, 4).map((clip) => (
              <div key={`${clip.matchId}-${clip.id}`} style={sectionStyles.videoClip}>
                <div style={sectionStyles.videoClipTop}>
                  <Badge tone="orange">{clip.minute ? `${clip.minute}'` : "Video"}</Badge>
                  <span>{formatShortDate(clip.matchDate)} · {clip.category}</span>
                </div>
                <strong>{clip.phase || t("pages.playerDetail.development.noPhase")}</strong>
                <p>{clip.note || clip.tags || t("pages.playerDetail.development.clipFallback")}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={sectionStyles.muted}>{t("pages.playerDetail.development.noClips")}</p>
        )}

        <div style={{ marginTop: 14 }}>
          <TextAreaField label={t("pages.playerDetail.development.videoNotes")}    value={form.videoReviewNotes} editing={editing} onChange={(v) => onFieldChange("videoReviewNotes", v)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <TextAreaField label={t("pages.playerDetail.development.coachFeedback")} value={form.coachFeedback}    editing={editing} onChange={(v) => onFieldChange("coachFeedback", v)} />
        </div>
      </AppCard>
    </div>
  );
}

export function PlayerPhysicalTab({ form, editing, latestTests, onFieldChange }) {
  const { t } = useTranslation();
  return (
    <>
      <AppCard>
        <h3 style={{ marginTop: 0 }}>{t("pages.playerDetail.physical.title")}</h3>
        <div style={sectionStyles.formGrid}>
          <StatusField value={form.status} editing={editing} onChange={(v) => onFieldChange("status", v)} />
          <Field label={t("pages.playerDetail.physical.fieldInjuryType")}    value={form.injuryType}         editing={editing} onChange={(v) => onFieldChange("injuryType", v)} />
          <Field label={t("pages.playerDetail.physical.fieldDifferentiated")} value={form.differentiatedType} editing={editing} onChange={(v) => onFieldChange("differentiatedType", v)} />
          <Field label={t("pages.playerDetail.physical.fieldExpectedReturn")} value={form.expectedReturn}     editing={editing} onChange={(v) => onFieldChange("expectedReturn", v)} />
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>{t("pages.playerDetail.physical.testTitle")}</h3>
        {latestTests.length ? (
          <div style={sectionStyles.list}>
            {latestTests.map((test) => {
              const reference = getPhysicalReference(test);
              return (
                <div key={test.id} style={sectionStyles.listItem}>
                  <Badge tone="blue">{formatShortDate(test.date)}</Badge>
                  <strong>{reference.group} · MAS {reference.mas || "-"}</strong>
                  <span>Gacon {test.gaconLevel || "-"} · 10m {test.sprint10m || "-"} · {t("pages.playerDetail.physical.jumpLabel")} {test.jumpCm || "-"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={sectionStyles.muted}>{t("pages.playerDetail.physical.noTests")}</p>
        )}
      </AppCard>
    </>
  );
}

export function PlayerMedicalTab({
  activeInjuries,
  injuryHistory,
  pastInjuries,
  totalDaysOut,
  totalSessionsMissed,
  totalMatchesMissed,
  generalInjuryNotes,
  preventionRecommendations,
  onAddInjuryRecord,
  onCreateDifferentiatedWork,
  onAddMedicalNote,
  onMarkRecovered,
}) {
  const { t } = useTranslation();
  return (
    <AppCard>
      <div style={sectionStyles.cardHeader}>
        <div>
          <h3 style={{ margin: 0 }}>{t("pages.playerDetail.medical.title")}</h3>
          <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.medical.subtitle")}</p>
        </div>
        <Badge tone={activeInjuries.length ? "red" : "green"}>
          {activeInjuries.length
            ? t("pages.playerDetail.medical.activeCount", { count: activeInjuries.length })
            : t("pages.playerDetail.medical.noneActive")}
        </Badge>
      </div>

      <div style={sectionStyles.quickActions}>
        <Button onClick={onAddInjuryRecord}>{t("pages.playerDetail.medical.addInjury")}</Button>
        <Button variant="ghost" onClick={onCreateDifferentiatedWork}>{t("pages.playerDetail.medical.createDifferentiated")}</Button>
        <Button variant="ghost" onClick={onAddMedicalNote}>{t("pages.playerDetail.medical.addNote")}</Button>
        <Button variant="ghost" onClick={onMarkRecovered} disabled={!activeInjuries.length}>{t("pages.playerDetail.medical.markRecovered")}</Button>
      </div>

      <div style={sectionStyles.medicalKpiGrid}>
        <MiniKpi label={t("pages.playerDetail.medical.totalInjuries")}  value={injuryHistory.length} />
        <MiniKpi label={t("pages.playerDetail.medical.recovered")}      value={pastInjuries.length} />
        <MiniKpi label={t("pages.playerDetail.medical.daysOut")}        value={totalDaysOut} />
        <MiniKpi label={t("pages.playerDetail.medical.sessionsMissed")} value={totalSessionsMissed} />
        <MiniKpi label={t("pages.playerDetail.medical.matchesMissed")}  value={totalMatchesMissed} />
      </div>

      <div style={sectionStyles.preventionBox}>
        <div style={sectionStyles.preventionHeader}>
          <strong>{t("pages.playerDetail.medical.preventionTitle")}</strong>
          <Badge tone="blue">{t("pages.playerDetail.medical.preventionCount", { count: preventionRecommendations.length })}</Badge>
        </div>
        {preventionRecommendations.length ? (
          <div style={sectionStyles.preventionGrid}>
            {preventionRecommendations.map((item) => (
              <div key={item.title} style={sectionStyles.preventionCard}>
                <div style={sectionStyles.preventionCardTop}>
                  <strong>{item.title}</strong>
                  <span style={sectionStyles.preventionTag}>{item.reason}</span>
                </div>
                <ul style={sectionStyles.preventionList}>
                  {item.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p style={sectionStyles.muted}>{t("pages.playerDetail.medical.noPreventionSheets")}</p>
        )}
      </div>

      {generalInjuryNotes && (
        <div style={sectionStyles.generalNotes}>
          <strong>{t("pages.playerDetail.medical.generalNotes")}</strong>
          <p>{generalInjuryNotes}</p>
        </div>
      )}

      {injuryHistory.length ? (
        <div style={sectionStyles.injuryTimeline}>
          {injuryHistory.map((injury, index) => (
            <div key={injury.id || `${injury.startDate}-${injury.injuryType}-${index}`} style={sectionStyles.injuryItem}>
              <div style={sectionStyles.injuryItemTop}>
                <div>
                  <strong style={sectionStyles.injuryTitle}>{injury.injuryType || t("pages.playerDetail.medical.injuryFallback")}</strong>
                  <p style={sectionStyles.injuryDates}>
                    {injury.startDate || t("pages.playerDetail.medical.dateNotSet")} → {injury.endDate || injury.expectedReturn || t("pages.playerDetail.medical.inProgress")}
                  </p>
                </div>
                <Badge tone={injury.endDate ? "green" : "red"}>
                  {injury.endDate ? t("pages.playerDetail.medical.statusRecovered") : t("pages.playerDetail.medical.statusActive")}
                </Badge>
              </div>

              <div style={sectionStyles.injuryMeta}>
                {injury.daysOut != null && <span>{t("pages.playerDetail.medical.daysOutCount", { count: injury.daysOut })}</span>}
                {injury.sessionsMissed != null && <span>{t("pages.playerDetail.medical.sessionsMissedCount", { count: injury.sessionsMissed })}</span>}
                {injury.matchesMissed != null && <span>{t("pages.playerDetail.medical.matchesMissedCount", { count: injury.matchesMissed })}</span>}
                {injury.differentiatedType && <span>{t("pages.playerDetail.medical.differentiatedWork", { type: injury.differentiatedType })}</span>}
              </div>

              {injury.notes && <p style={sectionStyles.injuryNotes}>{injury.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p style={sectionStyles.muted}>{t("pages.playerDetail.medical.noInjuries")}</p>
      )}
    </AppCard>
  );
}

const ABSENCE_TYPE_LABEL_KEYS = {
  ferie:    "pages.playerDetail.absences.typeFerie",
  permesso: "pages.playerDetail.absences.typePermesso",
  studio:   "pages.playerDetail.absences.typeStudio",
  lavoro:   "pages.playerDetail.absences.typeLavoro",
  altro:    "pages.playerDetail.absences.typeAltro",
};

function getAbsenceStatus(absence) {
  const today = new Date().toISOString().slice(0, 10);
  if (absence.dateEnd && absence.dateEnd < today) return "past";
  if (absence.dateStart && absence.dateStart > today) return "upcoming";
  return "ongoing";
}

export function PlayerAbsencesSection({ absences = [], onAddAbsence, onRemoveAbsence }) {
  const { t } = useTranslation();
  const sorted = [...absences].sort((a, b) => new Date(a.dateStart || 0) - new Date(b.dateStart || 0));
  const upcomingOrOngoing = sorted.filter((a) => getAbsenceStatus(a) !== "past");

  return (
    <AppCard>
      <div style={sectionStyles.cardHeader}>
        <div>
          <h3 style={{ margin: 0 }}>{t("pages.playerDetail.absences.title")}</h3>
          <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.absences.subtitle")}</p>
        </div>
        <Badge tone={upcomingOrOngoing.length ? "orange" : "green"}>
          {upcomingOrOngoing.length
            ? t("pages.playerDetail.absences.plannedCount", { count: upcomingOrOngoing.length })
            : t("pages.playerDetail.absences.noneActive")}
        </Badge>
      </div>

      <div style={sectionStyles.quickActions}>
        <Button onClick={onAddAbsence}>{t("pages.playerDetail.absences.addBtn")}</Button>
      </div>

      {sorted.length ? (
        <div style={sectionStyles.injuryTimeline}>
          {sorted.map((absence, index) => {
            const status = getAbsenceStatus(absence);
            const tone = status === "past" ? "green" : status === "upcoming" ? "blue" : "orange";
            const statusLabel = status === "past"
              ? t("pages.playerDetail.absences.statusPast")
              : status === "upcoming"
              ? t("pages.playerDetail.absences.statusUpcoming")
              : t("pages.playerDetail.absences.statusOngoing");
            const typeLabel = ABSENCE_TYPE_LABEL_KEYS[absence.type]
              ? t(ABSENCE_TYPE_LABEL_KEYS[absence.type])
              : (absence.type || t("pages.playerDetail.absences.typeAltro"));

            return (
              <div key={absence.id || `${absence.dateStart}-${absence.dateEnd}-${index}`} style={sectionStyles.injuryItem}>
                <div style={sectionStyles.injuryItemTop}>
                  <div>
                    <strong style={sectionStyles.injuryTitle}>{typeLabel}</strong>
                    <p style={sectionStyles.injuryDates}>
                      {absence.dateStart || "—"} → {absence.dateEnd || "—"}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone={tone}>{statusLabel}</Badge>
                    {onRemoveAbsence && (
                      <Button variant="ghost" onClick={() => onRemoveAbsence(absence.id)}>
                        {t("pages.playerDetail.absences.removeBtn")}
                      </Button>
                    )}
                  </div>
                </div>
                {absence.notes && <p style={sectionStyles.injuryNotes}>{absence.notes}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={sectionStyles.muted}>{t("pages.playerDetail.absences.noAbsences")}</p>
      )}
    </AppCard>
  );
}

export function PlayerStatsTab({ summary }) {
  const { t } = useTranslation();
  return (
    <AppCard>
      <h3 style={{ marginTop: 0 }}>{t("pages.playerDetail.stats.title")}</h3>
      {summary.recentEvents.length ? (
        <div style={sectionStyles.list}>
          {summary.recentEvents.map(({ event, data }) => (
            <div key={`${event.type}-${event.id}`} style={sectionStyles.listItem}>
              <Badge tone={event.type === "Partita" ? "orange" : "green"}>{event.type}</Badge>
              <strong>{event.title}</strong>
              <span>{formatShortDate(event.date)} · {data.status} · {data.minutes || 0} min · {data.goals || 0} {t("pages.playerDetail.kpi.goals").toLowerCase()} · {data.assists || 0} {t("pages.playerDetail.kpi.assists").toLowerCase()}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={sectionStyles.muted}>{t("pages.playerDetail.stats.noEvents")}</p>
      )}
    </AppCard>
  );
}

export function PlayerVideoTab({ clips }) {
  const { t } = useTranslation();
  const grouped = clips.reduce((acc, clip) => {
    const key = clip.category || t("common.other");
    acc[key] = acc[key] || [];
    acc[key].push(clip);
    return acc;
  }, {});

  return (
    <AppCard>
      <div style={sectionStyles.cardHeader}>
        <div>
          <h3 style={{ margin: 0 }}>{t("pages.playerDetail.video.title")}</h3>
          <p style={sectionStyles.cardSubtitle}>{t("pages.playerDetail.video.subtitle")}</p>
        </div>
        <Badge tone={clips.length ? "blue" : "orange"}>{clips.length} {t("pages.playerDetail.development.clip").toLowerCase()}</Badge>
      </div>

      {clips.length ? (
        <div style={sectionStyles.videoGrid}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={sectionStyles.videoGroup}>
              <div style={sectionStyles.videoGroupHead}>
                <strong>{category}</strong>
                <Badge tone="purple">{items.length}</Badge>
              </div>
              <div style={sectionStyles.list}>
                {items.map((clip) => (
                  <div key={`${clip.matchId}-${clip.id}`} style={sectionStyles.videoClip}>
                    <div style={sectionStyles.videoClipTop}>
                      <Badge tone="orange">{clip.minute ? `${clip.minute}'` : "Video"}</Badge>
                      <span>{formatShortDate(clip.matchDate)} · {clip.matchTitle}</span>
                    </div>
                    <strong>{clip.phase || t("pages.playerDetail.video.noPhase")}</strong>
                    <p>{clip.note || clip.tags || t("pages.playerDetail.video.noTechNote")}</p>
                    <div style={sectionStyles.videoMeta}>
                      {clip.tags && <span>{clip.tags}</span>}
                      {clip.audience && <span>{clip.audience}</span>}
                      {clip.url && (
                        <a href={clip.url} target="_blank" rel="noreferrer">
                          {t("pages.playerDetail.video.openClip")}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={sectionStyles.muted}>{t("pages.playerDetail.video.noClips")}</p>
      )}
    </AppCard>
  );
}

/* ─── Inner helper components ────────────────────────────────── */

function MiniKpi({ label, value }) {
  return (
    <AppCard>
      <span style={sectionStyles.kpiLabel}>{label}</span>
      <strong style={sectionStyles.kpiValue}>{value}</strong>
    </AppCard>
  );
}

function MiniStatus({ label, value, tone }) {
  return (
    <div style={sectionStyles.miniStatus}>
      <Badge tone={tone}>{label}</Badge>
      <strong>{value}</strong>
    </div>
  );
}

function ReadOnlyText({ label, value }) {
  return (
    <div style={sectionStyles.readOnlySummary}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function getAvailabilityScore(player, activeInjuries) {
  if (activeInjuries.length || player.status === "Infortunato") return 25;
  if (player.status === "Recupero") return 55;
  if (player.status === "Differenziato") return 65;
  if (player.status === "Squalificato") return 45;
  return 100;
}

function StatusField({ value, editing, onChange }) {
  const { t } = useTranslation();
  const options = [
    { value: "Disponibile",   label: t("pages.playerDetail.statusField.available") },
    { value: "Recupero",      label: t("pages.playerDetail.statusField.recovery") },
    { value: "Differenziato", label: t("pages.playerDetail.statusField.differentiated") },
    { value: "Infortunato",   label: t("pages.playerDetail.statusField.injured") },
    { value: "Squalificato",  label: t("pages.playerDetail.statusField.suspended") },
    { value: "Permesso",      label: t("pages.playerDetail.statusField.absent") },
  ];
  return (
    <div>
      <FieldLabel>Status</FieldLabel>
      {editing ? (
        <select value={value || "Disponibile"} onChange={(e) => onChange(e.target.value)} style={styles.input}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <ReadOnlyBox>{options.find((o) => o.value === value)?.label || value || t("pages.playerDetail.statusField.available")}</ReadOnlyBox>
      )}
    </div>
  );
}

function Field({ label, value, editing, onChange, type = "text", displayValue }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
      ) : (
        <ReadOnlyBox>{displayValue !== undefined ? displayValue : (value || "-")}</ReadOnlyBox>
      )}
    </div>
  );
}

function TextAreaField({ label, value, editing, onChange }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...styles.input, minHeight: 100 }}
        />
      ) : (
        <div style={sectionStyles.readOnlyText}>{value || "-"}</div>
      )}
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={sectionStyles.fieldLabel}>{children}</div>;
}

function ReadOnlyBox({ children }) {
  return <div style={sectionStyles.readOnlyBox}>{children}</div>;
}

function getStatusTone(status) {
  if (status === "Infortunato") return "red";
  if (status === "Recupero" || status === "Differenziato") return "orange";
  if (status === "Squalificato") return "purple";
  return "green";
}

const sectionStyles = {
  sidebarProfile: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  avatarFrame: {
    width: 180,
    height: 180,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 18,
    border: "2px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.72)",
    display: "grid",
    placeItems: "center",
  },
  avatarImage: { width: "100%", height: "100%", objectFit: "cover" },
  avatarFallback: {
    width: 180, height: 180, borderRadius: 28,
    background: "linear-gradient(135deg,#2563eb,#38bdf8)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 52, fontWeight: 900, marginBottom: 18,
  },
  photoSizeControl: {
    display: "grid",
    gap: 6,
    marginTop: 12,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  badgeRow: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 12 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 },
  kpiLabel: { color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  kpiValue: { display: "block", marginTop: 8, fontSize: 26 },
  tabRow: { display: "flex", gap: 8, flexWrap: "wrap", padding: 6, borderRadius: 16, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.08)" },
  tabButton: { minHeight: 38, border: "1px solid transparent", borderRadius: 12, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "0 14px" },
  tabButtonActive: { background: "rgba(56,189,248,0.16)", borderColor: "rgba(56,189,248,0.35)", color: "#f8fafc" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 16, flexWrap: "wrap" },
  cardSubtitle: { color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 },
  overviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 },
  overviewHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  eyebrow: { margin: "0 0 6px", color: "#38bdf8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 },
  overviewTitle: { margin: "0 0 6px", fontSize: 24, lineHeight: 1.12 },
  readinessBox: { minWidth: 108, borderRadius: 16, padding: "12px 14px", textAlign: "right", display: "grid", gap: 4, color: "#bfdbfe", background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.24)" },
  overviewKpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginTop: 16 },
  miniStatus: { display: "grid", gap: 8, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  priorityList: { display: "grid", gap: 8, color: "#fcd34d", fontSize: 13, fontWeight: 800 },
  objectiveGrid: { display: "grid", gap: 10 },
  readOnlySummary: { display: "grid", gap: 6, padding: 12, borderRadius: 14, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" },
  developmentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },
  developmentKpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: "uppercase" },
  readOnlyBox: { borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 48, display: "flex", alignItems: "center" },
  readOnlyText: { borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.6, color: "#cbd5e1" },
  medicalKpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 16 },
  quickActions: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 },
  preventionBox: { display: "grid", gap: 12, padding: 14, borderRadius: 14, background: "rgba(56,189,248,0.055)", border: "1px solid rgba(56,189,248,0.16)", marginBottom: 16 },
  preventionHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "#e2e8f0" },
  preventionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 },
  preventionCard: { padding: 12, borderRadius: 12, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.08)" },
  preventionCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, color: "#f8fafc", fontSize: 13 },
  preventionTag: { flexShrink: 0, color: "#38bdf8", fontSize: 10, fontWeight: 900, textTransform: "uppercase" },
  preventionList: { margin: 0, paddingLeft: 18, display: "grid", gap: 5, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 },
  list: { display: "grid", gap: 10 },
  listItem: { display: "grid", gap: 6, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
  videoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 },
  videoGroup: { display: "grid", gap: 10 },
  videoGroupHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  videoClip: { display: "grid", gap: 8, padding: 12, borderRadius: 14, background: "rgba(15,23,42,0.62)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
  videoClipTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 12, flexWrap: "wrap" },
  videoMeta: { display: "flex", flexWrap: "wrap", gap: 8, color: "#94a3b8", fontSize: 12 },
  alertList: { display: "flex", flexWrap: "wrap", gap: 8 },
  muted: { color: "#94a3b8", margin: 0 },
  injuryTimeline: { display: "grid", gap: 10 },
  generalNotes: { display: "grid", gap: 6, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", marginBottom: 16 },
  injuryItem: { padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  injuryItemTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  injuryTitle: { color: "#e2e8f0", fontSize: 14 },
  injuryDates: { margin: "4px 0 0", color: "#94a3b8", fontSize: 12 },
  injuryMeta: { display: "flex", flexWrap: "wrap", gap: 8, color: "#94a3b8", fontSize: 12 },
  injuryNotes: { margin: "10px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 },
};
