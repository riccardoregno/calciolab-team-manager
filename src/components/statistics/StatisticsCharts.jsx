import AppCard from "../ui/AppCard";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    fontSize: 12,
    color: "#e2e8f0",
  },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

const sectionLabel = {
  margin: "0 0 12px",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
  color: "#475569",
};

export default function StatisticsCharts({ stats, history, selectedPlayer }) {
  const topScorers = [...stats]
    .filter((p) => p.goals > 0 || p.assists > 0)
    .sort((a, b) => b.goalContributions - a.goalContributions)
    .slice(0, 10)
    .map((p) => ({ name: p.name.split(" ")[0], goals: p.goals, assists: p.assists }));

  const minutesHistory = [...history]
    .filter((h) => h.minutes > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((h) => ({
      date: h.date?.slice(5),
      min: h.minutes,
    }));

  const attendanceData = [...stats]
    .filter((p) => p.trainingPct !== null)
    .sort((a, b) => b.trainingPct - a.trainingPct)
    .slice(0, 12)
    .map((p) => ({
      name: p.name.split(" ")[0],
      pct: p.trainingPct,
    }));

  if (topScorers.length === 0 && minutesHistory.length === 0 && attendanceData.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      {topScorers.length > 0 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Gol + Assist</p>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>Top marcatori stagione</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topScorers} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="goals" name="Gol" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
              <Bar dataKey="assists" name="Assist" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {minutesHistory.length > 1 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Minutaggio nel tempo</p>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>
            {selectedPlayer?.name || "Giocatore"} - minuti per evento
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={minutesHistory} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} min`, "Minuti"]} />
              <Line
                type="monotone"
                dataKey="min"
                stroke="#a78bfa"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#a78bfa" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {attendanceData.length > 0 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Presenze allenamenti</p>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>% partecipazione per giocatore</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Presenze"]} />
              <Bar dataKey="pct" name="% Presenze" radius={[4, 4, 0, 0]}>
                {attendanceData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.pct >= 80 ? "#22c55e" : entry.pct >= 60 ? "#fbbf24" : "#f87171"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}
    </div>
  );
}
