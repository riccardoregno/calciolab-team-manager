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

const exportTypes = [
  { id: "training", label: "Seduta", description: "Piano campo pronto da stampare" },
  { id: "matchday", label: "Match Day", description: "Distinta, ruoli e scouting avversario" },
  { id: "microcycle", label: "Microciclo", description: "Settimana gara, carichi e alert staff" },
  { id: "postmatch", label: "Post gara", description: "Report tecnico e focus settimana" },
  { id: "player", label: "Scheda giocatore", description: "Dati individuali, test e carico" },
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
        subtitle="Template professionali per consegnare sedute, gara, report e schede giocatore in PDF."
        action={
          <Button onClick={() => window.print()}>
            Stampa / salva PDF
          </Button>
        }
      />

      <div className="export-workspace" style={{ ...pageStyles.workspace, gridTemplateColumns: isMobile ? "1fr" : "360px 1fr" }}>
        <AppCard title="Contenuto" subtitle="Scegli cosa preparare per staff, giocatori o archivio.">
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
              <Field label="Seduta">
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
              <Field label="Partita">
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
              <Field label="Giocatore">
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

        <AppCard
          title={`Anteprima ${activeType.label}`}
          subtitle="Questa area e' quella che verra' stampata o salvata in PDF."
          rightContent={<Button variant="ghost" onClick={() => window.print()}>PDF</Button>}
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
      </div>
    </div>
  );
}

const microcycleDays = [
  { key: "MD+1", offset: -6, focus: "Recupero gara precedente", plan: "Rigenerante, terapie, scarico" },
  { key: "MD-4", offset: -4, focus: "Principi e carico", plan: "Tecnico-tattico, volume medio" },
  { key: "MD-3", offset: -3, focus: "Picco settimanale", plan: "Alta intensita', duelli, reparti" },
  { key: "MD-2", offset: -2, focus: "Piano gara", plan: "Strategia, palle inattive, undici" },
  { key: "MD-1", offset: -1, focus: "Rifinitura", plan: "Attivazione, chiarezza compiti" },
  { key: "MD", offset: 0, focus: "Gara", plan: "Match day" },
];

