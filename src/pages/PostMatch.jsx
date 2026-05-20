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

const clipCategories = ["Tattica", "Tecnica", "Fisico", "Palla inattiva", "Errore", "Occasione", "Transizione"];
const clipPhases = ["Possesso", "Non possesso", "Transizione +", "Transizione -", "Corner", "Punizione", "Rimessa", "Rigore"];
const clipAudiences = ["Staff", "Squadra", "Individuale", "Reparto"];

export default function PostMatch({
  matches = [], setMatches, players = [], setStaffTasks }) {

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
        title: "Preparare seduta post-gara",
        description: report.trainingActions || report.nextWeekFocus,
        ownerRole: "headCoach",
        priority: "high",
      },
      {
        title: "Correzione tattica da condividere",
        description: report.tacticalCorrections || report.notWorked,
        ownerRole: "assistantCoach",
        priority: "high",
      },
      {
        title: "Verificare alert fisici",
        description: report.physicalAlerts,
        ownerRole: "athleticTrainer",
        priority: "high",
      },
      {
        title: "Rivedere palle inattive",
        description: report.setPiecesReview,
        ownerRole: "assistantCoach",
        priority: "medium",
      },
      {
        title: "Preparare clip video",
        description: buildVideoTaskDescription(match.videoAnalysis || []),
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
          description: `${task.description}\n\nOrigine: ${match.title || match.opponent || "Post gara"}`,
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

  if (!match) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <PageHeader
          title={t("pages.postMatch.title")}
          subtitle="Analisi gara e focus settimana successiva"
        />
        <AppCard>
          <p style={s.muted}>Partita non trovata.</p>
          <Button variant="ghost" onClick={() => navigate("/matches")} style={{ marginTop: 12 }}>
            Torna alle partite
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
    { key: "worked", label: "Cosa ha funzionato" },
    { key: "notWorked", label: "Cosa non ha funzionato" },
    { key: "keyMoments", label: "Episodi chiave" },
    { key: "tacticalCorrections", label: "Correzioni tattiche" },
    { key: "nextWeekFocus", label: "Focus prossima settimana" },
    { key: "trainingActions", label: "Azioni in allenamento" },
    { key: "positivePlayers", label: "Giocatori positivi" },
    { key: "physicalAlerts", label: "Alert fisici" },
    { key: "setPiecesReview", label: "Palle inattive" },
    { key: "opponentLessons", label: "Lezioni sull'avversario" },
    { key: "videoAnalysis", label: "Clip video" },
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

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <PageHeader
        title={`Post Gara — ${match.opponent || "Partita"}`}
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
          ✓ Modifiche salvate automaticamente
        </div>
      )}

      {/* Intestazione partita */}
      <AppCard>
        <div style={s.matchHead}>
          <div>
            <Badge tone="orange">Report post partita</Badge>
            <h2 style={{ margin: "10px 0 4px", lineHeight: 1.15 }}>
              {match.title || `CalcioLab vs ${match.opponent}`}
            </h2>
            <p style={s.muted}>{subtitle}</p>
          </div>

          <div style={s.resultBox}>
            <span style={s.resultLabel}>Risultato</span>
            <strong style={s.resultValue}>{match.result || "—"}</strong>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <div style={s.reportHead}>
          <div>
            <p style={s.eyebrow}>Report staff</p>
            <h3 style={s.reportTitle}>Analisi operativa post gara</h3>
            <p style={s.muted}>
              Trasforma la partita in correzioni, sedute e focus individuali per il microciclo successivo.
            </p>
          </div>
          <div style={s.completionBox}>
            <strong>{completion}%</strong>
            <span>{completedSections.length}/{reportSections.length} sezioni</span>
          </div>
        </div>

        <div style={s.progressTrack}>
          <span style={{ ...s.progressFill, width: `${completion}%` }} />
        </div>

        <div style={s.summaryGrid}>
          <SummaryCard
            title="Priorita staff"
            value={report.nextWeekFocus || report.notWorked || "Da definire"}
          />
          <SummaryCard
            title="Correzione principale"
            value={report.tacticalCorrections || report.trainingActions || "Da collegare alle sedute"}
          />
          <SummaryCard
            title="Alert immediati"
            value={report.physicalAlerts || "Nessun alert fisico inserito"}
          />
          <SummaryCard
            title="Clip taggate"
            value={videoAnalysis.length ? `${videoAnalysis.length} clip collegate` : "Nessuna clip taggata"}
          />
        </div>

        <div style={s.actionRow}>
          <Button variant="ghost" onClick={() => navigate(`/match-stats/${match.id}`)}>Statistiche</Button>
          <Button variant="ghost" onClick={() => navigate(`/match-day/${match.id}`)}>Match Day</Button>
          <Button variant="ghost" onClick={() => navigate("/microcycle")}>Microciclo</Button>
          <Button variant="ghost" onClick={createStaffTasksFromReport}>Crea azioni staff</Button>
          <Button onClick={() => navigate("/trainings")}>Crea seduta</Button>
        </div>

        {openSections.length > 0 && (
          <div style={s.todoStrip}>
            {openSections.slice(0, 4).map((section) => (
              <span key={section.key}>Da completare: {section.label}</span>
            ))}
          </div>
        )}
      </AppCard>

      {/* Griglia analisi */}
      <div style={s.grid}>
        <TextBlock
          title="✅ Cosa ha funzionato"
          placeholder="Principi rispettati, prestazioni positive, schemi riusciti..."
          value={report.worked}
          onChange={(v) => updateReport("worked", v)}
        />
        <TextBlock
          title="❌ Cosa non ha funzionato"
          placeholder="Errori strutturali, fasi difficili, pressing subito..."
          value={report.notWorked}
          onChange={(v) => updateReport("notWorked", v)}
        />
        <TextBlock
          title="⚡ Episodi chiave"
          placeholder="Gol, espulsioni, cambi decisivi, svolta tattica..."
          value={report.keyMoments}
          onChange={(v) => updateReport("keyMoments", v)}
        />
        <TextBlock
          title="🧠 Correzioni tattiche"
          placeholder="Cosa correggere: pressioni, distanze, uscite, preventive, reparto..."
          value={report.tacticalCorrections}
          onChange={(v) => updateReport("tacticalCorrections", v)}
        />
        <TextBlock
          title="🎯 Focus prossima settimana"
          placeholder="Cosa lavorare nelle prossime sedute sulla base di questa partita..."
          value={report.nextWeekFocus}
          onChange={(v) => updateReport("nextWeekFocus", v)}
        />
        <TextBlock
          title="📋 Azioni in allenamento"
          placeholder="Esercitazioni da preparare, reparti coinvolti, priorita del microciclo..."
          value={report.trainingActions}
          onChange={(v) => updateReport("trainingActions", v)}
        />
        <TextBlock
          title="⭐ Giocatori positivi"
          placeholder="Chi ha fatto bene e perché — da valorizzare o comunicare..."
          value={report.positivePlayers}
          onChange={(v) => updateReport("positivePlayers", v)}
        />
        <TextBlock
          title="🏃 Alert fisici"
          placeholder="Affaticamenti, minutaggi critici, giocatori a rischio stop..."
          value={report.physicalAlerts}
          onChange={(v) => updateReport("physicalAlerts", v)}
        />
        <TextBlock
          title="📐 Palle inattive"
          placeholder="Schemi riusciti, marcature da correggere, corner/punizioni da rivedere..."
          value={report.setPiecesReview}
          onChange={(v) => updateReport("setPiecesReview", v)}
        />
        <TextBlock
          title="🕵️ Lezioni sull'avversario"
          placeholder="Informazioni utili per ritorno, playoff o prossima sfida simile..."
          value={report.opponentLessons}
          onChange={(v) => updateReport("opponentLessons", v)}
        />
        <TextBlock
          title="✅ Decisioni staff"
          placeholder="Decisioni finali: comunicazioni, gestione rosa, recuperi, contenuti sedute..."
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
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>Cambia partita</h3>
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
          <p style={s.eyebrow}>Video analysis</p>
          <h3 style={s.reportTitle}>Clip taggate e collegate al report</h3>
          <p style={s.muted}>
            Registra minuto, fase, giocatore e link video. Le clip restano dentro la partita e finiscono nel PDF post gara.
          </p>
        </div>
        <div style={s.clipCounter}>
          <strong>{clips.length}</strong>
          <span>clip</span>
        </div>
      </div>

      <div style={s.clipForm}>
        <input
          placeholder="Min."
          value={draft.minute}
          onChange={(event) => updateDraft("minute", event.target.value.replace(/[^\d+:.-]/g, ""))}
          style={s.smallInput}
        />
        <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} style={styles.input}>
          {clipCategories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={draft.phase} onChange={(event) => updateDraft("phase", event.target.value)} style={styles.input}>
          {clipPhases.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={draft.playerId} onChange={(event) => updateDraft("playerId", event.target.value)} style={styles.input}>
          <option value="">Giocatore</option>
          {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
        <select value={draft.audience} onChange={(event) => updateDraft("audience", event.target.value)} style={styles.input}>
          {clipAudiences.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input
          placeholder="Link video"
          value={draft.url}
          onChange={(event) => updateDraft("url", event.target.value)}
          style={styles.input}
        />
        <input
          placeholder="Tag: pressing, uscita, transizione..."
          value={draft.tags}
          onChange={(event) => updateDraft("tags", event.target.value)}
          style={styles.input}
        />
        <input
          placeholder="Nota tecnica"
          value={draft.note}
          onChange={(event) => updateDraft("note", event.target.value)}
          style={styles.input}
        />
        <Button onClick={addClip}>Aggiungi clip</Button>
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
                  {clipCategories.map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={clip.phase} onChange={(event) => updateClip(clip.id, "phase", event.target.value)} style={styles.input}>
                  {clipPhases.map((item) => <option key={item}>{item}</option>)}
                </select>
                <div style={s.clipText}>
                  <strong>{player?.name || "Nessun giocatore"}</strong>
                  <span>{clip.tags || clip.note || "Clip senza tag"}</span>
                  {clip.url && (
                    <a href={clip.url} target="_blank" rel="noreferrer" style={s.clipLink}>
                      Apri video
                    </a>
                  )}
                </div>
                <select value={clip.playerId} onChange={(event) => updateClip(clip.id, "playerId", event.target.value)} style={styles.input}>
                  <option value="">Giocatore</option>
                  {players.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={clip.audience} onChange={(event) => updateClip(clip.id, "audience", event.target.value)} style={styles.input}>
                  {clipAudiences.map((item) => <option key={item}>{item}</option>)}
                </select>
                <Button variant="danger" onClick={() => deleteClip(clip.id)}>Elimina</Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={s.emptyClipBox}>
          Nessuna clip taggata. Aggiungi le azioni da mostrare allo staff, alla squadra o al singolo giocatore.
        </div>
      )}

      {clips.length > 0 && (
        <div style={s.actionRow}>
          <Button variant="ghost" onClick={syncReportNotes}>Copia sintesi nelle note video</Button>
        </div>
      )}
    </AppCard>
  );
}

function getEmptyClip() {
  return {
    minute: "",
    category: "Tattica",
    phase: "Possesso",
    playerId: "",
    audience: "Staff",
    url: "",
    tags: "",
    note: "",
  };
}

function buildVideoTaskDescription(clips) {
  if (!clips.length) return "";
  const individualCount = clips.filter((clip) => clip.audience === "Individuale" || clip.playerId).length;
  const staffCount = clips.length - individualCount;
  return [
    `${clips.length} clip da organizzare per restituzione video.`,
    individualCount ? `${individualCount} clip individuali da inviare o discutere.` : "",
    staffCount ? `${staffCount} clip staff/reparto da sintetizzare.` : "",
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
  summaryCard: {
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 8,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
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
