import { useEffect, useState } from "react";
import { CalendarDays, ClipboardCheck, FileText, Pause, Play, RotateCcw } from "lucide-react";
import { CALCIOLAB_MARK_URL } from "../../constants/branding.js";
import "./weekly-workflow-demo.css";

const DURATION = 40;
const STEPS = [
  { start: 0, title: "Pianifica la seduta", view: "Sedute", icon: CalendarDays, Example: SessionExample,
    description: "Imposta orario e obiettivo. Lo staff trova il programma nel calendario della squadra." },
  { start: 13, title: "Registra le presenze", view: "Registro presenze", icon: ClipboardCheck, Example: AttendanceExample,
    description: "Segna chi si è allenato, chi era in recupero e chi era assente." },
  { start: 26, title: "Rileggi la gara", view: "Report gara", icon: FileText, Example: MatchExample,
    description: "Rivedi risultato, formazione e minutaggio prima di preparare la prossima seduta." },
];

const ATTENDANCE = [
  { name: "Luca Riva", status: "Presente", style: "positive" },
  { name: "Marco Serra", status: "In recupero", style: "caution" },
  { name: "Andrea Costa", status: "Assente", style: "neutral" },
];

export default function WeeklyWorkflowDemo() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const active = playing && elapsed < DURATION;
  const current = STEPS.reduce((selected, step) => step.start <= elapsed ? step : selected, STEPS[0]);
  const { Example } = current;

  useEffect(() => {
    if (!active) return undefined;
    const interval = window.setInterval(() => setElapsed((seconds) => Math.min(seconds + 1, DURATION)), 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  function togglePlayback() {
    if (elapsed === DURATION) setElapsed(0);
    setPlaying(!active);
  }

  function selectStep(start) {
    setPlaying(false);
    setElapsed(start);
  }

  const PlaybackIcon = active ? Pause : elapsed === DURATION ? RotateCcw : Play;
  const playbackLabel = active ? "Pausa" : elapsed === DURATION ? "Rivedi la demo" : elapsed ? "Riprendi la demo" : "Avvia la demo";

  return (
    <section id="demo" className="cl-demo" aria-labelledby="cl-demo-title">
      <div className="cl-demo-heading">
        <h2 id="cl-demo-title">Una settimana con CalcioLab</h2>
        <p>40 secondi, con una squadra fittizia.</p>
      </div>
      <div className="cl-demo-layout">
        <div className="cl-demo-screen">
          <div className="cl-demo-bar">
            <img src={CALCIOLAB_MARK_URL} alt="" width="24" height="24" />
            <strong>CalcioLab</strong>
            <span>Squadra demo</span>
          </div>
          <div className="cl-demo-content" aria-live="polite">
            <h3>{current.view}</h3>
            <p className="cl-demo-description">{current.description}</p>
            <Example />
          </div>
        </div>
        <ol className="cl-demo-steps" aria-label="Passaggi della demo">
          {STEPS.map(({ start, title, icon: Icon }) => (
            <li key={start}>
              <button type="button" aria-current={current.start === start ? "step" : undefined} onClick={() => selectStep(start)}>
                <Icon size={18} aria-hidden="true" /> {title}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="cl-demo-controls">
        <button type="button" onClick={togglePlayback}><PlaybackIcon size={16} aria-hidden="true" /> {playbackLabel}</button>
        <progress value={elapsed} max={DURATION} aria-label="Avanzamento della demo" />
        <span aria-hidden="true">0:{String(elapsed).padStart(2, "0")} / 0:40</span>
      </div>
    </section>
  );
}

function SessionExample() {
  return (
    <div className="cl-demo-example">
      <div className="cl-demo-example-header"><strong>Possesso e riaggressione</strong><span className="cl-demo-status positive">In programma</span></div>
      <dl className="cl-demo-data">
        <div><dt>Quando</dt><dd>Martedì · 19:30</dd></div>
        <div><dt>Dove</dt><dd>Campo A</dd></div>
        <div><dt>Durata</dt><dd>90 min</dd></div>
      </dl>
    </div>
  );
}

function AttendanceExample() {
  return (
    <ul className="cl-demo-example cl-demo-list" aria-label="Presenze di esempio">
      {ATTENDANCE.map(({ name, status, style }) => (
        <li key={name}><strong>{name}</strong><span className={`cl-demo-status ${style}`}>{status}</span></li>
      ))}
    </ul>
  );
}

function MatchExample() {
  return (
    <div className="cl-demo-example">
      <div className="cl-demo-example-header"><strong>Squadra demo – Ospiti</strong><span className="cl-demo-score">2–1</span></div>
      <dl className="cl-demo-data">
        <div><dt>Formazione</dt><dd>4–3–3</dd></div>
        <div><dt>Luca Riva</dt><dd>90 min</dd></div>
        <div><dt>Marco Serra</dt><dd>25 min</dd></div>
      </dl>
    </div>
  );
}
