import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
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
import { comparePlayersByName, formatShortDate, getPlayerSortKey, getPlayerUnavailabilityOnDate } from "../utils/helpers";
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

// Le date sono confrontate come stringhe "YYYY-MM-DD": funziona solo se sono
// sempre già in quel formato esatto. Normalizziamo qui ogni data "in ingresso"
// (sedute, partite, range del report) così un formato diverso (es. "2026-8-4"
// senza zero-padding) non rompe silenziosamente i confronti `>=`/`<=`.
function normalizeDateStr(value) {
  if (!value) return "";
  const raw = String(value);
  // Data pura "YYYY-MM-DD" senza orario: nessuna conversione di fuso da fare.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Se arriva un timestamp con orario (es. ISO con "T..."), NON si può
  // prendere lo slice dei primi 10 caratteri: quello è il giorno in UTC, ma
  // un orario serale italiano vicino alla mezzanotte UTC può "scivolare" al
  // giorno sbagliato. Si usano i componenti della data nel fuso locale.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Indisponibilità "forte" per una data: lo status esplicito sulla scheda
// giocatore (player.status) ha sempre la priorità più alta perché è una
// decisione attiva del mister; poi gli infortuni datati (player.injuries[]);
// infine le assenze pianificate (player.absences[]: ferie/permesso/studio/
// lavoro). Un infortunio batte sempre una ferie sovrapposta sullo stesso
// giorno — non deve mai diventare una multa.
function getUnavailabilityStatus(player, dateStr) {
  if (player.status === "Infortunato") return "Infortunato";
  if (player.status === "Squalificato") return "Squalificato";
  const unavailability = getPlayerUnavailabilityOnDate(player, dateStr);
  if (unavailability?.type === "injury") return "Infortunato";
  if (unavailability?.type === "absence") return "Permesso";
  return null;
}

function getDefaultStatus(player, dateStr) {
  const unavailableStatus = getUnavailabilityStatus(player, dateStr);
  if (unavailableStatus) return unavailableStatus;
  if (player.status === "Recupero" || player.status === "Differenziato") return "Recupero";
  // I Juniores non fanno parte del gruppo base: di default risultano Assenti
  // per ogni seduta, finché il mister non li marca manualmente Presenti
  // (a quel punto contano come un disponibile aggiuntivo rispetto alla prima squadra).
  if ((player.gruppo || "prima") === "juniores") return "Assente";
  return "Presente";
}

// Le partite ufficiali (campionato/coppa) non hanno una riga "attendance"
// modificabile come le sedute: la presenza è quella decisa in Convocazione
// (match.convocazione.playerIds), ma SOLO se la convocazione è stata
// effettivamente pubblicata (match.convocazione.published === true) — una
// bozza con dei nomi selezionati ma non pubblicata non conta ancora come
// decisione definitiva. "Assente" va segnato SOLO se c'è una vera
// indisponibilità dichiarata (ferie/permesso/infortunio/squalifica) per quella
// data, oppure se la convocazione è pubblicata e il giocatore non ne fa parte.
// Le amichevoli invece non richiedono affatto convocazione: si comportano
// come un allenamento normale (vedi getSessionStatus).
function getMatchStatus(player, session) {
  const unavailableStatus = getUnavailabilityStatus(player, session.date);
  if (unavailableStatus) return unavailableStatus;
  if (!session.convocationPublished) return "Presente";
  const convocatiIds = session.convocatiIds || [];
  return convocatiIds.includes(String(player.id)) ? "Presente" : "Assente";
}

function getSessionStatus(player, session) {
  if (session.isMatch && !session.isFriendly) return getMatchStatus(player, session);
  const entry = session.attendance?.[String(player.id)] || {};
  // Uno status salvato ma non riconosciuto (dato corrotto/malformato) non deve
  // mai "vincere" silenziosamente: si ricalcola il default come se non fosse
  // stato impostato, così resta coerente con le statistiche aggregate.
  if (entry.status && STATUS_META[entry.status]) return entry.status;
  return getDefaultStatus(player, session.date);
}

function findOverlappingAbsence(player, dateStr, { type, excludeType } = {}) {
  return (player.absences || []).find((a) => {
    if (type && a.type !== type) return false;
    if (excludeType && a.type === excludeType) return false;
    const start = normalizeDateStr(a.dateStart);
    const end = normalizeDateStr(a.dateEnd);
    return start && end && dateStr >= start && dateStr <= end;
  });
}

// Giorni multabili: assenze non giustificate (status "Assente") oppure ferie
// dichiarate dal giocatore (player.absences con type "ferie", verificate
// direttamente e non tramite lo status aggregato, perché più assenze di tipo
// diverso possono sovrapporsi sulla stessa data). Permesso/Studio/Lavoro
// restano SEMPRE giustificati e bloccano la multa — anche se quel giorno la
// seduta è stata marcata manualmente "Assente", o se la stessa data è anche
// dentro un periodo di ferie: una giustificazione non-ferie prevale sempre.
// Un infortunio o una squalifica bloccano sempre la multa allo stesso modo.
// Si contano SOLO i giorni in cui c'è davvero una seduta/impegno multabile
// (allenamento o amichevole): un giorno senza seduta (es. riposo) non deve
// mai comparire, anche se cade dentro un periodo di ferie dichiarato.
// Campionato/coppa restano fuori: un "non convocato" può dipendere da scelte
// tecniche, non da una colpa del giocatore.
function getFineEntry(player, session) {
  const dateStr = session.date;
  const blockingStatus = getUnavailabilityStatus(player, dateStr);
  if (blockingStatus === "Infortunato" || blockingStatus === "Squalificato") return null;
  if (findOverlappingAbsence(player, dateStr, { excludeType: "ferie" })) return null;
  const status = getSessionStatus(player, session);
  if (status === "Assente") return { reason: "Assente" };
  if (findOverlappingAbsence(player, dateStr, { type: "ferie" })) return { reason: "Ferie" };
  return null;
}

function buildFineRows(players, sessions, rangeStartRaw, rangeEndRaw) {
  const rangeStart = normalizeDateStr(rangeStartRaw);
  const rangeEnd = normalizeDateStr(rangeEndRaw);
  if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return [];
  const inRange = sessions
    .filter((session) => session.date >= rangeStart && session.date <= rangeEnd)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return players
    .map((player) => {
      // Più sedute nello stesso giorno (es. doppia seduta) non devono contare
      // come più "giorni" multabili: si deduplica per data.
      const entriesByDate = new Map();
      inRange.forEach((session) => {
        if (entriesByDate.has(session.date)) return;
        const fine = getFineEntry(player, session);
        if (fine) entriesByDate.set(session.date, { date: session.date, reason: fine.reason });
      });
      const entries = [...entriesByDate.values()];
      return {
        playerId: player.id,
        name: getPlayerName(player),
        sortKey: getPlayerSortKey(player),
        role: player.role || "",
        count: entries.length,
        entries,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.sortKey.localeCompare(b.sortKey));
}

const MATCH_DEFAULT_DURATION = 90;

function getDuration(session) {
  if (session.isMatch) return Number(session.duration || 0) || MATCH_DEFAULT_DURATION;
  const explicit = Number(session.duration || 0);
  if (explicit) return explicit;
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  return exercises.reduce((sum, item) => {
    const value = Number(item?.customDuration || item?.duration || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export default function AttendanceRegister({ players = [], sessions = [], setSessions, matches = [], setMatches, teamId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();
  const auth = useAuth();
  const isMobile = useIsMobile();
  const teamName = auth.profile?.teamName || auth.profile?.clubName || auth.team?.name || "Squadra";
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("tutti");
  // Le statistiche aggregate in testa alla pagina rappresentano di default
  // solo la Prima Squadra (coerente con Players.jsx/Availability.jsx); i
  // Juniores entrano nel calcolo solo se il mister lo richiede esplicitamente.
  const [includeJuniorsInStats, setIncludeJuniorsInStats] = useState(false);
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

  const matchSessions = useMemo(
    () => matches
      .filter((match) => match.date)
      .map((match) => ({
        id: match.id,
        date: normalizeDateStr(match.date),
        title: match.opponent || match.title || "Partita",
        type: "Partita",
        isMatch: true,
        // Case-insensitive: il valore arriva dal select della pagina Partite,
        // ma normalizziamo comunque per non rompersi su dati importati o futuri.
        isFriendly: String(match.matchKind || "").trim().toLowerCase() === "amichevole",
        convocationPublished: Boolean(match.convocazione?.published),
        convocatiIds: (match.convocazione?.playerIds || []).map(String),
        attendance: match.attendance || {},
      })),
    [matches]
  );

  const trainingSessions = useMemo(
    () => sessions
      .filter((session) => (session.type || "Allenamento") === "Allenamento")
      .map((session) => ({ ...session, date: normalizeDateStr(session.date) })),
    [sessions]
  );

  const friendlyMatchSessions = useMemo(
    () => matchSessions.filter((session) => session.isFriendly),
    [matchSessions]
  );

  // Sedute che contano per il Report multe: allenamenti + amichevoli (sono
  // equivalenti a un allenamento, niente convocazione necessaria). Campionato
  // e coppa restano fuori — vedi nota su getFineEntry.
  const finableSessions = useMemo(
    () => [...trainingSessions, ...friendlyMatchSessions],
    [trainingSessions, friendlyMatchSessions]
  );

  // Tutte le sedute di allenamento + le partite (amichevoli/campionato/coppa),
  // ordinate cronologicamente: la tabella presenze mostra anche i giorni di
  // gara.
  const allSessions = useMemo(
    () => [...trainingSessions, ...matchSessions]
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [trainingSessions, matchSessions]
  );

  const visibleSessions = useMemo(
    () => allSessions.filter((session) => getSessionMonth(session) === month),
    [allSessions, month]
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
      .sort(comparePlayersByName);
  }, [players, groupFilter, search]);

  const visiblePrimaryPlayers = useMemo(
    () => visiblePlayers.filter((player) => (player.gruppo || "prima") !== "juniores"),
    [visiblePlayers]
  );
  const visibleJuniorPlayers = useMemo(
    () => visiblePlayers.filter((player) => (player.gruppo || "prima") === "juniores"),
    [visiblePlayers]
  );

  // Indipendente dal filtro gruppo usato per le tabelle: le metriche restano
  // scoped alla Prima Squadra a meno che non si spunti esplicitamente di
  // includere anche i Juniores.
  const statsPlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return players
      .filter((player) => includeJuniorsInStats || (player.gruppo || "prima") !== "juniores")
      .filter((player) => {
        if (!needle) return true;
        return `${getPlayerName(player)} ${player.role || ""} ${player.shirtNumber || ""}`
          .toLowerCase()
          .includes(needle);
      });
  }, [players, includeJuniorsInStats, search]);

  const registerStats = useMemo(
    () => buildRegisterStats(statsPlayers, visibleSessions, playerRpeIndex),
    [statsPlayers, visibleSessions, playerRpeIndex]
  );

  const isFinesRangeInverted = Boolean(
    finesRange.start && finesRange.end && normalizeDateStr(finesRange.start) > normalizeDateStr(finesRange.end)
  );

  const fineRows = useMemo(
    () => buildFineRows(statsPlayers, finableSessions, finesRange.start, finesRange.end),
    [statsPlayers, finableSessions, finesRange]
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

  function updateAttendance(session, playerId, patch) {
    if (!canManage) return;
    const updater = (prevList) =>
      prevList.map((item) => {
        if (String(item.id) !== String(session.id)) return item;
        const current = item.attendance?.[playerId] || {};
        return {
          ...item,
          attendance: {
            ...(item.attendance || {}),
            [playerId]: { ...current, ...patch },
          },
        };
      });
    if (session.isMatch) setMatches?.(updater);
    else setSessions(updater);
  }

  function cycleStatus(session, player) {
    if (!canManage || (session.isMatch && !session.isFriendly)) return;
    const playerId = String(player.id);
    const current = session.attendance?.[playerId]?.status || getDefaultStatus(player, session.date);
    const currentIndex = STATUS_FLOW.indexOf(current);
    const nextStatus = STATUS_FLOW[(currentIndex + 1) % STATUS_FLOW.length] || "Presente";
    updateAttendance(session, playerId, { status: nextStatus });
  }

  function markSession(session, status, targetPlayers = visiblePlayers) {
    if (!canManage || (session.isMatch && !session.isFriendly)) return;
    const updater = (prevList) =>
      prevList.map((item) => {
        if (String(item.id) !== String(session.id)) return item;
        const nextAttendance = { ...(item.attendance || {}) };
        targetPlayers.forEach((player) => {
          const playerId = String(player.id);
          nextAttendance[playerId] = {
            ...(nextAttendance[playerId] || {}),
            status,
          };
        });
        return { ...item, attendance: nextAttendance };
      });
    if (session.isMatch) setMatches?.(updater);
    else setSessions(updater);
  }

  function renderAttendanceTable(tablePlayers, { title = "", subtitle = "" } = {}) {
    if (!tablePlayers.length) return null;

    // ── Vista card mobile ──────────────────────────────────────────────────
    if (isMobile) {
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
          <div style={{ display: "grid", gap: 1 }}>
            {tablePlayers.map((player) => {
              const rowStats = buildPlayerStats(player, visibleSessions, playerRpeIndex);
              return (
                <div key={player.id} style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: 13, display: "block" }}>{getPlayerName(player)}</strong>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{player.role || "-"}{player.shirtNumber ? ` · #${player.shirtNumber}` : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge tone={rowStats.presencePct < 70 ? "red" : rowStats.presencePct < 85 ? "orange" : "green"}>
                        {rowStats.presencePct}%
                      </Badge>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>carico {rowStats.load}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
                    {visibleSessions.map((session) => {
                      const status = getSessionStatus(player, session);
                      const meta = STATUS_META[status] || STATUS_META.Presente;
                      const isReadOnlyMatch = session.isMatch && !session.isFriendly;
                      return (
                        <div key={session.id} style={{ flexShrink: 0, textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap" }}>
                            {formatShortDate(session.date)}
                          </div>
                          <button
                            type="button"
                            onClick={() => cycleStatus(session, player)}
                            disabled={!canManage || isReadOnlyMatch}
                            style={{
                              width: 28, height: 28, borderRadius: 7, border: `1px solid ${meta.border}`,
                              background: meta.bg, color: meta.color,
                              fontWeight: 900, fontSize: 11, cursor: isReadOnlyMatch ? "default" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {meta.code}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </AppCard>
      );
    }

    // ── Vista tabella desktop ──────────────────────────────────────────────
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
                    {session.isMatch && !session.isFriendly ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/match-convocation/${session.id}`)}
                        style={ar.sessionLink}
                        title={t("pages.attendanceRegister.editInConvocation")}
                      >
                        <span>{formatShortDate(session.date)}</span>
                        <small>🏆 {session.title}</small>
                      </button>
                    ) : session.isFriendly ? (
                      <div style={ar.sessionLink}>
                        <span>{formatShortDate(session.date)}</span>
                        <small>🤝 {session.title}</small>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/session-attendance/${session.id}`)}
                        style={ar.sessionLink}
                        title={session.title || t("pages.attendanceRegister.sessionFallback")}
                      >
                        <span>{formatShortDate(session.date)}</span>
                        <small>{session.title || t("pages.attendanceRegister.sessionFallback")}</small>
                      </button>
                    )}
                    {canManage && (!session.isMatch || session.isFriendly) && (
                      <div style={ar.columnActions}>
                        <button type="button" onClick={() => markSession(session, "Presente", tablePlayers)} style={ar.miniAction}>P</button>
                        <button type="button" onClick={() => markSession(session, "Assente", tablePlayers)} style={ar.miniAction}>A</button>
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
                      const status = getSessionStatus(player, session);
                      const meta = STATUS_META[status] || STATUS_META.Presente;
                      const isReadOnlyMatch = session.isMatch && !session.isFriendly;
                      const showRpe = status === "Presente" || status === "Recupero";
                      const playerSubmittedRpe = playerRpeIndex[`${playerId}:${session.id}`];
                      const effectiveRpe = entry.rpe ?? playerSubmittedRpe ?? "";

                      return (
                        <td key={`${session.id}-${playerId}`} style={ar.td}>
                          <div style={ar.cellStack}>
                            <button
                              type="button"
                              onClick={() => cycleStatus(session, player)}
                              disabled={!canManage || isReadOnlyMatch}
                              style={{
                                ...ar.statusCell,
                                color: meta.color,
                                background: meta.bg,
                                borderColor: meta.border,
                                cursor: isReadOnlyMatch ? "default" : "pointer",
                              }}
                              title={isReadOnlyMatch ? t("pages.attendanceRegister.editInConvocation") : t("pages.attendanceRegister.cycleStatus")}
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
                                onChange={(event) => updateAttendance(session, playerId, { rpe: event.target.value })}
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

          <label style={ar.statsScopeToggle}>
            <input
              type="checkbox"
              checked={includeJuniorsInStats}
              onChange={(event) => setIncludeJuniorsInStats(event.target.checked)}
            />
            {t("pages.attendanceRegister.includeJuniorsInStats")}
          </label>

          {groupFilter === "juniores" && !includeJuniorsInStats && (
            <p style={ar.statsScopeNote}>{t("pages.attendanceRegister.juniorsScopeNote")}</p>
          )}

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
              disabled={!fineRows.length || exportingFines || isFinesRangeInverted}
              onClick={exportFinesPDF}
            >
              {exportingFines ? t("pages.attendanceRegister.fines.exporting") : t("pages.attendanceRegister.fines.exportPdf")}
            </Button>
          </div>
        </div>

        {isFinesRangeInverted ? (
          <p style={ar.finesError}>{t("pages.attendanceRegister.fines.invalidRange")}</p>
        ) : !finesRange.start || !finesRange.end ? (
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
      const status = getSessionStatus(player, session);
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
    const status = getSessionStatus(player, session);
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
  finesError: {
    margin: "14px 0 0",
    fontSize: 13,
    color: "#f87171",
    fontWeight: 700,
  },
  statsScopeToggle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#94a3b8",
    cursor: "pointer",
  },
  statsScopeNote: {
    margin: 0,
    fontSize: 12,
    color: "#fbbf24",
    fontWeight: 700,
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
