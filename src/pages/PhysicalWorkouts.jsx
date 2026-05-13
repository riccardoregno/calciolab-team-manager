import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import PageHeader from "../components/ui/PageHeader";
import { generatePhysicalWorkout, normalizeAppSettings } from "../utils/helpers";

export default function PhysicalWorkouts({ players = [], physicalTests = [], appSettings }) {
  const settings = normalizeAppSettings(appSettings);
  const rows = generatePhysicalWorkout(players, physicalTests, settings.coachParameters);

  return (
    <div>
      <PageHeader
        title="Lavori fisici"
        subtitle="Proposte operative per gruppi, metri, ripetizioni e recuperi"
      />

      <div style={workoutStyles.grid}>
        {rows.map(({ player, reference }) => (
          <AppCard key={player.id}>
            <div style={workoutStyles.header}>
              <div>
                <h3 style={{ margin: 0 }}>{player.name}</h3>
                <p style={workoutStyles.muted}>{player.role || "Ruolo"} · {reference.intensity}</p>
              </div>
              <Badge tone={reference.group === "Gruppo A" ? "green" : reference.group === "Gruppo D" ? "red" : "blue"}>
                {reference.group}
              </Badge>
            </div>

            {reference.mas ? (
              <div style={workoutStyles.repList}>
                <strong>MAS {reference.mas} km/h</strong>
                {reference.reps.map((rep) => (
                  <div key={rep.label} style={workoutStyles.rep}>
                    <span>{rep.label}</span>
                    <strong>{rep.meters}m</strong>
                    <small>{rep.reps} reps · {rep.sets} serie · {rep.recovery}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p style={workoutStyles.muted}>Serve un test Gacon o Yo-Yo per generare il lavoro.</p>
            )}
          </AppCard>
        ))}
      </div>
    </div>
  );
}

const workoutStyles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  muted: { color: "#94a3b8", margin: "6px 0 0" },
  repList: { display: "grid", gap: 10 },
  rep: { display: "grid", gap: 4, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
};

