import { useMemo, useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";

import { formatDate, defaultPlayerEventData } from "../utils/helpers";
import { styles } from "../styles/index.js";

function Calendar({ events, players, updateEventAttendance }) {
  const [view, setView] = useState("list");
  const [monthDate, setMonthDate] = useState(() => new Date());

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  );

  const [selectedId, setSelectedId] = useState(sortedEvents[0]?.id || "");
  const effectiveSelectedId = selectedId || sortedEvents[0]?.id || "";

  const selectedEvent = sortedEvents.find(
    (event) => String(event.id) === String(effectiveSelectedId)
  );

  const groupedEvents = useMemo(
    () =>
      sortedEvents.reduce((acc, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
      }, {}),
    [sortedEvents]
  );

  function updatePlayer(playerId, field, value) {
    if (!selectedEvent) return;

    const current =
      selectedEvent.attendance?.[playerId] || defaultPlayerEventData();

    const attendance = {
      ...(selectedEvent.attendance || {}),
      [playerId]: {
        ...current,
        [field]: value,
      },
    };

    updateEventAttendance(selectedEvent.id, selectedEvent.type, attendance);
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Calendario"
        subtitle="Gestisci eventi, presenze e statistiche partita/allenamento"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <Badge tone="blue">{events.length} eventi</Badge>

        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant={view === "list" ? "primary" : "ghost"}
            onClick={() => setView("list")}
          >
            Lista
          </Button>

          <Button
            variant={view === "month" ? "primary" : "ghost"}
            onClick={() => setView("month")}
          >
            Mese
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        {view === "month" ? (
          <MonthView
            events={sortedEvents}
            monthDate={monthDate}
            setMonthDate={setMonthDate}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Nessun evento in calendario"
            text="Crea un allenamento o una partita per iniziare a registrare presenze e statistiche."
          />
        ) : (
            <EventList
              groupedEvents={groupedEvents}
              selectedId={effectiveSelectedId}
              setSelectedId={setSelectedId}
            />
        )}

        {events.length > 0 && (
          <EventRegister
            selectedEvent={selectedEvent}
            players={players}
            updatePlayer={updatePlayer}
          />
        )}
      </div>
    </div>
  );
}

function EventList({ groupedEvents, selectedId, setSelectedId }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {Object.keys(groupedEvents).map((date) => (
        <AppCard key={date}>
          <h3 style={{ marginTop: 0 }}>{formatDate(date)}</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: 12,
            }}
          >
            {groupedEvents[date].map((event) => (
              <button
                key={`${event.type}-${event.id}`}
                onClick={() => setSelectedId(event.id)}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  textAlign: "left",
                  cursor: "pointer",
                  color: "white",
                  background:
                    String(selectedId) === String(event.id)
                      ? "rgba(56,189,248,0.16)"
                      : "rgba(255,255,255,0.045)",
                  border:
                    String(selectedId) === String(event.id)
                      ? "1px solid rgba(56,189,248,0.35)"
                      : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <strong>{event.title}</strong>

                  <Badge tone={event.type === "Partita" ? "orange" : "green"}>
                    {event.type}
                  </Badge>
                </div>

                <p style={{ color: "#94a3b8", margin: "8px 0 0" }}>
                  {event.theme || event.opponent || "Nessun dettaglio"}
                </p>
              </button>
            ))}
          </div>
        </AppCard>
      ))}
    </div>
  );
}

