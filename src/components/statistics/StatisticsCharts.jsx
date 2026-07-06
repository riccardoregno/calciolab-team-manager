import AppCard from "../ui/AppCard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { normalizeRoleToGroup } from "../../utils/helpers";

/* ─── Tooltip style ─────────────────────────────────────────── */
const TT = {
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
  margin: "0 0 4px",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
  color: "#475569",
};

const cardTitle = {
  margin: "0 0 16px",
  fontSize: 15,
  lineHeight: 1.2,
};

/* ─── Helpers ────────────────────────────────────────────────── */

/** Normalizza il ruolo di un giocatore in 5 categorie */
function normalizeRole(role = "") {
  return normalizeRoleToGroup(role) || "Altro";
}

/**
 * Estrae W/D/L e gol da una stringa risultato come
 * "2-1", "Vittoria 2-1", "Pareggio 0-0", "Sconfitta 1-3", "1:2"
 * Restituisce { outcome: "W"|"D"|"L"|null, goalsFor: n, goalsAgainst: n }
 */
function parseResult(result = "") {
  const s = String(result).trim();
  if (!s) return { outcome: null, goalsFor: 0, goalsAgainst: 0 };

  const lower = s.toLowerCase();

  // Determina esito da parola chiave
  let outcome = null;
  if (lower.includes("vittoria") || lower.startsWith("v ") || lower === "v") outcome = "W";
  else if (lower.includes("pareggio") || lower.startsWith("p ") || lower === "p") outcome = "D";
  else if (lower.includes("sconfitta") || lower.startsWith("s ") || lower === "s") outcome = "L";

  // Cerca pattern score "X-Y" o "X:Y"
  const match = s.match(/(\d+)\s*[-:]\s*(\d+)/);
  let goalsFor = 0;
  let goalsAgainst = 0;

  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    goalsFor = a;
    goalsAgainst = b;
    // Se non abbiamo già l'esito dalle parole chiave, derivalo dai numeri
    if (!outcome) {
      if (a > b) outcome = "W";
      else if (a === b) outcome = "D";
      else outcome = "L";
    }
  }

  return { outcome, goalsFor, goalsAgainst };
}

