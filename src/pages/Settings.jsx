import AppCard from "../components/ui/AppCard";
import PageHeader from "../components/ui/PageHeader";
import Badge from "../components/ui/Badge";
import AuthPanel from "../components/auth/AuthPanel";
import { styles } from "../styles/index.js";

export default function Settings({
  authConfigured,
  authLoading,
  user,
  team,
  authError,
  storageSource,
}) {
  return (
    <div>
      <PageHeader
        title="Impostazioni"
        subtitle="Configura identità squadra, profilo coach e preferenze della piattaforma."
      />

      <div style={styles.grid2}>
        <AuthPanel
          authConfigured={authConfigured}
          authLoading={authLoading}
          user={user}
          team={team}
          authError={authError}
        />

        <AppCard>
          <h3 style={styles.cardTitle}>Profilo Coach</h3>

          <div style={settingsStyles.profileBox}>
            <div style={settingsStyles.avatar}>C</div>

            <div>
              <h2 style={settingsStyles.name}>Coach</h2>
              <p style={settingsStyles.role}>Allenatore principale</p>
            </div>
          </div>

          <div style={settingsStyles.infoGrid}>
            <Info label="Nome" value={user?.email || "Coach"} />
            <Info label="Ruolo" value="Head Coach" />
            <Info label="Licenza" value="UEFA B" />
            <Info
              label="Modalità"
              value={storageSource === "supabase" ? "Cloud workspace" : "Locale"}
            />
          </div>
        </AppCard>

        <AppCard>
          <h3 style={styles.cardTitle}>Squadra</h3>

          <div style={settingsStyles.infoGrid}>
            <Info label="Nome squadra" value={team?.name || "CalcioLab Team"} />
            <Info label="Categoria" value={team?.category || "Prima squadra"} />
            <Info label="Stagione" value={team?.season || "2025/2026"} />
            <Info label="Modulo base" value="4-2-3-1" />
          </div>

          <div style={settingsStyles.badges}>
            <Badge variant="blue">Gestione rosa</Badge>
            <Badge variant="green">Allenamenti</Badge>
            <Badge variant="purple">Analytics</Badge>
          </div>
        </AppCard>
      </div>

      <AppCard>
        <h3 style={styles.cardTitle}>Roadmap piattaforma</h3>

        <div style={settingsStyles.roadmap}>
          <RoadmapItem title="Cloud sync" text="Attivo con Supabase e fallback locale automatico." />
          <RoadmapItem title="Multi team" text="Base dati pronta con teams e team_members." />
          <RoadmapItem title="Export PDF" text="Prossimo step per sedute, distinta e match plan." />
          <RoadmapItem title="Staff roles" text="Estendere permessi per coach, preparatore e osservatore." />
        </div>
      </AppCard>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={settingsStyles.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoadmapItem({ title, text }) {
  return (
    <div style={settingsStyles.roadmapItem}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

const settingsStyles = {
  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#052e16",
    fontSize: 26,
    fontWeight: 950,
  },

  name: {
    margin: 0,
    color: "white",
    fontSize: 22,
  },

  role: {
    margin: "5px 0 0",
    color: "#94a3b8",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },

  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#94a3b8",
    fontSize: 12,
  },

  badges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 18,
  },

  roadmap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  roadmapItem: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#94a3b8",
  },
};
