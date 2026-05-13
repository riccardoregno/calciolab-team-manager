import { useMemo, useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";

import { formatDate } from "../utils/helpers";
import { styles } from "../styles/index.js";

function Statistics({ events, players }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || "");
  const [eventType, setEventType] = useState("Tutti");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const effectiveSelectedPlayerId = selectedPlayerId || players[0]?.id || "";

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesType = eventType === "Tutti" || event.type === eventType;
      const afterStart = !fromDate || event.date >= fromDate;
      const beforeEnd = !toDate || event.date <= toDate;

      return matchesType && afterStart && beforeEnd;
    });
  }, [events, eventType, fromDate, toDate]);

  const stats = useMemo(
    () => getStatsSummary(filteredEvents, players),
    [filteredEvents, players]
  );

  const selectedPlayer = players.find(
    (p) => String(p.id) === String(effectiveSelectedPlayerId)
  );

  const selectedStats = stats.find(
    (s) => String(s.id) === String(effectiveSelectedPlayerId)
  );

  const history = getPlayerHistory(filteredEvents, selectedPlayer);

  const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0];
  const mostMinutes = [...stats].sort((a, b) => b.minutes - a.minutes)[0];

  if (players.length === 0) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Statistiche"
          subtitle="Database stagione e rendimento giocatori"
        />

        <EmptyState
          icon="📊"
          title="Nessun dato disponibile"
          text="Aggiungi giocatori ed eventi per iniziare a generare statistiche."
        />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Statistiche"
        subtitle="Analizza rendimento, minutaggio e storico stagione"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <KpiCard label="Eventi" value={filteredEvents.length} icon="📅" />
        <KpiCard label="Giocatori" value={players.length} icon="👥" />
        <KpiCard label="Gol top" value={topScorer?.goals || 0} icon="⚽" />
        <KpiCard label="Minuti top" value={mostMinutes?.minutes || 0} icon="⏱️" />
      </div>

      <AppCard>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 14,
            alignItems: "end",
          }}
        >
          <label style={filterLabelStyle}>
            Tipo evento
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              style={styles.input}
            >
              <option>Tutti</option>
              <option>Allenamento</option>
              <option>Partita</option>
            </select>
          </label>

          <label style={filterLabelStyle}>
            Dal
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={filterLabelStyle}>
            Al
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={filterLabelStyle}>
            Giocatore
            <select
                  value={effectiveSelectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              style={styles.input}
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </AppCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.8fr",
          gap: 24,
          alignItems: "start",
          marginTop: 24,
        }}
      >
        <AppCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Riepilogo giocatori</h3>
              <p style={{ color: "#94a3b8", marginBottom: 0 }}>
                Presenze, minuti, gol, assist e disciplina
              </p>
            </div>

            <Badge tone="purple">Live database</Badge>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={tableStyle}>
              <div style={headerStyle}>
                <span>Giocatore</span>
                <span>Pres.</span>
                <span>Ass.</span>
                <span>Inf.</span>
                <span>Min</span>
                <span>Media</span>
                <span>Gol</span>
                <span>Ass.</span>
                <span>Amm.</span>
                <span>Esp.</span>
              </div>

              {stats.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedPlayerId(row.id)}
                  style={{
                    ...rowStyle,
                    background:
                      String(selectedPlayerId) === String(row.id)
                        ? "rgba(56,189,248,0.14)"
                        : "rgba(255,255,255,0.035)",
                    border:
                      String(selectedPlayerId) === String(row.id)
                        ? "1px solid rgba(56,189,248,0.35)"
                        : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <strong>{row.name}</strong>
                  <span>{row.presences}</span>
                  <span>{row.absences}</span>
                  <span>{row.injuries}</span>
                  <span>{row.minutes}</span>
                  <span>
                    {row.presences ? Math.round(row.minutes / row.presences) : 0}
                  </span>
                  <span>{row.goals}</span>
                  <span>{row.assists}</span>
                  <span>{row.yellowCards}</span>
                  <span>{row.redCards}</span>
                </button>
              ))}
            </div>
          </div>
        </AppCard>

        <div style={{ display: "grid", gap: 18 }}>
          <AppCard>
            <h3 style={{ marginTop: 0 }}>Scheda rapida</h3>

            <select
              value={effectiveSelectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              style={styles.input}
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>

            {selectedPlayer && (
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 22,
                      background:
                        "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(37,99,235,0.20))",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 24,
                      fontWeight: 900,
                      overflow: "hidden",
                    }}
                  >
                    {selectedPlayer.photo ? (
                      <img
                        src={selectedPlayer.photo}
                        alt={selectedPlayer.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      selectedPlayer.name?.[0]
                    )}
                  </div>

                  <div>
                    <h2 style={{ margin: 0 }}>{selectedPlayer.name}</h2>
                    <p style={{ color: "#94a3b8", margin: "4px 0 0" }}>
                      {selectedPlayer.role || "Ruolo non impostato"}
                    </p>
                  </div>
                </div>

                <div style={miniGridStyle}>
                  <MiniStat label="Presenze" value={selectedStats?.presences || 0} />
                  <MiniStat label="Minuti" value={selectedStats?.minutes || 0} />
                  <MiniStat label="Gol" value={selectedStats?.goals || 0} />
                  <MiniStat label="Assist" value={selectedStats?.assists || 0} />
                </div>
              </div>
            )}
          </AppCard>

          <AppCard>
            <h3 style={{ marginTop: 0 }}>Storico eventi</h3>

            {history.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>Nessun evento registrato.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {history.map((item) => (
                  <div
                    key={`${item.sessionId}-${item.date}`}
                    style={{
                      borderRadius: 16,
                      padding: 14,
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <strong>{item.title}</strong>

                    <p style={{ color: "#94a3b8", margin: "6px 0" }}>
                      {formatDate(item.date)} · {item.type}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        color: "#cbd5e1",
                        fontSize: 13,
                      }}
                    >
                      <span>{item.status}</span>
                      <span>{item.minutes} min</span>
                      <span>{item.goals} gol</span>
                      <span>{item.assists} assist</span>
                      <span>{item.yellowCards} amm.</span>
                      <span>{item.redCards} esp.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppCard>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }) {
  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ color: "#94a3b8", margin: 0, fontWeight: 700 }}>{label}</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 34 }}>{value}</h2>
        </div>

        <div style={{ fontSize: 34 }}>{icon}</div>
      </div>
    </AppCard>
  );
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 6,
        }}
      >
        {label}
      </span>

      <strong style={{ fontSize: 20 }}>{value}</strong>
    </div>
  );
}

