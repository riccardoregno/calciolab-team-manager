import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { styles } from "../styles/index.js";
import { formatDate } from "../utils/helpers";

export default function PostMatch({ matches = [], setMatches }) {
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

  if (!match) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <PageHeader
          title="Post Gara"
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
  const subtitle = [formatDate(match.date), match.location, match.result]
    .filter(Boolean)
    .join(" · ");

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
          title="🎯 Focus prossima settimana"
          placeholder="Cosa lavorare nelle prossime sedute sulla base di questa partita..."
          value={report.nextWeekFocus}
          onChange={(v) => updateReport("nextWeekFocus", v)}
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
      </div>

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
