import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import MiniMatchFinesView from "../components/trainings/MiniMatchFinesView";
import { useAreaPermission } from "../components/auth/permissionContext";
import { useTranslation } from "../i18n";

export default function Fines({ sessions = [], players = [], appSettings = {}, setAppSettings }) {
  const { t } = useTranslation();
  const { canManage } = useAreaPermission();
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <PageHeader title={t("navigation.items.fines")} subtitle={t("pages.fines.subtitle")} />
      <MiniMatchStats sessions={sessions} players={players} appSettings={appSettings} setAppSettings={canManage ? setAppSettings : undefined} />
    </div>
  );
}

const BENCH_BASE = 100;
const assignmentTeamIndex = (v) => {
  if (typeof v !== "number") return null;
  if (v === 99) return 0;
  if (v >= BENCH_BASE) return v - BENCH_BASE;
  return v;
};

function getPlayerFullName(player) {
  return [player?.firstName, player?.lastName].filter(Boolean).join(" ") || player?.name || "—";
}

function getPlayerLastName(player) {
  const lastName = player?.lastName || "";
  if (lastName) return lastName;
  const parts = (player?.name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}


// multa per posizione nel podio: 1°=0€, 2°=1€, 3°=2€
const PODIUM_FINE = { 1: 0, 2: 1, 3: 2 };

// ── Statistiche Partitelle ────────────────────────────────────────────────────
function getISOWeekKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatWeekLabel(weekKey) {
  // weekKey = "2026-W33" → "Sett. 33 · lun 10 ago"
  const [year, wPart] = weekKey.split("-W");
  const w = parseInt(wPart, 10);
  // trova il lunedì della settimana ISO
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (w - 1) * 7);
  const d = monday.getDate();
  const m = monday.toLocaleDateString("it-IT", { month: "short" });
  return `Sett. ${w} · ${d} ${m}`;
}

const STATS_ABSENT_STATUSES = new Set(["Assente", "Infortunato", "Squalificato", "Permesso", "Differenziato"]);
const DRAW_FINE_AMOUNT = 0.5;

