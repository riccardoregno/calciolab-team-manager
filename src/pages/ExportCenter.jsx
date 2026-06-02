import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import AppCard from "../components/ui/AppCard";
import { useIsMobile } from "../hooks/useIsMobile";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import {
  formatDate,
  formatShortDate,
  getLineup,
  getPhysicalReference,
  getPlayerSummary,
  RPE_BY_MATCH_DAY,
} from "../utils/helpers";
import { generateSeasonReport } from "../utils/generateSeasonReport";

const EXPORT_TYPE_KEYS = [
  { id: "season",    labelKey: "pages.exportCenter.typeSeason",    descKey: "pages.exportCenter.typeSeasonDesc" },
  { id: "training",  labelKey: "pages.exportCenter.typeTraining",  descKey: "pages.exportCenter.typeTrainingDesc" },
  { id: "matchday",  labelKey: "pages.exportCenter.typeMatchday",  descKey: "pages.exportCenter.typeMatchdayDesc" },
  { id: "microcycle",labelKey: "pages.exportCenter.typeMicrocycle",descKey: "pages.exportCenter.typeMicrocycleDesc" },
  { id: "postmatch", labelKey: "pages.exportCenter.typePostmatch", descKey: "pages.exportCenter.typePostmatchDesc" },
  { id: "player",    labelKey: "pages.exportCenter.typePlayer",    descKey: "pages.exportCenter.typePlayerDesc" },
];

