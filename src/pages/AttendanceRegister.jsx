import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import SearchBar from "../components/ui/SearchBar";
import { useAreaPermission } from "../components/auth/permissionContext";
import { useAuth } from "../hooks/useAuth";
import { styles } from "../styles/index.js";
import { formatShortDate } from "../utils/helpers";
import { fetchTeamRpe } from "../services/sessionRpe";
import { useTranslation } from "../i18n";

const STATUS_FLOW = ["Presente", "Assente", "Infortunato", "Recupero", "Permesso", "Squalificato"];

const STATUS_META = {
  Presente:     { code: "P",  tone: "green",  color: "#4ade80", bg: "rgba(34,197,94,0.13)", border: "rgba(34,197,94,0.36)" },
  Assente:      { code: "A",  tone: "red",    color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.34)" },
  Infortunato:  { code: "I",  tone: "orange", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.36)" },
  Recupero:     { code: "R",  tone: "blue",   color: "#38bdf8", bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.34)" },
  Permesso:     { code: "Pe", tone: "blue",   color: "#93c5fd", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.34)" },
  Squalificato: { code: "S",  tone: "purple", color: "#c4b5fd", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.34)" },
};

const PRESENT_STATUSES = new Set(["Presente", "Recupero"]);
const ABSENT_STATUSES = new Set(["Assente", "Permesso", "Squalificato"]);

function getPlayerName(player) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "-";
}

function getSessionMonth(session) {
  return String(session.date || "").slice(0, 7);
}

// Assenze pianificate (ferie/permessi/studio/lavoro) dalla scheda giocatore:
// se la data della seduta cade in un intervallo dichiarato, lo stato di default
// non deve essere "Presente" — il mister non dovrebbe doverlo correggere a mano
// per ogni seduta in cui il giocatore è già segnalato assente.
function getAbsenceStatus(player, dateStr) {
  if (!dateStr) return null;
  const absence = (player.absences || []).find(
    (a) => a.dateStart && a.dateEnd && dateStr >= a.dateStart && dateStr <= a.dateEnd
  );
  return absence ? "Permesso" : null;
}

function getDefaultStatus(player, dateStr) {
  const absenceStatus = getAbsenceStatus(player, dateStr);
  if (absenceStatus) return absenceStatus;
  if (player.status === "Infortunato") return "Infortunato";
  if (player.status === "Squalificato") return "Squalificato";
  if (player.status === "Recupero" || player.status === "Differenziato") return "Recupero";
  // I Juniores non fanno parte del gruppo base: di default risultano Assenti
  // per ogni seduta, finché il mister non li marca manualmente Presenti
  // (a quel punto contano come un disponibile aggiuntivo rispetto alla prima squadra).
  if ((player.gruppo || "prima") === "juniores") return "Assente";
  return "Presente";
}

// Giorni multabili: assenze non giustificate (status "Assente") oppure ferie
// dichiarate dal giocatore (player.absences con type "ferie"). Permesso/Studio/
// Lavoro restano giustificati e non vengono contati. Contando solo le sedute
// di allenamento realmente esistenti, un giorno senza seduta non pesa mai sul
// conteggio (es. sabato senza allenamento non allunga l'assenza).
function getFineEntry(player, session) {
  const dateStr = session.date;
  const entry = session.attendance?.[String(player.id)] || {};
  const status = entry.status || getDefaultStatus(player, dateStr);
  if (status === "Assente") return { reason: "Assente" };
  if (status === "Permesso") {
    const absence = (player.absences || []).find(
      (a) => a.dateStart && a.dateEnd && dateStr >= a.dateStart && dateStr <= a.dateEnd
    );
    if (absence?.type === "ferie") return { reason: "Ferie" };
  }
  return null;
}

