import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { normalizeAppSettings } from "../utils/helpers";

const widgetLabels = {
  hero: "Introduzione operativa",
  nextEvent: "Prossimo evento",
  kpis: "KPI principali",
  weekFocus: "Focus settimana",
  rosterStatus: "Stato rosa",
  coachAlerts: "Alert coach",
  recentActivities: "Ultime attivita",
  quickActions: "Azioni rapide",
  rewardCenter: "Reward e piano",
};

export default function CoachSettings({ appSettings, setAppSettings }) {
  const settings = normalizeAppSettings(appSettings);
  const parameters = settings.coachParameters;

  function updateParameters(patch) {
    setAppSettings({
      ...settings,
      coachParameters: {
        ...parameters,
        ...patch,
      },
    });
  }

  function updateWidget(key, value) {
    setAppSettings({
      ...settings,
      dashboardWidgets: {
        ...settings.dashboardWidgets,
        [key]: value,
      },
    });
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Parametri Coach"
        subtitle="Personalizza preparazione, soglie fisiche e dashboard iniziale"
      />

      <div style={coachStyles.grid}>
        <AppCard>
          <h3 style={{ marginTop: 0 }}>Parametri preparatore</h3>
          <div style={coachStyles.formGrid}>
            <label style={coachStyles.label}>
              Categoria
              <select value={parameters.category} onChange={(event) => updateParameters({ category: event.target.value })} style={styles.input}>
                <option value="adulti">Adulti</option>
                <option value="juniores">Juniores</option>
                <option value="allievi">Allievi</option>
                <option value="giovanissimi">Giovanissimi</option>
              </select>
            </label>
            <label style={coachStyles.label}>
              Metodo
              <select value={parameters.method} onChange={(event) => updateParameters({ method: event.target.value })} style={styles.input}>
                <option value="prudente">Prudente</option>
                <option value="standard">Standard</option>
                <option value="aggressivo">Aggressivo</option>
              </select>
            </label>
            <NumberField label="Soglia gruppo A" value={parameters.groupA} onChange={(value) => updateParameters({ groupA: value })} />
            <NumberField label="Soglia gruppo B" value={parameters.groupB} onChange={(value) => updateParameters({ groupB: value })} />
            <NumberField label="Soglia gruppo C" value={parameters.groupC} onChange={(value) => updateParameters({ groupC: value })} />
          </div>
          <Badge tone="blue">Le soglie modificano Test fisici e Lavori fisici</Badge>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0 }}>Dashboard iniziale</h3>
          <div style={coachStyles.widgetList}>
            {Object.entries(widgetLabels).map(([key, label]) => (
              <label key={key} style={coachStyles.widgetRow}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={settings.dashboardWidgets[key]}
                  onChange={(event) => updateWidget(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </AppCard>
      </div>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>Blocchi lavoro fisico</h3>
        <div style={coachStyles.blocks}>
          {parameters.workBlocks.map((block) => (
            <div key={block.label} style={coachStyles.block}>
              <strong>{block.label}</strong>
              <span>{block.seconds}s · {Math.round(block.percent * 100)}% MAS · {block.reps} reps · {block.sets} serie</span>
              <span>{block.recovery}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={() => alert("Editor avanzato blocchi in arrivo")}>
          Personalizza blocchi
        </Button>
      </AppCard>
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label style={coachStyles.label}>
      {label}
      <input type="number" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} style={styles.input} />
    </label>
  );
}

const coachStyles = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start", marginBottom: 22 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 },
  label: { color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  widgetList: { display: "grid", gap: 10 },
  widgetRow: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  blocks: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16 },
  block: { display: "grid", gap: 6, padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
};