function getStatsSummary(events, players) {
  return players.map((player) => {
    const totals = events.reduce(
      (acc, event) => {
        const data = event.attendance?.[player.id];

        if (!data) return acc;

        if (data.status === "Presente") acc.presences += 1;
        if (data.status === "Assente" || data.status === "Permesso") {
          acc.absences += 1;
        }
        if (data.status === "Infortunato") acc.injuries += 1;

        if (data.status === "Presente") {
          acc.minutes += Number(data.minutes || 0);
          acc.goals += Number(data.goals || 0);
          acc.assists += Number(data.assists || 0);
          acc.yellowCards += Number(data.yellowCards || 0);
          acc.redCards += Number(data.redCards || 0);
        }

        return acc;
      },
      {
        presences: 0,
        absences: 0,
        injuries: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      }
    );

    return {
      id: player.id,
      name: player.name,
      ...totals,
    };
  });
}

function getPlayerHistory(events, player) {
  if (!player) return [];

  return [...events]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((event) => {
      const data = event.attendance?.[player.id];

      if (!data) return null;

      return {
        sessionId: event.id,
        title: event.title,
        date: event.date,
        type: event.type,
        status: data.status,
        minutes: data.status === "Presente" ? Number(data.minutes || 0) : 0,
        goals: data.status === "Presente" ? Number(data.goals || 0) : 0,
        assists: data.status === "Presente" ? Number(data.assists || 0) : 0,
        yellowCards:
          data.status === "Presente" ? Number(data.yellowCards || 0) : 0,
        redCards: data.status === "Presente" ? Number(data.redCards || 0) : 0,
      };
    })
    .filter(Boolean);
}

const tableStyle = {
  minWidth: 760,
  display: "grid",
  gap: 8,
};

const headerStyle = {
  display: "grid",
  gridTemplateColumns: "1.4fr repeat(9, 0.6fr)",
  gap: 8,
  padding: "0 12px 8px",
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1.4fr repeat(9, 0.6fr)",
  gap: 8,
  padding: "14px 12px",
  borderRadius: 16,
  color: "white",
  cursor: "pointer",
  textAlign: "left",
};

const miniGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
};

const filterLabelStyle = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

export default Statistics;
