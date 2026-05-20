import { useMemo, useState } from "react";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { formatShortDate, getAvailabilityGroups, getSessionLoad, createId } from "../utils/helpers";
import { styles } from "../styles/index.js";

const EVENT_TYPES = [
  { value: "Allenamento", label: "Allenamento", tone: "green" },
  { value: "Partita",     label: "Partita",     tone: "orange" },
  { value: "Altro",       label: "Altro",       tone: "blue" },
];

const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function buildWeek(offsetWeeks = 0) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { date, key: `${y}-${m}-${d}` };
  });
}

function Calendar({ events, players, setSessions, setMatches, sessions = [], matches = [] }) {
  const [view, setView] = useState("week");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [confirmState, setConfirmState] = useState(null);

  function quickCreate({ date, type, title, notes }) {
    const base = {
      id:    createId(type === "Partita" ? "match" : "session"),
      date,
      notes: notes || "",
      attendance: {},
    };
    if (type === "Partita") {
      const opponent = title || "Avversario";
      setMatches?.([...matches, {
        ...base,
        type:       "Partita",
        opponent,
        title:      `CalcioLab - ${opponent}`,
        location:   "Casa",
        formation:  "4-2-3-1",
        result:     "",
        homeLogo:   "",
        awayLogo:   "",
        lineup:     { starterIds: [], benchIds: [], calledUpIds: [] },
        matchPlan:  "",
        staffNotes: "",
      }]);
    } else {
      setSessions?.([...sessions, {
        ...base,
        type:      type === "Altro" ? "Altro" : "Allenamento",
        title:     title || (type === "Altro" ? "Evento" : "Allenamento"),
        theme:     "Costruzione",
        objective: "",
        exercises: [],
        duration:  0,
      }]);
    }
  }

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  );

  const [selectedId, setSelectedId] = useState(sortedEvents[0]?.id || "");
  const effectiveSelectedId = selectedId || sortedEvents[0]?.id || "";

  function requestDeleteEvent(event) {
    setConfirmState({
      message: `Eliminare "${event.title}"?`,
      confirmLabel: "Elimina",
      confirmTone: "red",
      onConfirm: () => {
        if (event.type === "Partita") {
          setMatches?.(matches.filter((m) => String(m.id) !== String(event.id)));
        } else {
          setSessions?.(sessions.filter((s) => String(s.id) !== String(event.id)));
        }
      },
    });
  }

  return (
    <div style={styles.page}>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title="Calendario"
        subtitle="Gestisci eventi, presenze e statistiche partita/allenamento"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <Badge tone="blue">{events.length} eventi</Badge>
          <p style={{ color: "#94a3b8", margin: "8px 0 0", lineHeight: 1.4 }}>
            Vista operativa per pianificare settimana e mese.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            variant={view === "week" ? "primary" : "ghost"}
            onClick={() => setView("week")}
          >
            Settimana
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
        {view === "week" ? (
          <WeekView
            events={sortedEvents}
            players={players}
            onQuickCreate={quickCreate}
            onDeleteEvent={requestDeleteEvent}
            onEditEvent={(event, updates) => {
              if (event.type === "Partita") setMatches?.(matches.map((m) => String(m.id) === String(event.id) ? { ...m, ...updates } : m));
              else setSessions?.(sessions.map((s) => String(s.id) === String(event.id) ? { ...s, ...updates } : s));
            }}
          />
        ) : (
          <MonthView
            events={sortedEvents}
            monthDate={monthDate}
            setMonthDate={setMonthDate}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
            onQuickCreate={quickCreate}
            onDeleteEvent={requestDeleteEvent}
            onEditEvent={(event, updates) => {
              if (event.type === "Partita") setMatches?.(matches.map((m) => String(m.id) === String(event.id) ? { ...m, ...updates } : m));
              else setSessions?.(sessions.map((s) => String(s.id) === String(event.id) ? { ...s, ...updates } : s));
            }}
          />
        )}
      </div>
    </div>
  );
}

