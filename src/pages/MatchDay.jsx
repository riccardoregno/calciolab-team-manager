import { Link, useNavigate, useParams } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import { createId, formatDate, getLineup, normalizeAppSettings, uniqueIds } from "../utils/helpers";
import { deleteTeamAttachment, uploadTeamAttachment } from "../services/attachments";
import { useAuth } from "../hooks/useAuth";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";

function MatchDay({
  matches = [], setMatches, players = [], appSettings = {} }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast, ToastContainer } = useToast();

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

  function moveToStarter(player) {
    if (lineup.starterIds.includes(player.id) || lineup.starterIds.length >= 11) {
      return;
    }

    updateSelectedMatch({
      lineup: {
        calledUpIds: uniqueIds([...lineup.calledUpIds, player.id]),
        starterIds: [...lineup.starterIds, player.id],
        benchIds: lineup.benchIds.filter((id) => id !== player.id),
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
    updateOpponentScouting({
      lineup: opponentScouting.lineup.filter((player) => player.id !== playerId),
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
          <Button onClick={() => window.print()}>{t("pages.matchDay.exportPdf")}</Button>
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
          <div style={matchDayStyles.matchHeader}>
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

function PlayerList({
  players,
  empty,
  actionLabel,
  onAction,
  disableAction = false,
  lineup,
  listKey,
  onMove,
  onCaptain,
  onRoleChange,
  isMobile = false,
}) {
  const { t } = useTranslation();
  if (players.length === 0) {
    return <p style={matchDayStyles.muted}>{empty}</p>;
  }

  const rowGrid = isMobile
    ? "46px 1fr auto"
    : "46px 1fr minmax(120px, 0.7fr) auto auto auto";

  return (
    <div style={matchDayStyles.playerList}>
      {players.map((player) => (
        <div key={player.id} style={{ ...matchDayStyles.playerRow, gridTemplateColumns: rowGrid }}>
          <div style={matchDayStyles.playerAvatar}>
            {player.photo ? (
              <img src={player.photo} alt={player.name} style={matchDayStyles.avatarImg} />
            ) : (
              player.name?.[0] || "?"
            )}
          </div>
          <div style={matchDayStyles.playerInfo}>
            <strong style={{ lineHeight: 1.2 }}>{player.name}</strong>
            <span>
              #{player.shirtNumber || "-"} · {lineup?.roles?.[player.id] || player.role || "—"}
              {lineup?.captainId === player.id ? " · C" : ""}
            </span>
            {isMobile && onRoleChange && (
              <input
                placeholder={t("pages.matchDay.rolePlaceholderInput")}
                value={lineup?.roles?.[player.id] || ""}
                onChange={(event) => onRoleChange(player.id, event.target.value)}
                style={{ ...matchDayStyles.roleInput, marginTop: 4, fontSize: 12, padding: "5px 8px" }}
              />
            )}
          </div>
          {!isMobile && onRoleChange && (
            <input
              placeholder={t("pages.matchDay.rolePlaceholderInput")}
              value={lineup?.roles?.[player.id] || ""}
              onChange={(event) => onRoleChange(player.id, event.target.value)}
              style={matchDayStyles.roleInput}
            />
          )}
          {!isMobile && onMove && listKey && (
            <div style={matchDayStyles.moveButtons}>
              <button onClick={() => onMove(player.id, listKey, "up")}>↑</button>
              <button onClick={() => onMove(player.id, listKey, "down")}>↓</button>
            </div>
          )}
          {!isMobile && onCaptain && (
            <Button variant="ghost" onClick={() => onCaptain(player.id)}>
              C
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onAction(player)}
            disabled={disableAction}
          >
            {actionLabel}
          </Button>
        </div>
      ))}
    </div>
  );
}

function TeamMark({ logo, logoSize = 100, name, fallback }) {
  return (
    <div style={matchDayStyles.teamMark}>
      {logo ? (
        <div style={matchDayStyles.teamLogoFrame}>
          <img
            src={logo}
            alt={name}
            style={{
              ...matchDayStyles.teamLogo,
              width: `${Number(logoSize || 100)}%`,
              height: `${Number(logoSize || 100)}%`,
            }}
          />
        </div>
      ) : (
        <div style={matchDayStyles.teamFallback}>{fallback}</div>
      )}
      <strong style={{ lineHeight: 1.2 }}>{name}</strong>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={matchDayStyles.statCard}>
      <span>{label}</span>
      <strong style={{ lineHeight: 1 }}>{value}</strong>
    </div>
  );
}

function PrintKpi({ label, value }) {
  return (
    <div className="print-kpi">
      <span>{label}</span>
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

function PlayerPrintTable({ players, lineup, empty, t }) {
  if (!players.length) {
    return (
      <div className="print-box">
        <span>{empty}</span>
        <p>-</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t("pages.matchDay.printTableNumber")}</th>
          <th>{t("pages.matchDay.printTableShirt")}</th>
          <th>{t("pages.matchDay.printTablePlayer")}</th>
          <th>{t("pages.matchDay.printTableRole")}</th>
          <th>{t("pages.matchDay.printTableNotes")}</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player, index) => {
          const displayName = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "-";
          const role = lineup?.roles?.[player.id] || player.role || "-";
          const isCaptain = lineup?.captainId === player.id;

          return (
            <tr key={player.id}>
              <td>{index + 1}</td>
              <td>#{player.shirtNumber || "-"}</td>
              <td>{displayName}</td>
              <td>{role}</td>
              <td>{isCaptain ? t("pages.matchDay.playerTableCaptain") : player.status || "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SectionHeader({ title, badge }) {
  return (
    <div style={matchDayStyles.sectionHeader}>
      <h3 style={{ margin: 0, lineHeight: 1.2 }}>{title}</h3>
      <Badge tone="blue">{badge}</Badge>
    </div>
  );
}

function MatchCommandCenter({ steps, completed, total, onMicrocycle, onSetPlays, onOpponents }) {
  const { t } = useTranslation();
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const criticalOpen = steps.filter((step) => !step.done).slice(0, 2);

  return (
    <AppCard>
      <div style={matchDayStyles.commandHead}>
        <div>
          <p style={matchDayStyles.commandEyebrow}>{t("pages.matchDay.commandCabina")}</p>
          <h3 style={matchDayStyles.commandTitle}>{t("pages.matchDay.commandTitle")}</h3>
          <p style={matchDayStyles.muted}>
            {t("pages.matchDay.commandSubtitle")}
          </p>
        </div>
        <div style={matchDayStyles.readinessBox}>
          <strong>{pct}%</strong>
          <span>{t("pages.matchDay.commandCompleted", { done: completed, total })}</span>
        </div>
      </div>

      <div style={matchDayStyles.progressTrack}>
        <span style={{ ...matchDayStyles.progressFill, width: `${pct}%` }} />
      </div>

      <div style={matchDayStyles.commandGrid}>
        {steps.map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={step.onClick}
            style={{
              ...matchDayStyles.commandCard,
              ...(step.done ? matchDayStyles.commandCardDone : {}),
            }}
          >
            <div style={matchDayStyles.commandCardTop}>
              <span style={step.done ? matchDayStyles.checkDone : matchDayStyles.checkTodo}>
                {step.done ? "✓" : "•"}
              </span>
              <strong>{step.title}</strong>
            </div>
            <small>{step.detail}</small>
            <span style={matchDayStyles.commandAction}>{step.action} →</span>
          </button>
        ))}
      </div>

      <div style={matchDayStyles.commandFooter}>
        <div style={matchDayStyles.openAlerts}>
          {criticalOpen.length ? (
            criticalOpen.map((step) => (
              <span key={step.key}>{t("pages.matchDay.commandToClose", { title: step.title })}</span>
            ))
          ) : (
            <span>{t("pages.matchDay.commandReady")}</span>
          )}
        </div>
        <div style={matchDayStyles.commandLinks}>
          <Button variant="ghost" onClick={onMicrocycle}>{t("pages.matchDay.commandMicrocycle")}</Button>
          <Button variant="ghost" onClick={onSetPlays}>{t("pages.matchDay.commandSetPlays")}</Button>
          <Button variant="ghost" onClick={onOpponents}>{t("pages.matchDay.commandOpponents")}</Button>
        </div>
      </div>
    </AppCard>
  );
}

function getOpponentScouting(match) {
  return {
    formation: match?.opponentScouting?.formation || "",
    lineup: (match?.opponentScouting?.lineup || []).map((player) => ({
      ...player,
      birthYear: player.birthYear || "",
    })),
    keyPlayers: match?.opponentScouting?.keyPlayers || "",
    strengths: match?.opponentScouting?.strengths || "",
    weaknesses: match?.opponentScouting?.weaknesses || "",
    setPiecesFor: match?.opponentScouting?.setPiecesFor || "",
    setPiecesAgainst: match?.opponentScouting?.setPiecesAgainst || "",
    returnLegNotes: match?.opponentScouting?.returnLegNotes || "",
    attachment: match?.opponentScouting?.attachment || null,
  };
}

function getPreMatchChecklist(match) {
  const checklist = match?.preMatchChecklist || {};
  return {
    items: checklist.items || {},
    staffArrivalTime: checklist.staffArrivalTime || "",
    staffResponsible: checklist.staffResponsible || "",
    refereeInfo: checklist.refereeInfo || "",
    logisticsNotes: checklist.logisticsNotes || "",
  };
}

function getChecklistItems({ match, venue, t }) {
  const details = match?.convocazione?.details || {};
  return [
    {
      key: "documents",
      label: t("pages.matchDay.checklistDocumentsLabel"),
      detail: t("pages.matchDay.checklistDocumentsDetail"),
    },
    {
      key: "kits",
      label: t("pages.matchDay.checklistKitsLabel"),
      detail: details.kit || t("pages.matchDay.checklistKitsDefault"),
    },
    {
      key: "water",
      label: t("pages.matchDay.checklistWaterLabel"),
      detail: t("pages.matchDay.checklistWaterDetail"),
    },
    {
      key: "medical",
      label: t("pages.matchDay.checklistMedicalLabel"),
      detail: t("pages.matchDay.checklistMedicalDetail"),
    },
    {
      key: "field",
      label: t("pages.matchDay.checklistFieldLabel"),
      detail: venue || details.meetingPlace || t("pages.matchDay.checklistFieldDefault"),
    },
    {
      key: "referee",
      label: t("pages.matchDay.checklistRefereeLabel2"),
      detail: t("pages.matchDay.checklistRefereeDetail"),
    },
    {
      key: "opponentLineup",
      label: t("pages.matchDay.checklistOpponentLabel"),
      detail: match?.opponentScouting?.attachment ? t("pages.matchDay.checklistOpponentDone") : t("pages.matchDay.checklistOpponentTodo"),
    },
    {
      key: "warmup",
      label: t("pages.matchDay.checklistWarmupLabel"),
      detail: t("pages.matchDay.checklistWarmupDetail"),
    },
  ];
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function getHomeVenue(profile = {}) {
  return [profile.homeFieldName, profile.homeFieldAddress, profile.homeFieldSurface]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");
}

function getMatchVenue(match = {}, profile = {}) {
  const importedVenue = [match.venueName, match.venueAddress]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");

  if (importedVenue) return importedVenue;
  if (match.location === "Casa") return getHomeVenue(profile);
  return match.location || "";
}

function buildMatchPlanPrefill({ match, venue, convocationCount, t }) {
  return [
    t("pages.matchDay.prefillOpponent", { value: match.opponent || t("pages.matchDay.checklistToBeDefined") }),
    match.competition ? t("pages.matchDay.prefillCompetition", { value: match.competition }) : "",
    match.matchday ? t("pages.matchDay.prefillMatchday", { value: match.matchday }) : "",
    venue ? t("pages.matchDay.prefillField", { value: venue }) : "",
    match.time ? t("pages.matchDay.prefillTime", { value: match.time }) : "",
    convocationCount ? t("pages.matchDay.prefillCalled", { value: convocationCount }) : "",
    "",
    t("pages.matchDay.prefillGamePlanHeader"),
    t("pages.matchDay.prefillPossesso"),
    t("pages.matchDay.prefillNonPossesso"),
    t("pages.matchDay.prefillTransizioni"),
    t("pages.matchDay.prefillPalleInattive"),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildStaffNotesPrefill({ match, venue, details, t }) {
  return [
    details.meetingTime || details.meetingPlace
      ? t("pages.matchDay.prefillRaduno", { value: [details.meetingTime, details.meetingPlace].filter(Boolean).join(" - ") })
      : "",
    details.lockerRoom ? t("pages.matchDay.prefillSpogliatoio", { value: details.lockerRoom }) : "",
    details.kit ? t("pages.matchDay.prefillKit", { value: details.kit }) : "",
    details.staffContact ? t("pages.matchDay.prefillStaffContact", { value: details.staffContact }) : "",
    details.message ? t("pages.matchDay.prefillMessage", { value: details.message }) : "",
    match.convocazione?.notes ? t("pages.matchDay.prefillConvoNotes", { value: match.convocazione.notes }) : "",
    venue ? t("pages.matchDay.prefillVerifica", { value: venue }) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const matchDayStyles = {
  selectorRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 22,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  commandHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  commandEyebrow: {
    margin: "0 0 6px",
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  commandTitle: {
    margin: "0 0 6px",
    fontSize: 24,
    lineHeight: 1.1,
  },
  readinessBox: {
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
  commandGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: 10,
  },
  commandCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(15,23,42,0.72)",
    color: "#cbd5e1",
    display: "grid",
    gap: 8,
    textAlign: "left",
    cursor: "pointer",
  },
  commandCardDone: {
    border: "1px solid rgba(34,197,94,0.28)",
    background: "rgba(34,197,94,0.08)",
  },
  commandCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  checkDone: {
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(34,197,94,0.18)",
    color: "#86efac",
    fontWeight: 900,
  },
  checkTodo: {
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(245,158,11,0.14)",
    color: "#fcd34d",
    fontWeight: 900,
  },
  commandAction: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: 900,
  },
  commandFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  openAlerts: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    color: "#fcd34d",
    fontSize: 12,
    fontWeight: 800,
  },
  commandLinks: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  printArea: {
    display: "grid",
    gap: 22,
  },
  matchHeader: {
    display: "grid",
    gridTemplateColumns: "160px 1fr 160px",
    alignItems: "center",
    gap: 18,
  },
  matchTitle: {
    margin: "12px 0 6px",
    textAlign: "center",
  },
  scoreBox: {
    textAlign: "center",
  },
  muted: {
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.5,
  },
  teamMark: {
    display: "grid",
    placeItems: "center",
    gap: 10,
    textAlign: "center",
    minWidth: 0,
  },
  teamLogoFrame: {
    width: 68,
    height: 68,
    borderRadius: 16,
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  teamLogo: {
    maxWidth: "160%",
    maxHeight: "160%",
    objectFit: "contain",
    transition: "width 0.2s ease, height 0.2s ease",
  },
  teamFallback: {
    width: 68,
    height: 68,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#2563eb,#38bdf8)",
    fontWeight: 900,
    fontSize: 24,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 12,
    marginTop: 22,
  },
  statCard: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  checklistMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
    marginBottom: 14,
  },
  smallField: {
    display: "grid",
    gap: 6,
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  smallInput: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.82)",
    color: "white",
    padding: "9px 10px",
    boxSizing: "border-box",
  },
  checklistGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
    gap: 10,
  },
  checklistItem: {
    display: "grid",
    gridTemplateColumns: "24px 1fr",
    gap: 10,
    alignItems: "start",
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
    color: "#e2e8f0",
    cursor: "pointer",
  },
  checklistItemDone: {
    border: "1px solid rgba(34,197,94,0.32)",
    background: "rgba(34,197,94,0.1)",
  },
  checkIconTodo: {
    width: 22,
    height: 22,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(15,23,42,0.8)",
  },
  checkIconDone: {
    width: 22,
    height: 22,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "rgba(34,197,94,0.22)",
    color: "#86efac",
    fontWeight: 900,
  },
  printChecklistSummary: {
    display: "grid",
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  printChecklistHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    color: "#e2e8f0",
  },
  printChecklistInfo: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  printChecklistRows: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 8,
  },
  printChecklistRow: {
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 6,
    alignItems: "start",
    padding: 10,
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  printStatusDone: {
    color: "#86efac",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  printStatusTodo: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  printChecklistNotes: {
    margin: 0,
    color: "#cbd5e1",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  playerList: {
    display: "grid",
    gap: 10,
  },
  playerRow: {
    display: "grid",
    gridTemplateColumns: "46px 1fr minmax(120px, 0.7fr) auto auto auto",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  playerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "rgba(56,189,248,0.16)",
    fontWeight: 900,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  playerInfo: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  roleInput: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.82)",
    color: "white",
    padding: "9px 10px",
  },
  moveButtons: {
    display: "flex",
    gap: 4,
  },
  scoutingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
    marginBottom: 18,
  },
  opponentHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  opponentList: {
    display: "grid",
    gap: 10,
  },
  opponentRow: {
    display: "grid",
    gridTemplateColumns: "70px 1fr 90px 130px 130px 1fr auto",
    gap: 8,
    alignItems: "center",
  },
  compactInput: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.82)",
    color: "white",
    padding: "9px 10px",
  },
  attachmentBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(59,130,246,0.07)",
    border: "1px solid rgba(59,130,246,0.18)",
  },
  attachmentActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  attachmentLink: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    wordBreak: "break-word",
  },
  uploadButton: {
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.14)",
    color: "#bfdbfe",
    cursor: "pointer",
    padding: "9px 13px",
    fontSize: 13,
    fontWeight: 800,
  },
  previousBox: {
    display: "grid",
    gap: 10,
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.18)",
  },
  previousItem: {
    display: "grid",
    gap: 4,
    color: "#cbd5e1",
  },

  // Piano di gara labels
  planLabel: {
    margin: "0 0 6px",
    fontSize: 13,
    fontWeight: 800,
    color: "#94a3b8",
    lineHeight: 1.2,
  },

  // Risultato inline nel header
  resultRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#64748b",
    letterSpacing: 0.4,
  },
  resultInput: {
    width: 88,
    padding: "5px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.07)",
    color: "white",
    fontSize: 16,
    fontWeight: 900,
    textAlign: "center",
    outline: "none",
  },

  // Import dalla convocazione
  importBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 18px",
    borderRadius: 14,
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.3)",
  },
  prefillBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 18px",
    borderRadius: 14,
    background: "rgba(14,165,233,0.08)",
    border: "1px solid rgba(14,165,233,0.24)",
  },
  prefillMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  // Banner convocazione
  convoBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.28)",
    marginBottom: 4,
  },
  convoBannerText: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fcd34d",
    lineHeight: 1.4,
  },
};

export default MatchDay;