export default function ExportCenter({
  players = [],
  sessions = [],
  matches = [],
  exercises = [],
  physicalTests = [],
  gpsSessions = [],
  appSettings = {},
}) {
  const { t } = useTranslation();
  const [type, setType] = useState("training");

  const exportTypes = EXPORT_TYPE_KEYS.map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    description: t(item.descKey),
  }));
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const isMobile = useIsMobile();

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sessions]
  );
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [matches]
  );

  const effectiveSessionId = selectedSessionId || sortedSessions[0]?.id || "";
  const effectiveMatchId = selectedMatchId || sortedMatches[0]?.id || "";
  const effectivePlayerId = selectedPlayerId || players[0]?.id || "";

  const selectedSession = sortedSessions.find((session) => sameId(session.id, effectiveSessionId));
  const selectedMatch = sortedMatches.find((match) => sameId(match.id, effectiveMatchId));
  const selectedPlayer = players.find((player) => sameId(player.id, effectivePlayerId));

  const activeType = exportTypes.find((item) => item.id === type) || exportTypes[0];

  return (
    <div style={pageStyles.page}>
      <PageHeader
        title={t("pages.exportCenter.title")}
        subtitle={t("pages.exportCenter.subtitle")}
        action={
          <Button onClick={() => window.print()}>
            {t("pages.exportCenter.printBtn")}
          </Button>
        }
      />

      <div className="export-workspace" style={{ ...pageStyles.workspace, gridTemplateColumns: isMobile ? "1fr" : "360px 1fr" }}>
        <AppCard title={t("pages.exportCenter.contentTitle")} subtitle={t("pages.exportCenter.contentSubtitle")}>
          <div style={pageStyles.typeGrid}>
            {exportTypes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id)}
                style={{
                  ...pageStyles.typeButton,
                  borderColor: item.id === type ? "#38bdf8" : "rgba(255,255,255,0.08)",
                  background: item.id === type ? "rgba(56,189,248,0.12)" : "rgba(15,23,42,0.72)",
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          <div style={pageStyles.controls}>
            {(type === "training") && (
              <Field label={t("pages.exportCenter.fieldSession")}>
                <select
                  value={effectiveSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  style={styles.input}
                >
                  {sortedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title} - {formatShortDate(session.date)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {(type === "matchday" || type === "postmatch" || type === "microcycle") && (
              <Field label={t("pages.exportCenter.fieldMatch")}>
                <select
                  value={effectiveMatchId}
                  onChange={(event) => setSelectedMatchId(event.target.value)}
                  style={styles.input}
                >
                  {sortedMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.title} - {formatShortDate(match.date)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {type === "player" && (
              <Field label={t("pages.exportCenter.fieldPlayer")}>
                <select
                  value={effectivePlayerId}
                  onChange={(event) => setSelectedPlayerId(event.target.value)}
                  style={styles.input}
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} {player.role ? `- ${player.role}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </AppCard>

        {type === "season" ? (
          <SeasonReportPanel
            players={players}
            sessions={sessions}
            matches={matches}
            physicalTests={physicalTests}
            appSettings={appSettings}
          />
        ) : (
          <AppCard
            title={t("pages.exportCenter.previewTitle", { label: activeType.label })}
            subtitle={t("pages.exportCenter.previewSubtitle")}
            rightContent={<Button variant="ghost" onClick={() => window.print()}>{t("pages.exportCenter.pdfBtn")}</Button>}
          >
            <div className="print-area print-template">
              {type === "training" && (
                <TrainingTemplate session={selectedSession} exercises={exercises} />
              )}
              {type === "matchday" && (
                <MatchDayTemplate match={selectedMatch} players={players} />
              )}
              {type === "microcycle" && (
                <MicrocycleTemplate
                  match={selectedMatch}
                  sessions={sessions}
                  matches={matches}
                  players={players}
                  gpsSessions={gpsSessions}
                />
              )}
              {type === "postmatch" && (
                <PostMatchTemplate match={selectedMatch} players={players} />
              )}
              {type === "player" && (
                <PlayerTemplate
                  player={selectedPlayer}
                  sessions={sessions}
                  matches={matches}
                  physicalTests={physicalTests}
                  appSettings={appSettings}
                />
              )}
            </div>
          </AppCard>
        )}
      </div>
    </div>
  );
}

/** Returns the microcycle days array with translated focus/plan strings. */
function getMicrocycleDays(t) {
  const T = "pages.exportCenter.tpl.microcycle";
  return [
    { key: "MD+1", offset: -6, focus: t(`${T}.md1Focus`),  plan: t(`${T}.md1Plan`) },
    { key: "MD-4", offset: -4, focus: t(`${T}.md4Focus`),  plan: t(`${T}.md4Plan`) },
    { key: "MD-3", offset: -3, focus: t(`${T}.md3Focus`),  plan: t(`${T}.md3Plan`) },
    { key: "MD-2", offset: -2, focus: t(`${T}.md2Focus`),  plan: t(`${T}.md2Plan`) },
    { key: "MD-1", offset: -1, focus: t(`${T}.mdm1Focus`), plan: t(`${T}.mdm1Plan`) },
    { key: "MD",   offset:  0, focus: t(`${T}.md0Focus`),  plan: t(`${T}.md0Plan`) },
  ];
}

function MicrocycleTemplate({ match, sessions, matches, players, gpsSessions }) {
  const { t } = useTranslation();
  const T = "pages.exportCenter.tpl.microcycle";
  if (!match) return <EmptyPrint />;

  const matchDate = toDateKey(match.date);
  const week = getMicrocycleDays(t).map((day) => {
    const date = addDays(matchDate, day.offset);
    const daySessions = sessions.filter((session) => toDateKey(session.date) === date);
    const dayMatches = matches.filter((item) => toDateKey(item.date) === date);
    const dayGps = gpsSessions.filter((session) => toDateKey(session.date) === date);
    const sessionLoad = daySessions.reduce((sum, session) => {
      return sum + Number(session.duration || 0) * Number(session.rpe || 0);
    }, 0);
    const gpsDistance = dayGps.reduce((sum, session) => {
      return sum + (session.rows || []).reduce((rowSum, row) => rowSum + Number(row.distance || row.totalDistance || 0), 0);
    }, 0);
    return { ...day, date, daySessions, dayMatches, sessionLoad, gpsDistance };
  });

  const unavailable = players.filter((player) =>
    ["Infortunato", "Recupero", "Differenziato", "Squalificato", "Assente", "Permesso"].includes(player.status)
  );
  const totalSessions = week.reduce((sum, day) => sum + day.daySessions.length, 0);
  const totalLoad = week.reduce((sum, day) => sum + day.sessionLoad, 0);
  const totalGpsDistance = week.reduce((sum, day) => sum + day.gpsDistance, 0);

  return (
    <article>
      <PrintHeader
        eyebrow={t(`${T}.eyebrow`)}
        title={match.title}
        meta={[formatDate(match.date), match.opponent || t(`${T}.fallbackOpponent`, { defaultValue: t("pages.exportCenter.tpl.fallbackOpponent") }), match.competition || t("pages.exportCenter.tpl.fallbackCompetition")]}
      />

      <KpiGrid
        items={[
          { label: t(`${T}.kpiSessions`), value: totalSessions },
          { label: t(`${T}.kpiLoad`),     value: totalLoad },
          { label: t(`${T}.kpiGps`),      value: totalGpsDistance ? `${Math.round(totalGpsDistance / 100) / 10} km` : "-" },
          { label: t(`${T}.kpiAlert`),    value: unavailable.length },
        ]}
      />

      <Section title={t(`${T}.sectionWeek`)}>
        <table>
          <thead>
            <tr>
              <th>{t(`${T}.colDay`)}</th>
              <th>{t(`${T}.colDate`)}</th>
              <th>{t(`${T}.colFocus`)}</th>
              <th>{t(`${T}.colContent`)}</th>
              <th>{t(`${T}.colRpe`)}</th>
              <th>{t(`${T}.colLoad`)}</th>
            </tr>
          </thead>
          <tbody>
            {week.map((day) => {
              const rpe = RPE_BY_MATCH_DAY[day.key];
              const content = [
                ...day.daySessions.map((session) => session.title || "Seduta"),
                ...day.dayMatches.map((item) => item.title || "Partita"),
              ];
              return (
                <tr key={day.key}>
                  <td><strong>{day.key}</strong></td>
                  <td>{formatShortDate(day.date)}</td>
                  <td>{day.focus}</td>
                  <td>{content.join(", ") || day.plan}</td>
                  <td>{rpe ? `${rpe.min}-${rpe.max}` : "-"}</td>
                  <td>{day.sessionLoad || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t(`${T}.sectionAlerts`)}>
        <div className="print-grid two">
          <PrintBox
            label={t(`${T}.labelUnavailable`)}
            value={unavailable.map((player) => `${player.name} (${player.status})`).join(", ") || "-"}
          />
          <PrintBox
            label={t(`${T}.labelPriority`)}
            value={t(`${T}.priorityValue`, { opponent: match.opponent || t("pages.exportCenter.tpl.fallbackOpponent") })}
          />
        </div>
      </Section>
    </article>
  );
}

function TrainingTemplate({ session, exercises }) {
  const { t } = useTranslation();
  const T = "pages.exportCenter.tpl.training";
  if (!session) return <EmptyPrint />;

  const plannedExercises = (session.exercises || []).map((block) => {
    const exercise = exercises.find((item) => sameId(item.id, block.exerciseId));
    return {
      ...block,
      exercise,
      title: exercise?.title || block.title || t(`${T}.colBlock`),
    };
  });

  return (
    <article>
      <PrintHeader
        eyebrow={t(`${T}.eyebrow`)}
        title={session.title}
        meta={[
          formatDate(session.date),
          session.theme || session.type || t(`${T}.eyebrow`),
          `${session.duration || 0}'`,
        ]}
      />

      <KpiGrid
        items={[
          { label: t(`${T}.kpiObjective`), value: session.objective || t("pages.exportCenter.tpl.fallbackTbd") },
          { label: t(`${T}.kpiRpe`),       value: session.rpe || "-" },
          { label: t(`${T}.kpiBlocks`),    value: plannedExercises.length },
          { label: t(`${T}.kpiLoad`),      value: `${Number(session.duration || 0) * Number(session.rpe || 0)}` },
        ]}
      />

      <Section title={t(`${T}.sectionTimeline`)}>
        {plannedExercises.length ? (
          <table>
            <thead>
              <tr>
                <th>{t(`${T}.colMinutes`)}</th>
                <th>{t(`${T}.colBlock`)}</th>
                <th>{t(`${T}.colField`)}</th>
                <th>{t(`${T}.colFocus`)}</th>
              </tr>
            </thead>
            <tbody>
              {plannedExercises.map((block, index) => (
                <tr key={`${block.exerciseId || block.title}-${index}`}>
                  <td>{block.minutes || block.duration || "-"}</td>
                  <td>
                    <strong>{block.title}</strong>
                    <small>{block.exercise?.category || block.exercise?.type || ""}</small>
                  </td>
                  <td>{block.exercise?.fieldSize || block.exercise?.space || "-"}</td>
                  <td>{block.note || block.exercise?.coachingPoints || block.exercise?.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{t(`${T}.noExercises`)}</p>
        )}
      </Section>

      <Section title={t(`${T}.sectionMaterial`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelMaterial`)} value={session.materials || t(`${T}.materialFallback`)} />
          <PrintBox label={t(`${T}.labelNotes`)}    value={session.notes    || t(`${T}.notesFallback`)} />
        </div>
      </Section>
    </article>
  );
}

function MatchDayTemplate({ match, players }) {
  const { t } = useTranslation();
  const T = "pages.exportCenter.tpl.matchday";
  const Tc = "pages.exportCenter.tpl";
  if (!match) return <EmptyPrint />;

  const lineup = getLineup(match);
  const starters = lineup.starterIds.map((id) => findPlayer(players, id)).filter(Boolean);
  const bench = lineup.benchIds.map((id) => findPlayer(players, id)).filter(Boolean);
  const calledUp = lineup.calledUpIds.map((id) => findPlayer(players, id)).filter(Boolean);
  const opponentLineup = match.opponentScouting?.lineup || [];

  return (
    <article>
      <PrintHeader
        eyebrow={t(`${T}.eyebrow`)}
        title={match.title}
        meta={[
          formatDate(match.date),
          match.location || t(`${T}.locationFallback`),
          match.competition || t(`${Tc}.fallbackCompetition`),
        ]}
      />

      <KpiGrid
        items={[
          { label: t(`${T}.kpiOpponent`),    value: match.opponent || "-" },
          { label: t(`${T}.kpiCalledUp`),    value: calledUp.length || starters.length + bench.length },
          { label: t(`${T}.kpiFormation`),   value: match.formation || t(`${Tc}.fallbackTbd`) },
          { label: t(`${T}.kpiOppFormation`), value: match.opponentScouting?.formation || t(`${Tc}.fallbackTbd`) },
        ]}
      />

      <Section title={t(`${T}.sectionLineup`)}>
        <div className="print-grid two">
          <RosterList title={t(`${T}.starters`)} players={starters} roles={lineup.roles} captainId={lineup.captainId} t={t} />
          <RosterList title={t(`${T}.bench`)}    players={bench}    roles={lineup.roles} captainId={lineup.captainId} t={t} />
        </div>
      </Section>

      <Section title={t(`${T}.sectionOpponent`)}>
        {opponentLineup.length ? (
          <table>
            <thead>
              <tr>
                <th>{t(`${T}.colNum`)}</th>
                <th>{t(`${T}.colPlayer`)}</th>
                <th>{t(`${T}.colYear`)}</th>
                <th>{t(`${T}.colRole`)}</th>
                <th>{t(`${T}.colNotes`)}</th>
              </tr>
            </thead>
            <tbody>
              {opponentLineup.map((item, index) => (
                <tr key={`${item.name || "opponent"}-${index}`}>
                  <td>{item.number || "-"}</td>
                  <td>{item.name || "-"}</td>
                  <td>{item.birthYear || "-"}</td>
                  <td>{item.role || "-"}</td>
                  <td>{item.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{t(`${T}.noOpponentLineup`)}</p>
        )}
        {match.opponentScouting?.attachment && (
          <PrintBox label={t(`${T}.labelAttachment`)} value={match.opponentScouting.attachment.name || "File caricato"} />
        )}
      </Section>

      <Section title={t(`${T}.sectionPlan`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelPlan`)}      value={match.matchPlan || t(`${T}.planFallback`)} />
          <PrintBox label={t(`${T}.labelReturn`)}    value={match.opponentScouting?.returnLegNotes || t(`${T}.returnFallback`)} />
          <PrintBox label={t(`${T}.labelStrengths`)} value={match.opponentScouting?.strengths || "-"} />
          <PrintBox label={t(`${T}.labelWeaknesses`)} value={match.opponentScouting?.weaknesses || "-"} />
        </div>
      </Section>
    </article>
  );
}

function PostMatchTemplate({ match, players }) {
  const { t } = useTranslation();
  const T = "pages.exportCenter.tpl.postmatch";
  const Tc = "pages.exportCenter.tpl";
  if (!match) return <EmptyPrint />;

  const report = match.postMatch || {};
  const videoClips = match.videoAnalysis || [];
  const positivePlayers = getPositivePlayersText(report.positivePlayers, players);
  const completion = getReportCompletion(report);

  return (
    <article>
      <PrintHeader
        eyebrow={t(`${T}.eyebrow`)}
        title={match.title}
        meta={[formatDate(match.date), match.result || t(`${T}.resultFallback`), match.competition || t(`${Tc}.fallbackCompetition`)]}
      />

      <KpiGrid
        items={[
          { label: t(`${T}.kpiOpponent`), value: match.opponent || "-" },
          { label: t(`${T}.kpiResult`),   value: match.result || "-" },
          { label: t(`${T}.kpiReport`),   value: `${completion}%` },
          { label: t(`${T}.kpiClips`),    value: videoClips.length },
        ]}
      />

      <Section title={t(`${T}.sectionAnalysis`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelWorked`)}      value={report.worked || "-"} />
          <PrintBox label={t(`${T}.labelNotWorked`)}   value={report.notWorked || "-"} />
          <PrintBox label={t(`${T}.labelKeyMoments`)}  value={report.keyMoments || "-"} />
          <PrintBox label={t(`${T}.labelNextWeek`)}    value={report.nextWeekFocus || "-"} />
          <PrintBox label={t(`${T}.labelTactical`)}    value={report.tacticalCorrections || "-"} />
          <PrintBox label={t(`${T}.labelTraining`)}    value={report.trainingActions || "-"} />
        </div>
      </Section>

      <Section title={t(`${T}.sectionPlayers`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelPositive`)} value={positivePlayers || "-"} />
          <PrintBox label={t(`${T}.labelAlerts`)}   value={report.physicalAlerts || "-"} />
        </div>
      </Section>

      <Section title={t(`${T}.sectionSetPieces`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelSetPieces`)}        value={report.setPiecesReview || "-"} />
          <PrintBox label={t(`${T}.labelVideo`)}            value={report.videoClips || "-"} />
          <PrintBox label={t(`${T}.labelOpponentLessons`)}  value={report.opponentLessons || "-"} />
          <PrintBox label={t(`${T}.labelStaff`)}            value={report.staffDecisions || "-"} />
        </div>
      </Section>

      {videoClips.length > 0 && (
        <Section title={t(`${T}.sectionClips`)}>
          <table>
            <thead>
              <tr>
                <th>{t(`${T}.colMinute`)}</th>
                <th>{t(`${T}.colCategory`)}</th>
                <th>{t(`${T}.colPhase`)}</th>
                <th>{t(`${T}.colPlayer`)}</th>
                <th>{t(`${T}.colNote`)}</th>
              </tr>
            </thead>
            <tbody>
              {videoClips.map((clip) => (
                <tr key={clip.id}>
                  <td>{clip.minute || "-"}</td>
                  <td>{clip.category || "-"}</td>
                  <td>{clip.phase || "-"}</td>
                  <td>{findPlayer(players, clip.playerId)?.name || "-"}</td>
                  <td>{clip.note || clip.tags || clip.url || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </article>
  );
}

function PlayerTemplate({ player, sessions, matches, physicalTests, appSettings }) {
  const { t } = useTranslation();
  const T = "pages.exportCenter.tpl.player";
  if (!player) return <EmptyPrint />;

  const summary = getPlayerSummary(player, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const reference = getPhysicalReference(latestTest, appSettings.coachParameters);
  const activeInjuries = (player.injuries || []).filter((injury) => injury.status !== "rientrato" && !injury.endDate);
  const readiness = getReadinessScore(player, summary);

  return (
    <article>
      <PrintHeader
        eyebrow={t(`${T}.eyebrow`)}
        title={player.name}
        meta={[player.role || t(`${T}.roleFallback`), player.status || t(`${T}.statusFallback`), player.shirtNumber ? `#${player.shirtNumber}` : ""]}
      />

      <KpiGrid
        items={[
          { label: t(`${T}.kpiPresences`), value: summary.stats.presences },
          { label: t(`${T}.kpiMinutes`),   value: summary.stats.minutes },
          { label: t(`${T}.kpiGoals`),     value: `${summary.stats.goals} + ${summary.stats.assists}` },
          { label: t(`${T}.kpiReadiness`), value: `${readiness}%` },
        ]}
      />

      <Section title={t(`${T}.sectionPhysical`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelLastTest`)}  value={latestTest ? formatShortDate(latestTest.date) : t(`${T}.testFallback`)} />
          <PrintBox label={t(`${T}.labelGroup`)}     value={reference.group} />
          <PrintBox label={t(`${T}.labelMas`)}       value={reference.mas ? `${reference.mas} km/h` : "-"} />
          <PrintBox label={t(`${T}.labelIndication`)} value={reference.intensity} />
        </div>
      </Section>

      <Section title={t(`${T}.sectionMeters`)}>
        {reference.reps.length ? (
          <table>
            <thead>
              <tr>
                <th>{t(`${T}.colProtocol`)}</th>
                <th>{t(`${T}.colMeters`)}</th>
                <th>{t(`${T}.colReps`)}</th>
                <th>{t(`${T}.colSets`)}</th>
                <th>{t(`${T}.colRecovery`)}</th>
              </tr>
            </thead>
            <tbody>
              {reference.reps.map((block) => (
                <tr key={block.label}>
                  <td>{block.label}</td>
                  <td>{block.meters} m</td>
                  <td>{block.reps}</td>
                  <td>{block.sets}</td>
                  <td>{block.recovery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{t(`${T}.noTest`)}</p>
        )}
      </Section>

      <Section title={t(`${T}.sectionHistory`)}>
        <table>
          <thead>
            <tr>
              <th>{t(`${T}.colEvent`)}</th>
              <th>{t(`${T}.colDate`)}</th>
              <th>{t(`${T}.colMinutes`)}</th>
              <th>{t(`${T}.colRpe`)}</th>
              <th>{t(`${T}.colStatus`)}</th>
            </tr>
          </thead>
          <tbody>
            {summary.recentEvents.map(({ event, data }) => (
              <tr key={`${event.id}-${player.id}`}>
                <td>{event.title}</td>
                <td>{formatShortDate(event.date)}</td>
                <td>{data.minutes || "-"}</td>
                <td>{data.rpe || "-"}</td>
                <td>{data.status || "-"}</td>
              </tr>
            ))}
            {!summary.recentEvents.length && (
              <tr>
                <td colSpan="5">{t(`${T}.noEvents`)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title={t(`${T}.sectionNotes`)}>
        <div className="print-grid two">
          <PrintBox label={t(`${T}.labelGoal`)}         value={player.weeklyGoal || "-"} />
          <PrintBox label={t(`${T}.labelAlert`)}        value={summary.alerts.join(", ") || "-"} />
          <PrintBox label={t(`${T}.labelStrengths`)}    value={player.strengths || player.developmentNotes?.strengths || "-"} />
          <PrintBox label={t(`${T}.labelImprovements`)} value={player.improvements || player.developmentNotes?.improvements || "-"} />
        </div>
      </Section>

      <Section title={t(`${T}.sectionMedical`)}>
        <div className="print-grid two">
          <PrintBox
            label={t(`${T}.labelMedicalStatus`)}
            value={activeInjuries.length ? activeInjuries.map((injury) => injury.injuryType || injury.type || "Infortunio").join(", ") : player.status || t(`${T}.statusFallback`)}
          />
          <PrintBox label={t(`${T}.labelPrevention`)} value={player.injuryNotes || player.preventionNotes || "-"} />
        </div>
      </Section>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label style={pageStyles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PrintHeader({ eyebrow, title, meta }) {
  return (
    <header className="print-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="print-meta">
        {meta.filter(Boolean).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </header>
  );
}

function KpiGrid({ items }) {
  return (
    <div className="print-kpis">
      {items.map((item) => (
        <div key={item.label} className="print-kpi">
          <span>{item.label}</span>
          <strong>{item.value || "-"}</strong>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="print-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PrintBox({ label, value }) {
  return (
    <div className="print-box">
      <span>{label}</span>
      <p>{value || "-"}</p>
    </div>
  );
}

function RosterList({ title, players, roles, captainId, t }) {
  const Tc = "pages.exportCenter.tpl";
  return (
    <div className="print-box">
      <span>{title}</span>
      {players.length ? (
        <ol className="print-roster">
          {players.map((player) => (
            <li key={player.id}>
              <strong>
                {player.shirtNumber ? `${player.shirtNumber}. ` : ""}
                {player.name}
              </strong>
              <small>
                {roles?.[player.id] || player.role || t("pages.exportCenter.tpl.matchday.colRole")}
                {sameId(player.id, captainId) ? ` · ${t(`${Tc}.captain`)}` : ""}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t(`${Tc}.noPlayers`)}</p>
      )}
    </div>
  );
}

// ─── Season Report Panel ────────────────────────────────────────────────────
function SeasonReportPanel({ players, sessions, matches, physicalTests, appSettings }) {
  const { t } = useTranslation();
  const T = "pages.exportCenter.tpl.season";
  const [generating, setGenerating] = useState(false);
  const teamName = appSettings?.workspaceProfile?.clubName || "CalcioLab";

  const played = matches.filter((m) => m.goalsScored !== undefined || m.goals_scored !== undefined);
  const wins   = played.filter((m) => Number(m.goalsScored ?? m.goals_scored ?? 0) > Number(m.goalsConceded ?? m.goals_conceded ?? 0)).length;
  const draws  = played.filter((m) => Number(m.goalsScored ?? m.goals_scored ?? 0) === Number(m.goalsConceded ?? m.goals_conceded ?? 0)).length;
  const losses = played.length - wins - draws;

  async function handleDownload() {
    setGenerating(true);
    try {
      generateSeasonReport({ players, sessions, matches, physicalTests, appSettings });
    } finally {
      setTimeout(() => setGenerating(false), 800);
    }
  }

  const kpis = [
    { label: t(`${T}.kpiMatches`),  value: matches.length },
    { label: t(`${T}.kpiWins`),     value: wins },
    { label: t(`${T}.kpiDraws`),    value: draws },
    { label: t(`${T}.kpiLosses`),   value: losses },
    { label: t(`${T}.kpiSessions`), value: sessions.length },
    { label: t(`${T}.kpiPlayers`),  value: players.length },
  ];

  const sections = [
    { icon: "📋", label: t(`${T}.sectionSummary`),    desc: t(`${T}.sectionSummaryDesc`) },
    { icon: "⚽", label: t(`${T}.sectionMatches`),    desc: t(`${T}.sectionMatchesDesc`) },
    { icon: "📅", label: t(`${T}.sectionAttendance`), desc: t(`${T}.sectionAttendanceDesc`) },
    { icon: "📈", label: t(`${T}.sectionStats`),      desc: t(`${T}.sectionStatsDesc`) },
    ...(physicalTests.length > 0 ? [{ icon: "⏱️", label: t(`${T}.sectionTests`), desc: t(`${T}.sectionTestsDesc`) }] : []),
  ];

  return (
    <AppCard
      title={t(`${T}.title`)}
      subtitle={t(`${T}.subtitle`, { teamName })}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#60a5fa" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {sections.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleDownload} disabled={generating} style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "13px 0" }}>
        {generating ? t(`${T}.btnGenerating`) : t(`${T}.btnDownload`)}
      </Button>
    </AppCard>
  );
}

function EmptyPrint() {
  const { t } = useTranslation();
  return (
    <article>
      <PrintHeader eyebrow="Export" title="—" meta={["CalcioLab"]} />
      <p>{t("pages.exportCenter.tpl.emptyText")}</p>
    </article>
  );
}

function sameId(a, b) {
  return String(a) === String(b);
}

function findPlayer(players, id) {
  return players.find((player) => sameId(player.id, id));
}

function toDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getPositivePlayersText(value, players) {
  if (Array.isArray(value)) {
    return value
      .map((id) => findPlayer(players, id)?.name || id)
      .filter(Boolean)
      .join(", ");
  }
  return value || "";
}

function getReportCompletion(report = {}) {
  const fields = [
    "worked",
    "notWorked",
    "keyMoments",
    "nextWeekFocus",
    "positivePlayers",
    "physicalAlerts",
    "tacticalCorrections",
    "trainingActions",
    "setPiecesReview",
    "staffDecisions",
  ];
  const completed = fields.filter((field) => {
    const value = report[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim());
  }).length;
  return Math.round((completed / fields.length) * 100);
}

function getReadinessScore(player, summary) {
  let score = 100;
  if (player.status === "Infortunato") score -= 55;
  if (player.status === "Recupero") score -= 35;
  if (player.status === "Differenziato") score -= 25;
  if (player.status === "Squalificato") score -= 20;
  if (!summary.latestTests.length) score -= 10;
  if ((player.injuries || []).some((injury) => injury.status !== "rientrato" && !injury.endDate)) score -= 20;
  return Math.max(0, Math.min(100, score));
}

const pageStyles = {
  page: {
    display: "grid",
    gap: 22,
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 20,
    alignItems: "start",
  },
  typeGrid: {
    display: "grid",
    gap: 10,
  },
  typeButton: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 14,
    color: "white",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 5,
  },
  controls: {
    marginTop: 18,
    display: "grid",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 4,
    color: "#cbd5e1",
    fontWeight: 800,
    fontSize: 13,
  },
};
