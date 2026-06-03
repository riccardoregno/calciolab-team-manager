import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "../i18n";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import AppCard from "../components/ui/AppCard";
import { useToast } from "../components/ui/Toast";

import PlayerCard from "../components/players/PlayerCard";
import ImportPlayersModal from "../components/players/ImportPlayersModal";

import { styles } from "../styles/index.js";
import { emptyPlayer } from "../data/initialData";
import { createId, isBirthdayToday, getTeamAverageAge } from "../utils/helpers";

// GROUP_LABELS is now built dynamically inside the component via t()
const PLAYER_MODAL_QUERY = "new-player";
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

function Players({ players, setPlayers }) {
  const { t } = useTranslation();
  const GROUP_LABELS = {
    prima:        t("pages.players.groupPrima"),
    juniores:     t("pages.players.groupJuniores"),
    allievi:      t("pages.players.groupAllievi"),
    giovanissimi: t("pages.players.groupGiovanissimi"),
    esordienti:   t("pages.players.groupEsordienti"),
  };
  const location = useLocation();
  const navigate = useNavigate();
  const urlGruppo = new URLSearchParams(location.search).get("gruppo") || "tutti";
  const openModal = new URLSearchParams(location.search).get("modal") === PLAYER_MODAL_QUERY;

  const { showToast, ToastContainer } = useToast();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("tutti");
  const [filterRole, setFilterRole] = useState("tutti");
  const [filterFoot, setFilterFoot] = useState("tutti");
  const [filterAge, setFilterAge] = useState("tutti");
  const [gruppoFilter, setGruppoFilter] = useState(urlGruppo);

  const [form, setForm] = useState(() => loadNewPlayerDraft(getEmptyPlayerForm(urlGruppo)));

  useEffect(() => {
    if (!openModal) return;
    try {
      localStorage.setItem(NEW_PLAYER_DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }, [form, openModal]);

  // Birthday players (today)
  const birthdayPlayers = players.filter((p) => isBirthdayToday(p.birthDate));

  // Average team age
  const averageAge = getTeamAverageAge(players);

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

  const activeFilterCount = [filterStatus, filterRole, filterFoot, filterAge].filter(
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
    return matchesSearch && matchesGroup && matchesStatus && matchesRole && matchesFoot && matchesAge;
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
    if (r.includes("difensore") || r.includes("terzino") || r.includes("libero") ||
        r.includes("stopper") || r.includes("centrale") || r.includes("cb") ||
        r.includes("lb") || r.includes("rb") || r.includes("wb")) return "D";
    if (r.includes("centrocampista") || r.includes("mezzala") || r.includes("mediano") ||
        r.includes("regista") || r.includes("trequartista") || r.includes("tornante") ||
        r.includes("mezz") || r.includes("cm") || r.includes("cdm") || r.includes("cam")) return "C";
    if (r.includes("attaccante") || r.includes("punta") || r.includes("ala") ||
        r.includes("bomber") || r.includes("esterno") || r.includes("seconda") ||
        r.includes("cf") || r.includes("lw") || r.includes("rw") || r.includes("st")) return "A";
    return null;
  }

  const countByPosition = players.reduce(
    (acc, p) => {
      const family = getRoleFamily(p.role);
      if (family) acc[family] = (acc[family] || 0) + 1;
      return acc;
    },
    { P: 0, D: 0, C: 0, A: 0 }
  );

  function handlePhotoUpload(file) {
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

  function openNewPlayerModal() {
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
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast(t("pages.players.missingName"), "warn");
      return;
    }

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const newPlayer = {
      id:          createId("player"),
      name:        fullName,
      firstName:   form.firstName.trim(),
      lastName:    form.lastName.trim(),
      role:        form.role        || "",
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
    const removed = players.find((p) => String(p.id) === String(id));
    if (!removed) return;
    setPlayers((prev) => prev.filter((p) => String(p.id) !== String(id)));
    showToast(t("pages.players.playerDeleted"), "info", {
      duration: 5000,
      action: {
        label: t("common.undo"),
        fn: () => setPlayers((prev) => [...prev, removed]),
      },
    });
  }

  return (
    <div style={styles.page}>
      <ToastContainer />

      {showImport && (
        <ImportPlayersModal
          onClose={() => setShowImport(false)}
          onImport={(newPlayers) => {
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
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to="/player-compare"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 12,
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
                color: "#c4b5fd", fontWeight: 800, fontSize: 13, textDecoration: "none",
              }}
            >
              ⚡ {t("navigation.items.playerCompare")}
            </Link>
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 12,
                background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
                color: "#6ee7b7", fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}
            >
              📥 {t("pages.importPlayers.btnLabel")}
            </button>
            <Button onClick={openNewPlayerModal}>{t("pages.players.newPlayer")}</Button>
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

      <AppCard style={{ marginBottom: 22 }}>
        <div style={pStyles.toolbar}>
          <div style={pStyles.counterGrid}>
            <MetricCard label={t("pages.players.totalPlayers")} value={players.length} tone="blue" />
            <MetricCard
              label={t("pages.players.available")}
              value={players.filter((p) => (p.status || "Disponibile") === "Disponibile").length}
              tone="green"
            />
            <MetricCard
              label={t("pages.players.injured")}
              value={players.filter((p) => p.status === "Infortunato").length}
              tone="red"
            />
            {averageAge !== null && (
              <MetricCard label={t("pages.players.averageAge")} value={averageAge} tone="purple" />
            )}
            {Object.entries(countByGroup).map(([g, n]) => (
              <MetricCard key={g} label={GROUP_LABELS[g] || g} value={n} />
            ))}
            <MetricCard label={`🧤 ${t("pages.players.posGK")}`}  value={countByPosition.P} tone="slate" />
            <MetricCard label={`🛡️ ${t("pages.players.posDEF")}`} value={countByPosition.D} tone="blue" />
            <MetricCard label={`⚙️ ${t("pages.players.posMID")}`} value={countByPosition.C} tone="green" />
            <MetricCard label={`⚡ ${t("pages.players.posFWD")}`} value={countByPosition.A} tone="orange" />
          </div>

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
                  onChange={(e) => setFilterRole(e.target.value)}
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
                onClick={() => { setFilterStatus("tutti"); setFilterRole("tutti"); setFilterFoot("tutti"); setFilterAge("tutti"); }}
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
                onClick={() => setGruppoFilter(g)}
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
                  setFilterFoot("tutti");
                  setFilterAge("tutti");
                }}
                style={{
                  marginTop: 12, padding: "8px 18px", borderRadius: 10,
                  background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)",
                  color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                ✕ {t("pages.players.resetFilters")}
              </button>
            ) : (
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
            )
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 18,
          }}
        >
          {filteredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onDelete={() => deletePlayer(player.id)}
            />
          ))}
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
              placeholder={t("pages.players.role")}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={styles.input}
            />

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

function MetricCard({ label, value, tone = "slate" }) {
  const tones = {
    blue: "#60a5fa",
    green: "#22c55e",
    red: "#f87171",
    purple: "#a78bfa",
    slate: "#cbd5e1",
  };

  return (
    <div style={pStyles.metricCard}>
      <strong style={{ ...pStyles.metricValue, color: tones[tone] }}>
        {value}
      </strong>
      <span style={pStyles.metricLabel}>{label}</span>
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
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(124px,1fr))",
    gap: 10,
    flex: "1 1 520px",
  },
  searchWrap: {
    flex: "0 1 360px",
    width: "100%",
  },
  metricCard: {
    minHeight: 70,
    padding: "12px 13px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0,
    marginTop: 7,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