function MicrocycleTemplate({ match, sessions, matches, players, gpsSessions }) {
  if (!match) return <EmptyPrint title="Nessuna partita disponibile" />;

  const matchDate = toDateKey(match.date);
  const week = microcycleDays.map((day) => {
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
        eyebrow="Microciclo gara"
        title={match.title}
        meta={[formatDate(match.date), match.opponent || "Avversario da definire", match.competition || "Gara"]}
      />

      <KpiGrid
        items={[
          { label: "Sedute settimana", value: totalSessions },
          { label: "Carico stimato", value: totalLoad },
          { label: "GPS totale", value: totalGpsDistance ? `${Math.round(totalGpsDistance / 100) / 10} km` : "-" },
          { label: "Alert rosa", value: unavailable.length },
        ]}
      />

      <Section title="Settimana gara">
        <table>
          <thead>
            <tr>
              <th>Giorno</th>
              <th>Data</th>
              <th>Focus</th>
              <th>Contenuto</th>
              <th>RPE target</th>
              <th>Load</th>
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

      <Section title="Alert staff">
        <div className="print-grid two">
          <PrintBox
            label="Non disponibili / limitati"
            value={unavailable.map((player) => `${player.name} (${player.status})`).join(", ") || "Nessun alert registrato"}
          />
          <PrintBox
            label="Priorita' settimana"
            value={`Preparare ${match.opponent || "avversario"}, rifinitura MD-1, palle inattive e gestione carichi individuali.`}
          />
        </div>
      </Section>
    </article>
  );
}

function TrainingTemplate({ session, exercises }) {
  if (!session) return <EmptyPrint title="Nessuna seduta disponibile" />;

  const plannedExercises = (session.exercises || []).map((block) => {
    const exercise = exercises.find((item) => sameId(item.id, block.exerciseId));
    return {
      ...block,
      exercise,
      title: exercise?.title || block.title || "Blocco seduta",
    };
  });

  return (
    <article>
      <PrintHeader
        eyebrow="Seduta allenamento"
        title={session.title}
        meta={[
          formatDate(session.date),
          session.theme || session.type || "Allenamento",
          `${session.duration || 0}'`,
        ]}
      />

      <KpiGrid
        items={[
          { label: "Obiettivo", value: session.objective || "Da definire" },
          { label: "RPE previsto", value: session.rpe || "-" },
          { label: "Blocchi", value: plannedExercises.length },
          { label: "Carico stimato", value: `${Number(session.duration || 0) * Number(session.rpe || 0)}` },
        ]}
      />

      <Section title="Timeline campo">
        {plannedExercises.length ? (
          <table>
            <thead>
              <tr>
                <th>Minuti</th>
                <th>Blocco</th>
                <th>Spazio</th>
                <th>Focus staff</th>
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
          <p>Nessun esercizio collegato alla seduta.</p>
        )}
      </Section>

      <Section title="Materiale e note">
        <div className="print-grid two">
          <PrintBox label="Materiale" value={session.materials || "Palloni, cinesini, casacche"} />
          <PrintBox label="Note staff" value={session.notes || "Annotazioni libere per gestione gruppo."} />
        </div>
      </Section>
    </article>
  );
}

function MatchDayTemplate({ match, players }) {
  if (!match) return <EmptyPrint title="Nessuna partita disponibile" />;

  const lineup = getLineup(match);
  const starters = lineup.starterIds.map((id) => findPlayer(players, id)).filter(Boolean);
  const bench = lineup.benchIds.map((id) => findPlayer(players, id)).filter(Boolean);
  const calledUp = lineup.calledUpIds.map((id) => findPlayer(players, id)).filter(Boolean);
  const opponentLineup = match.opponentScouting?.lineup || [];

  return (
    <article>
      <PrintHeader
        eyebrow="Match day"
        title={match.title}
        meta={[
          formatDate(match.date),
          match.location || "Campo da definire",
          match.competition || "Gara",
        ]}
      />

      <KpiGrid
        items={[
          { label: "Avversario", value: match.opponent || "-" },
          { label: "Convocati", value: calledUp.length || starters.length + bench.length },
          { label: "Modulo nostro", value: match.formation || "Da definire" },
          { label: "Modulo avversario", value: match.opponentScouting?.formation || "Da definire" },
        ]}
      />

      <Section title="Distinta CalcioLab">
        <div className="print-grid two">
          <RosterList title="Titolari" players={starters} roles={lineup.roles} captainId={lineup.captainId} />
          <RosterList title="Panchina" players={bench} roles={lineup.roles} captainId={lineup.captainId} />
        </div>
      </Section>

      <Section title="Distinta avversaria">
        {opponentLineup.length ? (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Giocatore</th>
                <th>Anno</th>
                <th>Ruolo</th>
                <th>Note</th>
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
          <p>Nessuna distinta avversaria registrata.</p>
        )}
        {match.opponentScouting?.attachment && (
          <PrintBox label="Allegato distinta" value={match.opponentScouting.attachment.name || "File caricato"} />
        )}
      </Section>

      <Section title="Piano gara e ritorno">
        <div className="print-grid two">
          <PrintBox label="Piano gara" value={match.matchPlan || "Principi e priorita' da comunicare alla squadra."} />
          <PrintBox label="Appunti ritorno" value={match.opponentScouting?.returnLegNotes || "Osservazioni da recuperare al ritorno."} />
          <PrintBox label="Punti forti avversario" value={match.opponentScouting?.strengths || "-"} />
          <PrintBox label="Dove attaccarli" value={match.opponentScouting?.weaknesses || "-"} />
        </div>
      </Section>
    </article>
  );
}

function PostMatchTemplate({ match, players }) {
  if (!match) return <EmptyPrint title="Nessuna partita disponibile" />;

  const report = match.postMatch || {};
  const videoClips = match.videoAnalysis || [];
  const positivePlayers = getPositivePlayersText(report.positivePlayers, players);
  const completion = getReportCompletion(report);

  return (
    <article>
      <PrintHeader
        eyebrow="Report post gara"
        title={match.title}
        meta={[formatDate(match.date), match.result || "Risultato da inserire", match.competition || "Gara"]}
      />

      <KpiGrid
        items={[
          { label: "Avversario", value: match.opponent || "-" },
          { label: "Risultato", value: match.result || "-" },
          { label: "Report staff", value: `${completion}%` },
          { label: "Clip video", value: videoClips.length },
        ]}
      />

      <Section title="Analisi tecnica">
        <div className="print-grid two">
          <PrintBox label="Cosa ha funzionato" value={report.worked || "-"} />
          <PrintBox label="Cosa migliorare" value={report.notWorked || "-"} />
          <PrintBox label="Momenti chiave" value={report.keyMoments || "-"} />
          <PrintBox label="Focus prossima settimana" value={report.nextWeekFocus || "-"} />
          <PrintBox label="Correzioni tattiche" value={report.tacticalCorrections || "-"} />
          <PrintBox label="Azioni in allenamento" value={report.trainingActions || "-"} />
        </div>
      </Section>

      <Section title="Giocatori e alert">
        <div className="print-grid two">
          <PrintBox label="Note positive" value={positivePlayers || "-"} />
          <PrintBox label="Alert fisici" value={report.physicalAlerts || "-"} />
        </div>
      </Section>

      <Section title="Palle inattive, video e staff">
        <div className="print-grid two">
          <PrintBox label="Review palle inattive" value={report.setPiecesReview || "-"} />
          <PrintBox label="Sintesi video" value={report.videoClips || "-"} />
          <PrintBox label="Lezioni sull'avversario" value={report.opponentLessons || "-"} />
          <PrintBox label="Decisioni staff" value={report.staffDecisions || "-"} />
        </div>
      </Section>

      {videoClips.length > 0 && (
        <Section title="Clip taggate">
          <table>
            <thead>
              <tr>
                <th>Minuto</th>
                <th>Categoria</th>
                <th>Fase</th>
                <th>Giocatore</th>
                <th>Nota</th>
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
  if (!player) return <EmptyPrint title="Nessun giocatore disponibile" />;

  const summary = getPlayerSummary(player, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const reference = getPhysicalReference(latestTest, appSettings.coachParameters);
  const activeInjuries = (player.injuries || []).filter((injury) => injury.status !== "rientrato" && !injury.endDate);
  const readiness = getReadinessScore(player, summary);

  return (
    <article>
      <PrintHeader
        eyebrow="Scheda giocatore"
        title={player.name}
        meta={[player.role || "Ruolo da definire", player.status || "Disponibile", player.shirtNumber ? `#${player.shirtNumber}` : ""]}
      />

      <KpiGrid
        items={[
          { label: "Presenze", value: summary.stats.presences },
          { label: "Minuti", value: summary.stats.minutes },
          { label: "Gol + assist", value: `${summary.stats.goals} + ${summary.stats.assists}` },
          { label: "Readiness", value: `${readiness}%` },
        ]}
      />

      <Section title="Profilo fisico">
        <div className="print-grid two">
          <PrintBox label="Ultimo test" value={latestTest ? formatShortDate(latestTest.date) : "Da testare"} />
          <PrintBox label="Gruppo lavoro" value={reference.group} />
          <PrintBox label="MAS stimata" value={reference.mas ? `${reference.mas} km/h` : "-"} />
          <PrintBox label="Indicazione" value={reference.intensity} />
        </div>
      </Section>

      <Section title="Metri riferimento">
        {reference.reps.length ? (
          <table>
            <thead>
              <tr>
                <th>Protocollo</th>
                <th>Metri</th>
                <th>Ripetizioni</th>
                <th>Serie</th>
                <th>Recupero</th>
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
          <p>Inserisci un test Gacon o Yo-Yo per calcolare i metri di riferimento.</p>
        )}
      </Section>

      <Section title="Storico recente">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Data</th>
              <th>Minuti</th>
              <th>RPE</th>
              <th>Status</th>
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
                <td colSpan="5">Nessun evento recente registrato.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Note staff">
        <div className="print-grid two">
          <PrintBox label="Obiettivo individuale" value={player.weeklyGoal || "-"} />
          <PrintBox label="Alert" value={summary.alerts.join(", ") || "-"} />
          <PrintBox label="Punti di forza" value={player.strengths || player.developmentNotes?.strengths || "-"} />
          <PrintBox label="Aree da migliorare" value={player.improvements || player.developmentNotes?.improvements || "-"} />
        </div>
      </Section>

      <Section title="Medico e prevenzione">
        <div className="print-grid two">
          <PrintBox
            label="Status medico"
            value={activeInjuries.length ? activeInjuries.map((injury) => injury.injuryType || injury.type || "Infortunio").join(", ") : player.status || "Disponibile"}
          />
          <PrintBox label="Note prevenzione" value={player.injuryNotes || player.preventionNotes || "-"} />
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

function RosterList({ title, players, roles, captainId }) {
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
                {roles?.[player.id] || player.role || "Ruolo"}
                {sameId(player.id, captainId) ? " · Capitano" : ""}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p>Nessun giocatore selezionato.</p>
      )}
    </div>
  );
}

function EmptyPrint({ title }) {
  return (
    <article>
      <PrintHeader eyebrow="Export" title={title} meta={["CalcioLab"]} />
      <p>Aggiungi dati nel modulo dedicato per generare questo documento.</p>
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