function EventRegister({ selectedEvent, players, updatePlayer }) {
  if (!selectedEvent) {
    return (
      <AppCard>
        <h3 style={{ marginTop: 0 }}>Registro evento</h3>
        <p style={{ color: "#94a3b8" }}>Seleziona un evento.</p>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Registro evento</h3>
          <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
            {selectedEvent.title} · {formatDate(selectedEvent.date)} ·{" "}
            {selectedEvent.type}
          </p>
        </div>

        <Badge tone={selectedEvent.type === "Partita" ? "orange" : "green"}>
          {selectedEvent.type}
        </Badge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 14,
        }}
      >
        {players.map((player) => {
          const data =
            selectedEvent.attendance?.[player.id] || defaultPlayerEventData();

          return (
            <div
              key={player.id}
              style={{
                borderRadius: 20,
                padding: 16,
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.08)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{player.name}</strong>
                  <p
                    style={{
                      color: "#94a3b8",
                      margin: "4px 0 0",
                      fontSize: 13,
                    }}
                  >
                    {player.role || "-"}
                  </p>
                </div>

                <Badge tone={data.status === "Presente" ? "green" : "red"}>
                  {data.status}
                </Badge>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {["Presente", "Assente", "Infortunato", "Permesso"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => updatePlayer(player.id, "status", status)}
                      style={{
                        borderRadius: 999,
                        padding: "7px 10px",
                        cursor: "pointer",
                        color: "white",
                        fontWeight: 800,
                        border:
                          data.status === status
                            ? "1px solid rgba(56,189,248,0.45)"
                            : "1px solid rgba(255,255,255,0.08)",
                        background:
                          data.status === status
                            ? "rgba(56,189,248,0.20)"
                            : "rgba(255,255,255,0.05)",
                      }}
                    >
                      {status}
                    </button>
                  )
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                  gap: 8,
                }}
              >
                <StatInput
                  label="Min"
                  value={data.minutes || 0}
                  disabled={data.status !== "Presente"}
                  onChange={(value) => updatePlayer(player.id, "minutes", value)}
                />

                <StatInput
                  label="Gol"
                  value={data.goals || 0}
                  disabled={data.status !== "Presente"}
                  onChange={(value) => updatePlayer(player.id, "goals", value)}
                />

                <StatInput
                  label="Ass"
                  value={data.assists || 0}
                  disabled={data.status !== "Presente"}
                  onChange={(value) => updatePlayer(player.id, "assists", value)}
                />

                <StatInput
                  label="RPE"
                  value={data.rpe || ""}
                  disabled={data.status !== "Presente"}
                  onChange={(value) => updatePlayer(player.id, "rpe", value)}
                />

                <StatInput
                  label="Amm."
                  value={data.yellowCards || 0}
                  disabled={data.status !== "Presente"}
                  onChange={(value) =>
                    updatePlayer(player.id, "yellowCards", value)
                  }
                />

                <StatInput
                  label="Esp."
                  value={data.redCards || 0}
                  disabled={data.status !== "Presente"}
                  onChange={(value) => updatePlayer(player.id, "redCards", value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AppCard>
  );
}

function StatInput({ label, value, disabled, onChange }) {
  return (
    <label
      style={{
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: 800,
        minWidth: 0,
      }}
    >
      {label}

      <input
        type="number"
        min="0"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 6,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: disabled
            ? "rgba(255,255,255,0.035)"
            : "rgba(255,255,255,0.065)",
          color: "white",
          padding: "10px 8px",
          outline: "none",
          fontWeight: 800,
        }}
      />
    </label>
  );
}

function MonthView({ events, monthDate, setMonthDate, selectedId, onSelect }) {
  const month = useMemo(() => {
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, monthIndex, index + 1);
      const dateKey = toDateKey(date);

      return {
        date,
        dateKey,
        day: index + 1,
        events: events.filter((event) => event.date === dateKey),
      };
    });

    return {
      label: new Intl.DateTimeFormat("it-IT", {
        month: "long",
        year: "numeric",
      }).format(monthDate),
      cells: [
        ...Array.from({ length: mondayOffset }, (_, index) => ({
          key: `empty-${index}`,
          empty: true,
        })),
        ...days,
      ],
    };
  }, [events, monthDate]);

  function moveMonth(delta) {
    setMonthDate(
      new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1)
    );
  }

  return (
    <AppCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Button variant="ghost" onClick={() => moveMonth(-1)}>
          Mese precedente
        </Button>

        <h3 style={{ margin: 0, textTransform: "capitalize" }}>
          {month.label}
        </h3>

        <Button variant="ghost" onClick={() => moveMonth(1)}>
          Mese successivo
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(90px, 1fr))",
          gap: 8,
          marginBottom: 8,
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(90px, 1fr))",
          gap: 10,
          overflowX: "auto",
        }}
      >
        {month.cells.map((cell) => {
          if (cell.empty) {
            return <div key={cell.key} />;
          }

          return (
            <div
              key={cell.dateKey}
              style={{
                minHeight: 110,
                borderRadius: 16,
                padding: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <strong>{String(cell.day).padStart(2, "0")}</strong>

              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {cell.events.map((event) => (
                  <button
                    key={`${event.type}-${event.id}`}
                    onClick={() => onSelect(event.id)}
                    style={{
                      border: "none",
                      borderRadius: 10,
                      padding: 7,
                      cursor: "pointer",
                      background:
                        String(selectedId) === String(event.id)
                          ? "rgba(56,189,248,0.24)"
                          : "rgba(56,189,248,0.16)",
                      color: "white",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {event.type} · {event.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppCard>
  );
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default Calendar;
