import { Link, useNavigate, useParams } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import { createId, formatDate, getLineup, uniqueIds } from "../utils/helpers";
import { deleteTeamAttachment, uploadTeamAttachment } from "../services/attachments";
import { useAuth } from "../hooks/useAuth";

function MatchDay({ matches = [], setMatches, players = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast, ToastContainer } = useToast();
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
          title="Match Day"
          subtitle="Prepara convocati, distinta, titolari e note gara"
        />
        <EmptyState
          icon="⚽"
          title="Nessuna partita disponibile"
          text="Crea una partita dal Match Center per preparare la scheda gara."
          action={
            <Link to="/matches" style={{ textDecoration: "none" }}>
              <Button>Vai alle partite</Button>
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
      showToast(error?.message || "Upload allegato non riuscito", "error");
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
    showToast(`${convIds.length} convocati importati dalla convocazione`, "success");
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
      showToast("Nessuna distinta precedente da copiare", "info");
      return;
    }

    updateLineup(getLineup(previous));
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <PageHeader
        title="Match Day"
        subtitle="Convocazioni, distinta, piano gara ed export stampabile"
      />

      <MatchTabBar
        matchId={selectedMatch?.id}
        active="scheda"
        matchLabel={selectedMatch?.opponent ? `vs ${selectedMatch.opponent}` : undefined}
        matchData={selectedMatch}
      />

      {/* ── Banner convocazione non pubblicata ── */}
      {selectedMatch && !selectedMatch.convocazione?.published && (
        <div style={matchDayStyles.convoBanner}>
          <span style={matchDayStyles.convoBannerText}>
            {selectedMatch.convocazione?.playerIds?.length > 0
              ? `📋 Convocazione in bozza — ${selectedMatch.convocazione.playerIds.length} giocatori selezionati, non ancora pubblicata`
              : "📋 Convocazione non ancora compilata per questa partita"}
          </span>
          <Button variant="ghost" onClick={() => navigate(`/match-convocation/${selectedMatch.id}`)}>
            Vai alla convocazione →
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
            <Button variant="ghost">Match Center</Button>
          </Link>
          <Button variant="ghost" onClick={copyPreviousLineup}>
            Copia precedente
          </Button>
          <Button
            variant={lineup.ready ? "primary" : "ghost"}
            onClick={() => updateLineup({ ready: !lineup.ready })}
          >
            {lineup.ready ? "Distinta pronta" : "Segna pronta"}
          </Button>
          <Button onClick={() => window.print()}>Esporta PDF</Button>
        </div>
      </div>

      <div className="print-area" style={matchDayStyles.printArea}>
        <AppCard>
          <div style={matchDayStyles.matchHeader}>
            <TeamMark
              logo={selectedMatch.homeLogo}
              name="CalcioLab"
              fallback="CL"
            />
            <div style={matchDayStyles.scoreBox}>
              <Badge tone="orange">Match Day</Badge>
              <h2 style={matchDayStyles.matchTitle}>
                {selectedMatch.title || `CalcioLab - ${selectedMatch.opponent}`}
              </h2>
              <p style={{ ...matchDayStyles.muted, marginTop: 6 }}>
                {formatDate(selectedMatch.date)} · {selectedMatch.location} ·{" "}
                {selectedMatch.formation}
              </p>
              <div style={matchDayStyles.resultRow}>
                <span style={matchDayStyles.resultLabel}>Risultato</span>
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
            <MiniStat label="Convocati" value={calledPlayers.length} />
            <MiniStat label="Titolari" value={`${starterPlayers.length}/11`} />
            <MiniStat label="Panchina" value={benchPlayers.length} />
            <MiniStat label="Modulo" value={selectedMatch.formation || "-"} />
            <MiniStat label="Stato" value={lineup.ready ? "Pronta" : "Bozza"} />
          </div>
        </AppCard>

        {/* ── Banner import dalla Convocazione ── */}
        {lineup.calledUpIds.length === 0 && (selectedMatch.convocazione?.playerIds?.length > 0) && (
          <div style={matchDayStyles.importBanner}>
            <div>
              <strong style={{ color: "#93c5fd", fontSize: 14 }}>📋 Convocazione disponibile</strong>
              <p style={{ ...matchDayStyles.muted, marginTop: 4 }}>
                Hai {selectedMatch.convocazione.playerIds.length} giocatori nella convocazione —
                importali come punto di partenza per la distinta.
              </p>
            </div>
            <Button onClick={importConvocazione}>Importa convocati →</Button>
          </div>
        )}

        <div style={matchDayStyles.mainGrid}>
          <AppCard>
            <SectionHeader title="Titolari" badge={`${starterPlayers.length}/11`} />
            <PlayerList
              players={starterPlayers}
              empty="Nessun titolare selezionato"
              actionLabel="Panchina"
              onAction={moveToBench}
              lineup={lineup}
              listKey="starterIds"
              onMove={movePlayer}
              onCaptain={setCaptain}
              onRoleChange={updatePlayerRole}
            />
          </AppCard>

          <AppCard>
            <SectionHeader title="Panchina" badge={benchPlayers.length} />
            <PlayerList
              players={benchPlayers}
              empty="Nessun giocatore in panchina"
              actionLabel="Titolare"
              onAction={moveToStarter}
              disableAction={lineup.starterIds.length >= 11}
              lineup={lineup}
              listKey="benchIds"
              onMove={movePlayer}
              onCaptain={setCaptain}
              onRoleChange={updatePlayerRole}
            />
          </AppCard>
        </div>

        <div style={matchDayStyles.mainGrid}>
          <AppCard>
            <SectionHeader title="Convocabili" badge={availablePlayers.length} />
            <PlayerList
              players={availablePlayers}
              empty="Tutti i giocatori sono gia convocati"
              actionLabel="Convoca"
              onAction={toggleCalled}
              lineup={lineup}
            />
          </AppCard>

          <AppCard>
            <SectionHeader title="Piano di gara" badge={lineup.ready ? "✓ Pronta" : "Staff"} />
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <h4 style={matchDayStyles.planLabel}>🕵️ Scouting rapido avversario</h4>
                <textarea
                  placeholder="Modulo, punti forti, pericoli principali, stile di gioco..."
                  value={selectedMatch.opponentNotes || ""}
                  onChange={(event) => updateNote("opponentNotes", event.target.value)}
                  style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
                />
              </div>
              <div>
                <h4 style={matchDayStyles.planLabel}>🎯 Piano e principi di gara</h4>
                <textarea
                  placeholder="Principi offensivi e difensivi, palle inattive, istruzioni per reparto, gestione cambi..."
                  value={selectedMatch.matchPlan || ""}
                  onChange={(event) => updateNote("matchPlan", event.target.value)}
                  style={{ ...styles.input, minHeight: 130, resize: "vertical" }}
                />
              </div>
              <div>
                <h4 style={matchDayStyles.planLabel}>📋 Note staff / Briefing</h4>
                <textarea
                  placeholder="Comunicazioni allo staff, logistica, assenze dell'ultimo minuto..."
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
            title="Scouting avversario"
            badge={`${opponentScouting.lineup.length} in distinta`}
          />

          <div style={matchDayStyles.scoutingGrid}>
            <input
              placeholder="Modulo avversario es. 4-3-3"
              value={opponentScouting.formation}
              onChange={(event) =>
                updateOpponentScouting({ formation: event.target.value })
              }
              style={styles.input}
            />
            <input
              placeholder="Giocatori chiave"
              value={opponentScouting.keyPlayers}
              onChange={(event) =>
                updateOpponentScouting({ keyPlayers: event.target.value })
              }
              style={styles.input}
            />
            <textarea
              placeholder="Punti forti"
              value={opponentScouting.strengths}
              onChange={(event) =>
                updateOpponentScouting({ strengths: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder="Punti deboli / dove attaccarli"
              value={opponentScouting.weaknesses}
              onChange={(event) =>
                updateOpponentScouting({ weaknesses: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder="Palle inattive a favore"
              value={opponentScouting.setPiecesFor}
              onChange={(event) =>
                updateOpponentScouting({ setPiecesFor: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder="Palle inattive contro"
              value={opponentScouting.setPiecesAgainst}
              onChange={(event) =>
                updateOpponentScouting({ setPiecesAgainst: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90 }}
            />
            <textarea
              placeholder="Note per la partita di ritorno"
              value={opponentScouting.returnLegNotes}
              onChange={(event) =>
                updateOpponentScouting({ returnLegNotes: event.target.value })
              }
              style={{ ...styles.input, minHeight: 90, gridColumn: "1 / -1" }}
            />
          </div>

          <div style={matchDayStyles.attachmentBox}>
            <div>
              <h4 style={{ margin: 0, lineHeight: 1.2 }}>Allegato distinta</h4>
              <p style={matchDayStyles.muted}>Carica PDF o foto della distinta avversaria ricevuta sul campo.</p>
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
                    {opponentScouting.attachment.name || "Apri allegato"}
                  </a>
                  <Button variant="ghost" onClick={removeOpponentAttachment}>Rimuovi</Button>
                </>
              ) : (
                <label style={matchDayStyles.uploadButton}>
                  Carica file
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
            <h4 style={{ margin: 0, lineHeight: 1.2 }}>Distinta avversaria</h4>
            <Button variant="ghost" onClick={addOpponentPlayer}>
              + Giocatore
            </Button>
          </div>

          <div style={matchDayStyles.opponentList}>
            {opponentScouting.lineup.length === 0 ? (
              <p style={matchDayStyles.muted}>
                Inserisci la distinta avversaria per ritrovarla al ritorno.
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
                    placeholder="Nome"
                    value={player.name}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "name", event.target.value)
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <input
                    placeholder="Anno"
                    inputMode="numeric"
                    maxLength={4}
                    value={player.birthYear || ""}
                    onChange={(event) =>
                      updateOpponentPlayer(player.id, "birthYear", event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    style={matchDayStyles.compactInput}
                  />
                  <input
                    placeholder="Ruolo"
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
                    <option>Titolare</option>
                    <option>Panchina</option>
                    <option>Chiave</option>
                  </select>
                  <input
                    placeholder="Note"
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

          {previousOpponentMatches.length > 0 && (
            <div style={matchDayStyles.previousBox}>
              <h4 style={{ margin: 0 }}>Storico contro {selectedMatch.opponent}</h4>
              {previousOpponentMatches.map((match) => (
                <div key={match.id} style={matchDayStyles.previousItem}>
                  <strong>{formatDate(match.date)}</strong>
                  <span>{match.result || "Risultato non inserito"}</span>
                  <span>{match.opponentScouting?.returnLegNotes || match.opponentNotes || "Nessuna nota ritorno"}</span>
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
}) {
  if (players.length === 0) {
    return <p style={matchDayStyles.muted}>{empty}</p>;
  }

  return (
    <div style={matchDayStyles.playerList}>
      {players.map((player) => (
        <div key={player.id} style={matchDayStyles.playerRow}>
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
              #{player.shirtNumber || "-"} · {lineup?.roles?.[player.id] || player.role || "Ruolo"}
              {lineup?.captainId === player.id ? " · C" : ""}
            </span>
          </div>
          {onRoleChange && (
            <input
              placeholder="Ruolo gara"
              value={lineup?.roles?.[player.id] || ""}
              onChange={(event) => onRoleChange(player.id, event.target.value)}
              style={matchDayStyles.roleInput}
            />
          )}
          {onMove && listKey && (
            <div style={matchDayStyles.moveButtons}>
              <button onClick={() => onMove(player.id, listKey, "up")}>↑</button>
              <button onClick={() => onMove(player.id, listKey, "down")}>↓</button>
            </div>
          )}
          {onCaptain && (
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

function TeamMark({ logo, name, fallback }) {
  return (
    <div style={matchDayStyles.teamMark}>
      {logo ? (
        <img src={logo} alt={name} style={matchDayStyles.teamLogo} />
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

function SectionHeader({ title, badge }) {
  return (
    <div style={matchDayStyles.sectionHeader}>
      <h3 style={{ margin: 0, lineHeight: 1.2 }}>{title}</h3>
      <Badge tone="blue">{badge}</Badge>
    </div>
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
  teamLogo: {
    width: 68,
    height: 68,
    borderRadius: 16,
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.12)",
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
