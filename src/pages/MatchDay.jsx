import { useEffect, useMemo, useState } from "react";
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
import { compareMatchDateTime, createId, formatDate, getLineup, localDateString, normalizeAppSettings } from "../utils/helpers";
import { deleteTeamAttachment, uploadTeamAttachment } from "../services/attachments";
import { useAuth } from "../hooks/useAuth";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";
import { matchDayStyles } from "../styles/matchDay";
import {
  TeamMark, MiniStat, PrintKpi, PrintBox, PlayerPrintTable,
  SectionHeader, MatchCommandCenter,
} from "../components/matchday/MatchDayElements";
import MatchFormationPlanner from "../components/matchday/MatchFormationPlanner";
import { getOpponentScouting, getMatchVenue } from "../utils/matchDayHelpers";

function MatchDay({
  matches = [], setMatches, players = [], appSettings = {} }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const [showOpponentLineupEditor, setShowOpponentLineupEditor] = useState(false);

  const isMobile = useIsMobile();
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const clubLogo = workspaceProfile.logo || "";
  const clubLogoSize = Number(workspaceProfile.logoSize || 100);
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => compareMatchDayOrder(a, b, localDateString())),
    [matches]
  );
  const selectedMatch =
    matches.find((match) => String(match.id) === String(id)) || sortedMatches[0];
  const lineup = getLineup(selectedMatch);

  useEffect(() => {
    const convIds = (selectedMatch?.convocazione?.playerIds || []).map(String);
    if (!selectedMatch || !convIds.length || lineup.calledUpIds.length) return;

    setMatches((prevMatches) =>
      prevMatches.map((match) =>
        String(match.id) === String(selectedMatch.id)
          ? {
              ...match,
              lineup: {
                ...getLineup(match),
                calledUpIds: convIds,
                benchIds: convIds,
                starterIds: [],
              },
            }
          : match
      )
    );
  }, [selectedMatch, lineup.calledUpIds.length, setMatches]);

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

  const starterPlayers = players.filter((player) =>
    lineup.starterIds.includes(player.id)
  );
  const benchPlayers = players.filter((player) => lineup.benchIds.includes(player.id));
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
  const matchTeams = getMatchTeams(selectedMatch, { clubName, clubLogo });
  const matchMeta = [
    formatDate(selectedMatch.date),
    selectedMatch.time ? t("pages.matchDay.timePrefix", { time: selectedMatch.time }) : "",
    selectedMatch.competition,
    selectedMatch.matchday,
    matchVenue || selectedMatch.location,
    selectedMatch.formation,
  ].filter(Boolean);
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
      key: "distinta",
      title: t("pages.matchDay.commandDistinta"),
      detail: t("pages.matchDay.commandDistintaDetail", { starters: starterPlayers.length, bench: benchPlayers.length }),
      done: lineup.ready,
      action: lineup.ready ? t("pages.matchDay.commandDistintaReview") : t("pages.matchDay.commandDistintaComplete"),
      onClick: () => document.getElementById("match-lineup-distinta")?.scrollIntoView({ behavior: "smooth", block: "start" }),
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

  // Numero massimo di sostituzioni per partita (regole FIFA moderne: 5)
  const MAX_SUBSTITUTIONS = 5;

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

  async function exportMatchDayPDF() {
    const { generateMatchDayPDF } = await import("../utils/generateMatchDayPDF");
    await generateMatchDayPDF({ match: selectedMatch, players, appSettings });
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

      <div style={matchDayStyles.selectorRow}>
        <select
          value={selectedMatch.id}
          onChange={(event) => selectMatch(event.target.value)}
          style={{ ...styles.input, maxWidth: 360, marginTop: 0 }}
        >
          {sortedMatches.map((match) => (
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
          <Button onClick={exportMatchDayPDF}>
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
                  logo={matchTeams.home.logo}
                  logoSize={clubLogoSize}
                  name={matchTeams.home.name}
                  fallback={matchTeams.home.fallback}
                />
                <div>
                  <p>{t("pages.matchDay.printDocType")}</p>
                  <h1>
                    {matchTeams.home.name} <span style={{ color: "#64748b" }}>vs</span>{" "}
                    {matchTeams.away.name}
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
              <PrintKpi label={t("pages.matchDay.statStarters")} value={`${starterPlayers.length}/11`} />
              <PrintKpi label={t("pages.matchDay.statBench")} value={benchPlayers.length} />
              <PrintKpi label={t("pages.matchDay.statFormation")} value={selectedMatch.formation || "-"} />
            </section>

            <section className="print-grid two">
              <PrintBox title={t("pages.matchDay.printBoxField")} value={matchVenue || t("pages.matchDay.fieldUndefined")} />
              <PrintBox title={t("pages.matchDay.statTime")} value={selectedMatch.time || t("pages.matchDay.timeUndefined")} />
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
              logo={matchTeams.home.logo}
              logoSize={clubLogoSize}
              name={matchTeams.home.name}
              fallback={matchTeams.home.fallback}
            />
            <div style={matchDayStyles.scoreBox}>
              <Badge tone="orange">Match Day</Badge>
              <h2 style={matchDayStyles.matchTitle}>
                {matchTeams.title}
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
              logo={matchTeams.away.logo}
              logoSize={matchTeams.away.isClub ? clubLogoSize : undefined}
              name={matchTeams.away.name}
              fallback={matchTeams.away.fallback}
            />
          </div>

          <div style={matchDayStyles.kpiGrid}>
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

        <MatchFormationPlanner
          match={selectedMatch}
          lineup={lineup}
          players={players}
          onChange={updateLineup}
          clubName={clubName}
          clubLogo={clubLogo}
          clubLogoSize={clubLogoSize}
          isMobile={isMobile}
        />

        <div style={{ ...matchDayStyles.mainGrid, gridTemplateColumns: "1fr" }}>
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
                  <a
                    href={opponentScouting.attachment.url || opponentScouting.attachment.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={matchDayStyles.openAttachmentButton}
                  >
                    Visualizza distinta
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

          {opponentScouting.attachment && (
            <AttachmentPreview attachment={opponentScouting.attachment} />
          )}

          <div style={matchDayStyles.opponentHeader}>
            <h4 style={{ margin: 0, lineHeight: 1.2 }}>
              {opponentScouting.attachment ? "Trascrizione giocatori" : t("pages.matchDay.opponentLineupTitle")}
            </h4>
            <Button
              variant="ghost"
              onClick={() => {
                setShowOpponentLineupEditor(true);
                addOpponentPlayer();
              }}
            >
              {opponentScouting.attachment ? "Aggiungi manualmente" : t("pages.matchDay.addPlayer")}
            </Button>
          </div>

          {(showOpponentLineupEditor || opponentScouting.lineup.length > 0 || !opponentScouting.attachment) && (
            <div style={{ overflowX: "auto" }}>
              <div style={{ ...matchDayStyles.opponentList, minWidth: 560 }}>
                {opponentScouting.lineup.length === 0 ? (
                  <p style={matchDayStyles.muted}>
                    {opponentScouting.attachment
                      ? "La distinta allegata è già visibile sopra. Aggiungi giocatori solo se vuoi salvarli come testo."
                      : t("pages.matchDay.opponentEmptyText")}
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
          )}

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

function compareMatchDayOrder(a, b, todayKey) {
  const aDate = String(a.date || "");
  const bDate = String(b.date || "");
  const aUpcoming = aDate >= todayKey;
  const bUpcoming = bDate >= todayKey;

  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

  const direction = aUpcoming ? 1 : -1;
  return direction * compareMatchDateTime(a, b);
}

function getMatchTeams(match = {}, { clubName, clubLogo }) {
  const opponentName = match.opponent || "Avversario";
  const isAway = match.location === "Trasferta";
  const club = {
    name: clubName,
    logo: clubLogo,
    fallback: clubName.slice(0, 2).toUpperCase(),
    isClub: true,
  };
  const opponent = {
    name: opponentName,
    logo: isAway ? match.homeLogo || match.awayLogo || "" : match.awayLogo || "",
    fallback: opponentName.slice(0, 2).toUpperCase(),
    isClub: false,
  };
  const home = isAway ? opponent : { ...club, logo: match.homeLogo || clubLogo };
  const away = isAway ? club : opponent;

  return {
    home,
    away,
    title: `${home.name} vs ${away.name}`,
  };
}

function AttachmentPreview({ attachment }) {
  const src = attachment.url || attachment.dataUrl || "";
  const name = attachment.name || "Distinta avversaria";
  const type = String(attachment.type || "").toLowerCase();
  const isImage = type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
  const isPdf = type.includes("pdf") || /\.pdf$/i.test(name);

  if (!src) return null;

  return (
    <div style={matchDayStyles.attachmentPreview}>
      <div style={matchDayStyles.attachmentPreviewHeader}>
        <strong>Distinta caricata</strong>
        <a href={src} target="_blank" rel="noreferrer" style={matchDayStyles.openAttachmentButton}>
          Apri a schermo intero
        </a>
      </div>

      {isImage ? (
        <a href={src} target="_blank" rel="noreferrer" style={matchDayStyles.imagePreviewLink}>
          <img src={src} alt={name} style={matchDayStyles.attachmentImage} />
        </a>
      ) : isPdf ? (
        <div style={matchDayStyles.pdfPreviewFallback}>
          <div style={matchDayStyles.pdfIcon}>PDF</div>
          <div>
            <strong>{name}</strong>
            <p>Il PDF non puo' essere mostrato dentro la pagina, ma si apre correttamente a schermo intero.</p>
          </div>
          <a href={src} target="_blank" rel="noreferrer" style={matchDayStyles.openAttachmentButton}>
            Apri distinta
          </a>
        </div>
      ) : (
        <a href={src} target="_blank" rel="noreferrer" style={matchDayStyles.attachmentFallback}>
          Visualizza {name}
        </a>
      )}
    </div>
  );
}
