import { useMemo, useState } from "react";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import {
  formatDate,
  formatShortDate,
  getLineup,
  getPhysicalReference,
  getPlayerSummary,
} from "../utils/helpers";

const exportTypes = [
  { id: "training", label: "Seduta", description: "Piano campo pronto da stampare" },
  { id: "matchday", label: "Match Day", description: "Distinta, ruoli e scouting avversario" },
  { id: "postmatch", label: "Post gara", description: "Report tecnico e focus settimana" },
  { id: "player", label: "Scheda giocatore", description: "Dati individuali, test e carico" },
];

export default function ExportCenter({
  players = [],
  sessions = [],
  matches = [],
  exercises = [],
  physicalTests = [],
  appSettings = {},
}) {
  const [type, setType] = useState("training");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

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
        title="Export Center"
        subtitle="Template professionali per consegnare sedute, gara, report e schede giocatore in PDF."
        action={
          <Button onClick={() => window.print()}>
            Stampa / salva PDF
          </Button>
        }
      />

      <div className="export-workspace" style={pageStyles.workspace}>
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

            {(type === "matchday" || type === "postmatch") && (
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
                <th>Ruolo</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {opponentLineup.map((item, index) => (
                <tr key={`${item.name || "opponent"}-${index}`}>
                  <td>{item.number || "-"}</td>
                  <td>{item.name || "-"}</td>
                  <td>{item.role || "-"}</td>
                  <td>{item.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Nessuna distinta avversaria registrata.</p>
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
  const positivePlayers = (report.positivePlayers || [])
    .map((id) => findPlayer(players, id)?.name)
    .filter(Boolean);

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
          { label: "Minuti analizzati", value: report.keyMoments ? "Completo" : "Da completare" },
          { label: "Giocatori evidenziati", value: positivePlayers.length },
        ]}
      />

      <Section title="Analisi tecnica">
        <div className="print-grid two">
          <PrintBox label="Cosa ha funzionato" value={report.worked || "-"} />
          <PrintBox label="Cosa migliorare" value={report.notWorked || "-"} />
          <PrintBox label="Momenti chiave" value={report.keyMoments || "-"} />
          <PrintBox label="Focus prossima settimana" value={report.nextWeekFocus || "-"} />
        </div>
      </Section>

      <Section title="Giocatori e alert">
        <div className="print-grid two">
          <PrintBox label="Note positive" value={positivePlayers.join(", ") || "-"} />
          <PrintBox label="Alert fisici" value={report.physicalAlerts || "-"} />
        </div>
      </Section>
    </article>
  );
}

function PlayerTemplate({ player, sessions, matches, physicalTests, appSettings }) {
  if (!player) return <EmptyPrint title="Nessun giocatore disponibile" />;

  const summary = getPlayerSummary(player, { sessions, matches, physicalTests });
  const latestTest = summary.latestTests[0];
  const reference = getPhysicalReference(latestTest, appSettings.coachParameters);

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
          { label: "Carico", value: summary.stats.load },
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
