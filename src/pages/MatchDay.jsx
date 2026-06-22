import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { styles } from "../styles/index.js";
import { createId, formatDate, getLineup, normalizeAppSettings, uniqueIds } from "../utils/helpers";
import { generateMatchDayPDF } from "../utils/generateMatchDayPDF";
import { deleteTeamAttachment, uploadTeamAttachment } from "../services/attachments";
import { useAuth } from "../hooks/useAuth";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";
import { matchDayStyles } from "../styles/matchDay";
import {
  PlayerList, TeamMark, MiniStat, PrintKpi, PrintBox, PlayerPrintTable,
  SectionHeader, MatchCommandCenter,
} from "../components/matchday/MatchDayElements";
import {
  getOpponentScouting, getPreMatchChecklist, getChecklistItems, hasText,
  getMatchVenue, buildMatchPlanPrefill, buildStaffNotesPrefill,
} from "../utils/matchDayHelpers";

function MatchDay({
  matches = [], setMatches, players = [], appSettings = {} }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);

  const isMobile = useIsMobile();
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const clubLogo = workspaceProfile.logo || "";
  const clubLogoSize = Number(workspaceProfile.logoSize || 100);
  const selectedMatch =
    matches.find((match) => String(match.id) === String(id)) || matches[0];

  function updateSelectedMatch(patch) {
    if (!selectedMatch) return;

    setMatches((prevMatches) =>
      prevMatches.map((match) =>
        match.id === selectedMatch.id
          ? {
              ...match,
              ...patch,
              lineup: {
                ...getLineup(match),
                ...(patch.lineup || {}),
              },
            }
          : match
      )
    );
  }

  function selectMatch(nextId) {
    const nextMatch = matches.find((match) => String(match.id) === String(nextId));
    if (!nextMatch) return;
    navigate(`/match-day/${nextMatch.id}`);
  }

  if (matches.length === 0) {
    return (
      <div style={styles.page}>
        <PageHeader
          title={t("pages.matchDay.title")}
          subtitle={t("pages.matchDay.subtitleEmpty")}
        />
        <EmptyState
          icon="⚽"
          title={t("pages.matchDay.noMatchTitle")}
          text={t("pages.matchDay.noMatchText")}
          action={
            <Link to="/matches" style={{ textDecoration: "none" }}>
              <Button>{t("pages.matchDay.goToMatches")}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const lineup = getLineup(selectedMatch);
  const starterPlayers = players.filter((player) =>
    lineup.starterIds.includes(player.id)
  );
  const benchPlayers = players.filter((player) => lineup.benchIds.includes(player.id));
  const calledPlayers = players.filter((player) =>
    lineup.calledUpIds.includes(player.id)
  );
  const availablePlayers = players.filter(
    (player) => !lineup.calledUpIds.includes(player.id)
  );
  const opponentScouting = getOpponentScouting(selectedMatch);
  const previousOpponentMatches = matches
    .filter(
      (match) =>
        match.id !== selectedMatch.id &&
        match.opponent &&
        selectedMatch.opponent &&
        match.opponent.toLowerCase() === selectedMatch.opponent.toLowerCase()
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const matchVenue = getMatchVenue(selectedMatch, workspaceProfile);
  const convocationDetails = selectedMatch.convocazione?.details || {};
  const convocationCount = selectedMatch.convocazione?.playerIds?.length || 0;
  const preMatchChecklist = getPreMatchChecklist(selectedMatch);
  const checklistItems = getChecklistItems({ match: selectedMatch, venue: matchVenue, t });
  const completedChecklist = checklistItems.filter((item) => preMatchChecklist.items[item.key]).length;
  const matchMeta = [
    formatDate(selectedMatch.date),
    selectedMatch.time ? t("pages.matchDay.timePrefix", { time: selectedMatch.time }) : "",
    selectedMatch.competition,
    selectedMatch.matchday,
    matchVenue || selectedMatch.location,
    selectedMatch.formation,
  ].filter(Boolean);
  const canPrefillMatchDay =
    Boolean(selectedMatch) &&
    (!hasText(selectedMatch.matchPlan) ||
      !hasText(selectedMatch.staffNotes) ||
      (!lineup.calledUpIds.length && convocationCount > 0));

  const postMatchFilled = Object.values(selectedMatch.postMatch || {}).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  const scoutingFields = [
    opponentScouting.formation,
    opponentScouting.keyPlayers,
    opponentScouting.strengths,
    opponentScouting.weaknesses,
    opponentScouting.setPiecesFor,
    opponentScouting.setPiecesAgainst,
  ];
  const scoutingCount = scoutingFields.filter((value) => String(value || "").trim()).length;
  const commandSteps = [
    {
      key: "convocazione",
      title: t("pages.matchDay.commandConvocazione"),
      detail: selectedMatch.convocazione?.published
        ? t("pages.matchDay.commandConvocazionePublished", { count: selectedMatch.convocazione.playerIds?.length || 0 })
        : selectedMatch.convocazione?.playerIds?.length
          ? t("pages.matchDay.commandConvocazioneDraft", { count: selectedMatch.convocazione.playerIds.length })
          : t("pages.matchDay.commandConvocazioneTodo"),
      done: Boolean(selectedMatch.convocazione?.published),
      action: t("pages.matchDay.commandOpenAction"),
      onClick: () => navigate(`/match-convocation/${selectedMatch.id}`),
    },
    {
      key: "distinta",
      title: t("pages.matchDay.commandDistinta"),
      detail: t("pages.matchDay.commandDistintaDetail", { starters: starterPlayers.length, bench: benchPlayers.length }),
      done: lineup.ready,
      action: lineup.ready ? t("pages.matchDay.commandDistintaReview") : t("pages.matchDay.commandDistintaComplete"),
      onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    },
    {
      key: "scouting",
      title: t("pages.matchDay.commandAvversario"),
      detail: scoutingCount ? t("pages.matchDay.commandScoutingDetail", { count: scoutingCount }) : t("pages.matchDay.commandScoutingTodo"),
      done: scoutingCount >= 3,
      action: t("pages.matchDay.commandScoutingAction"),
      onClick: () => document.getElementById("match-opponent-scouting")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
    {
      key: "logistica",
      title: t("pages.matchDay.commandLogistica"),
      detail: t("pages.matchDay.commandLogisticaDetail", { done: completedChecklist, total: checklistItems.length }),
      done: completedChecklist === checklistItems.length,
      action: t("pages.matchDay.commandLogisticaAction"),
      onClick: () => document.getElementById("match-pre-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
    {
      key: "stats",
      title: t("pages.matchDay.commandStatistiche"),
      detail: t("pages.matchDay.commandStatisticheDetail"),
      done: false,
      action: t("pages.matchDay.commandOpenAction"),
      onClick: () => navigate(`/match-stats/${selectedMatch.id}`),
    },
    {
      key: "post",
      title: t("pages.matchDay.commandPost"),
      detail: postMatchFilled ? t("pages.matchDay.commandPostDone") : t("pages.matchDay.commandPostTodo"),
      done: postMatchFilled,
      action: t("pages.matchDay.commandPostAction"),
      onClick: () => navigate(`/post-match/${selectedMatch.id}`),
    },
  ];
  const completedSteps = commandSteps.filter((step) => step.done).length;

  function toggleCalled(player) {
    if (lineup.calledUpIds.includes(player.id)) {
      updateSelectedMatch({
        lineup: {
          calledUpIds: lineup.calledUpIds.filter((id) => id !== player.id),
          starterIds: lineup.starterIds.filter((id) => id !== player.id),
          benchIds: lineup.benchIds.filter((id) => id !== player.id),
        },
      });
      return;
    }

    updateSelectedMatch({
      lineup: {
        calledUpIds: [...lineup.calledUpIds, player.id],
        benchIds: [...lineup.benchIds, player.id],
      },
    });
  }

  // Numero massimo di sostituzioni per partita (regole FIFA moderne: 5)
  const MAX_SUBSTITUTIONS = 5;

  function moveToStarter(player) {
    if (lineup.starterIds.includes(player.id) || lineup.starterIds.length >= 11) {
      return;
    }

    // Conta la sostituzione solo a distinta già pronta (gara in corso)
    const newSubsMade = lineup.ready ? lineup.subsMade + 1 : lineup.subsMade;

    updateSelectedMatch({
      lineup: {
        calledUpIds: uniqueIds([...lineup.calledUpIds, player.id]),
        starterIds: [...lineup.starterIds, player.id],
        benchIds: lineup.benchIds.filter((id) => id !== player.id),
        subsMade: newSubsMade,
      },
    });
  }

  function moveToBench(player) {
    updateSelectedMatch({
      lineup: {
        calledUpIds: uniqueIds([...lineup.calledUpIds, player.id]),
        starterIds: lineup.starterIds.filter((id) => id !== player.id),
        benchIds: uniqueIds([...lineup.benchIds, player.id]),
      },
    });
  }

  function updateNote(field, value) {
    updateSelectedMatch({ [field]: value });
  }

  function updateOpponentScouting(patch) {
    updateSelectedMatch({
      opponentScouting: {
        ...opponentScouting,
        ...patch,
      },
    });
  }

  function updatePreMatchChecklist(patch) {
    updateSelectedMatch({
      preMatchChecklist: {
        ...preMatchChecklist,
        ...patch,
        items: {
          ...preMatchChecklist.items,
          ...(patch.items || {}),
        },
      },
    });
  }

  function toggleChecklistItem(key) {
    updatePreMatchChecklist({
      items: {
        [key]: !preMatchChecklist.items[key],
      },
    });
  }

  function addOpponentPlayer() {
    const opponentPlayerId = createId("opponent-player");

    updateOpponentScouting({
      lineup: [
        ...opponentScouting.lineup,
        {
          id: opponentPlayerId,
          number: "",
          name: "",
          role: "",
          status: "Titolare",
          notes: "",
        },
      ],
    });
  }

  function updateOpponentPlayer(playerId, field, value) {
    updateOpponentScouting({
      lineup: opponentScouting.lineup.map((player) =>
        player.id === playerId ? { ...player, [field]: value } : player
      ),
    });
  }

  function deleteOpponentPlayer(playerId) {
    setConfirmState({
      message: t("pages.matchDay.deleteOpponentPlayerConfirm"),
      confirmLabel: t("common.delete"),
      confirmTone: "red",
      onConfirm: () => {
        updateOpponentScouting({
          lineup: opponentScouting.lineup.filter((player) => player.id !== playerId),
        });
      },
    });
  }

  async function handleOpponentAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const attachment = await uploadTeamAttachment({
        teamId: auth.team?.id,
        folder: `matches/${selectedMatch.id}/opponent-lineup`,
        file,
      });

      updateOpponentScouting({
        attachment,
      });
    } catch (error) {
      showToast(error?.message || t("pages.matchDay.uploadFailed"), "error");
    }
    event.target.value = "";
  }

  async function removeOpponentAttachment() {
    await deleteTeamAttachment(opponentScouting.attachment);
    updateOpponentScouting({ attachment: null });
  }

  function updateLineup(patch) {
    updateSelectedMatch({
      lineup: {
        ...lineup,
        ...patch,
      },
    });
  }

  function setCaptain(playerId) {
    updateLineup({ captainId: lineup.captainId === playerId ? "" : playerId });
  }

  function updatePlayerRole(playerId, value) {
    updateLineup({
      roles: {
        ...lineup.roles,
        [playerId]: value,
      },
    });
  }

  function movePlayer(playerId, listKey, direction) {
    const list = [...lineup[listKey]];
    const index = list.indexOf(playerId);
    const target = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || target < 0 || target >= list.length) return;

    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);
    updateLineup({ [listKey]: list });
  }

  function importConvocazione() {
    const convIds = (selectedMatch.convocazione?.playerIds || []).map(String);
    if (!convIds.length) return;
    // Importa tutti i convocati come panchina — il mister li sposta a titolare manualmente
    updateLineup({
      calledUpIds: convIds,
      benchIds:    convIds,
      starterIds:  [],
    });
    showToast(t("pages.matchDay.importConvocazioneSuccess", { count: convIds.length }), "success");
  }

  function prefillMatchDayFromSchedule() {
    const convIds = (selectedMatch.convocazione?.playerIds || []).map(String);
    const patch = {};

    if (!hasText(selectedMatch.matchPlan)) {
      patch.matchPlan = buildMatchPlanPrefill({
        match: selectedMatch,
        venue: matchVenue,
        convocationCount: convIds.length,
        t,
      });
    }

    if (!hasText(selectedMatch.staffNotes)) {
      patch.staffNotes = buildStaffNotesPrefill({
        match: selectedMatch,
        venue: matchVenue,
        details: convocationDetails,
        t,
      });
    }

    if (!lineup.calledUpIds.length && convIds.length) {
      patch.lineup = {
        calledUpIds: convIds,
        benchIds: convIds,
        starterIds: [],
      };
    }

    if (Object.keys(patch).length === 0) {
      showToast(t("pages.matchDay.alreadyFilled"), "info");
      return;
    }

    updateSelectedMatch(patch);
    showToast(t("pages.matchDay.prefillDone"), "success");
  }

  function copyPreviousLineup() {
    const previous = [...matches]
      .filter(
        (match) =>
          match.id !== selectedMatch.id &&
          match.date &&
          selectedMatch.date &&
          new Date(match.date) <= new Date(selectedMatch.date) &&
          match.lineup?.calledUpIds?.length
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!previous) {
      showToast(t("pages.matchDay.noPreviousLineup"), "info");
      return;
    }

    updateLineup(getLineup(previous));
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.matchDay.title")}
        subtitle={t("pages.matchDay.subtitle")}
      />

      <MatchTabBar
        matchId={selectedMatch?.id}
        active="scheda"
        matchLabel={selectedMatch?.opponent ? `vs ${selectedMatch.opponent}` : undefined}
        matchData={selectedMatch}
      />

      <MatchCommandCenter
        steps={commandSteps}
        completed={completedSteps}
        total={commandSteps.length}
        onMicrocycle={() => navigate("/microcycle")}
        onSetPlays={() => navigate("/set-plays")}
        onOpponents={() => navigate("/opponents")}
      />

      {/* ── Banner convocazione non pubblicata ── */}
      {selectedMatch && !selectedMatch.convocazione?.published && (
        <div style={matchDayStyles.convoBanner}>
          <span style={matchDayStyles.convoBannerText}>
            {selectedMatch.convocazione?.playerIds?.length > 0
              ? t("pages.matchDay.convoDraft", { count: selectedMatch.convocazione.playerIds.length })
              : t("pages.matchDay.convoEmpty")}
          </span>
          <Button variant="ghost" onClick={() => navigate(`/match-convocation/${selectedMatch.id}`)}>
            {t("pages.matchDay.goToConvocation")}
          </Button>
        </div>
      )}

        <div style={matchDayStyles.selectorRow}>
        <select
          value={selectedMatch.id}
          onChange={(event) => selectMatch(event.target.value)}
          style={{ ...styles.input, maxWidth: 360, marginTop: 0 }}
        >
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.title} - {match.date}
            </option>
          ))}
        </select>

        <div style={matchDayStyles.actions}>
          <Link to={`/matches`} style={{ textDecoration: "none" }}>
            <Button variant="ghost">{t("pages.matchDay.matchCenter")}</Button>
          </Link>
          <Button variant="ghost" onClick={copyPreviousLineup}>
            {t("pages.matchDay.copyPrevious")}
          </Button>
          <Button
            variant={lineup.ready ? "primary" : "ghost"}
            onClick={() => updateLineup({ ready: !lineup.ready })}
          >
            {lineup.ready ? t("pages.matchDay.lineupReady") : t("pages.matchDay.markReady")}
          </Button>
          <Button onClick={() => generateMatchDayPDF({ match: selectedMatch, players, appSettings })}>
            {t("pages.matchDay.exportPdf")}
          </Button>
        </div>
      </div>

      <div className="print-area">
        <section className="print-template">
          <article>
            <header className="print-header">
              <div style={matchDayStyles.printBrand}>
                <TeamMark
                  logo={selectedMatch.homeLogo || clubLogo}
                  logoSize={clubLogoSize}
                  name={clubName}
                  fallback={clubName.slice(0, 2).toUpperCase()}
                />
                <div>
                  <p>{t("pages.matchDay.printDocType")}</p>
                  <h1>
                    {clubName} <span style={{ color: "#64748b" }}>vs</span>{" "}
                    {selectedMatch.opponent || t("pages.matchDay.opponentUndefined")}
                  </h1>
                </div>
              </div>
              <div className="print-meta">
                <span>{formatDate(selectedMatch.date)}</span>
                {selectedMatch.time && <span>{t("pages.matchDay.timePrefix", { time: selectedMatch.time })}</span>}
                {selectedMatch.competition && <span>{selectedMatch.competition}</span>}
                {selectedMatch.matchday && <span>{selectedMatch.matchday}</span>}
                <span>{matchVenue || selectedMatch.location || t("pages.matchDay.fieldUndefined")}</span>
              </div>
            </header>

            <section className="print-kpis">
              <PrintKpi label={t("pages.matchDay.statCalled")} value={calledPlayers.length} />
              <PrintKpi label={t("pages.matchDay.statStarters")} value={`${starterPlayers.length}/11`} />
              <PrintKpi label={t("pages.matchDay.statBench")} value={benchPlayers.length} />
              <PrintKpi label={t("pages.matchDay.statFormation")} value={selectedMatch.formation || "-"} />
            </section>

            <section className="print-grid two">
              <PrintBox title={t("pages.matchDay.printBoxField")} value={matchVenue || t("pages.matchDay.fieldUndefined")} />
              <PrintBox title={t("pages.matchDay.printBoxMeetingPoint")} value={[convocationDetails.meetingTime, convocationDetails.meetingPlace].filter(Boolean).join(" · ") || t("pages.matchDay.checklistToBeDefined")} />
              <PrintBox title={t("pages.matchDay.printBoxLockerRoom")} value={convocationDetails.lockerRoom || t("pages.matchDay.checklistToBeDefined")} />
              <PrintBox title={t("pages.matchDay.printBoxKit")} value={convocationDetails.kit || t("pages.matchDay.checklistToBeDefined")} />
            </section>

            <section className="print-section">
              <h2>{t("pages.matchDay.startersTitle")}</h2>
              <PlayerPrintTable players={starterPlayers} lineup={lineup} empty={t("pages.matchDay.noStarters")} t={t} />
            </section>

            <section className="print-section">
              <h2>{t("pages.matchDay.benchTitle")}</h2>
              <PlayerPrintTable players={benchPlayers} lineup={lineup} empty={t("pages.matchDay.noBench")} t={t} />
            </section>

            {opponentScouting.lineup.length > 0 && (
              <section className="print-section">
                <h2>{t("pages.matchDay.opponentLineupTitle")}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("pages.matchDay.namePlaceholder")}</th>
                      <th>{t("pages.matchDay.birthYearPlaceholder")}</th>
                      <th>{t("pages.matchDay.rolePlaceholder")}</th>
                      <th>{t("pages.matchDay.notesPlaceholder")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opponentScouting.lineup.map((player) => (
                      <tr key={player.id}>
                        <td>{player.number || "-"}</td>
                        <td>{player.name || "-"}</td>
                        <td>{player.birthYear || "-"}</td>
                        <td>{player.role || player.status || "-"}</td>
                        <td>{player.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="print-grid two">
              <PrintBox title={t("pages.matchDay.gamePlanLabel")} value={selectedMatch.matchPlan || t("pages.matchDay.checklistToBeDefined")} />
              <PrintBox title={t("pages.matchDay.staffNotesLabel")} value={selectedMatch.staffNotes || t("pages.matchDay.checklistToBeDefined")} />
              <PrintBox title={t("pages.matchDay.scoutingQuick")} value={selectedMatch.opponentNotes || t("pages.matchDay.checklistToBeDefined")} />
              <PrintBox title={t("pages.matchDay.checklistSummaryTitle")} value={t("pages.matchDay.checklistCompleted", { done: completedChecklist, total: checklistItems.length })} />
            </section>

            <section className="print-grid two">
              <PrintBox title={t("pages.matchDay.signatureCoach")} value=" " />
              <PrintBox title={t("pages.matchDay.signatureDirector")} value=" " />
            </section>
          </article>
        </section>
      </div>

      <div className="no-print" style={matchDayStyles.printArea}>
        <AppCard>
          <div style={{ ...matchDayStyles.matchHeader, gridTemplateColumns: isMobile ? "1fr" : "160px 1fr 160px" }}>
            <TeamMark
              logo={selectedMatch.homeLogo || clubLogo}
              logoSize={clubLogoSize}
              name={clubName}
              fallback={clubName.slice(0, 2).toUpperCase()}
            />
            <div style={matchDayStyles.scoreBox}>
              <Badge tone="orange">Match Day</Badge>
              <h2 style={matchDayStyles.matchTitle}>
                {selectedMatch.title || `CalcioLab - ${selectedMatch.opponent}`}
              </h2>
              <p style={{ ...matchDayStyles.muted, marginTop: 6 }}>
                {matchMeta.join(" · ")}
              </p>
              <div style={matchDayStyles.resultRow}>
                <span style={matchDayStyles.resultLabel}>{t("pages.matchDay.resultLabel")}</span>
                <input
                  value={selectedMatch.result || ""}
                  onChange={(e) => updateNote("result", e.target.value)}
                  placeholder="es. 2-1"
                  style={matchDayStyles.resultInput}
                />
              </div>
            </div>
            <TeamMark
              logo={selectedMatch.awayLogo}
              name={selectedMatch.opponent}
              fallback={selectedMatch.opponent?.[0] || "A"}
            />
          </div>

          <div style={matchDayStyles.kpiGrid}>
            <MiniStat label={t("pages.matchDay.statCalled")} value={calledPlayers.length} />
            <MiniStat label={t("pages.matchDay.statStarters")} value={`${starterPlayers.length}/11`} />
            <MiniStat label={t("pages.matchDay.statBench")} value={benchPlayers.length} />
            <MiniStat label={t("pages.matchDay.statTime")} value={selectedMatch.time || "-"} />
            <MiniStat label={t("pages.matchDay.statFormation")} value={selectedMatch.formation || "-"} />
            <MiniStat label={t("pages.matchDay.statStatus")} value={lineup.ready ? t("pages.matchDay.statusReady") : t("pages.matchDay.statusDraft")} />
            {lineup.ready && (
              <MiniStat
                label={t("pages.matchDay.statSubs")}
                value={`${lineup.subsMade}/${MAX_SUBSTITUTIONS}`}
                valueColor={lineup.subsMade >= MAX_SUBSTITUTIONS ? "#f87171" : lineup.subsMade >= MAX_SUBSTITUTIONS - 1 ? "#fb923c" : undefined}
              />
            )}
          </div>
        </AppCard>

        <div style={matchDayStyles.prefillBanner}>
          <div>
            <strong style={{ color: "#bfdbfe", fontSize: 14 }}>{t("pages.matchDay.scheduleTitle")}</strong>
            <div style={matchDayStyles.prefillMeta}>
              <span>{selectedMatch.opponent ? `vs ${selectedMatch.opponent}` : t("pages.matchDay.opponentUndefined")}</span>
              <span>{selectedMatch.time ? t("pages.matchDay.timePrefix", { time: selectedMatch.time }) : t("pages.matchDay.timeUndefined")}</span>
              <span>{matchVenue || t("pages.matchDay.fieldUndefined")}</span>
              <span>{convocationCount ? t("pages.matchDay.convocatiCount", { count: convocationCount }) : t("pages.matchDay.convoEmpty2")}</span>
            </div>
          </div>
          <Button onClick={prefillMatchDayFromSchedule} disabled={!canPrefillMatchDay}>
            {t("pages.matchDay.prefillFromCalendar")}
          </Button>
        </div>

        <AppCard>
          <SectionHeader
            title={t("pages.matchDay.checklistTitle")}
            badge={`${completedChecklist}/${checklistItems.length}`}
          />
          <div id="match-pre-checklist" />
          <div style={matchDayStyles.checklistMetaGrid}>
            <label style={matchDayStyles.smallField}>
              {t("pages.matchDay.checklistStaffArrival")}
              <input
                type="time"
                value={preMatchChecklist.staffArrivalTime}
                onChange={(event) => updatePreMatchChecklist({ staffArrivalTime: event.target.value })}
                style={matchDayStyles.smallInput}
              />
            </label>
            <label style={matchDayStyles.smallField}>
              {t("pages.matchDay.checklistResponsible")}
              <input
                value={preMatchChecklist.staffResponsible}
                onChange={(event) => updatePreMatchChecklist({ staffResponsible: event.target.value })}
                placeholder={t("pages.matchDay.checklistStaffPlaceholder")}
                style={matchDayStyles.smallInput}
              />
            </label>
            <label style={matchDayStyles.smallField}>
              {t("pages.matchDay.checklistReferee")}
              <input
                value={preMatchChecklist.refereeInfo}
                onChange={(event) => updatePreMatchChecklist({ refereeInfo: event.target.value })}
                placeholder={t("pages.matchDay.checklistRefereePlaceholder")}
                style={matchDayStyles.smallInput}
              />
            </label>
          </div>
          <div style={matchDayStyles.checklistGrid}>
            {checklistItems.map((item) => {
              const checked = Boolean(preMatchChecklist.items[item.key]);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleChecklistItem(item.key)}
                  style={{
                    ...matchDayStyles.checklistItem,
                    ...(checked ? matchDayStyles.checklistItemDone : {}),
                  }}
                >
                  <span style={checked ? matchDayStyles.checkIconDone : matchDayStyles.checkIconTodo}>
                    {checked ? "✓" : ""}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <textarea
            value={preMatchChecklist.logisticsNotes}
            onChange={(event) => updatePreMatchChecklist({ logisticsNotes: event.target.value })}
            placeholder={t("pages.matchDay.checklistNotesPlaceholder")}
            style={{ ...styles.input, marginTop: 12, minHeight: 80, resize: "vertical" }}
          />
          <div style={matchDayStyles.printChecklistSummary}>
            <div style={matchDayStyles.printChecklistHeader}>
              <strong>{t("pages.matchDay.checklistSummaryTitle")}</strong>
              <span>{t("pages.matchDay.checklistCompleted", { done: completedChecklist, total: checklistItems.length })}</span>
            </div>
            <div style={matchDayStyles.printChecklistInfo}>
              <span>{t("pages.matchDay.checklistStaffArrivalLabel", { value: preMatchChecklist.staffArrivalTime || t("pages.matchDay.checklistToBeDefined") })}</span>
              <span>{t("pages.matchDay.checklistResponsibleLabel", { value: preMatchChecklist.staffResponsible || t("pages.matchDay.checklistToBeDefined") })}</span>
              <span>{t("pages.matchDay.checklistRefereeLabel", { value: preMatchChecklist.refereeInfo || t("pages.matchDay.checklistToBeDefined") })}</span>
            </div>
            <div style={matchDayStyles.printChecklistRows}>
              {checklistItems.map((item) => {
                const checked = Boolean(preMatchChecklist.items[item.key]);
                return (
                  <div key={`print-${item.key}`} style={matchDayStyles.printChecklistRow}>
                    <span style={checked ? matchDayStyles.printStatusDone : matchDayStyles.printStatusTodo}>
                      {checked ? t("pages.matchDay.checklistOk") : t("pages.matchDay.checklistTodo")}
                    </span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                );
              })}
            </div>
            {preMatchChecklist.logisticsNotes && (
              <p style={matchDayStyles.printChecklistNotes}>{preMatchChecklist.logisticsNotes}</p>
            )}
          </div>
        </AppCard>

        {/* ── Banner import dalla Convocazione ── */}
        {lineup.calledUpIds.length === 0 && (selectedMatch.convocazione?.playerIds?.length > 0) && (
          <div style={matchDayStyles.importBanner}>
            <div>
              <strong style={{ color: "#93c5fd", fontSize: 14 }}>{t("pages.matchDay.importConvocazioneTitle")}</strong>
              <p style={{ ...matchDayStyles.muted, marginTop: 4 }}>
                {t("pages.matchDay.importConvocazioneText", { count: selectedMatch.convocazione.playerIds.length })}
              </p>
            </div>
            <Button onClick={importConvocazione}>{t("pages.matchDay.importConvocazioneAction")}</Button>
          </div>
        )}

        <div style={{ ...matchDayStyles.mainGrid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <AppCard>
            <SectionHeader title={t("pages.matchDay.startersTitle")} badge={`${starterPlayers.length}/11`} />
            <PlayerList
              players={starterPlayers}
              empty={t("pages.matchDay.noStarters")}
              actionLabel={t("pages.matchDay.benchAction")}
              onAction={moveToBench}
              lineup={lineup}
              listKey="starterIds"
              onMove={movePlayer}
              onCaptain={setCaptain}
              onRoleChange={updatePlayerRole}
              isMobile={isMobile}
            />
          </AppCard>

          <AppCard>
            <SectionHeader title={t("pages.matchDay.benchTitle")} badge={benchPlayers.length} />
            <PlayerList
              players={benchPlayers}
              empty={t("pages.matchDay.noBench")}
              actionLabel={t("pages.matchDay.starterAction")}
              onAction={moveToStarter}
              disableAction={lineup.starterIds.length >= 11}
              lineup={lineup}
              listKey="benchIds"
              onMove={movePlayer}
              onCaptain={setCaptain}
              onRoleChange={updatePlayerRole}
              isMobile={isMobile}
            />
          </AppCard>
        </div>

        <div style={{ ...matchDayStyles.mainGrid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <AppCard>
            <SectionHeader title={t("pages.matchDay.callableTitle")} badge={availablePlayers.length} />
            <PlayerList
              players={availablePlayers}
              empty={t("pages.matchDay.allCalled")}
              actionLabel={t("pages.matchDay.callAction")}
              onAction={toggleCalled}
              lineup={lineup}
              isMobile={isMobile}
            />
          </AppCard>

          <AppCard>
            <SectionHeader title={t("pages.matchDay.gamePlanTitle")} badge={lineup.ready ? t("pages.matchDay.gamePlanReady") : t("pages.matchDay.gamePlanDraft")} />
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <h4 style={matchDayStyles.planLabel}>{t("pages.matchDay.scoutingQuick")}</h4>
                <textarea
                  placeholder={t("pages.matchDay.scoutingQuickPlaceholder")}
                  value={selectedMatch.opponentNotes || ""}
                  onChange={(event) => updateNote("opponentNotes", event.target.value)}
                  style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
                />
              </div>
              <div>
                <h4 style={matchDayStyles.planLabel}>{t("pages.matchDay.gamePlanLabel")}</h4>
                <textarea
                  placeholder={t("pages.matchDay.gamePlanPlaceholder")}
                  value={selectedMatch.matchPlan || ""}
                  onChange={(event) => updateNote("matchPlan", event.target.value)}
                  style={{ ...styles.input, minHeight: 130, resize: "vertical" }}
                />
              </div>
              <div>
                <h4 style={matchDayStyles.planLabel}>{t("pages.matchDay.staffNotesLabel")}</h4>
                <textarea
                  placeholder={t("pages.matchDay.staffNotesPlaceholder")}
                  value={selectedMatch.staffNotes || ""}
                  onChange={(event) => updateNote("staffNotes", event.target.value)}
                  style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
                />
              </div>
            </div>
          </AppCard>
        </div>

        <AppCard>
          <SectionHeader
            title={t("pages.matchDay.scoutingTitle")}
            badge={t("pages.matchDay.scoutingInDistinta", { count: opponentScouting.lineup.length })}
          />
          <div id="match-opponent-scouting" />

          <div style={matchDayStyles.scoutingGrid}>
            <input
              placeholder={t("pages.matchDay.scoutingFormationPlaceholder")}
              value={opponentScouting.formation}
              onChange={(event) =>
                updateOpponentScouting({ formation: event.target.value })
              }
              style={styles.input}
            />
            <input
              placeholder={t("pages.matchDay.scoutingKeyPlayersPlaceholder")}
              value={opponentScouting.keyPlayers}
              onChange={(event) =>
                updateOpponentScouting({ keyPlayers: event.target.value })
              }
              style={styles.input}
            />
            <textarea
              placeholder={t("pages.matchDay.scoutingStrengthsPlaceholder")}
              value={opponentScouting.strengths}
              onChange={(event) =>
                updateOpponentScouting({ strengths: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder={t("pages.matchDay.scoutingWeaknessesPlaceholder")}
              value={opponentScouting.weaknesses}
              onChange={(event) =>
                updateOpponentScouting({ weaknesses: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder={t("pages.matchDay.scoutingSetPiecesForPlaceholder")}
              value={opponentScouting.setPiecesFor}
              onChange={(event) =>
                updateOpponentScouting({ setPiecesFor: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder={t("pages.matchDay.scoutingSetPiecesAgainstPlaceholder")}
              value={opponentScouting.setPiecesAgainst}
              onChange={(event) =>
                updateOpponentScouting({ setPiecesAgainst: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder={t("pages.matchDay.scoutingReturnLegPlaceholder")}
              value={opponentScouting.returnLegNotes}
              onChange={(event) =>
                updateOpponentScouting({ returnLegNotes: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90, gridColumn: "1 / -1" }}
            />
          </div>

          <div style={matchDayStyles.attachmentBox}>
            <div>
              <h4 style={{ margin: 0, lineHeight: 1.2 }}>{t("pages.matchDay.attachmentTitle")}</h4>
              <p style={matchDayStyles.muted}>{t("pages.matchDay.attachmentSubtitle")}</p>
            </div>
            <div style={matchDayStyles.attachmentActions}>
              {opponentScouting.attachment ? (
                <>
                  <a
                    href={opponentScouting.attachment.url || opponentScouting.attachment.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={matchDayStyles.attachmentLink}
                  >
                    {opponentScouting.attachment.name || t("pages.matchDay.openAttachment")}
                  </a>
                  <Button variant="ghost" onClick={removeOpponentAttachment}>{t("pages.matchDay.removeAttachment")}</Button>
                </>
              ) : (
                <label style={matchDayStyles.uploadButton}>
                  {t("pages.matchDay.uploadFile")}
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={handleOpponentAttachment}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>
          </div>

          <div style={matchDayStyles.opponentHeader}>
            <h4 style={{ margin: 0, lineHeight: 1.2 }}>{t("pages.matchDay.opponentLineupTitle")}</h4>
            <Button variant="ghost" onClick={addOpponentPlayer}>
              {t("pages.matchDay.addPlayer")}
            </Button>
          </div>

          {/* Scroll orizzontale su mobile per la distinta avversaria (7 colonne) */}
          <div style={{ overflowX: "auto" }}>
          <div style={{ ...matchDayStyles.opponentList, minWidth: 560 }}>
            {opponentScouting.lineup.length === 0 ? (
              <p style={matchDayStyles.muted}>
                {t("pages.matchDay.opponentEmptyText")}
              </p>
            ) : (
              opponentScouting.lineup.map((player) => (
                <div key={player.id} style={matchDayStyles.opponentRow}>
                  <input
                    placeholder="#"
                    value={player.number}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "number", event.target.value)
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <input
                    placeholder={t("pages.matchDay.namePlaceholder")}
                    value={player.name}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "name", event.target.value)
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <input
                    placeholder={t("pages.matchDay.birthYearPlaceholder")}
                    inputMode="numeric"
                    maxLength={4}
                    value={player.birthYear || ""}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "birthYear", event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <input
                    placeholder={t("pages.matchDay.rolePlaceholder")}
                    value={player.role}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "role", event.target.value)
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <select
                    value={player.status}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "status", event.target.value)
                    }
                    style={matchDayStyles.compactInput}
                  >
                    <option value="Titolare">{t("pages.matchDay.opponentStatusStarter")}</option>
                    <option value="Panchina">{t("pages.matchDay.opponentStatusBench")}</option>
                    <option value="Chiave">{t("pages.matchDay.opponentStatusKey")}</option>
                  </select>
                  <input
                    placeholder={t("pages.matchDay.notesPlaceholder")}
                    value={player.notes}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "notes", event.target.value)
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <Button
                    variant="danger"
                    onClick={() => deleteOpponentPlayer(player.id)}
                  >
                    X
                  </Button>
                </div>
              ))
            )}
          </div>
          </div>

          {previousOpponentMatches.length > 0 && (
            <div style={matchDayStyles.previousBox}>
              <h4 style={{ margin: 0 }}>{t("pages.matchDay.matchHistoryTitle", { opponent: selectedMatch.opponent })}</h4>
              {previousOpponentMatches.map((match) => (
                <div key={match.id} style={matchDayStyles.previousItem}>
                  <strong>{formatDate(match.date)}</strong>
                  <span>{match.result || t("pages.matchDay.noResult")}</span>
                  <span>{match.opponentScouting?.returnLegNotes || match.opponentNotes || t("pages.matchDay.noReturnNotes")}</span>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      </div>
    </div>
  );
}


export default MatchDay;
