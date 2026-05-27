import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import { createId } from "../utils/helpers";
import { useTranslation } from "../i18n";

// ─────────────────────────────────────────────
// Costanti
// ─────────────────────────────────────────────
const INJURY_TYPES = [
  "Muscolare", "Osseo / frattura", "Articolare",
  "Tendineo / legamentoso", "Contusione",
  "Malattia / influenza", "Affaticamento", "Altro",
];

// label-key map — values stay as Italian (persisted to player data for backward compat)
const INJURY_TYPE_LABEL_KEYS = {
  "Muscolare":              "pages.availability.injuryTypeMusc",
  "Osseo / frattura":       "pages.availability.injuryTypeBone",
  "Articolare":             "pages.availability.injuryTypeJoint",
  "Tendineo / legamentoso": "pages.availability.injuryTypeTendon",
  "Contusione":             "pages.availability.injuryTypeBruise",
  "Malattia / influenza":   "pages.availability.injuryTypeIllness",
  "Affaticamento":          "pages.availability.injuryTypeFatigue",
  "Altro":                  "pages.availability.injuryTypeOther",
};

const STATUS_OPTIONS = [
  { value: "Infortunato",   labelKey: "pages.availability.statusInjured",       color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)"  },
  { value: "Recupero",      labelKey: "pages.availability.statusRecovery",      color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)"   },
  { value: "Differenziato", labelKey: "pages.availability.statusDifferentiated", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"   },
  { value: "Squalificato",  labelKey: "pages.availability.statusSuspended",      color: "#a855f7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)"   },
];

const DIFFERENTIATED_WORK_TYPES = [
  "Defaticante",
  "Recupero infortunio",
  "Lavoro individuale",
  "Rientro parziale in gruppo",
  "Carico ridotto",
];

const DIFF_TYPE_LABEL_KEYS = {
  "Defaticante":                 "pages.availability.diffTypeWarmDown",
  "Recupero infortunio":         "pages.availability.diffTypeInjRecovery",
  "Lavoro individuale":          "pages.availability.diffTypeIndividual",
  "Rientro parziale in gruppo":  "pages.availability.diffTypePartialReturn",
  "Carico ridotto":              "pages.availability.diffTypeReducedLoad",
};

const UNAVAILABLE = STATUS_OPTIONS.map((s) => s.value);
const AVAILABILITY_DRAFT_KEY = "calciolab_availability_draft_v1";
const AVAILABILITY_MODAL = "medical";
const RECOVERY_MODAL = "recovery";

const PREVENTION_CARDS = [
  {
    titleKey: "pages.availability.prev1Title",
    tagKey:   "pages.availability.prevTagPrevention",
    tone: "#38bdf8",
    pointKeys: [
      "pages.availability.prev1p1",
      "pages.availability.prev1p2",
      "pages.availability.prev1p3",
    ],
  },
  {
    titleKey: "pages.availability.prev2Title",
    tagKey:   "pages.availability.prevTagPrevention",
    tone: "#38bdf8",
    pointKeys: [
      "pages.availability.prev2p1",
      "pages.availability.prev2p2",
      "pages.availability.prev2p3",
    ],
  },
  {
    titleKey: "pages.availability.prev3Title",
    tagKey:   "pages.availability.prevTagPrevention",
    tone: "#38bdf8",
    pointKeys: [
      "pages.availability.prev3p1",
      "pages.availability.prev3p2",
      "pages.availability.prev3p3",
    ],
  },
  {
    titleKey: "pages.availability.prev4Title",
    tagKey:   "pages.availability.prevTagReturnToPlay",
    tone: "#22c55e",
    pointKeys: [
      "pages.availability.prev4p1",
      "pages.availability.prev4p2",
      "pages.availability.prev4p3",
    ],
  },
];

function getStatusStyle(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || { color: "#94a3b8", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" };
}

function emptyForm(players) {
  const firstAvailable = players.find((p) => !UNAVAILABLE.includes(p.status || "Disponibile"));
  return {
    playerId:        firstAvailable?.id || "",
    status:          "Infortunato",
    injuryType:      "",
    differentiatedType: "",
    injuryStartDate: new Date().toISOString().slice(0, 10),
    expectedReturn:  "",
    notes:           "",
  };
}

function loadAvailabilityDraft(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

function clearAvailabilityDraft(id = "new") {
  try {
    localStorage.removeItem(`${AVAILABILITY_DRAFT_KEY}:${id}`);
  } catch {
    /* localStorage can be unavailable in restricted browsers */
  }
}

// Calcola sedute e partite saltate tra due date
function calcMissed(startDate, endDate, sessions, matches) {
  if (!startDate || !endDate) return { sessionsMissed: 0, matchesMissed: 0 };
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const sessionsMissed = sessions.filter((s) => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  }).length;
  const matchesMissed = matches.filter((m) => {
    const d = new Date(m.date);
    return d >= start && d <= end;
  }).length;
  return { sessionsMissed, matchesMissed };
}

function getMedicalType(status, injuryType, differentiatedType) {
  if (status === "Differenziato") {
    return injuryType || differentiatedType || "Lavoro differenziato";
  }
  return injuryType || status || "Infortunio";
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────
export default function Availability({
  players = [], setPlayers, sessions = [], matches = [] }) {

  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const searchParams = new URLSearchParams(location.search);
  const openModal = searchParams.get("modal") === AVAILABILITY_MODAL;
  const editingPlayerParam = searchParams.get("playerId") || "";
  const recoveryPlayerId = searchParams.get("modal") === RECOVERY_MODAL ? searchParams.get("playerId") : null;
  const modalKeyRef = useRef("");
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [form, setForm]                 = useState(() => loadAvailabilityDraft(`${AVAILABILITY_DRAFT_KEY}:new`, emptyForm(players)));
  const [historyPlayerId, setHistoryPlayerId] = useState(null);
  const [recoveryDate, setRecoveryDate] = useState(() => new Date().toISOString().slice(0, 10));

  const injuredPlayers = players.filter((p) => UNAVAILABLE.includes(p.status || "Disponibile"));
  const availablePlayers = players.filter((p) => !UNAVAILABLE.includes(p.status || "Disponibile"));
  const recoveryPlayer = players.find((p) => String(p.id) === String(recoveryPlayerId));
  const recoveryActiveInjury = (recoveryPlayer?.injuries || []).find((i) => !i.endDate);
  const recoveryStartDate = recoveryActiveInjury?.startDate || recoveryPlayer?.injuryStartDate || "";
  const recoveryStats = recoveryPlayer
    ? calcMissed(recoveryStartDate, recoveryDate, sessions, matches)
    : { sessionsMissed: 0, matchesMissed: 0 };
  const recoveryDaysOut = recoveryStartDate
    ? Math.max(0, Math.floor((new Date(recoveryDate) - new Date(recoveryStartDate)) / 86400000))
    : 0;

  useEffect(() => {
    if (!openModal) {
      modalKeyRef.current = "";
      return;
    }
    const key = `${AVAILABILITY_DRAFT_KEY}:${editingPlayerParam || "new"}`;
    if (modalKeyRef.current === key) return;
    modalKeyRef.current = key;

    if (editingPlayerParam) {
      const player = players.find((p) => String(p.id) === String(editingPlayerParam));
      if (!player) return;
      const active = (player.injuries || []).find((i) => !i.endDate);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingPlayerId(player.id);
      setForm(loadAvailabilityDraft(key, {
        playerId: player.id,
        status: player.status || "Infortunato",
        injuryType: active?.injuryType || player.injuryType || "",
        differentiatedType: player.status === "Differenziato"
          ? active?.differentiatedType || player.differentiatedType || DIFFERENTIATED_WORK_TYPES[0]
          : "",
        injuryStartDate: active?.startDate || player.injuryStartDate || new Date().toISOString().slice(0, 10),
        expectedReturn: player.expectedReturn || "",
        notes: active?.notes || player.injuryNotes || "",
      }));
      return;
    }

    setEditingPlayerId(null);
    setForm(loadAvailabilityDraft(key, emptyForm(players)));
  }, [editingPlayerParam, openModal, players]);

  useEffect(() => {
    if (!openModal || !modalKeyRef.current) return;
    try {
      localStorage.setItem(modalKeyRef.current, JSON.stringify(form));
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }, [form, openModal]);

  // ── Apri modal aggiungi
  function openAdd() {
    openAvailabilityModal();
  }

  // ── Apri modal modifica infortunio attivo
  function openEdit(player) {
    openAvailabilityModal(player.id);
  }

  function openAvailabilityModal(playerId = "") {
    const params = new URLSearchParams(location.search);
    params.set("modal", AVAILABILITY_MODAL);
    if (playerId) params.set("playerId", String(playerId));
    else params.delete("playerId");
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeAvailabilityModal({ resetDraft = false } = {}) {
    if (resetDraft) clearAvailabilityDraft(editingPlayerId || editingPlayerParam || "new");
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    params.delete("playerId");
    const search = params.toString();
    setEditingPlayerId(null);
    setForm(emptyForm(players));
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  }

  // ── Salva infortunio (nuovo o modifica)
  function saveInjury() {
    if (!form.playerId) {
      showToast(t("pages.availability.toastSelectPlayer"), "warn");
      return;
    }
    const differentiatedType = form.status === "Differenziato"
      ? form.differentiatedType || DIFFERENTIATED_WORK_TYPES[0]
      : "";
    const medicalType = getMedicalType(form.status, form.injuryType, differentiatedType);

    setPlayers((prevPlayers) => prevPlayers.map((p) => {
      if (String(p.id) !== String(form.playerId)) return p;

      const existingInjuries = p.injuries || [];

      if (editingPlayerId) {
        // Aggiorna infortunio attivo esistente
        return {
          ...p,
          status:          form.status,
          injuryType:      medicalType,
          differentiatedType,
          injuryStartDate: form.injuryStartDate,
          expectedReturn:  form.expectedReturn,
          injuryNotes:     form.notes,
          injuries: existingInjuries.map((inj) =>
            !inj.endDate
              ? {
                  ...inj,
                  status: form.status,
                  injuryType: medicalType,
                  differentiatedType,
                  startDate: form.injuryStartDate,
                  expectedReturn: form.expectedReturn,
                  notes: form.notes,
                }
              : inj
          ),
        };
      } else {
        // Nuovo infortunio — aggiungi a storico
        const newInjury = {
          id:          createId("injury"),
          injuryType:  medicalType,
          differentiatedType,
          status:      form.status,
          startDate:   form.injuryStartDate,
          endDate:     null,
          expectedReturn: form.expectedReturn,
          notes:       form.notes,
          sessionsMissed: 0,
          matchesMissed:  0,
        };
        return {
          ...p,
          status:          form.status,
          injuryType:      medicalType,
          differentiatedType,
          injuryStartDate: form.injuryStartDate,
          expectedReturn:  form.expectedReturn,
          injuryNotes:     form.notes,
          injuries:        [...existingInjuries, newInjury],
        };
      }
    }));

    clearAvailabilityDraft(editingPlayerId || editingPlayerParam || "new");
    closeAvailabilityModal();
  }

  function openRecovery(player) {
    const params = new URLSearchParams(location.search);
    params.set("modal", RECOVERY_MODAL);
    params.set("playerId", String(player.id));
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
    setRecoveryDate(new Date().toISOString().slice(0, 10));
  }

  function closeRecovery() {
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    params.delete("playerId");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  }

  // ── Segna rientro: chiude l'infortunio attivo e aggiorna lo storico
  function markRecovered(playerId, recoveredAt = new Date().toISOString().slice(0, 10)) {
    const today = recoveredAt;

    setPlayers((prevPlayers) => prevPlayers.map((p) => {
      if (String(p.id) !== String(playerId)) return p;

      const activeInjuries = (p.injuries || []).filter((i) => !i.endDate);
      if (!activeInjuries.length) return p;

      const activeInjury = activeInjuries[0];
      const { sessionsMissed, matchesMissed } = calcMissed(
        activeInjury.startDate || p.injuryStartDate,
        today,
        sessions,
        matches
      );
      const daysOut = activeInjury.startDate
        ? Math.max(0, Math.floor((new Date(today) - new Date(activeInjury.startDate)) / 86400000))
        : 0;

      return {
        ...p,
        status:          "Disponibile",
        injuryType:      "",
        differentiatedType: "",
        injuryStartDate: "",
        expectedReturn:  "",
        injuryNotes:     "",
        injuries: (p.injuries || []).map((inj) =>
          !inj.endDate
            ? { ...inj, endDate: today, sessionsMissed, matchesMissed, daysOut }
            : inj
        ),
      };
    }));
    closeRecovery();
  }

  const selectablePlayers = players.filter(
    (p) => !UNAVAILABLE.includes(p.status || "Disponibile") || String(p.id) === String(editingPlayerId)
  );

  return (
    <div style={styles.page}>
      <ToastContainer />
      <PageHeader
        title={t("pages.availability.title")}
        subtitle={t("pages.availability.subtitle")}
        action={<Button onClick={openAdd}>{t("pages.availability.btnAdd")}</Button>}
      />

      {/* KPI + azione */}
      <div style={av.kpiRow}>
        <KpiPill label={t("pages.availability.kpiAvailable")} value={availablePlayers.length} color="#22c55e" />
        {STATUS_OPTIONS.map((s) => {
          const n = players.filter((p) => p.status === s.value).length;
          return n > 0 ? <KpiPill key={s.value} label={t(s.labelKey)} value={n} color={s.color} /> : null;
        })}
        <div style={{ flex: 1 }} />
      </div>

      <AppCard>
        <div style={av.sectionHeader}>
          <div>
            <h3 style={av.sectionTitle}>{t("pages.availability.preventionTitle")}</h3>
            <p style={av.muted}>{t("pages.availability.preventionSub")}</p>
          </div>
        </div>
        <div style={av.preventionGrid}>
          {PREVENTION_CARDS.map((card) => (
            <div key={card.titleKey} style={av.preventionCard}>
              <div style={av.preventionTop}>
                <strong style={av.preventionTitle}>{t(card.titleKey)}</strong>
                <span style={{ ...av.preventionTag, color: card.tone, borderColor: `${card.tone}55`, background: `${card.tone}18` }}>
                  {t(card.tagKey)}
                </span>
              </div>
              <ul style={av.preventionList}>
                {card.pointKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </AppCard>

      {/* Lista infortuni attivi */}
      {injuredPlayers.length === 0 ? (
        <EmptyState icon="🏥" title={t("pages.availability.emptyTitle")} text={t("pages.availability.emptyText")} />
      ) : (
        <div style={av.grid}>
          {injuredPlayers.map((player) => {
            const name = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";
            const st   = getStatusStyle(player.status);
            const statusLabel = st.labelKey ? t(st.labelKey) : player.status;
            const activeInj = (player.injuries || []).find((i) => !i.endDate);
            const startDate = activeInj?.startDate || player.injuryStartDate || null;
            const daysOut   = startDate ? Math.floor((new Date() - new Date(startDate)) / 86400000) : null;
            const daysLeft  = player.expectedReturn
              ? Math.ceil((new Date(player.expectedReturn) - new Date()) / 86400000)
              : null;
            const pastInjuries = (player.injuries || []).filter((i) => i.endDate);

            return (
              <div key={player.id} style={{ ...av.card, borderColor: st.border, background: st.bg }}>
                {/* Header */}
                <div style={av.cardHeader}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ ...av.avatar, background: st.bg, border: `1.5px solid ${st.border}` }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: st.color }}>{name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, color: "#e2e8f0" }}>{name}</strong>
                      <p style={av.muted}>{player.role || "—"}{player.shirtNumber ? ` · #${player.shirtNumber}` : ""}</p>
                    </div>
                  </div>
                  <span style={{ ...av.badge, color: st.color, background: "rgba(0,0,0,0.2)", border: `1px solid ${st.border}` }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Dettagli */}
                <div style={av.details}>
                  {player.injuryType && <InfoRow icon="🏥" label={t("pages.availability.labelType")} value={player.injuryType} />}
                  {player.status === "Differenziato" && player.differentiatedType && (
                    <InfoRow icon="🏃" label={t("pages.availability.labelWork")} value={player.differentiatedType} />
                  )}
                  {daysOut !== null && (
                    <InfoRow icon="📅" label={t("pages.availability.labelStopDate")} value={`${startDate} · ${daysOut === 0 ? t("pages.availability.today") : t("pages.availability.daysAgo", { days: daysOut })}`} />
                  )}
                  {player.expectedReturn && (
                    <InfoRow
                      icon="🔄"
                      label={t("pages.availability.labelExpReturn")}
                      value={player.expectedReturn}
                      extra={daysLeft !== null && (
                        <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 8, color: daysLeft <= 0 ? "#22c55e" : daysLeft <= 7 ? "#fb923c" : "#64748b" }}>
                          {daysLeft <= 0 ? t("pages.availability.canReturn") : t("pages.availability.daysLeft", { days: daysLeft })}
                        </span>
                      )}
                    />
                  )}
                </div>

                {/* Azioni */}
                <div style={av.actions}>
                  {pastInjuries.length > 0 && (
                    <button
                      onClick={() => setHistoryPlayerId(historyPlayerId === player.id ? null : player.id)}
                      style={av.historyBtn}
                    >
                      {t("pages.availability.historyBtn", { count: pastInjuries.length })}
                    </button>
                  )}
                  <Button variant="ghost" onClick={() => openEdit(player)} style={{ flex: 1 }}>{t("pages.availability.btnEdit")}</Button>
                  <Button variant="ghost" onClick={() => navigate(`/players/${player.id}`)} style={{ flex: 1 }}>{t("pages.availability.btnCard")}</Button>
                  <Button onClick={() => openRecovery(player)} style={{ flex: 1 }}>{t("pages.availability.btnRecovery")}</Button>
                </div>

                {/* Storico infortuni inline */}
                {historyPlayerId === player.id && pastInjuries.length > 0 && (
                  <div style={av.historyBox}>
                    <p style={av.historyTitle}>{t("pages.availability.historyTitle", { name })}</p>
                    {[...pastInjuries].reverse().map((inj, index) => (
                      <div key={inj.id || `${inj.startDate}-${inj.injuryType}-${index}`} style={av.historyRow}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{inj.injuryType || "—"}</span>
                          {inj.differentiatedType && (
                            <span style={{ fontSize: 12, color: "#fbbf24" }}>{inj.differentiatedType}</span>
                          )}
                          <span style={{ fontSize: 12, color: "#64748b" }}>{inj.startDate} → {inj.endDate}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                          <StatPill color="#94a3b8" label={t("pages.availability.statDaysOut")} value={inj.daysOut ?? "—"} />
                          <StatPill color="#f87171" label={t("pages.availability.statSessionsMissed")} value={inj.sessionsMissed ?? 0} />
                          <StatPill color="#fb923c" label={t("pages.availability.statMatchesMissed")} value={inj.matchesMissed ?? 0} />
                        </div>
                        {inj.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>{inj.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Storico giocatori senza infortuni attivi */}
      {players.some((p) => !UNAVAILABLE.includes(p.status || "Disponibile") && (p.injuries || []).some((i) => i.endDate)) && (
        <AppCard>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>{t("pages.availability.pastHistoryTitle")}</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {players
              .filter((p) => !UNAVAILABLE.includes(p.status || "Disponibile") && (p.injuries || []).some((i) => i.endDate))
              .map((player) => {
                const name = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";
                const past = (player.injuries || []).filter((i) => i.endDate);
                const totalDays     = past.reduce((s, i) => s + (i.daysOut || 0), 0);
                const totalSessions = past.reduce((s, i) => s + (i.sessionsMissed || 0), 0);
                const totalMatches  = past.reduce((s, i) => s + (i.matchesMissed || 0), 0);

                return (
                  <div key={player.id} style={av.pastPlayerRow}>
                    <div>
                      <strong style={{ fontSize: 14, color: "#e2e8f0" }}>{name}</strong>
                      <p style={av.muted}>{player.role || "—"}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <StatPill color="#94a3b8" label={t("pages.availability.statInjuries")} value={past.length} />
                      <StatPill color="#64748b" label={t("pages.availability.statTotalDays")} value={totalDays} />
                      <StatPill color="#f87171" label={t("pages.availability.statSessionsMissed")} value={totalSessions} />
                      <StatPill color="#fb923c" label={t("pages.availability.statMatchesMissed")} value={totalMatches} />
                      <button onClick={() => setHistoryPlayerId(historyPlayerId === player.id ? null : player.id)} style={av.historyBtn}>
                        {historyPlayerId === player.id ? t("pages.availability.btnClose") : t("pages.availability.btnDetail")}
                      </button>
                      <button onClick={() => navigate(`/players/${player.id}`)} style={av.historyBtn}>
                        {t("pages.availability.btnCard")}
                      </button>
                    </div>
                    {historyPlayerId === player.id && (
                      <div style={{ ...av.historyBox, gridColumn: "1 / -1", marginTop: 4 }}>
                        {[...past].reverse().map((inj, index) => (
                          <div key={inj.id || `${inj.startDate}-${inj.injuryType}-${index}`} style={av.historyRow}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{inj.injuryType || "—"}</span>
                              {inj.differentiatedType && (
                                <span style={{ fontSize: 12, color: "#fbbf24" }}>{inj.differentiatedType}</span>
                              )}
                              <span style={{ fontSize: 12, color: "#64748b" }}>{inj.startDate} → {inj.endDate}</span>
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                              <StatPill color="#94a3b8" label={t("pages.availability.statDaysOut")} value={inj.daysOut ?? "—"} />
                              <StatPill color="#f87171" label={t("pages.availability.statSessionsMissed")} value={inj.sessionsMissed ?? 0} />
                              <StatPill color="#fb923c" label={t("pages.availability.statMatchesMissed")} value={inj.matchesMissed ?? 0} />
                            </div>
                            {inj.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>{inj.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </AppCard>
      )}

      {/* Modal aggiungi / modifica */}
      {openModal && (
        <Modal
          title={editingPlayerId ? t("pages.availability.modalEditTitle") : t("pages.availability.modalAddTitle")}
          onClose={() => closeAvailabilityModal()}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {!editingPlayerId && (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>{t("pages.availability.fieldPlayer")}</label>
                <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} style={styles.input}>
                  <option value="">{t("pages.availability.selectPlayer")}</option>
                  {selectablePlayers.map((p) => {
                    const n = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
                    return <option key={p.id} value={p.id}>{n}{p.shirtNumber ? ` (#${p.shirtNumber})` : ""}</option>;
                  })}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>{t("pages.availability.fieldStatus")}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      status: s.value,
                      differentiatedType: s.value === "Differenziato"
                        ? form.differentiatedType || DIFFERENTIATED_WORK_TYPES[0]
                        : "",
                    })}
                    style={{
                    borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    color: form.status === s.value ? s.color : "#94a3b8",
                    background: form.status === s.value ? s.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${form.status === s.value ? s.border : "rgba(255,255,255,0.08)"}`,
                  }}>
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>{t("pages.availability.fieldInjuryType")}</label>
              <select value={form.injuryType} onChange={(e) => setForm({ ...form, injuryType: e.target.value })} style={styles.input}>
                <option value="">{t("pages.availability.selectType")}</option>
                {INJURY_TYPES.map((type) => (
                  <option key={type} value={type}>{INJURY_TYPE_LABEL_KEYS[type] ? t(INJURY_TYPE_LABEL_KEYS[type]) : type}</option>
                ))}
              </select>
            </div>

            {form.status === "Differenziato" && (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>{t("pages.availability.fieldDiffType")}</label>
                <select
                  value={form.differentiatedType}
                  onChange={(e) => setForm({ ...form, differentiatedType: e.target.value })}
                  style={styles.input}
                >
                  {DIFFERENTIATED_WORK_TYPES.map((type) => (
                    <option key={type} value={type}>{DIFF_TYPE_LABEL_KEYS[type] ? t(DIFF_TYPE_LABEL_KEYS[type]) : type}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>{t("pages.availability.fieldStartDate")}</label>
                <input type="date" value={form.injuryStartDate} onChange={(e) => setForm({ ...form, injuryStartDate: e.target.value })} style={styles.input} />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>{t("pages.availability.fieldExpReturnDate")}</label>
                <input type="date" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} style={styles.input} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>{t("pages.availability.fieldNotes")}</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("pages.availability.notesPlaceholder")}
                style={{ ...styles.input, minHeight: 72, resize: "vertical" }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Button variant="ghost" onClick={() => closeAvailabilityModal({ resetDraft: true })}>{t("pages.availability.btnCancel")}</Button>
            <Button onClick={saveInjury}>{editingPlayerId ? t("pages.availability.btnUpdate") : t("pages.availability.btnAddInj")}</Button>
          </div>
        </Modal>
      )}

      {recoveryPlayer && (
        <Modal title={t("pages.availability.recoveryModalTitle")} onClose={closeRecovery}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={av.recoverySummary}>
              <div>
                <p style={av.fieldLabel}>{t("pages.availability.recoveryPlayerLabel")}</p>
                <strong style={{ color: "#e2e8f0", fontSize: 18 }}>
                  {[recoveryPlayer.firstName, recoveryPlayer.lastName].filter(Boolean).join(" ") || recoveryPlayer.name || "—"}
                </strong>
                <p style={av.muted}>
                  {recoveryPlayer.injuryType || recoveryActiveInjury?.injuryType || t("pages.availability.recoveryActiveStop")}
                  {recoveryPlayer.differentiatedType ? ` · ${recoveryPlayer.differentiatedType}` : ""}
                </p>
              </div>
              <span style={{ ...av.badge, color: "#22c55e", border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.12)" }}>
                {t("pages.availability.recoveryBadge")}
              </span>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>{t("pages.availability.recoveryDateLabel")}</label>
              <input
                type="date"
                value={recoveryDate}
                onChange={(e) => setRecoveryDate(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={av.recoveryStats}>
              <StatPill color="#94a3b8" label={t("pages.availability.statDaysOut")} value={recoveryDaysOut} />
              <StatPill color="#f87171" label={t("pages.availability.statSessionsMissed")} value={recoveryStats.sessionsMissed} />
              <StatPill color="#fb923c" label={t("pages.availability.statMatchesMissed")} value={recoveryStats.matchesMissed} />
            </div>

            <p style={{ ...av.muted, margin: 0 }}>
              {t("pages.availability.recoveryNote")}
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={closeRecovery}>{t("pages.availability.btnCancel")}</Button>
            <Button onClick={() => markRecovered(recoveryPlayer.id, recoveryDate)}>{t("pages.availability.btnConfirmRecovery")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── UI helpers ───────────────────────────────
function KpiPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{label}</span>
      <strong style={{ fontSize: 15, color: "#e2e8f0" }}>{value}</strong>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <span style={{ fontSize: 12, color: "#94a3b8", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "3px 9px" }}>
      <strong style={{ color }}>{value}</strong> {label}
    </span>
  );
}

function InfoRow({ icon, label, value, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{label}:</span>
      <span style={{ fontSize: 13, color: "#cbd5e1" }}>{value}</span>
      {extra}
    </div>
  );
}

const av = {
  kpiRow:     { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20, padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 },
  card:       { borderRadius: 14, padding: 18, border: "1px solid", display: "grid", gap: 14 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  avatar:     { width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0 },
  badge:      { fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 0, whiteSpace: "nowrap" },
  details:    { display: "grid", gap: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" },
  actions:    { display: "flex", gap: 8, flexWrap: "wrap" },
  historyBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 700 },
  historyBox: { background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 14, display: "grid", gap: 10, border: "1px solid rgba(255,255,255,0.06)" },
  historyTitle:{ margin: "0 0 6px", fontSize: 13, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0 },
  historyRow: { paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  pastPlayerRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", flexWrap: "wrap" },
  recoverySummary: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", padding: 14, borderRadius: 14, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" },
  recoveryStats: { display: "flex", gap: 10, flexWrap: "wrap", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" },
  muted:      { color: "#64748b", margin: "3px 0 0", fontSize: 12, lineHeight: 1.35 },
  fieldLabel: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#64748b" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  sectionTitle: { margin: 0, color: "#f1f5f9", fontSize: 16, lineHeight: 1.2 },
  preventionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  preventionCard: { padding: 14, borderRadius: 13, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" },
  preventionTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  preventionTitle: { color: "#e2e8f0", fontSize: 13, lineHeight: 1.25 },
  preventionTag: { border: "1px solid", borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", whiteSpace: "nowrap" },
  preventionList: { margin: 0, paddingLeft: 18, color: "#94a3b8", fontSize: 12, lineHeight: 1.5, display: "grid", gap: 4 },
};