function MonthView({ events, monthDate, setMonthDate, selectedId, onSelect, onQuickCreate, onDeleteEvent, onEditEvent }) {
  const [openDay, setOpenDay] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
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
          Prec.
        </Button>

        <h3 style={{ margin: 0, textTransform: "capitalize", lineHeight: 1.2 }}>
          {month.label}
        </h3>

        <Button variant="ghost" onClick={() => moveMonth(1)}>
          Succ.
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

          const isOpen = openDay === cell.dateKey;
          const isToday = cell.dateKey === todayKey;
          return (
            <div
              key={cell.dateKey}
              style={{
                minHeight: 110,
                borderRadius: 12,
                padding: 10,
                background: isOpen
                  ? "rgba(56,189,248,0.06)"
                  : isToday
                  ? "rgba(59,130,246,0.12)"
                  : "rgba(255,255,255,0.04)",
                border: isOpen
                  ? "1px solid rgba(56,189,248,0.25)"
                  : isToday
                  ? "2px solid #3b82f6"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Header cella: data + azioni (se 1 solo evento) + pulsante aggiunta */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{String(cell.day).padStart(2, "0")}</strong>
                  {isToday && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#3b82f6", background: "rgba(59,130,246,0.18)", borderRadius: 6, padding: "1px 5px", lineHeight: 1.5 }}>
                      Oggi
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {/* Bottoni modifica/elimina nel header solo se c'è esattamente 1 evento */}
                  {cell.events.length === 1 && (
                    <>
                      <button
                        onClick={() => setEditingEvent(cell.events[0])}
                        style={wv.addBtnSmall}
                        title="Modifica evento"
                      >✏️</button>
                      <button
                        onClick={() => onDeleteEvent?.(cell.events[0])}
                        style={{ ...wv.addBtnSmall, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                        title="Elimina evento"
                      >🗑️</button>
                    </>
                  )}
                  {onQuickCreate && (
                    <button
                      onClick={() => setOpenDay(isOpen ? null : cell.dateKey)}
                      style={wv.addBtnSmall}
                      title="Aggiungi evento"
                    >
                      {isOpen ? "×" : "+"}
                    </button>
                  )}
                </div>
              </div>

              {isOpen && (
                <QuickAddForm
                  date={cell.dateKey}
                  compact
                  onSave={(data) => { onQuickCreate(data); setOpenDay(null); }}
                  onCancel={() => setOpenDay(null)}
                />
              )}

              <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                {cell.events.map((event) => (
                  <div
                    key={`${event.type}-${event.id}`}
                    style={{
                      borderRadius: 8,
                      padding: "5px 7px",
                      background:
                        String(selectedId) === String(event.id)
                          ? "rgba(56,189,248,0.24)"
                          : event.type === "Partita"
                          ? "rgba(251,146,60,0.18)"
                          : event.type === "Altro"
                          ? "rgba(56,189,248,0.14)"
                          : "rgba(34,197,94,0.14)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                      <button
                        type="button"
                        onClick={() => onSelect(event.id)}
                        style={{ flex: 1, cursor: "pointer", fontSize: 11, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: "none", background: "transparent", padding: 0, textAlign: "left", minHeight: 0 }}
                      >
                        {event.type === "Partita" ? "⚽" : event.type === "Altro" ? "📌" : "🏃"} {event.title}
                      </button>
                    {/* Bottoni per-chip solo quando ci sono più eventi nella cella */}
                    {cell.events.length > 1 && (
                      <>
                        <button
                          onClick={() => setEditingEvent(event)}
                          style={{ ...wv.iconBtn, width: 18, height: 18, fontSize: 9, flexShrink: 0 }}
                          title="Modifica"
                        >✏️</button>
                        <button
                          onClick={() => onDeleteEvent?.(event)}
                          style={{ ...wv.iconBtn, width: 18, height: 18, fontSize: 9, flexShrink: 0, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                          title="Elimina"
                        >🗑️</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onSave={(updates) => {
            onEditEvent?.(editingEvent, updates);
            setEditingEvent(null);
          }}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </AppCard>
  );
}

// ─────────────────────────────────────────────
// Vista Settimana (ex WeekPlan)
// ─────────────────────────────────────────────
function WeekView({ events, players, onQuickCreate, onDeleteEvent, onEditEvent }) {
  const [offset, setOffset] = useState(0);
  const [openDay, setOpenDay] = useState(null); // dateKey del giorno con form aperto
  const [editingEvent, setEditingEvent] = useState(null);

  const week         = buildWeek(offset);
  const weekStart    = week[0].date;
  const weekEnd      = week[6].date;

  // filtra solo gli eventi della settimana visualizzata
  const weekEvents   = events.filter((e) => {
    const d = new Date(e.date);
    return d >= weekStart && d <= weekEnd;
  });
  const sessions     = weekEvents.filter((e) => e.type !== "Partita");
  const matches      = weekEvents.filter((e) => e.type === "Partita");
  const availability = getAvailabilityGroups(players);
  const weeklyLoad   = sessions.reduce((sum, s) => sum + getSessionLoad(s), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isCurrentWeek = offset === 0;

  // Label periodo settimana
  const weekLabel = `${formatShortDate(week[0].key)} – ${formatShortDate(week[6].key)}`;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Navigazione settimana */}
      <div style={wv.navBar}>
        <Button variant="ghost" onClick={() => setOffset((o) => o - 1)}>Prec.</Button>
        <div style={wv.navCenter}>
          <span style={wv.navLabel}>{weekLabel}</span>
          {!isCurrentWeek && (
            <button onClick={() => setOffset(0)} style={wv.todayBtn}>
              Questa settimana
            </button>
          )}
        </div>
        <Button variant="ghost" onClick={() => setOffset((o) => o + 1)}>Succ.</Button>
      </div>

      {/* KPI */}
      <div style={wv.kpiGrid}>
        <WeekKpi label="Allenamenti" value={sessions.length} tone="green" sub="sedute programmate" />
        <WeekKpi label="Partite" value={matches.length} tone="orange" sub="gare in calendario" />
        <WeekKpi label="Carico settimana" value={weeklyLoad || "—"} tone="purple" sub="RPE × minuti (u.a.)" />
        <WeekKpi label="A rischio" value={availability.injured.length + availability.limited.length} tone="red" sub="infortunati + differenziato" />
      </div>

      {/* Griglia giorni */}
      <div style={wv.grid}>
        {week.map((day, index) => {
          const dayEvents  = weekEvents.filter((e) => e.date === day.key);
          const isToday    = day.date.getTime() === today.getTime();
          const isPast     = day.date < today;
          const isOpen     = openDay === day.key;

          return (
            <div
              key={day.key}
              style={{
                ...wv.dayCard,
                ...(isToday ? wv.dayCardToday : {}),
                ...(isPast  ? wv.dayCardPast  : {}),
                ...(isOpen  ? wv.dayCardOpen  : {}),
              }}
            >
              {/* Header giorno */}
              <div style={wv.dayHeader}>
                <div>
                  <p style={{ margin: 0, fontWeight: 900, fontSize: 13, color: isToday ? "#38bdf8" : "#94a3b8", textTransform: "uppercase" }}>
                    {weekDays[index]}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>
                    {formatShortDate(day.key)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <Badge tone={dayEvents.length ? (isToday ? "blue" : "green") : "purple"}>
                    {dayEvents.length || "Off"}
                  </Badge>
                  {onQuickCreate && (
                    <button
                      onClick={() => setOpenDay(isOpen ? null : day.key)}
                      style={wv.addBtn}
                      title="Aggiungi evento"
                    >
                      {isOpen ? "×" : "+"}
                    </button>
                  )}
                </div>
              </div>

              {/* Mini-form inline */}
              {isOpen && (
                <QuickAddForm
                  date={day.key}
                  onSave={(data) => {
                    onQuickCreate(data);
                    setOpenDay(null);
                  }}
                  onCancel={() => setOpenDay(null)}
                />
              )}

              {/* Lista eventi */}
              <div style={wv.eventList}>
                {dayEvents.length ? (
                  dayEvents.map((event) => (
                    <div
                      key={`${event.type}-${event.id}`}
                      style={{
                        ...wv.event,
                        borderLeftColor: event.type === "Partita" ? "#fb923c" : event.type === "Altro" ? "#38bdf8" : "#22c55e",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                        <Badge tone={event.type === "Partita" ? "orange" : event.type === "Altro" ? "blue" : "green"}>
                          {event.type}
                        </Badge>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button
                            onClick={() => setEditingEvent(event)}
                            style={wv.iconBtn}
                            title="Modifica evento"
                          >✏️</button>
                          <button
                            onClick={() => onDeleteEvent?.(event)}
                            style={{ ...wv.iconBtn, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                            title="Elimina evento"
                          >🗑️</button>
                        </div>
                      </div>
                      <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 13 }}>
                        {event.title}
                      </p>
                      {(event.theme || event.opponent || event.objective || event.notes) && (
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                          {event.theme || event.opponent || event.objective || event.notes}
                        </p>
                      )}
                    </div>
                  ))
                ) : !isOpen ? (
                  <p style={wv.muted}>Recupero / riposo</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert staff */}
      <AppCard>
        <div style={wv.alertHeader}>
          <div>
            <h3 style={{ margin: 0, lineHeight: 1.2 }}>Alert staff</h3>
            <p style={{ ...wv.muted, marginTop: 6 }}>Giocatori da monitorare questa settimana</p>
          </div>
          <Button variant="ghost" onClick={() => window.print()}>Stampa settimana</Button>
        </div>

        <div style={wv.alertGrid}>
          <AlertCol title="🚑 Infortunati"          players={availability.injured}  />
          <AlertCol title="🔄 Recupero/Differenziato" players={availability.limited} />
          <AlertCol title="🟥 Squalificati"           players={availability.suspended} />
        </div>
      </AppCard>

      {/* Modal modifica evento */}
      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onSave={(updates) => {
            onEditEvent?.(editingEvent, updates);
            setEditingEvent(null);
          }}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}

function WeekKpi({ label, value, tone, sub }) {
  return (
    <AppCard>
      <Badge tone={tone}>{label}</Badge>
      <h2 style={{ margin: "10px 0 5px", fontSize: 28, lineHeight: 1 }}>{value}</h2>
      {sub && <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.35 }}>{sub}</p>}
    </AppCard>
  );
}

function AlertCol({ title, players }) {
  return (
    <div style={wv.alertCol}>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      {players.length ? (
        players.map((p) => (
          <span key={p.id} style={{ color: "#cbd5e1", fontSize: 13 }}>
            {p.name}{p.expectedReturn ? ` · rientro ${p.expectedReturn}` : ""}
          </span>
        ))
      ) : (
        <span style={{ color: "#475569", fontSize: 13 }}>Nessun giocatore</span>
      )}
    </div>
  );
}

const wv = {
  navBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexWrap: "wrap",
  },
  navCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  navLabel: {
    fontWeight: 700,
    fontSize: 15,
    color: "#e2e8f0",
  },
  todayBtn: {
    background: "none",
    border: "none",
    color: "#38bdf8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: 0,
  },
  kpiGrid:     { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 },
  grid:        { display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 10 },
  dayCard:     { borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 126, display: "grid", alignContent: "start", gap: 8 },
  dayCardToday:{ background: "rgba(56,189,248,0.09)", border: "1px solid rgba(56,189,248,0.28)" },
  dayCardPast: { opacity: 0.55 },
  dayCardOpen: { background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.22)" },
  addBtn: {
    width: 24, height: 24, borderRadius: 8,
    background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)",
    color: "#38bdf8", cursor: "pointer", fontSize: 16, fontWeight: 900,
    display: "grid", placeItems: "center", lineHeight: 1, padding: 0, minHeight: 0,
  },
  addBtnSmall: {
    width: 20, height: 20, borderRadius: 7,
    background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)",
    color: "#38bdf8", cursor: "pointer", fontSize: 13, fontWeight: 900,
    display: "grid", placeItems: "center", lineHeight: 1, padding: 0, minHeight: 0,
  },
  dayHeader:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  eventList:   { display: "grid", gap: 6 },
  event:       { padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "3px solid" },
  iconBtn: {
    width: 22, height: 22, borderRadius: 7, padding: 0, minHeight: 0,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer", fontSize: 11, display: "grid", placeItems: "center", lineHeight: 1,
  },
  muted:       { color: "#475569", margin: 0, fontSize: 12 },
  alertHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 },
  alertGrid:   { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 },
  alertCol:    { display: "grid", gap: 8, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" },
};

// ─────────────────────────────────────────────
// Mini-form aggiunta rapida evento
// ─────────────────────────────────────────────
function QuickAddForm({ date, onSave, onCancel, compact = false }) {
  const [type,  setType]  = useState("Allenamento");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  function handleSave() {
    onSave({ date, type, title: title.trim(), notes: notes.trim() });
    setType("Allenamento");
    setTitle("");
    setNotes("");
  }

  return (
    <div style={{ ...qa.wrap, ...(compact ? qa.wrapCompact : {}) }}>
      {/* Tipo */}
      <div style={qa.typeRow}>
        {EVENT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            style={{
              ...qa.typeBtn,
              ...(type === t.value ? qa.typeBtnActive : {}),
            }}
          >
            {t.value}
          </button>
        ))}
      </div>

      {/* Titolo / avversario */}
      <input
        style={qa.input}
        placeholder={type === "Partita" ? "Avversario *" : "Titolo (opzionale)"}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      {/* Note — solo in modalità non-compact */}
      {!compact && (
        <input
          style={qa.input}
          placeholder="Nota (es. campo sintetico, ore 18:30)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      )}

      {/* Azioni */}
      <div style={qa.actions}>
        <button onClick={onCancel} style={qa.cancelBtn}>Annulla</button>
        <button
          onClick={handleSave}
          disabled={type === "Partita" && !title.trim()}
          style={{
            ...qa.saveBtn,
            opacity: type === "Partita" && !title.trim() ? 0.45 : 1,
          }}
        >
          + Aggiungi
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal modifica evento calendario
// ─────────────────────────────────────────────
function EventEditModal({ event, onSave, onClose }) {
  const isMatch = event.type === "Partita";

  const [form, setForm] = useState({
    title:    isMatch ? (event.opponent || "") : (event.title || ""),
    date:     event.date || "",
    notes:    event.notes || "",
    // match-only
    location: event.location || "Casa",
    result:   event.result || "",
    // session-only
    duration: event.duration || 0,
    theme:    event.theme || "",
  });

  function handleSave() {
    const updates = isMatch
      ? {
          opponent: form.title,
          title:    `CalcioLab - ${form.title}`,
          date:     form.date,
          notes:    form.notes,
          location: form.location,
          result:   form.result,
        }
      : {
          title:    form.title,
          date:     form.date,
          notes:    form.notes,
          duration: Number(form.duration) || 0,
          theme:    form.theme,
        };
    onSave(updates);
  }

  return (
    <div style={em.overlay} onClick={onClose}>
      <div style={em.modal} onClick={(e) => e.stopPropagation()}>
        <div style={em.header}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            {isMatch ? "✏️ Modifica partita" : "✏️ Modifica allenamento"}
          </h3>
          <button onClick={onClose} style={em.closeBtn}>×</button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={em.label}>{isMatch ? "Avversario" : "Titolo"}</label>
          <input
            style={em.input}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={isMatch ? "Nome avversario" : "Titolo seduta"}
            autoFocus
          />

          <label style={em.label}>Data</label>
          <input
            type="date"
            style={em.input}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />

          {isMatch && (
            <>
              <label style={em.label}>Campo</label>
              <select style={em.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                <option>Casa</option>
                <option>Trasferta</option>
                <option>Neutro</option>
              </select>

              <label style={em.label}>Risultato</label>
              <input
                style={em.input}
                value={form.result}
                onChange={(e) => setForm({ ...form, result: e.target.value })}
                placeholder="es. 2-1"
              />
            </>
          )}

          {!isMatch && (
            <>
              <label style={em.label}>Tema</label>
              <input
                style={em.input}
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
                placeholder="es. Pressing, Fase difensiva..."
              />

              <label style={em.label}>Durata (min)</label>
              <input
                type="number"
                style={em.input}
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="90"
                min={0}
              />
            </>
          )}

          <label style={em.label}>Note</label>
          <textarea
            style={{ ...em.input, minHeight: 72, resize: "vertical" }}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Note aggiuntive..."
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={em.cancelBtn}>Annulla</button>
          <button onClick={handleSave} style={em.saveBtn}>Salva modifiche</button>
        </div>
      </div>
    </div>
  );
}

const em = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16,
  },
  modal: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 18,
  },
  closeBtn: {
    background: "none", border: "none", color: "#94a3b8",
    fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0,
  },
  label: {
    fontSize: 11, fontWeight: 800, textTransform: "uppercase",
    color: "#64748b", letterSpacing: 0, marginBottom: 2,
  },
  input: {
    width: "100%", boxSizing: "border-box",
    padding: "9px 12px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0", fontSize: 13, outline: "none",
  },
  cancelBtn: {
    background: "none", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "8px 16px",
    color: "#94a3b8", cursor: "pointer", fontWeight: 700, fontSize: 13,
  },
  saveBtn: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border: "none", borderRadius: 10, padding: "8px 18px",
    color: "white", cursor: "pointer", fontWeight: 800, fontSize: 13,
  },
};

const qa = {
  wrap: {
    padding: "10px 0 6px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 8,
    display: "grid",
    gap: 6,
  },
  wrapCompact: { padding: "8px 0 4px" },
  typeRow: { display: "flex", gap: 4, flexWrap: "wrap" },
  typeBtn: {
    borderRadius: 9,
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    color: "white",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  typeBtnActive: {
    background: "rgba(56,189,248,0.22)",
    border: "1px solid rgba(56,189,248,0.45)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    fontSize: 12,
    outline: "none",
  },
  actions: { display: "flex", gap: 6, justifyContent: "flex-end" },
  cancelBtn: {
    background: "none", border: "none",
    color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 700,
  },
  saveBtn: {
    borderRadius: 8, padding: "5px 10px",
    background: "rgba(56,189,248,0.22)",
    border: "1px solid rgba(56,189,248,0.4)",
    color: "white", cursor: "pointer", fontSize: 12, fontWeight: 800,
  },
};

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default Calendar;