/* ─── Componente principale ─────────────────────────────────── */
export default function StatisticsCharts({ stats, history, selectedPlayer, events = [], players = [] }) {

  /* ── Dati esistenti ── */
  const topScorers = [...stats]
    .filter((p) => p.goals > 0 || p.assists > 0)
    .sort((a, b) => b.goalContributions - a.goalContributions)
    .slice(0, 10)
    .map((p) => ({ name: p.name.split(" ")[0], goals: p.goals, assists: p.assists }));

  const minutesHistory = [...history]
    .filter((h) => h.minutes > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((h) => ({ date: h.date?.slice(5), min: h.minutes }));

  const attendanceData = [...stats]
    .filter((p) => p.trainingPct !== null)
    .sort((a, b) => b.trainingPct - a.trainingPct)
    .slice(0, 12)
    .map((p) => ({ name: p.name.split(" ")[0], pct: p.trainingPct }));

  /* ── Nuovo — Top minutaggio ── */
  const topMinutes = [...stats]
    .filter((p) => p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 12)
    .map((p) => ({ name: p.name.split(" ")[0], min: p.minutes }));

  /* ── Nuovo — Distribuzione ruoli ── */
  const roleMap = {};
  players.forEach((p) => {
    const cat = normalizeRole(p.role);
    roleMap[cat] = (roleMap[cat] || 0) + 1;
  });
  const roleData = Object.entries(roleMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const ROLE_COLORS = {
    Portieri: "#38bdf8",
    Difensori: "#4ade80",
    Centrocampisti: "#a78bfa",
    Attaccanti: "#f87171",
    Altro: "#64748b",
  };

  /* ── Nuovo — Andamento stagione + Gol fatti/subiti ── */
  const matchEvents = [...events]
    .filter((e) => e.type === "Partita" && e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const seasonTrend = matchEvents.reduce((acc, m, i) => {
    const { outcome, goalsFor, goalsAgainst } = parseResult(m.result);
    const pts = outcome === "W" ? 3 : outcome === "D" ? 1 : outcome === "L" ? 0 : null;
    const prev = acc[i - 1];
    const cumulativePoints = pts !== null
      ? (prev?.cumPts ?? 0) + pts
      : (prev?.cumPts ?? 0);
    acc.push({
      match: i + 1,
      label: m.opponent ? String(m.opponent).slice(0, 10) : `G${i + 1}`,
      outcome,
      pts,
      cumPts: pts !== null ? cumulativePoints : null,
      goalsFor,
      goalsAgainst,
    });
    return acc;
  }, []);

  const hasMatchData = seasonTrend.some((m) => m.outcome !== null);
  const hasGoalData  = seasonTrend.some((m) => m.goalsFor > 0 || m.goalsAgainst > 0);

  // Conteggio V/P/S
  const wdl = seasonTrend.reduce(
    (acc, m) => {
      if (m.outcome === "W") acc.w++;
      else if (m.outcome === "D") acc.d++;
      else if (m.outcome === "L") acc.l++;
      return acc;
    },
    { w: 0, d: 0, l: 0 }
  );

  const noCharts =
    topScorers.length === 0 &&
    minutesHistory.length === 0 &&
    attendanceData.length === 0 &&
    topMinutes.length === 0 &&
    roleData.length === 0 &&
    !hasMatchData;

  if (noCharts) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>

      {/* ── 1. Gol + Assist (top scorer) ── */}
      {topScorers.length > 0 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Gol + Assist</p>
          <h3 style={cardTitle}>Top marcatori stagione</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topScorers} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="goals" name="Gol" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
              <Bar dataKey="assists" name="Assist" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* ── 2. Minutaggio giocatore selezionato ── */}
      {minutesHistory.length > 1 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Minutaggio nel tempo</p>
          <h3 style={cardTitle}>{selectedPlayer?.name || "Giocatore"} — minuti per evento</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={minutesHistory} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...TT} formatter={(v) => [`${v} min`, "Minuti"]} />
              <Line type="monotone" dataKey="min" stroke="#a78bfa" strokeWidth={2.5}
                dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#a78bfa" }} />
            </LineChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* ── 3. Presenze allenamenti ── */}
      {attendanceData.length > 0 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Presenze allenamenti</p>
          <h3 style={cardTitle}>% partecipazione per giocatore</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip {...TT} formatter={(v) => [`${v}%`, "Presenze"]} />
              <Bar dataKey="pct" name="% Presenze" radius={[4, 4, 0, 0]}>
                {attendanceData.map((entry) => (
                  <Cell key={entry.name}
                    fill={entry.pct >= 80 ? "#22c55e" : entry.pct >= 60 ? "#fbbf24" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* ── 4. Top minutaggio squadra ── */}
      {topMinutes.length > 0 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Minutaggio squadra</p>
          <h3 style={cardTitle}>Chi gioca di più</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topMinutes} layout="vertical" margin={{ top: 0, right: 24, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip {...TT} formatter={(v) => [`${v} min`, "Minuti"]} />
              <Bar dataKey="min" name="Minuti" radius={[0, 4, 4, 0]}>
                {topMinutes.map((entry, i) => (
                  <Cell key={entry.name}
                    fill={i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#38bdf8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* ── 5. Distribuzione ruoli ── */}
      {roleData.length > 0 && players.length >= 3 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Rosa</p>
          <h3 style={cardTitle}>Distribuzione ruoli</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <ResponsiveContainer width={160} height={160} style={{ flexShrink: 0 }}>
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {roleData.map((entry) => (
                    <Cell key={entry.name} fill={ROLE_COLORS[entry.name] || "#64748b"} />
                  ))}
                </Pie>
                <Tooltip {...TT} formatter={(v, n) => [`${v} gioc.`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "grid", gap: 8, flex: 1 }}>
              {roleData.map((r) => (
                <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: ROLE_COLORS[r.name] || "#64748b",
                  }} />
                  <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{r.name}</span>
                  <strong style={{ fontSize: 13, color: "#e2e8f0" }}>{r.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </AppCard>
      )}

      {/* ── 6. Andamento stagione (punti cumulativi + W/D/L) ── */}
      {hasMatchData && seasonTrend.length >= 2 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Andamento stagione</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.2 }}>Punti cumulativi</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <ResultChip label="V" count={wdl.w} color="#22c55e" />
              <ResultChip label="P" count={wdl.d} color="#fbbf24" />
              <ResultChip label="S" count={wdl.l} color="#f87171" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={seasonTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...TT}
                formatter={(v, name) => [v, name === "cumPts" ? "Punti tot." : name]}
                labelFormatter={(l) => `vs ${l}`}
              />
              <Area type="monotone" dataKey="cumPts" name="cumPts"
                stroke="#38bdf8" strokeWidth={2.5}
                fill="url(#ptGrad)"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const color = payload.outcome === "W" ? "#22c55e" : payload.outcome === "D" ? "#fbbf24" : payload.outcome === "L" ? "#f87171" : "#64748b";
                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={color} stroke="#0f172a" strokeWidth={2} />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </AppCard>
      )}

      {/* ── 7. Gol fatti vs subiti ── */}
      {hasGoalData && seasonTrend.length >= 2 && (
        <AppCard style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={sectionLabel}>Rendimento offensivo/difensivo</p>
          <h3 style={cardTitle}>Gol fatti vs subiti per partita</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seasonTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...TT} labelFormatter={(l) => `vs ${l}`} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="goalsFor" name="Gol fatti" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar dataKey="goalsAgainst" name="Gol subiti" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AppCard>
      )}

    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */
function ResultChip({ label, count, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900,
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {label} <span style={{ fontSize: 14 }}>{count}</span>
    </span>
  );
}