function formatFineAmount(amount) {
  const value = Number(amount) || 0;
  if (value <= 0) return "—";
  return `€ ${value.toLocaleString("it-IT", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function calcPartitellaStats(sessions) {
  const map = {};
  sessions.forEach((s) => {
    const assignments = s.teamAssignments || {};
    const attendance = s.attendance || {};
    const p = s.partitella;
    if (!p) return;
    if (p.podium && Object.keys(p.podium).length > 0) {
      Object.entries(assignments).forEach(([pid, teamVal]) => {
        // salta chi era assente/infortunato in quella seduta
        const attStatus = attendance[pid]?.status || attendance[String(pid)]?.status;
        if (attStatus && STATS_ABSENT_STATUSES.has(attStatus)) return;
        const teamIdx = assignmentTeamIndex(teamVal);
        if (teamIdx == null) return;
        const placement = p.podium[teamIdx];
        if (!placement) return;
        if (!map[pid]) map[pid] = { wins: 0, losses: 0, draws: 0, fine: 0 };
        if (placement === 1) map[pid].wins++;
        else { map[pid].losses++; }
        map[pid].fine += PODIUM_FINE[placement] ?? 0;
      });
    } else if (p.winner != null) {
      Object.entries(assignments).forEach(([pid, teamVal]) => {
        const attStatus = attendance[pid]?.status || attendance[String(pid)]?.status;
        if (attStatus && STATS_ABSENT_STATUSES.has(attStatus)) return;
        const teamIdx = assignmentTeamIndex(teamVal);
        if (teamIdx == null) return;
        if (!map[pid]) map[pid] = { wins: 0, losses: 0, draws: 0, fine: 0 };
        if (p.winner === "draw") { map[pid].draws++; map[pid].fine += DRAW_FINE_AMOUNT; }
        else if (p.winner === teamIdx) { map[pid].wins++; }
        else { map[pid].losses++; map[pid].fine += 1; }
      });
    }
  });
  return map;
}

function MiniMatchStats({ sessions = [], players = [], appSettings = {}, setAppSettings }) {
  const torelloFines = useMemo(() => appSettings.torelloFines || {}, [appSettings.torelloFines]);              // legacy flat (da migrare alla prima settimana)
  const torelloFinesWeekly = useMemo(() => appSettings.torelloFinesWeekly || {}, [appSettings.torelloFinesWeekly]); // per-settimana (struttura definitiva)
  const [sortMode, setSortMode] = useState("alpha");
  const [selectedWeek, setSelectedWeek] = useState("totale");
  const [groupFilter, setGroupFilter] = useState("prima");

  // Settimane con partitelle, ordinate cronologicamente
  const weeks = useMemo(() => {
    const keys = new Set();
    sessions.forEach((s) => {
      if ((s.partitella?.winner != null || s.partitella?.podium) && s.date) {
        const k = getISOWeekKey(s.date);
        if (k) keys.add(k);
      }
    });
    return ["totale", ...Array.from(keys).sort()];
  }, [sessions]);

  // Migrazione one-shot: sposta torelloFines (legacy) nella prima settimana con partitelle
  // Dipende da weeks perché sessions carica in modo asincrono
  useEffect(() => {
    if (!setAppSettings) return;
    if (Object.keys(torelloFines).length === 0) return;
    // blocca migrazione solo se ci sono valori reali nelle settimane (non oggetti vuoti)
    const hasRealWeeklyData = Object.values(torelloFinesWeekly).some((wm) => Object.keys(wm).length > 0);
    if (hasRealWeeklyData) return;
    const firstWeek = weeks.find((w) => w !== "totale");
    if (!firstWeek) return;
    setAppSettings((prev) => ({
      ...prev,
      torelloFines: {},
      torelloFinesWeekly: { [firstWeek]: { ...torelloFines } },
    }));
  }, [weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sessioni filtrate per settimana selezionata
  const filteredSessions = useMemo(() => {
    if (selectedWeek === "totale") return sessions;
    return sessions.filter((s) => s.date && getISOWeekKey(s.date) === selectedWeek);
  }, [sessions, selectedWeek]);

  const stats = useMemo(() => calcPartitellaStats(filteredSessions), [filteredSessions]);

  function changeTorello(playerId, delta) {
    if (!setAppSettings || selectedWeek === "totale") return;
    const pid = String(playerId);
    const current = torelloFinesWeekly[selectedWeek]?.[pid] || 0;
    const next = Math.max(0, current + delta);
    const updatedWeek = { ...(torelloFinesWeekly[selectedWeek] || {}) };
    if (next === 0) delete updatedWeek[pid];
    else updatedWeek[pid] = next;
    setAppSettings((prev) => ({ ...prev, torelloFinesWeekly: { ...torelloFinesWeekly, [selectedWeek]: updatedWeek } }));
  }

  const rows = useMemo(() => {
    const getRowTorello = (playerId) => {
      const pid = String(playerId);
      if (selectedWeek === "totale") {
        return Object.values(torelloFinesWeekly).reduce((sum, wm) => sum + (wm[pid] || 0), 0)
             + (torelloFines[pid] || 0);
      }
      return torelloFinesWeekly[selectedWeek]?.[pid] || 0;
    };

    return players
      .filter((p) => groupFilter === "tutti" || (p.gruppo || "prima") === groupFilter)
      .map((p) => {
        const s = stats[String(p.id)] || { wins: 0, losses: 0, draws: 0, fine: 0 };
        const torello = getRowTorello(p.id);
        return { p, ...s, torello, totalFine: s.fine + torello };
      })
      .sort((a, b) => {
        const lastName = (p) => getPlayerLastName(p);
        if (sortMode === "fineDesc") return b.totalFine - a.totalFine || lastName(a.p).localeCompare(lastName(b.p), "it");
        if (sortMode === "fineAsc")  return a.totalFine - b.totalFine || lastName(a.p).localeCompare(lastName(b.p), "it");
        return lastName(a.p).localeCompare(lastName(b.p), "it");
      });
  }, [players, stats, sortMode, selectedWeek, torelloFinesWeekly, torelloFines, groupFilter]);


  const totalSessions = filteredSessions.filter((s) => s.partitella?.winner != null || s.partitella?.podium).length;
  const totPartitelle = rows.reduce((s, r) => s + r.fine, 0);
  const totTorello    = rows.reduce((s, r) => s + r.torello, 0);
  const totTotale     = rows.reduce((s, r) => s + r.totalFine, 0);

  return (
    <MiniMatchFinesView
      rows={rows.map((row) => ({ ...row, name: getPlayerFullName(row.p) }))}
      weekOptions={weeks.map((week) => ({ value: week, label: week === "totale" ? "Totale" : formatWeekLabel(week) }))}
      selectedWeek={selectedWeek}
      onWeekChange={setSelectedWeek}
      sortMode={sortMode}
      onSortChange={setSortMode}
      groupFilter={groupFilter}
      onGroupChange={setGroupFilter}
      editable={Boolean(setAppSettings) && selectedWeek !== "totale"}
      onTorelloChange={changeTorello}
      totalSessions={totalSessions}
      totals={{ partitelle: totPartitelle, torello: totTorello, total: totTotale }}
      formatAmount={formatFineAmount}
    />
  );
}

