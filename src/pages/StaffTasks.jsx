import { useMemo, useState } from "react";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { useIsMobile } from "../hooks/useIsMobile";
import { createId, formatDate } from "../utils/helpers";
import { styles } from "../styles/index.js";
import { useTranslation } from "../i18n";

const STATUS_LABEL = {
  todo: "Da fare",
  doing: "In corso",
  done: "Fatto",
};

const PRIORITY_LABEL = {
  high: "Alta",
  medium: "Media",
  low: "Bassa",
};

const PRIORITY_TONE = {
  high: "red",
  medium: "orange",
  low: "blue",
};

const ROLE_LABEL = {
  owner: "Owner",
  headCoach: "Allenatore",
  assistantCoach: "Assistente",
  athleticTrainer: "Preparatore",
  director: "Direttore",
};

const emptyForm = {
  title: "",
  description: "",
  priority: "medium",
  ownerRole: "headCoach",
  dueDate: "",
  playerId: "",
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function StaffTasks({
  staffTasks = [], setStaffTasks, players = [], matches = [] }) {

  const { t } = useTranslation();
  const { showToast, ToastContainer } = useToast();
  const isMobile = useIsMobile(760);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [weekAnchor, setWeekAnchor] = useState(() => getTodayKey());

  const playerById = useMemo(() => {
    return Object.fromEntries(players.map((player) => [String(player.id), player]));
  }, [players]);

  const filteredTasks = useMemo(() => {
    return [...staffTasks]
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
      .filter((task) => ownerFilter === "all" || task.ownerRole === ownerFilter)
      .sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        const aDate = a.dueDate || "9999-12-31";
        const bDate = b.dueDate || "9999-12-31";
        return aDate.localeCompare(bDate);
      });
  }, [staffTasks, statusFilter, ownerFilter]);

  const boardStats = useMemo(() => {
    return {
      todo: staffTasks.filter((task) => task.status === "todo").length,
      doing: staffTasks.filter((task) => task.status === "doing").length,
      done: staffTasks.filter((task) => task.status === "done").length,
      high: staffTasks.filter((task) => task.priority === "high" && task.status !== "done").length,
    };
  }, [staffTasks]);

  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);
  const agendaTasks = useMemo(() => {
    const weekStart = weekDays[0]?.key || "";
    const weekEnd = weekDays[6]?.key || "";
    const buckets = Object.fromEntries(weekDays.map((day) => [day.key, []]));
    const unscheduled = [];

    staffTasks
      .filter((task) => task.status !== "done")
      .forEach((task) => {
        if (!task.dueDate) {
          unscheduled.push(task);
          return;
        }
        if (task.dueDate < weekStart || task.dueDate > weekEnd) return;
        buckets[task.dueDate]?.push(task);
      });

    Object.values(buckets).forEach((items) => {
      items.sort(sortTasksForAgenda);
    });
    unscheduled.sort(sortTasksForAgenda);

    return { buckets, unscheduled };
  }, [staffTasks, weekDays]);

  const workloadByRole = useMemo(() => {
    return Object.fromEntries(Object.keys(ROLE_LABEL).map((role) => [
      role,
      staffTasks.filter((task) => task.status !== "done" && task.ownerRole === role).length,
    ]));
  }, [staffTasks]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function saveTask() {
    const title = form.title.trim();
    if (!title) {
      showToast("Inserisci un titolo per l'azione", "warn");
      return;
    }

    const task = {
      id: createId("task"),
      title,
      description: form.description.trim(),
      priority: form.priority,
      ownerRole: form.ownerRole,
      dueDate: form.dueDate,
      playerId: form.playerId,
      sourceType: "manual",
      sourceId: "",
      status: "todo",
      createdAt: new Date().toISOString(),
      completedAt: "",
    };

    setStaffTasks((prev) => [task, ...prev]);
    setForm(emptyForm);
    showToast("Azione staff creata", "ok");
  }

  function updateTask(id, patch) {
    setStaffTasks((prev) => prev.map((task) => {
      if (task.id !== id) return task;
      const nextStatus = patch.status || task.status;
      return {
        ...task,
        ...patch,
        completedAt: nextStatus === "done" ? (task.completedAt || new Date().toISOString()) : "",
      };
    }));
  }

  function deleteTask(id) {
    setStaffTasks((prev) => prev.filter((task) => task.id !== id));
    showToast("Azione eliminata", "ok");
  }

  function moveWeek(offset) {
    setWeekAnchor((current) => addDays(current, offset * 7));
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <PageHeader
        title={t("pages.staffTasks.title")}
        subtitle="Trasforma analisi, post-gara e sviluppo individuale in attività operative assegnate."
        badge={`${staffTasks.length} azioni`}
      />

      <div style={st.statsGrid}>
        <StatCard label="Da fare" value={boardStats.todo} />
        <StatCard label="In corso" value={boardStats.doing} />
        <StatCard label="Alta priorità" value={boardStats.high} tone="red" />
        <StatCard label="Completate" value={boardStats.done} tone="green" />
      </div>

      <div style={{ ...st.layout, gridTemplateColumns: isMobile ? "1fr" : st.layout.gridTemplateColumns }}>
        <AppCard title="Nuova azione" subtitle="Crea un task chiaro, assegnato e verificabile.">
          <div style={{ ...st.formGrid, gridTemplateColumns: isMobile ? "1fr" : st.formGrid.gridTemplateColumns }}>
            <label style={st.label}>
              Titolo
              <input
                style={st.input}
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Es. Preparare clip uscite pressione"
              />
            </label>

            <label style={st.label}>
              Scadenza
              <input
                type="date"
                style={st.input}
                value={form.dueDate}
                onChange={(e) => updateForm("dueDate", e.target.value)}
              />
            </label>

            <label style={st.label}>
              Responsabile
              <select
                style={st.input}
                value={form.ownerRole}
                onChange={(e) => updateForm("ownerRole", e.target.value)}
              >
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label style={st.label}>
              Priorità
              <select
                style={st.input}
                value={form.priority}
                onChange={(e) => updateForm("priority", e.target.value)}
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Bassa</option>
              </select>
            </label>

            <label style={st.label}>
              Giocatore collegato
              <select
                style={st.input}
                value={form.playerId}
                onChange={(e) => updateForm("playerId", e.target.value)}
              >
                <option value="">Nessuno</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </label>

            <label style={{ ...st.label, gridColumn: "1 / -1" }}>
              Dettaglio operativo
              <textarea
                style={{ ...st.input, minHeight: 88, resize: "vertical" }}
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Cosa va fatto, da chi, con quale output atteso."
              />
            </label>
          </div>

          <div style={st.actions}>
            <Button onClick={saveTask}>Crea azione</Button>
            <Button variant="ghost" onClick={() => setForm(emptyForm)}>Pulisci</Button>
          </div>
        </AppCard>

        <AppCard
          title="Board operativo"
          subtitle="Vista rapida delle attività aperte, in corso e completate."
          rightContent={
            <div style={{ ...st.filters, width: isMobile ? "100%" : "auto" }}>
              <select style={{ ...st.compactSelect, width: isMobile ? "100%" : st.compactSelect.width }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tutti gli stati</option>
                <option value="todo">Da fare</option>
                <option value="doing">In corso</option>
                <option value="done">Fatto</option>
              </select>
              <select style={{ ...st.compactSelect, width: isMobile ? "100%" : st.compactSelect.width }} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                <option value="all">Tutti i ruoli</option>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          }
        >
          {filteredTasks.length === 0 ? (
            <EmptyState title="Nessuna azione" description="Crea la prima attività staff o cambia i filtri." />
          ) : (
            <div style={st.taskList}>
              {filteredTasks.map((task) => {
                const player = task.playerId ? playerById[task.playerId] : null;
                const relatedMatch = task.sourceType === "postMatch"
                  ? matches.find((match) => String(match.id) === String(task.sourceId))
                  : null;
                const sourceLabel = task.sourceType === "playerDevelopment"
                  ? "Da sviluppo giocatore"
                  : task.sourceType === "postMatch"
                    ? "Da post-gara"
                    : "";

                return (
                  <div key={task.id} style={st.taskCard}>
                    <div style={{ ...st.taskTop, flexDirection: isMobile ? "column" : "row" }}>
                      <div>
                        <h3 style={st.taskTitle}>{task.title}</h3>
                        <div style={st.metaRow}>
                          <Badge tone={PRIORITY_TONE[task.priority] || "blue"}>
                            {PRIORITY_LABEL[task.priority] || "Media"}
                          </Badge>
                          <span>{ROLE_LABEL[task.ownerRole] || task.ownerRole}</span>
                          {task.dueDate && <span>Scadenza {formatDate(task.dueDate)}</span>}
                        </div>
                      </div>
                      <select
                        style={{ ...st.statusSelect, width: isMobile ? "100%" : st.statusSelect.width }}
                        value={task.status}
                        onChange={(e) => updateTask(task.id, { status: e.target.value })}
                      >
                        <option value="todo">Da fare</option>
                        <option value="doing">In corso</option>
                        <option value="done">Fatto</option>
                      </select>
                    </div>

                    {task.description && <p style={st.description}>{task.description}</p>}

                    <div style={{ ...st.footerRow, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center" }}>
                      <div style={st.metaRow}>
                        {player && <span>Giocatore: {player.name}</span>}
                        {relatedMatch && <span>{sourceLabel}: {relatedMatch.opponent || "partita"}</span>}
                        {!relatedMatch && sourceLabel && <span>{sourceLabel}</span>}
                        <span>{STATUS_LABEL[task.status]}</span>
                      </div>
                      <button type="button" style={{ ...st.deleteBtn, width: isMobile ? "100%" : "auto" }} onClick={() => deleteTask(task.id)}>
                        Elimina
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>
      </div>

      <AppCard
        title="Agenda staff settimanale"
        subtitle="Distribuzione operativa delle azioni aperte per scadenza e responsabilità."
        rightContent={
          <div style={st.weekControls}>
            <Button variant="ghost" onClick={() => moveWeek(-1)}>← Settimana</Button>
            <input
              type="date"
              style={{ ...st.compactSelect, width: isMobile ? "100%" : 150 }}
              value={weekAnchor}
              onChange={(e) => setWeekAnchor(e.target.value)}
            />
            <Button variant="ghost" onClick={() => moveWeek(1)}>Settimana →</Button>
          </div>
        }
        style={{ marginTop: 18 }}
      >
        <div style={st.workloadRow}>
          {Object.entries(ROLE_LABEL).map(([role, label]) => (
            <div key={role} style={st.workloadPill}>
              <span>{label}</span>
              <strong>{workloadByRole[role] || 0}</strong>
            </div>
          ))}
        </div>

        <div style={{ ...st.weekGrid, gridTemplateColumns: isMobile ? "1fr" : st.weekGrid.gridTemplateColumns }}>
          {weekDays.map((day, index) => {
            const tasks = agendaTasks.buckets[day.key] || [];
            return (
              <div key={day.key} style={st.dayColumn}>
                <div style={st.dayHeader}>
                  <div>
                    <strong>{DAY_LABELS[index]}</strong>
                    <span>{formatDate(day.key)}</span>
                  </div>
                  <Badge tone={tasks.length ? "blue" : "green"}>{tasks.length}</Badge>
                </div>

                {tasks.length === 0 ? (
                  <p style={st.emptyDay}>Nessuna azione</p>
                ) : (
                  <div style={st.agendaList}>
                    {tasks.map((task) => (
                      <AgendaTask
                        key={task.id}
                        task={task}
                        player={task.playerId ? playerById[task.playerId] : null}
                        onStatusChange={(status) => updateTask(task.id, { status })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {agendaTasks.unscheduled.length > 0 && (
          <div style={st.unscheduledBox}>
            <div style={st.dayHeader}>
              <div>
                <strong>Da pianificare</strong>
                <span>Azioni senza scadenza</span>
              </div>
              <Badge tone="orange">{agendaTasks.unscheduled.length}</Badge>
            </div>
            <div style={st.unscheduledGrid}>
              {agendaTasks.unscheduled.map((task) => (
                <AgendaTask
                  key={task.id}
                  task={task}
                  player={task.playerId ? playerById[task.playerId] : null}
                  onStatusChange={(status) => updateTask(task.id, { status })}
                />
              ))}
            </div>
          </div>
        )}
      </AppCard>
    </div>
  );
}

function AgendaTask({ task, player, onStatusChange }) {
  return (
    <div style={st.agendaTask}>
      <div style={st.agendaTaskTop}>
        <strong>{task.title}</strong>
        <Badge tone={PRIORITY_TONE[task.priority] || "blue"}>
          {PRIORITY_LABEL[task.priority] || "Media"}
        </Badge>
      </div>
      <div style={st.metaRow}>
        <span>{ROLE_LABEL[task.ownerRole] || task.ownerRole}</span>
        {player && <span>{player.name}</span>}
      </div>
      <select
        style={st.agendaSelect}
        value={task.status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="todo">Da fare</option>
        <option value="doing">In corso</option>
        <option value="done">Fatto</option>
      </select>
    </div>
  );
}

function StatCard({ label, value, tone = "blue" }) {
  const color = tone === "red" ? "#fb7185" : tone === "green" ? "#86efac" : "#38bdf8";
  return (
    <div style={st.statCard}>
      <span style={st.statLabel}>{label}</span>
      <strong style={{ ...st.statValue, color }}>{value}</strong>
    </div>
  );
}

function sortTasksForAgenda(a, b) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const statusOrder = { doing: 0, todo: 1, done: 2 };
  return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    || (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
    || String(a.title || "").localeCompare(String(b.title || ""));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekDays(anchorKey) {
  const start = getWeekStart(anchorKey);
  return Array.from({ length: 7 }, (_, index) => {
    const key = addDays(start, index);
    return { key };
  });
}

function getWeekStart(dateKey) {
  const date = parseDateKey(dateKey);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return toDateKey(date);
}

function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || getTodayKey()).split("-").map(Number);
  return new Date(year || 2026, (month || 1) - 1, day || 1);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const st = {
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    padding: 18,
    borderRadius: 18,
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(148,163,184,0.18)",
  },
  statLabel: {
    display: "block",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 1,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 0.8fr) minmax(0, 1.2fr)",
    gap: 18,
    alignItems: "start",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 7,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  input: {
    ...styles.input,
    width: "100%",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  filters: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  compactSelect: {
    ...styles.input,
    width: 150,
    padding: "9px 11px",
  },
  taskList: {
    display: "grid",
    gap: 12,
  },
  taskCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(2,6,23,0.34)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  taskTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  taskTitle: {
    margin: "0 0 8px",
    color: "#f8fafc",
    fontSize: 18,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  statusSelect: {
    ...styles.input,
    width: 130,
    padding: "9px 10px",
  },
  description: {
    margin: "12px 0 0",
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  footerRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  deleteBtn: {
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(127,29,29,0.18)",
    color: "#fecaca",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  weekControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  workloadRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginBottom: 16,
  },
  workloadPill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.62)",
    border: "1px solid rgba(148,163,184,0.14)",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
  },
  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 10,
    alignItems: "stretch",
  },
  dayColumn: {
    minHeight: 190,
    padding: 12,
    borderRadius: 16,
    background: "rgba(2,6,23,0.32)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
    color: "#f8fafc",
  },
  emptyDay: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  agendaList: {
    display: "grid",
    gap: 8,
  },
  agendaTask: {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  agendaTaskTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
    color: "#f8fafc",
    fontSize: 13,
    lineHeight: 1.3,
  },
  agendaSelect: {
    ...styles.input,
    width: "100%",
    padding: "8px 9px",
    fontSize: 12,
  },
  unscheduledBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "rgba(251,191,36,0.07)",
    border: "1px solid rgba(251,191,36,0.18)",
  },
  unscheduledGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
};