function buildFineRows(players, sessions, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) return [];
  const inRange = sessions.filter((session) => session.date >= rangeStart && session.date <= rangeEnd);
  return players
    .map((player) => {
      const entries = inRange
        .map((session) => {
          const fine = getFineEntry(player, session);
          return fine ? { date: session.date, reason: fine.reason } : null;
        })
        .filter(Boolean);
      return {
        playerId: player.id,
        name: getPlayerName(player),
        role: player.role || "",
        count: entries.length,
        entries,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function getDuration(session) {
  return Number(session.duration || 0) || (session.exercises || []).reduce(
    (sum, item) => sum + Number(item.customDuration || item.duration || 0),
    0
  );
}

export default function AttendanceRegister({ players = [], sessions = [], setSessions, teamId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();
  const auth = useAuth();
  const teamName = auth.profile?.teamName || auth.profile?.clubName || auth.team?.name || "Squadra";
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("tutti");
  const [finesRange, setFinesRange] = useState({ start: "", end: "" });
  const [exportingFines, setExportingFines] = useState(false);
  const [month, setMonth] = useState(() => {
    const latest = [...sessions]
      .filter((session) => session.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return latest?.date ? latest.date.slice(0, 7) : new Date().toISOString().slice(0, 7);
  });

  // RPE autodichiarato dai giocatori dal portale (tabella session_rpe) — usato come
  // pre-compilazione quando il mister non ha ancora inserito/corretto un valore.
  const [playerRpe, setPlayerRpe] = useState([]);
  useEffect(() => {
    if (!teamId) return;
    let active = true;
    fetchTeamRpe({ teamId }).then(({ data }) => {
      if (active) setPlayerRpe(data || []);
    });
    return () => { active = false; };
  }, [teamId]);

  const playerRpeIndex = useMemo(() => {
    const index = {};
    playerRpe.forEach((r) => { index[`${r.player_id}:${r.event_id}`] = r.rpe_value; });
    return index;
  }, [playerRpe]);

  const trainingSessions = useMemo(
    () => [...sessions]
      .filter((session) => (session.type || "Allenamento") === "Allenamento")
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [sessions]
  );

  const visibleSessions = useMemo(
    () => trainingSessions.filter((session) => getSessionMonth(session) === month),
    [trainingSessions, month]
  );

  const groups = useMemo(
    () => Array.from(new Set(players.map((player) => player.gruppo || "prima"))).sort(),
    [players]
  );

  const visiblePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return players
      .filter((player) => groupFilter === "tutti" || (player.gruppo || "prima") === groupFilter)
      .filter((player) => {
        if (!needle) return true;
        return `${getPlayerName(player)} ${player.role || ""} ${player.shirtNumber || ""}`
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)));
  }, [players, groupFilter, search]);

  const visiblePrimaryPlayers = useMemo(
    () => visiblePlayers.filter((player) => (player.gruppo || "prima") !== "juniores"),
    [visiblePlayers]
  );
  const visibleJuniorPlayers = useMemo(
    () => visiblePlayers.filter((player) => (player.gruppo || "prima") === "juniores"),
    [visiblePlayers]
  );

  const registerStats = useMemo(
    () => buildRegisterStats(visiblePlayers, visibleSessions, playerRpeIndex),
    [visiblePlayers, visibleSessions, playerRpeIndex]
  );

  const fineRows = useMemo(
    () => buildFineRows(visiblePlayers, trainingSessions, finesRange.start, finesRange.end),
    [visiblePlayers, trainingSessions, finesRange]
  );

  async function exportFinesPDF() {
    if (!fineRows.length) return;
    setExportingFines(true);
    try {
      const { generateFinesReportPDF } = await import("../utils/generateFinesReportPDF");
      await generateFinesReportPDF({
        rows: fineRows,
        rangeStart: finesRange.start,
        rangeEnd: finesRange.end,
        teamName,
      });
    } finally {
      setExportingFines(false);
    }
  }

  function updateAttendance(sessionId, playerId, patch) {
    if (!canManage) return;
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (String(session.id) !== String(sessionId)) return session;
        const current = session.attendance?.[playerId] || {};
        return {
          ...session,
          attendance: {
            ...(session.attendance || {}),
            [playerId]: { ...current, ...patch },
          },
        };
      })
    );
  }

  function cycleStatus(session, player) {
    if (!canManage) return;
    const playerId = String(player.id);
    const current = session.attendance?.[playerId]?.status || getDefaultStatus(player, session.date);
    const currentIndex = STATUS_FLOW.indexOf(current);
    const nextStatus = STATUS_FLOW[(currentIndex + 1) % STATUS_FLOW.length] || "Presente";
    updateAttendance(session.id, playerId, { status: nextStatus });
  }

  function markSession(sessionId, status, targetPlayers = visiblePlayers) {
    if (!canManage) return;
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (String(session.id) !== String(sessionId)) return session;
        const nextAttendance = { ...(session.attendance || {}) };
        targetPlayers.forEach((player) => {
          const playerId = String(player.id);
          nextAttendance[playerId] = {
            ...(nextAttendance[playerId] || {}),
            status,
          };
        });
        return { ...session, attendance: nextAttendance };
      })
    );
  }

  function renderAttendanceTable(tablePlayers, { title = "", subtitle = "" } = {}) {
    if (!tablePlayers.length) return null;

    return (
      <AppCard style={{ overflow: "hidden", padding: 0 }}>
        {title && (
          <div style={ar.tableSectionHeader}>
            <div>
              <h3 style={ar.tableSectionTitle}>{title}</h3>
              {subtitle && <p style={ar.tableSectionSubtitle}>{subtitle}</p>}
            </div>
            <Badge tone="blue">{tablePlayers.length}</Badge>
          </div>
        )}
        <div style={ar.tableScroller}>
          <table style={ar.table}>
            <thead>
              <tr>
                <th style={{ ...ar.th, ...ar.playerTh }}>{t("pages.attendanceRegister.player")}</th>
                {visibleSessions.map((session) => (
                  <th key={session.id} style={ar.th}>
                    <button
                      type="button"
                      onClick={() => navigate(`/session-attendance/${session.id}`)}
                      style={ar.sessionLink}
                      title={session.title || t("pages.attendanceRegister.sessionFallback")}
                    >
                      <span>{formatShortDate(session.date)}</span>
                      <small>{session.title || t("pages.attendanceRegister.sessionFallback")}</small>
                    </button>
                    {canManage && (
                      <div style={ar.columnActions}>
                        <button type="button" onClick={() => markSession(session.id, "Presente", tablePlayers)} style={ar.miniAction}>P</button>
                        <button type="button" onClick={() => markSession(session.id, "Assente", tablePlayers)} style={ar.miniAction}>A</button>
                      </div>
                    )}
                  </th>
                ))}
                <th style={ar.th}>{t("pages.attendanceRegister.presencePct")}</th>
                <th style={ar.th}>{t("pages.attendanceRegister.load")}</th>
              </tr>
            </thead>
            <tbody>
              {tablePlayers.map((player) => {
                const rowStats = buildPlayerStats(player, visibleSessions, playerRpeIndex);
                return (
                  <tr key={player.id}>
                    <td style={{ ...ar.td, ...ar.playerTd }}>
                      <div style={ar.playerCell}>
                        <strong>{getPlayerName(player)}</strong>
                        <span>{player.role || "-"}{player.shirtNumber ? ` · #${player.shirtNumber}` : ""}</span>
                      </div>
                    </td>

                    {visibleSessions.map((session) => {
                      const playerId = String(player.id);
                      const entry = session.attendance?.[playerId] || {};
                      const status = entry.status || getDefaultStatus(player, session.date);
                      const meta = STATUS_META[status] || STATUS_META.Presente;
                      const showRpe = status === "Presente" || status === "Recupero";
                      const playerSubmittedRpe = playerRpeIndex[`${playerId}:${session.id}`];
                      const effectiveRpe = entry.rpe ?? playerSubmittedRpe ?? "";

                      return (
                        <td key={`${session.id}-${playerId}`} style={ar.td}>
                          <div style={ar.cellStack}>
                            <button
                              type="button"
                              onClick={() => cycleStatus(session, player)}
                              disabled={!canManage}
                              style={{
                                ...ar.statusCell,
                                color: meta.color,
                                background: meta.bg,
                                borderColor: meta.border,
                              }}
                              title={t("pages.attendanceRegister.cycleStatus")}
                            >
                              {meta.code}
                            </button>
                            {showRpe && (
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="0.5"
                                value={effectiveRpe}
                                onChange={(event) => updateAttendance(session.id, playerId, { rpe: event.target.value })}
                                disabled={!canManage}
                                placeholder="RPE"
                                style={{
                                  ...ar.rpeInput,
                                  ...(entry.rpe == null && playerSubmittedRpe != null ? ar.rpeInputSelf : {}),
                                }}
                                title={entry.rpe == null && playerSubmittedRpe != null ? t("pages.attendanceRegister.rpeSelfReported") : undefined}
                                aria-label={t("pages.attendanceRegister.rpeFor", { name: getPlayerName(player) })}
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td style={ar.td}>
                      <Badge tone={rowStats.presencePct < 70 ? "red" : rowStats.presencePct < 85 ? "orange" : "green"}>
                        {rowStats.presencePct}%
                      </Badge>
                    </td>
                    <td style={ar.td}>
                      <span style={ar.loadValue}>{rowStats.load}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AppCard>
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title={t("pages.attendanceRegister.title")}
        subtitle={t("pages.attendanceRegister.subtitle")}
        action={
          <div style={ar.actions}>
            <Button variant="ghost" onClick={() => navigate("/trainings")}>
              {t("pages.attendanceRegister.backToTrainings")}
            </Button>
            <Button onClick={() => navigate("/statistics")}>
              {t("pages.attendanceRegister.openStats")}
            </Button>
          </div>
        }
      />

      <AppCard>
        <div style={ar.toolbar}>
          <div style={ar.metrics}>
            <Metric label={t("pages.attendanceRegister.metricSessions")} value={visibleSessions.length} tone="blue" />
            <Metric label={t("pages.attendanceRegister.metricPresence")} value={`${registerStats.presencePct}%`} tone="green" />
            <Metric label={t("pages.attendanceRegister.metricAbsences")} value={registerStats.absences} tone="red" />
            <Metric label={t("pages.attendanceRegister.metricInjuries")} value={registerStats.injuries} tone="orange" />
            <Metric label={t("pages.attendanceRegister.metricAvgRpe")} value={registerStats.avgRpe || "-"} tone="purple" />
          </div>

          <div style={ar.filters}>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={styles.input}
              aria-label={t("pages.attendanceRegister.month")}
            />
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              style={styles.input}
              aria-label={t("pages.attendanceRegister.group")}
            >
              <option value="tutti">{t("pages.attendanceRegister.allGroups")}</option>
              {groups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={t("pages.attendanceRegister.search")}
            />
          </div>
        </div>

        <div style={ar.legend}>
          {STATUS_FLOW.map((status) => (
            <span key={status} style={{ ...ar.legendItem, color: STATUS_META[status].color }}>
              <strong>{STATUS_META[status].code}</strong> {t(`pages.attendanceRegister.status.${status}`)}
            </span>
          ))}
        </div>
      </AppCard>

      <AppCard>
        <div style={ar.finesHeader}>
          <div>
            <h3 style={ar.finesTitle}>{t("pages.attendanceRegister.fines.title")}</h3>
            <p style={ar.finesSubtitle}>{t("pages.attendanceRegister.fines.subtitle")}</p>
          </div>
          <div style={ar.finesRangeInputs}>
            <input
              type="date"
              value={finesRange.start}
              onChange={(event) => setFinesRange((prev) => ({ ...prev, start: event.target.value }))}
              style={styles.input}
              aria-label={t("pages.attendanceRegister.fines.from")}
            />
            <input
              type="date"
              value={finesRange.end}
              onChange={(event) => setFinesRange((prev) => ({ ...prev, end: event.target.value }))}
              style={styles.input}
              aria-label={t("pages.attendanceRegister.fines.to")}
            />
            <Button
              variant="ghost"
              disabled={!fineRows.length || exportingFines}
              onClick={exportFinesPDF}
            >
              {exportingFines ? t("pages.attendanceRegister.fines.exporting") : t("pages.attendanceRegister.fines.exportPdf")}
            </Button>
          </div>
        </div>

        {!finesRange.start || !finesRange.end ? (
          <p style={ar.finesEmpty}>{t("pages.attendanceRegister.fines.pickRange")}</p>
        ) : !fineRows.length ? (
          <p style={ar.finesEmpty}>{t("pages.attendanceRegister.fines.none")}</p>
        ) : (
          <div style={ar.finesList}>
            {fineRows.map((row) => (
              <div key={row.playerId} style={ar.finesRow}>
                <div style={ar.finesRowHead}>
                  <strong>{row.name}</strong>
                  <Badge tone="red">{t("pages.attendanceRegister.fines.daysCount", { count: row.count })}</Badge>
                </div>
                <p style={ar.finesDates}>
                  {row.entries.map((e) => `${formatShortDate(e.date)} (${e.reason})`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </AppCard>

      {!visibleSessions.length ? (
        <EmptyState
          icon="📋"
          title={t("pages.attendanceRegister.noSessionsTitle")}
          text={t("pages.attendanceRegister.noSessionsText")}
          action={canManage ? <Button onClick={() => navigate("/trainings")}>{t("pages.attendanceRegister.createSession")}</Button> : null}
        />
      ) : !visiblePlayers.length ? (
        <EmptyState
          icon="👥"
          title={t("pages.attendanceRegister.noPlayersTitle")}
          text={t("pages.attendanceRegister.noPlayersText")}
        />
      ) : (
        <div style={ar.tableSections}>
          {renderAttendanceTable(visiblePrimaryPlayers)}
          {renderAttendanceTable(visibleJuniorPlayers, {
            title: t("pages.players.groupJuniores"),
            subtitle: t("pages.attendanceRegister.junioresHint"),
          })}
        </div>
      )}
    </div>
  );
}

function buildRegisterStats(players, sessions, playerRpeIndex = {}) {
  let present = 0;
  let absences = 0;
  let injuries = 0;
  let cells = 0;
  const rpes = [];

  players.forEach((player) => {
    sessions.forEach((session) => {
      cells += 1;
      const entry = session.attendance?.[String(player.id)] || {};
      const status = entry.status || getDefaultStatus(player, session.date);
      const effectiveRpe = entry.rpe ?? playerRpeIndex[`${player.id}:${session.id}`];
      if (PRESENT_STATUSES.has(status)) present += 1;
      if (ABSENT_STATUSES.has(status)) absences += 1;
      if (status === "Infortunato") injuries += 1;
      if (PRESENT_STATUSES.has(status) && Number(effectiveRpe || 0)) rpes.push(Number(effectiveRpe));
    });
  });

  return {
    presencePct: cells ? Math.round((present / cells) * 100) : 0,
    absences,
    injuries,
    avgRpe: rpes.length ? Number((rpes.reduce((sum, value) => sum + value, 0) / rpes.length).toFixed(1)) : 0,
  };
}

function buildPlayerStats(player, sessions, playerRpeIndex = {}) {
  let present = 0;
  let load = 0;

  sessions.forEach((session) => {
    const entry = session.attendance?.[String(player.id)] || {};
    const status = entry.status || getDefaultStatus(player, session.date);
    const effectiveRpe = entry.rpe ?? playerRpeIndex[`${player.id}:${session.id}`];
    if (PRESENT_STATUSES.has(status)) {
      present += 1;
      load += getDuration(session) * Number(effectiveRpe || 0);
    }
  });

  return {
    presencePct: sessions.length ? Math.round((present / sessions.length) * 100) : 0,
    load,
  };
}

function Metric({ label, value, tone = "slate" }) {
  const colors = {
    blue: "#60a5fa",
    green: "#4ade80",
    red: "#f87171",
    orange: "#fbbf24",
    purple: "#c4b5fd",
    slate: "#cbd5e1",
  };

  return (
    <div style={ar.metric}>
      <strong style={{ color: colors[tone] || colors.slate }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const ar = {
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  toolbar: {
    display: "grid",
    gap: 18,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))",
    gap: 10,
  },
  metric: {
    minHeight: 72,
    padding: "12px 13px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 7,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 190px) minmax(150px, 190px) minmax(220px, 1fr)",
    gap: 10,
    alignItems: "center",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 800,
  },
  finesHeader: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
  },
  finesTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "#e2e8f0",
  },
  finesSubtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#94a3b8",
  },
  finesRangeInputs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  finesEmpty: {
    margin: "14px 0 0",
    fontSize: 13,
    color: "#64748b",
  },
  finesList: {
    display: "grid",
    gap: 8,
    marginTop: 14,
  },
  finesRow: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(248,113,113,0.06)",
    border: "1px solid rgba(248,113,113,0.18)",
  },
  finesRowHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  finesDates: {
    margin: "6px 0 0",
    fontSize: 12,
    color: "#94a3b8",
  },
  tableSections: {
    display: "grid",
    gap: 18,
  },
  tableSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: "rgba(59,130,246,0.07)",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },
  tableSectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    color: "#e2e8f0",
  },
  tableSectionSubtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#94a3b8",
  },
  tableScroller: {
    overflow: "auto",
    maxHeight: "calc(100vh - 260px)",
  },
  table: {
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: 920,
    width: "100%",
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    minWidth: 104,
    padding: 10,
    background: "#111827",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    fontSize: 12,
    textAlign: "center",
    verticalAlign: "top",
  },
  playerTh: {
    left: 0,
    zIndex: 4,
    minWidth: 230,
    textAlign: "left",
  },
  td: {
    minWidth: 104,
    padding: 9,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    borderRight: "1px solid rgba(255,255,255,0.045)",
    background: "rgba(15,23,42,0.58)",
    textAlign: "center",
  },
  playerTd: {
    position: "sticky",
    left: 0,
    zIndex: 3,
    minWidth: 230,
    background: "#0f172a",
    textAlign: "left",
  },
  playerCell: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  sessionLink: {
    width: "100%",
    display: "grid",
    gap: 4,
    border: 0,
    background: "transparent",
    color: "#e2e8f0",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 900,
  },
  columnActions: {
    display: "flex",
    justifyContent: "center",
    gap: 5,
    marginTop: 7,
  },
  miniAction: {
    width: 26,
    height: 24,
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  cellStack: {
    display: "grid",
    justifyItems: "center",
    gap: 6,
  },
  statusCell: {
    width: 42,
    height: 34,
    borderRadius: 10,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  rpeInput: {
    width: 54,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.07)",
    color: "#e2e8f0",
    fontSize: 12,
    textAlign: "center",
    outline: "none",
  },
  rpeInputSelf: {
    border: "1px solid rgba(168,85,247,0.4)",
    background: "rgba(168,85,247,0.1)",
  },
  loadValue: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 900,
  },
};
