import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";

export default function PostMatch({ matches = [], setMatches }) {
  const match = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  function updateReport(field, value) {
    if (!match) return;

    setMatches(
      matches.map((item) =>
        item.id === match.id
          ? { ...item, postMatch: { ...(item.postMatch || {}), [field]: value } }
          : item
      )
    );
  }

  if (!match) {
    return (
      <div>
        <PageHeader title="Report Post Partita" subtitle="Analisi gara e focus settimana successiva" />
        <AppCard><p style={postStyles.muted}>Crea una partita per compilare il report.</p></AppCard>
      </div>
    );
  }

  const report = match.postMatch || {};

  return (
    <div>
      <PageHeader title="Report Post Partita" subtitle="Chiudi il ciclo partita, analisi, settimana e sedute" />

      <AppCard>
        <Badge tone="orange">{match.title}</Badge>
        <h2 style={{ marginBottom: 0 }}>{match.result || "Risultato da inserire"}</h2>
      </AppCard>

      <div style={postStyles.grid}>
        <TextBlock title="Cosa ha funzionato" value={report.worked} onChange={(value) => updateReport("worked", value)} />
        <TextBlock title="Cosa non ha funzionato" value={report.notWorked} onChange={(value) => updateReport("notWorked", value)} />
        <TextBlock title="Episodi chiave" value={report.keyMoments} onChange={(value) => updateReport("keyMoments", value)} />
        <TextBlock title="Focus prossima settimana" value={report.nextWeekFocus} onChange={(value) => updateReport("nextWeekFocus", value)} />
        <TextBlock title="Giocatori positivi" value={report.positivePlayers} onChange={(value) => updateReport("positivePlayers", value)} />
        <TextBlock title="Alert fisici" value={report.physicalAlerts} onChange={(value) => updateReport("physicalAlerts", value)} />
      </div>
    </div>
  );
}

function TextBlock({ title, value = "", onChange }) {
  return (
    <AppCard>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} style={{ ...styles.input, minHeight: 130, resize: "vertical" }} />
    </AppCard>
  );
}

const postStyles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginTop: 18 },
  muted: { color: "#94a3b8" },
};

