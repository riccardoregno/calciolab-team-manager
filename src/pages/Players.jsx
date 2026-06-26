import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "../i18n";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import AppCard from "../components/ui/AppCard";
import MetricStrip from "../components/ui/MetricStrip";
import { SkeletonGrid } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAreaPermission } from "../components/auth/permissionContext";

import PlayerCard from "../components/players/PlayerCard";
import Badge from "../components/ui/Badge";
import ImportPlayersModal from "../components/players/ImportPlayersModal";
import { useIsMobile } from "../hooks/useIsMobile";

import { styles } from "../styles/index.js";
import { emptyPlayer } from "../data/initialData";
import { createUuid, isBirthdayToday, getTeamAverageAge, calcPlayerAge, getPlayerQuickStats, comparePlayersByName } from "../utils/helpers";
import { loadAllPlayerStats, loadAllPlayerAvgRatings, loadTeamRecentRatings } from "../services/playerProfile";

// GROUP_LABELS is now built dynamically inside the component via t()
const PLAYER_MODAL_QUERY = "new-player";

const PLAYER_ROLE_SUGGESTIONS = [
  "Portiere",
  "Terzino destro", "Terzino sinistro",
  "Difensore centrale",
  "Mediano", "Mezzala", "Regista",
  "Trequartista",
  "Ala destra", "Ala sinistra",
  "Prima punta", "Seconda punta",
];
const NEW_PLAYER_DRAFT_KEY = "calciolab_new_player_draft_v1";

function getEmptyPlayerForm(gruppoFilter = "tutti") {
  return {
    ...emptyPlayer(),
    firstName: "",
    lastName: "",
    status: "Disponibile",
    gruppo: gruppoFilter !== "tutti" ? gruppoFilter : "prima",
  };
}

function loadNewPlayerDraft(fallback) {
  try {
    const stored = localStorage.getItem(NEW_PLAYER_DRAFT_KEY);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

const SUSPENSION_THRESHOLD = 5;

function Players({ players, setPlayers, sessions = [], matches = [], loading = false, teamId = null }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const GROUP_LABELS = {
    prima:        t("pages.players.groupPrima"),
    juniores:     t("pages.players.groupJuniores"),
    allievi:      t("pages.players.groupAllievi"),
    giovanissimi: t("pages.players.groupGiovanissimi"),
    esordienti:   t("pages.players.groupEsordienti"),
  };
  const location = useLocation();
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();
  const urlGruppo = new URLSearchParams(location.search).get("gruppo") || "prima";
  const openModal = new URLSearchParams(location.search).get("modal") === PLAYER_MODAL_QUERY;

  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const [playerStatsMap, setPlayerStatsMap] = useState({});
  const [playerRatingsMap, setPlayerRatingsMap] = useState({});
  const [playerRecentRatings, setPlayerRecentRatings] = useState({});

  useEffect(() => {
    if (!teamId) return;
    loadAllPlayerStats(teamId).then(({ data }) => setPlayerStatsMap(data || {}));
    loadAllPlayerAvgRatings(teamId).then(({ data }) => setPlayerRatingsMap(data || {}));
    loadTeamRecentRatings(teamId).then(({ data }) => setPlayerRecentRatings(data || {}));
  }, [teamId]);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("tutti");
  const [filterRole, setFilterRole] = useState("tutti");
  const [filterRoleFamily, setFilterRoleFamily] = useState("tutti");
  const [filterFoot, setFilterFoot] = useState("tutti");
  const [filterAge, setFilterAge] = useState("tutti");
  const gruppoFilter = urlGruppo;
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("calciolab_players_view") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });

  function changeViewMode(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem("calciolab_players_view", mode);
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }

  const [form, setForm] = useState(() => loadNewPlayerDraft(getEmptyPlayerForm(urlGruppo)));

  useEffect(() => {
    if (!openModal) return;
    try {
      localStorage.setItem(NEW_PLAYER_DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }, [form, openModal]);

  // Avvisa l'utente quando il modal si apre con una bozza ripristinata da una sessione precedente
  useEffect(() => {
    if (!openModal) return;
    const hasDraftContent = (form.firstName || "").trim() || (form.lastName || "").trim();
    if (!hasDraftContent) return;
    showToast(t("pages.players.draftRestored"), "info", {
      action: {
        label: t("pages.players.discardDraft"),
        fn: () => {
          try { localStorage.removeItem(NEW_PLAYER_DRAFT_KEY); } catch { /* noop */ }
          setForm(getEmptyPlayerForm(gruppoFilter));
        },
      },
      duration: 6000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModal]);

  // Birthday players (today)
  const birthdayPlayers = players.filter((p) => isBirthdayToday(p.birthDate));

  // I contatori "totale", "disponibili", "infortunati", "età media" e i reparti
  // riguardano solo la Prima Squadra: i Juniores sono un gruppo a parte e non
  // devono alterare le statistiche complessive della rosa principale.
  const primaPlayers = players.filter((p) => (p.gruppo || "prima") === "prima");

  // Average team age (solo prima squadra)
  const averageAge = getTeamAverageAge(primaPlayers);

  // Gruppi presenti nella rosa
  const presentGroups = [...new Set(players.map((p) => p.gruppo || "prima"))];
  const showTabs = presentGroups.length > 1 || presentGroups.some((g) => g !== "prima");

  // Ruoli unici nella rosa (ordinati alfabeticamente)
  const uniqueRoles = [...new Set(players.map((p) => p.role || "").filter(Boolean))].sort();

  // Calcolo età da data di nascita
  function calcAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth)) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  const activeFilterCount = [filterStatus, filterRole, filterRoleFamily, filterFoot, filterAge].filter(
    (f) => f !== "tutti"
  ).length;

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = `${player.first_name || player.firstName || ""} ${
      player.last_name || player.lastName || ""
    } ${player.name || ""} ${player.role || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGroup = gruppoFilter === "tutti" || (player.gruppo || "prima") === gruppoFilter;
    const matchesStatus =
      filterStatus === "tutti" || (player.status || "Disponibile") === filterStatus;
    const matchesRole = filterRole === "tutti" || (player.role || "") === filterRole;
    const matchesRoleFamily =
      filterRoleFamily === "tutti" || getRoleFamily(player.role) === filterRoleFamily;
    const matchesFoot =
      filterFoot === "tutti" ||
      (player.foot || player.preferredFoot || "").toLowerCase() === filterFoot.toLowerCase();
    const age = calcAge(player.birthDate);
    const matchesAge =
      filterAge === "tutti" ||
      (filterAge === "u18" && age !== null && age < 18) ||
      (filterAge === "18-23" && age !== null && age >= 18 && age <= 23) ||
      (filterAge === "24-30" && age !== null && age >= 24 && age <= 30) ||
      (filterAge === "o30" && age !== null && age > 30);
    return matchesSearch && matchesGroup && matchesStatus && matchesRole && matchesRoleFamily && matchesFoot && matchesAge;
  });

  // Ordinamento di default per ruolo: Portiere, Difensore, Centrocampista, Attaccante
  const ROLE_ORDER = { Portiere: 0, Difensore: 1, Centrocampista: 2, Attaccante: 3 };
  filteredPlayers.sort((a, b) => {
    const orderA = ROLE_ORDER[a.role] ?? 99;
    const orderB = ROLE_ORDER[b.role] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return comparePlayersByName(a, b);
  });

  // Contatori per gruppo
  const countByGroup = players.reduce((acc, p) => {
    const g = p.gruppo || "prima";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  // Contatori per reparto (keyword-based — funziona anche con ruoli liberi)
  function getRoleFamily(role = "") {
    const r = role.toLowerCase().trim();
    if (!r) return null;
    if (r.includes("portiere") || r === "por" || r === "gk") return "P";
    if (r.includes("terzino") || r.includes("difensore") || r.includes("libero") ||
        r.includes("stopper") || r.includes("centrale") || r.includes("cb") ||
        r.includes("lb") || r.includes("rb") || r.includes("wb")) return "D";
    if (r.includes("mezzala") || r.includes("mediano") || r.includes("regista") ||
        r.includes("trequartista") || r.includes("centrocampista") || r.includes("tornante") ||
        r.includes("cm") || r.includes("cdm") || r.includes("cam")) return "C";
    if (r.includes("ala") || r.includes("punta") || r.includes("attaccante") ||
        r.includes("bomber") || r.includes("esterno") || r.includes("seconda") ||
        r.includes("cf") || r.includes("lw") || r.includes("rw") || r.includes("st")) return "A";
    return null;
  }

  const countByPosition = primaPlayers.reduce(
    (acc, p) => {
      const family = getRoleFamily(p.role);
      if (family) acc[family] = (acc[family] || 0) + 1;
      return acc;
    },
    { P: 0, D: 0, C: 0, A: 0 }
  );

  function resetRosterFilters() {
    setSearch("");
    setFilterStatus("tutti");
    setFilterRole("tutti");
    setFilterRoleFamily("tutti");
    setFilterFoot("tutti");
    setFilterAge("tutti");
    changeGroupFilter("prima", { replace: true });
  }

  function filterByStatus(status) {
    setFilterStatus(status);
  }

  function filterByGroup(group) {
    changeGroupFilter(group);
  }

  function filterByRoleFamily(family) {
    setFilterRole("tutti");
    setFilterRoleFamily(family);
  }

  const rosterMetricItems = [
    {
      key: "total",
      label: t("pages.players.totalPlayers"),
      value: primaPlayers.length,
      color: "#60a5fa",
      onClick: resetRosterFilters,
      active: activeFilterCount === 0 && gruppoFilter === "prima" && !search,
    },
    {
      key: "available",
      label: t("pages.players.available"),
      value: primaPlayers.filter((p) => (p.status || "Disponibile") === "Disponibile").length,
      color: "#22c55e",
      onClick: () => filterByStatus("Disponibile"),
      active: filterStatus === "Disponibile",
    },
    {
      key: "injured",
      label: t("pages.players.injured"),
      value: primaPlayers.filter((p) => p.status === "Infortunato").length,
      color: "#f87171",
      onClick: () => filterByStatus("Infortunato"),
      active: filterStatus === "Infortunato",
    },
    averageAge !== null && {
      key: "average-age",
      label: t("pages.players.averageAge"),
      value: averageAge,
      color: "#a78bfa",
    },
    ...Object.entries(countByGroup).map(([g, n]) => ({
      key: `group-${g}`,
      label: GROUP_LABELS[g] || g,
      value: n,
      color: "#cbd5e1",
      onClick: () => filterByGroup(g),
      active: gruppoFilter === g,
    })),
    {
      key: "role-gk",
      label: `🧤 ${t("pages.players.posGK")}`,
      value: countByPosition.P,
      color: "#cbd5e1",
      onClick: () => filterByRoleFamily("P"),
      active: filterRoleFamily === "P",
    },
    {
      key: "role-def",
      label: `🛡️ ${t("pages.players.posDEF")}`,
      value: countByPosition.D,
      color: "#60a5fa",
      onClick: () => filterByRoleFamily("D"),
      active: filterRoleFamily === "D",
    },
    {
      key: "role-mid",
      label: `⚙️ ${t("pages.players.posMID")}`,
      value: countByPosition.C,
      color: "#22c55e",
      onClick: () => filterByRoleFamily("C"),
      active: filterRoleFamily === "C",
    },
    {
      key: "role-fwd",
      label: `⚡ ${t("pages.players.posFWD")}`,
      value: countByPosition.A,
      color: "#fb923c",
      onClick: () => filterByRoleFamily("A"),
      active: filterRoleFamily === "A",
    },
  ];

  function handlePhotoUpload(file) {
    if (!canManage) return;
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        photo: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  }

  function changeGroupFilter(group, { replace = false } = {}) {
    const params = new URLSearchParams(location.search);
    if (group && group !== "prima") {
      params.set("gruppo", group);
    } else {
      params.delete("gruppo");
    }
    const searchString = params.toString();
    navigate(
      { pathname: location.pathname, search: searchString ? `?${searchString}` : "" },
      { replace }
    );
  }

  function openNewPlayerModal() {
    if (!canManage) return;
    const params = new URLSearchParams(location.search);
    params.set("modal", PLAYER_MODAL_QUERY);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeNewPlayerModal({ resetDraft = false } = {}) {
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    if (resetDraft) {
      try {
        localStorage.removeItem(NEW_PLAYER_DRAFT_KEY);
      } catch {
        /* localStorage can be unavailable in restricted browsers */
      }
      setForm(getEmptyPlayerForm(gruppoFilter));
    }
    const searchString = params.toString();
    navigate(
      { pathname: location.pathname, search: searchString ? `?${searchString}` : "" },
      { replace: true }
    );
  }

  // CRITICO fix: rimossi insert/delete Supabase diretti con schema flat (user_id, first_name, ...).
  // Quegli insert bypassavano useTeamData e usavano un schema diverso da { id, team_id, data }.
  // Ora usiamo setPlayers() — la persistenza Supabase avviene tramite useTeamData con schema corretto.
  function addPlayer() {
    if (!canManage) return;
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast(t("pages.players.missingName"), "warn");
      return;
    }

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const newPlayer = {
      id:          createUuid(),
      name:        fullName,
      firstName:   form.firstName.trim(),
      lastName:    form.lastName.trim(),
      role:        form.role        || "",
      email:       form.email       || "",
      birthDate:   form.birthDate   || "",
      shirtNumber: "",
      status:      form.status      || "Disponibile",
      gruppo:      form.gruppo      || "prima",
      photo:       form.photo       || "",
      photoSize:   Number(form.photoSize || 100),
      ratings:     {},
      injuries:    [],
    };

    setPlayers((prevPlayers) => [...prevPlayers, newPlayer]);

    try {
      localStorage.removeItem(NEW_PLAYER_DRAFT_KEY);
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }

    setForm(getEmptyPlayerForm(gruppoFilter));

    closeNewPlayerModal();
    showToast(t("pages.players.playerAdded"), "ok");
  }

  function deletePlayer(id) {
    if (!canManage) return;
    const removed = players.find((p) => String(p.id) === String(id));
    if (!removed) return;
    setConfirmState({
      message: t("pages.players.deleteConfirm"),
      confirmLabel: t("common.delete"),
      confirmTone: "red",
      onConfirm: () => {
        setPlayers((prev) => prev.filter((p) => String(p.id) !== String(id)));
        showToast(t("pages.players.playerDeleted"), "info", {
          duration: 5000,
          action: {
            label: t("common.undo"),
            fn: () => setPlayers((prev) => [...prev, removed]),
          },
        });
      },
    });
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      {showImport && (
        <ImportPlayersModal
          onClose={() => setShowImport(false)}
          onImport={(newPlayers) => {
            if (!canManage) return;
            setPlayers((prev) => [...prev, ...newPlayers]);
            showToast(
              t("pages.importPlayers.successToast", { count: newPlayers.length }),
              "ok"
            );
            setShowImport(false);
          }}
        />
      )}
      <PageHeader
        title={t("pages.players.title")}
        subtitle={t("pages.players.subtitle")}
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            <Link
              to="/player-compare"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                flex: isMobile ? "1 1 100%" : "0 0 auto",
                minWidth: 0,
                justifyContent: "center",
                padding: "8px 14px", borderRadius: 12,
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
                color: "#c4b5fd", fontWeight: 800, fontSize: 13, textDecoration: "none",
              }}
            >
              ⚡ {t("navigation.items.playerCompare")}
            </Link>
            {canManage && (
              <>
                <button
                  onClick={() => setShowImport(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    flex: isMobile ? "1 1 100%" : "0 0 auto",
                    minWidth: 0,
                    justifyContent: "center",
                    padding: "8px 14px", borderRadius: 12,
                    background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
                    color: "#6ee7b7", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  }}
                >
                  📥 {t("pages.importPlayers.btnLabel")}
                </button>
                <Button onClick={openNewPlayerModal} style={{ flex: isMobile ? "1 1 100%" : "0 0 auto", minWidth: 0 }}>
                  {t("pages.players.newPlayer")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {birthdayPlayers.length > 0 && (
        <div style={pStyles.birthdayBanner}>
          <span style={pStyles.birthdayEmoji}>🎂</span>
          <span>
            {birthdayPlayers.length === 1
              ? t("pages.players.birthdayBannerSingle", {
                  name: birthdayPlayers[0].name || birthdayPlayers[0].firstName || "",
                })
              : t("pages.players.birthdayBannerMulti", {
                  names: birthdayPlayers.map((p) => p.name || p.firstName || "").join(", "),
                })}
          </span>
        </div>
      )}

      {loading && players.length === 0 ? (
        <SkeletonGrid count={isMobile ? 4 : 8} />
      ) : (
      <div className="players-list-wrap">
      <AppCard style={{ marginBottom: 22 }} className="players-toolbar">
        <div style={pStyles.toolbar}>
          <MetricStrip items={rosterMetricItems} min={isMobile ? 104 : 124} style={pStyles.counterGrid} className="mobile-scroll-x" />

          <div style={pStyles.searchWrap}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={t("pages.players.searchPlaceholder")}
            />
            {/* Filtri toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              style={{
                marginTop: 8,
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 13px", borderRadius: 10,
                background: activeFilterCount > 0 ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)",
                border: activeFilterCount > 0 ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.1)",
                color: activeFilterCount > 0 ? "#93c5fd" : "#94a3b8",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              🔍 {t("pages.players.filters")}
              {activeFilterCount > 0 && (
                <span style={{
                  background: "#3b82f6", color: "#fff",
                  borderRadius: 999, fontSize: 11, fontWeight: 900,
                  padding: "1px 7px", lineHeight: 1.6,
                }}>
                  {activeFilterCount}
                </span>
              )}
              <span style={{ fontSize: 10, opacity: 0.7 }}>{showFilters ? "▲" : "▼"}</span>
            </button>

            {/* Toggle vista griglia / elenco */}
            <div style={{ display: "inline-flex", gap: 4, marginTop: 8, marginLeft: isMobile ? 0 : 8, padding: 3, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", width: isMobile ? "100%" : "auto" }}>
              <button
                onClick={() => changeViewMode("grid")}
                title={t("pages.players.viewGrid")}
                style={{
                  flex: isMobile ? 1 : "0 0 auto",
                  padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: viewMode === "grid" ? "rgba(96,165,250,0.18)" : "transparent",
                  border: viewMode === "grid" ? "1px solid rgba(96,165,250,0.4)" : "1px solid transparent",
                  color: viewMode === "grid" ? "#93c5fd" : "#94a3b8",
                }}
              >
                ▦ {t("pages.players.viewGrid")}
              </button>
              <button
                onClick={() => changeViewMode("list")}
                title={t("pages.players.viewList")}
                style={{
                  flex: isMobile ? 1 : "0 0 auto",
                  padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: viewMode === "list" ? "rgba(96,165,250,0.18)" : "transparent",
                  border: viewMode === "list" ? "1px solid rgba(96,165,250,0.4)" : "1px solid transparent",
                  color: viewMode === "list" ? "#93c5fd" : "#94a3b8",
                }}
              >
                ☰ {t("pages.players.viewList")}
              </button>
            </div>
          </div>
        </div>

        {/* Pannello filtri avanzati */}
        {showFilters && (
          <div style={{
            marginTop: 14, padding: "14px 16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start",
          }}>
            {/* Stato */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                {t("pages.players.filterStatus")}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { val: "tutti", label: t("pages.players.all"), color: null },
                  { val: "Disponibile", label: t("pages.players.statusAvailable"), color: "#22c55e" },
                  { val: "Infortunato", label: t("pages.players.statusInjured"), color: "#f87171" },
                  { val: "Squalificato", label: t("pages.players.statusSuspended"), color: "#fb923c" },
                ].map(({ val, label, color }) => (
                  <button key={val} onClick={() => setFilterStatus(val)} style={{
                    padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: "pointer",
                    background: filterStatus === val
                      ? (color ? `${color}22` : "rgba(255,255,255,0.1)")
                      : "rgba(255,255,255,0.04)",
                    border: filterStatus === val
                      ? `1px solid ${color || "rgba(255,255,255,0.3)"}`
                      : "1px solid rgba(255,255,255,0.07)",
                    color: filterStatus === val ? (color || "#e2e8f0") : "#94a3b8",
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Ruolo */}
            {uniqueRoles.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  {t("pages.players.filterRole")}
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => {
                    setFilterRole(e.target.value);
                    setFilterRoleFamily("tutti");
                  }}
                  style={{
                    padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: filterRole !== "tutti" ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.06)",
                    border: filterRole !== "tutti" ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.1)",
                    color: filterRole !== "tutti" ? "#93c5fd" : "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <option value="tutti">{t("pages.players.all")}</option>
                  {uniqueRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Piede */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                {t("pages.players.filterFoot")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { val: "tutti", label: t("pages.players.all") },
                  { val: "destro", label: t("pages.players.footRight") },
                  { val: "sinistro", label: t("pages.players.footLeft") },
                  { val: "entrambi", label: t("pages.players.footBoth") },
                ].map(({ val, label }) => (
                  <button key={val} onClick={() => setFilterFoot(val)} style={{
                    padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: "pointer",
                    background: filterFoot === val ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                    border: filterFoot === val ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    color: filterFoot === val ? "#c4b5fd" : "#94a3b8",
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Età */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                {t("pages.players.filterAge")}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { val: "tutti", label: t("pages.players.all") },
                  { val: "u18", label: t("pages.players.ageUnder18") },
                  { val: "18-23", label: "18-23" },
                  { val: "24-30", label: "24-30" },
                  { val: "o30", label: t("pages.players.ageOver30") },
                ].map(({ val, label }) => (
                  <button key={val} onClick={() => setFilterAge(val)} style={{
                    padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: "pointer",
                    background: filterAge === val ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                    border: filterAge === val ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    color: filterAge === val ? "#fcd34d" : "#94a3b8",
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {activeFilterCount > 0 && (
              <button
                onClick={resetRosterFilters}
                style={{
                  alignSelf: "flex-end", padding: "5px 13px", borderRadius: 8,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                ✕ {t("pages.players.resetFilters")}
              </button>
            )}
          </div>
        )}

        {/* Tab filtro gruppo — visibili solo se ci sono più gruppi */}
        {showTabs && (
          <div style={pStyles.tabs}>
            {["tutti", ...presentGroups].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => changeGroupFilter(g)}
                style={{
                  ...pStyles.tab,
                  background: gruppoFilter === g ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                  border: gruppoFilter === g ? "1px solid rgba(96,165,250,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: gruppoFilter === g ? "#e2e8f0" : "#94a3b8",
                }}
              >
                {g === "tutti" ? `${t("pages.players.all")} (${players.length})` : `${GROUP_LABELS[g] || g} (${countByGroup[g] || 0})`}
              </button>
            ))}
          </div>
        )}
      </AppCard>

      {filteredPlayers.length === 0 ? (
        <EmptyState
          icon={activeFilterCount > 0 || search ? "🔍" : "⚽"}
          title={
            activeFilterCount > 0 || search
              ? t("pages.players.noFilterResults")
              : t("pages.players.noPlayersFound")
          }
          text={
            activeFilterCount > 0 || search
              ? t("pages.players.noFilterResultsText")
              : t("pages.players.noPlayersText")
          }
          action={
            (activeFilterCount > 0 || search) ? (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterStatus("tutti");
                  setFilterRole("tutti");
                  setFilterRoleFamily("tutti");
                  setFilterFoot("tutti");
                  setFilterAge("tutti");
                  changeGroupFilter("prima", { replace: true });
                }}
                style={{
                  marginTop: 12, padding: "8px 18px", borderRadius: 10,
                  background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)",
                  color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                ✕ {t("pages.players.resetFilters")}
              </button>
            ) : canManage ? (
              <button
                onClick={openNewPlayerModal}
                style={{
                  marginTop: 12, padding: "8px 18px", borderRadius: 10,
                  background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)",
                  color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("pages.players.newPlayer")}
              </button>
            ) : null
          }
        />
      ) : viewMode === "list" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {filteredPlayers.map((player) => (
            <PlayerListRow
              key={player.id}
              player={player}
              sessions={sessions}
              matches={matches}
              onDelete={canManage ? () => deletePlayer(player.id) : null}
              yellowCards={Number(playerStatsMap[String(player.id)]?.yellow_cards || 0)}
              avgRating={playerRatingsMap[String(player.id)] || null}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))",
            gap: isMobile ? 12 : 18,
          }}
        >
          {filteredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              sessions={sessions}
              matches={matches}
              onDelete={canManage ? () => deletePlayer(player.id) : null}
              yellowCards={Number(playerStatsMap[String(player.id)]?.yellow_cards || 0)}
              avgRating={playerRatingsMap[String(player.id)] || null}
              recentRatings={playerRecentRatings[String(player.id)] || null}
            />
          ))}
        </div>
      )}
      </div>
      )}

      {openModal && (
        <Modal title={t("pages.players.modalTitle")} onClose={() => closeNewPlayerModal()}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            <input
              placeholder={t("pages.players.firstName")}
              value={form.firstName}
              onChange={(e) =>
                setForm({ ...form, firstName: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder={t("pages.players.lastName")}
              value={form.lastName}
              onChange={(e) =>
                setForm({ ...form, lastName: e.target.value })
              }
              style={styles.input}
            />

            <input
              type="email"
              placeholder={t("pages.playerDetail.profile.fieldEmail")}
              value={form.email || ""}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              style={styles.input}
            />

            <input
              placeholder={t("pages.players.role")}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={styles.input}
              list="player-roles-list"
              autoComplete="off"
            />
            <datalist id="player-roles-list">
              {PLAYER_ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
            </datalist>

            <input
              type="date"
              aria-label={t("pages.players.birthDate")}
              title={t("pages.players.birthDate")}
              value={form.birthDate || ""}
              onChange={(e) =>
                setForm({ ...form, birthDate: e.target.value })
              }
              style={styles.input}
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={styles.input}
            >
              <option value="Disponibile">{t("pages.players.statusAvailable")}</option>
              <option value="Infortunato">{t("pages.players.statusInjured")}</option>
              <option value="Squalificato">{t("pages.players.statusSuspended")}</option>
            </select>

            <select
              value={form.gruppo}
              onChange={(e) => setForm({ ...form, gruppo: e.target.value })}
              style={styles.input}
            >
              <option value="prima">{t("pages.players.groupPrima")}</option>
              <option value="juniores">{t("pages.players.groupJuniores")}</option>
              <option value="allievi">{t("pages.players.groupAllievi")}</option>
              <option value="giovanissimi">{t("pages.players.groupGiovanissimi")}</option>
              <option value="esordienti">{t("pages.players.groupEsordienti")}</option>
            </select>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => handlePhotoUpload(e.target.files[0])}
              style={styles.input}
            />
          </div>

          {form.photo && (
            <div
              style={{
                marginTop: 20,
                display: "grid",
                justifyItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 24,
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.12)",
                  background: "rgba(15,23,42,0.72)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <img
                  src={form.photo}
                  alt="preview"
                  style={{
                    width: `${Number(form.photoSize || 100)}%`,
                    height: `${Number(form.photoSize || 100)}%`,
                    objectFit: "cover",
                  }}
                />
              </div>
              <label style={{ width: "min(320px, 100%)", display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
                {t("pages.players.photoSize", { value: Number(form.photoSize || 100) })}
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="5"
                  value={Number(form.photoSize || 100)}
                  onChange={(e) => setForm({ ...form, photoSize: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 26,
              gap: 12,
            }}
          >
            <Button variant="ghost" onClick={() => closeNewPlayerModal({ resetDraft: true })}>
              {t("common.cancel")}
            </Button>

            <Button onClick={addPlayer}>{t("pages.players.addPlayer")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PlayerListRow({ player, sessions = [], matches = [], onDelete, yellowCards = 0, avgRating = null }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const age = calcPlayerAge(player.birthDate) ?? player.age ?? "-";
  const { appearances, trainingPct } = getPlayerQuickStats(player, sessions, matches);
  const trainingPctValue = trainingPct === null ? "-" : `${trainingPct}%`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(255,255,255,0.08)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(37,99,235,0.18))",
            border: "1px solid rgba(255,255,255,0.16)",
            display: "grid", placeItems: "center",
            fontSize: 13, fontWeight: 900, color: "white", overflow: "hidden",
          }}
        >
          {player.photo ? (
            <img src={player.photo} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            (player.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
          )}
        </div>
        <span style={{
          position: "absolute", bottom: -2, right: -2,
          width: 11, height: 11, borderRadius: "50%",
          border: "2px solid rgba(15,23,42,0.9)",
          background:
            player.status === "Infortunato"   ? "#f87171" :
            player.status === "Squalificato"  ? "#a78bfa" :
            player.status === "Recupero" || player.status === "Differenziato" ? "#fb923c" :
            "#22c55e",
        }} />
      </div>

      <div style={{ flex: "2 1 140px", minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.name}
        </strong>
        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
          {player.role || t("components.playerCard.noRole")}
        </span>
      </div>

      <div style={{ flex: "1 1 50px", minWidth: 0, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{t("components.playerCard.age")}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{age}</div>
      </div>

      <div style={{ flex: "1 1 60px", minWidth: 0, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{t("components.playerCard.appearances")}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{appearances}</div>
      </div>

      <div style={{ flex: "1 1 60px", minWidth: 0, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{t("components.playerCard.trainingPct")}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{trainingPctValue}</div>
      </div>

      <div style={{ flex: "1 1 70px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <Badge tone={
          player.status === "Infortunato" ? "red" :
          player.status === "Squalificato" ? "purple" :
          player.status === "Recupero" || player.status === "Differenziato" ? "orange" :
          "green"
        }>
          {player.status || "Disponibile"}
        </Badge>
        {yellowCards >= SUSPENSION_THRESHOLD - 1 && (
          <span style={{
            fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6,
            background: yellowCards >= SUSPENSION_THRESHOLD ? "rgba(248,113,113,0.18)" : "rgba(251,191,36,0.18)",
            border: `1px solid ${yellowCards >= SUSPENSION_THRESHOLD ? "rgba(248,113,113,0.4)" : "rgba(251,191,36,0.4)"}`,
            color: yellowCards >= SUSPENSION_THRESHOLD ? "#f87171" : "#fbbf24",
            whiteSpace: "nowrap",
          }}>
            🟨 {yellowCards} {yellowCards >= SUSPENSION_THRESHOLD ? "SQUALIFICA" : "DIFFIDA"}
          </span>
        )}
        {avgRating !== null && (
          <span style={{
            fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6,
            background: avgRating >= 7 ? "rgba(34,197,94,0.15)" : avgRating >= 5 ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.15)",
            border: `1px solid ${avgRating >= 7 ? "rgba(34,197,94,0.4)" : avgRating >= 5 ? "rgba(251,191,36,0.4)" : "rgba(148,163,184,0.3)"}`,
            color: avgRating >= 7 ? "#22c55e" : avgRating >= 5 ? "#fbbf24" : "#94a3b8",
            whiteSpace: "nowrap",
          }}>
            ⭐ {avgRating.toFixed(1)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flex: "1 1 100%", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={() => navigate(`/players/${player.id}`)}>
          {t("components.playerCard.profile")}
        </Button>
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            {t("common.delete")}
          </Button>
        )}
      </div>
    </div>
  );
}

const pStyles = {
  birthdayBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 18px",
    marginBottom: 16,
    borderRadius: 14,
    background: "rgba(134,239,172,0.10)",
    border: "1px solid rgba(134,239,172,0.30)",
    color: "#86efac",
    fontSize: 14,
    fontWeight: 700,
  },
  birthdayEmoji: {
    fontSize: 22,
    lineHeight: 1,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  counterGrid: {
    flex: "1 1 520px",
  },
  searchWrap: {
    flex: "0 1 360px",
    width: "100%",
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginTop: 18,
    flexWrap: "wrap",
  },
  tab: {
    borderRadius: 10,
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

export default Players;
