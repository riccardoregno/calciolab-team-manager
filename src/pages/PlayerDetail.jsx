import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTabState } from "../hooks/useTabState";

import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { useAreaPermission } from "../components/auth/permissionContext";

import {
  PlayerAbsencesSection,
  PlayerDevelopmentTab,
  PlayerKpiStrip,
  PlayerMedicalTab,
  PlayerPhysicalTab,
  PlayerProfileTab,
  PlayerSidebar,
  PlayerStatsTab,
  PlayerTabs,
  PlayerTechnicalOverview,
  PlayerVideoTab,
  PlayerWellnessTab,
} from "../components/players/PlayerDetailSections";
import { getPreventionRecommendations } from "../components/players/playerDetailLogic";
import { styles } from "../styles/index.js";
import { createId, getPhysicalReference, getPlayerSeasonSeries, getPlayerSummary, normalizeAppSettings } from "../utils/helpers";
import { getInviteExpiryDate } from "../utils/settingsHelpers";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";
import { fetchPlayerPortalActivity } from "../services/playerPortalActivity";
import { getPlayerWellness } from "../services/wellness";

const ABSENCE_TYPES = ["ferie", "permesso", "studio", "lavoro", "altro"];

function emptyAbsenceForm() {
  return {
    type: ABSENCE_TYPES[0],
    dateStart: new Date().toISOString().slice(0, 10),
    dateEnd: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

const DIFFERENTIATED_TYPES = [
  "Defaticante",
  "Recupero infortunio",
  "Lavoro individuale",
  "Rientro parziale in gruppo",
  "Carico ridotto",
];

const INJURY_TYPES = [
  "Muscolare", "Osseo / frattura", "Articolare",
  "Tendineo / legamentoso", "Contusione",
  "Malattia / influenza", "Affaticamento", "Altro",
];

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

// Display-label lookup — keeps stored Italian values unchanged
const DIFF_TYPE_LABEL_KEYS = {
  "Defaticante":                "pages.availability.diffTypeWarmDown",
  "Recupero infortunio":        "pages.availability.diffTypeInjRecovery",
  "Lavoro individuale":         "pages.availability.diffTypeIndividual",
  "Rientro parziale in gruppo": "pages.availability.diffTypePartialReturn",
  "Carico ridotto":             "pages.availability.diffTypeReducedLoad",
};

function PlayerDetail({
  players, setPlayers, sessions = [], matches = [], physicalTests = [], setStaffTasks,
  appSettings, setAppSettings, team }) {

  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();

  const player = useMemo(
    () => players.find((item) => String(item.id) === String(id)),
    [players, id]
  );

  const { showToast, ToastContainer } = useToast();
  const [editing, setEditing] = useState(false);
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState(null);
  const [activeTab, setActiveTab] = useTabState("tab", "cartella");
  const [form, setForm] = useState({ ...player });
  const [medicalModal, setMedicalModal] = useState(null);
  const [absenceModal, setAbsenceModal] = useState(false);
  const [editingAbsenceId, setEditingAbsenceId] = useState(null);
  const [absenceForm, setAbsenceForm] = useState(() => emptyAbsenceForm());
  const [conflictModal, setConflictModal] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    differentiatedType: DIFFERENTIATED_TYPES[1],
    injuryType: INJURY_TYPES[0],
    startDate: new Date().toISOString().slice(0, 10),
    expectedReturn: "",
    note: "",
    returnDate: new Date().toISOString().slice(0, 10),
  });
  const isMobile = useIsMobile();
  const [invitingPortal, setInvitingPortal] = useState(false);
  const [revokingPortal, setRevokingPortal] = useState(false);
  const [cancellingPortalInvite, setCancellingPortalInvite] = useState(false);
  const [portalInviteLink, setPortalInviteLink] = useState("");
  const [portalAccountState, setPortalAccountState] = useState({ playerId: "", accountId: null });
  const [portalActivityState, setPortalActivityState] = useState({ playerId: "", data: null });
  const [portalActivityNow, setPortalActivityNow] = useState(Date.now());
  const [wellnessHistory, setWellnessHistory] = useState(null); // null = not loaded yet
  const currentPlayerId = String(player?.id || "");
  const portalAccountId = portalAccountState.playerId === currentPlayerId ? portalAccountState.accountId : null;
  const portalActivity = portalActivityState.playerId === currentPlayerId ? portalActivityState.data : null;

  useEffect(() => {
    if (!player) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ ...player });
    setEditing(false);
    setEditBaseUpdatedAt(player._updatedAt || null);
    setMedicalModal(null);
    setConflictModal(false);
    setPortalInviteLink("");
    // Reset intenzionale solo al cambio atleta: includere l'intero player sovrascriverebbe edit/modali dopo ogni update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  useEffect(() => {
    if (!currentPlayerId || !team?.id || !isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from("player_accounts")
      .select("id")
      .eq("team_id", team.id)
      .eq("player_id", currentPlayerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPortalAccountState({ playerId: currentPlayerId, accountId: data?.id || null });
      });
    return () => { cancelled = true; };
  }, [currentPlayerId, team?.id]);

  useEffect(() => {
    if (!currentPlayerId || !team?.id || !isSupabaseConfigured) {
      return undefined;
    }

    let active = true;
    fetchPlayerPortalActivity({ teamId: team.id, playerId: currentPlayerId }).then(({ data }) => {
      if (active) setPortalActivityState({ playerId: currentPlayerId, data: data || null });
    });

    const channel = supabase
      .channel(`player_portal_activity_${team.id}_${currentPlayerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_portal_activity",
          filter: `player_id=eq.${currentPlayerId}`,
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (String(row?.team_id || "") === String(team.id)) {
            setPortalActivityState({ playerId: currentPlayerId, data: payload.new || null });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentPlayerId, team?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setPortalActivityNow(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (activeTab !== "wellness" || !currentPlayerId || !team?.id) return;
    let cancelled = false;
    getPlayerWellness({ teamId: team.id, playerId: currentPlayerId }).then(({ data }) => {
      if (!cancelled) setWellnessHistory(data || []);
    });
    return () => { cancelled = true; };
  }, [activeTab, currentPlayerId, team?.id]);

  const summary = useMemo(
    () => getPlayerSummary(player, { sessions, matches, physicalTests }),
    [player, sessions, matches, physicalTests]
  );

  const seasonSeries = useMemo(
    () => getPlayerSeasonSeries(player, { sessions, matches, physicalTests }),
    [player, sessions, matches, physicalTests]
  );
  const injuryHistory = useMemo(
    () => [...(player?.injuries || [])].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)),
    [player]
  );
  const absenceHistory = useMemo(
    () => [...(player?.absences || [])].sort((a, b) => new Date(a.dateStart || 0) - new Date(b.dateStart || 0)),
    [player]
  );
  const activeInjuries = injuryHistory.filter((injury) => !injury.endDate);
  const pastInjuries = injuryHistory.filter((injury) => injury.endDate);
  const totalDaysOut = injuryHistory.reduce((sum, injury) => sum + Number(injury.daysOut || 0), 0);
  const totalSessionsMissed = injuryHistory.reduce((sum, injury) => sum + Number(injury.sessionsMissed || 0), 0);
  const totalMatchesMissed = injuryHistory.reduce((sum, injury) => sum + Number(injury.matchesMissed || 0), 0);
  const preventionRecommendations = useMemo(
    () => getPreventionRecommendations(injuryHistory, player),
    [injuryHistory, player]
  );

  const coachParameters = normalizeAppSettings(appSettings)?.coachParameters;
  const playerPrefs = normalizeAppSettings(appSettings)?.playerPortal?.playerPrefs?.[player?.id] || null;
  const injuryComparisons = useMemo(() => {
    const playerTests = physicalTests
      .filter((test) => String(test.playerId) === String(player?.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return pastInjuries.map((injury) => {
      const startDate = new Date(injury.startDate || 0);
      const endDate = new Date(injury.endDate || 0);
      const pre = [...playerTests].reverse().find((test) => new Date(test.date) < startDate) || null;
      const post = playerTests.find((test) => new Date(test.date) > endDate) || null;
      return {
        injury,
        pre: pre ? { test: pre, reference: getPhysicalReference(pre, coachParameters) } : null,
        post: post ? { test: post, reference: getPhysicalReference(post, coachParameters) } : null,
      };
    });
  }, [pastInjuries, physicalTests, player, coachParameters]);
  const playerVideoClips = useMemo(
    () => getPlayerVideoClips(matches, player?.id),
    [matches, player?.id]
  );

  if (!player) {
    return (
      <div style={styles.page}>
        <PageHeader title={t("pages.playerDetail.notFound")} subtitle={t("pages.playerDetail.notFoundSubtitle")} />
      </div>
    );
  }

  function updateField(field, value) {
    if (!canManage) return;
    setForm((prev) => {
      if (field !== "name") return { ...prev, [field]: value };
      // Il campo "Nome completo" è quello mostrato qui in scheda, ma il resto
      // dell'app (Registro presenze, Match Day, liste giocatori, ecc.) mostra
      // sempre firstName+lastName con priorità su name: se non li teniamo
      // sincronizzati, modificare il nome completo non si vede da nessun'altra
      // parte. Si divide sull'ultima parola come cognome.
      const parts = value.trim().split(/\s+/).filter(Boolean);
      const lastName = parts.length > 1 ? parts.pop() : "";
      const firstName = parts.join(" ");
      return { ...prev, name: value, firstName, lastName };
    });
  }

  function handleImageUpload(file) {
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

  function savePlayer() {
    if (!canManage) return;
    if (hasPlayerConflict(player, editBaseUpdatedAt)) {
      setConflictModal(true);
      return;
    }
    commitPlayerSave(form);
  }

  function commitPlayerSave(nextForm) {
    if (!canManage) return;
    // Stampa un nuovo _updatedAt affinché la conflict detection funzioni nei salvataggi successivi.
    const stamped = { ...nextForm, _updatedAt: new Date().toISOString() };
    setPlayers((prev) => prev.map((item) => String(item.id) === String(id) ? stamped : item));
    setEditing(false);
    setEditBaseUpdatedAt(stamped._updatedAt);
    showToast(t("pages.playerDetail.playerSaved"), "ok");
  }

  function forceSavePlayer() {
    if (!canManage) return;
    commitPlayerSave(form);
    setConflictModal(false);
  }

  function updateMedicalRecord(updater) {
    if (!canManage) return;
    const nextPlayer = updater(player);
    setPlayers((prev) => prev.map((item) => String(item.id) === String(id) ? nextPlayer : item));
    // Sync sempre i campi medici nel form, anche se l'utente sta modificando il profilo.
    // Senza questo, una save del profilo successiva sovrascriverà le modifiche mediche appena salvate.
    setForm((prevForm) => ({
      ...prevForm,
      injuries:          nextPlayer.injuries,
      absences:          nextPlayer.absences,
      injuryNotes:       nextPlayer.injuryNotes       ?? "",
      injuryType:        nextPlayer.injuryType        ?? "",
      injuryStartDate:   nextPlayer.injuryStartDate   ?? "",
      status:            nextPlayer.status,
      differentiatedType: nextPlayer.differentiatedType ?? "",
      expectedReturn:    nextPlayer.expectedReturn    ?? "",
    }));
  }

  function openDifferentiatedModal() {
    if (!canManage) return;
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      injuryType: player.injuryType || INJURY_TYPES[0],
      startDate: new Date().toISOString().slice(0, 10),
      expectedReturn: player.expectedReturn || "",
      note: player.injuryNotes || "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("differenziato");
  }

  function openInjuryModal() {
    if (!canManage) return;
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      injuryType: player.injuryType || INJURY_TYPES[0],
      startDate: new Date().toISOString().slice(0, 10),
      expectedReturn: player.expectedReturn || "",
      note: "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("infortunio");
  }

  function saveInjuryRecord() {
    if (!canManage) return;
    const injuryType = medicalForm.injuryType || INJURY_TYPES[0];
    const startDate = medicalForm.startDate || new Date().toISOString().slice(0, 10);
    const expectedReturn = medicalForm.expectedReturn || "";
    const note = medicalForm.note.trim();

    updateMedicalRecord((current) => ({
      ...current,
      status: "Infortunato",
      injuryType,
      injuryStartDate: startDate,
      expectedReturn,
      injuryNotes: [current.injuryNotes, note].filter(Boolean).join("\n"),
      injuries: [
        ...(current.injuries || []),
        {
          id: createId("injury"),
          injuryType,
          status: "Infortunato",
          startDate,
          endDate: null,
          expectedReturn,
          notes: note,
          sessionsMissed: 0,
          matchesMissed: 0,
        },
      ],
    }));
    setMedicalModal(null);
    showToast(t("pages.playerDetail.injuryAdded"), "ok");
  }

  function saveDifferentiatedWork() {
    if (!canManage) return;
    const differentiatedType = medicalForm.differentiatedType || DIFFERENTIATED_TYPES[1];
    const note = medicalForm.note.trim();
    updateMedicalRecord((current) => ({
      ...current,
      status: "Differenziato",
      differentiatedType,
      injuryNotes: [current.injuryNotes, note].filter(Boolean).join("\n"),
      injuries: [
        ...(current.injuries || []),
        {
          id: createId("injury"),
          injuryType: differentiatedType,
          differentiatedType,
          status: "Differenziato",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: null,
          expectedReturn: current.expectedReturn || "",
          notes: note,
          sessionsMissed: 0,
          matchesMissed: 0,
        },
      ],
    }));
    setMedicalModal(null);
  }

  function openRecoveredModal() {
    if (!canManage) return;
    if (!activeInjuries.length) return;
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      injuryType: player.injuryType || INJURY_TYPES[0],
      startDate: new Date().toISOString().slice(0, 10),
      expectedReturn: player.expectedReturn || "",
      note: "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("rientro");
  }

  function saveRecovered() {
    if (!canManage) return;
    if (!activeInjuries.length) return;
    const returnDate = medicalForm.returnDate || new Date().toISOString().slice(0, 10);
    updateMedicalRecord((current) => {
      const injuries = current.injuries || [];
      if (!injuries.some((injury) => !injury.endDate)) return current;

      return {
        ...current,
        status: "Disponibile",
        injuryType: "",
        differentiatedType: "",
        expectedReturn: "",
        injuryNotes: "",
        injuries: injuries.map((injury) => {
          if (injury.endDate) return injury;
          const start = injury.startDate ? new Date(injury.startDate) : null;
          const daysOut = start ? Math.max(0, Math.floor((new Date(returnDate) - start) / 86400000)) : injury.daysOut;
          return {
            ...injury,
            endDate: returnDate,
            daysOut,
            notes: [injury.notes, medicalForm.note.trim()].filter(Boolean).join("\n"),
          };
        }),
      };
    });
    setMedicalModal(null);
  }

  function openNoteModal() {
    if (!canManage) return;
    setMedicalForm({
      differentiatedType: player.differentiatedType || DIFFERENTIATED_TYPES[1],
      injuryType: player.injuryType || INJURY_TYPES[0],
      startDate: new Date().toISOString().slice(0, 10),
      expectedReturn: player.expectedReturn || "",
      note: "",
      returnDate: new Date().toISOString().slice(0, 10),
    });
    setMedicalModal("nota");
  }

  function saveMedicalNote() {
    if (!canManage) return;
    const note = medicalForm.note.trim();
    if (!note) return;
    updateMedicalRecord((current) => {
      const injuries = current.injuries || [];
      if (!injuries.length) {
        return {
          ...current,
          injuryNotes: [current.injuryNotes, note].filter(Boolean).join("\n"),
        };
      }

      const targetIndex = injuries.findIndex((injury) => !injury.endDate);
      const fallbackIndex = injuries.length - 1;
      const noteIndex = targetIndex >= 0 ? targetIndex : fallbackIndex;

      return {
        ...current,
        injuries: injuries.map((injury, index) => index === noteIndex
          ? { ...injury, notes: [injury.notes, note].filter(Boolean).join("\n") }
          : injury
        ),
      };
    });
    setMedicalModal(null);
  }

  function openAddAbsenceModal() {
    if (!canManage) return;
    setEditingAbsenceId(null);
    setAbsenceForm(emptyAbsenceForm());
    setAbsenceModal(true);
  }

  function openEditAbsenceModal(absence) {
    if (!canManage || !absence) return;
    setEditingAbsenceId(absence.id || null);
    setAbsenceForm({
      type: absence.type || ABSENCE_TYPES[0],
      dateStart: absence.dateStart || new Date().toISOString().slice(0, 10),
      dateEnd: absence.dateEnd || absence.dateStart || new Date().toISOString().slice(0, 10),
      notes: absence.notes || "",
    });
    setAbsenceModal(true);
  }

  function saveAbsenceRecord() {
    if (!canManage) return;
    if (!absenceForm.dateStart || !absenceForm.dateEnd) {
      showToast(t("pages.playerDetail.absences.toastDatesRequired"), "warn");
      return;
    }
    if (absenceForm.dateEnd < absenceForm.dateStart) {
      showToast(t("pages.playerDetail.absences.toastInvalidRange"), "warn");
      return;
    }
    const record = {
      id: editingAbsenceId || createId("absence"),
      type: absenceForm.type,
      dateStart: absenceForm.dateStart,
      dateEnd: absenceForm.dateEnd,
      notes: absenceForm.notes.trim(),
    };
    updateMedicalRecord((current) => ({
      ...current,
      absences: editingAbsenceId
        ? (current.absences || []).map((absence) =>
            String(absence.id) === String(editingAbsenceId) ? record : absence
          )
        : [...(current.absences || []), record],
    }));
    setAbsenceModal(false);
    setEditingAbsenceId(null);
    showToast(
      editingAbsenceId
        ? t("pages.playerDetail.absences.toastUpdated")
        : t("pages.playerDetail.absences.toastAdded"),
      "ok"
    );
  }

  function removeAbsenceRecord(absenceId) {
    if (!canManage) return;
    updateMedicalRecord((current) => ({
      ...current,
      absences: (current.absences || []).filter((a) => String(a.id) !== String(absenceId)),
    }));
    showToast(t("pages.playerDetail.absences.toastRemoved"), "ok");
  }

  function createDevelopmentTask() {
    if (!canManage) return;
    if (!setStaffTasks || !player) return;
    const description = [
      form.trainingActions && `Azioni: ${form.trainingActions}`,
      form.weeklyGoal && `Obiettivo settimana: ${form.weeklyGoal}`,
      form.thirtyDayGoal && `Obiettivo 30 giorni: ${form.thirtyDayGoal}`,
      form.successMetrics && `Metriche: ${form.successMetrics}`,
      form.videoReviewNotes && `Video: ${form.videoReviewNotes}`,
    ].filter(Boolean).join("\n");

    if (!description.trim()) return;

    setStaffTasks((prev = []) => [
      {
        id: createId("task"),
        title: `Piano individuale - ${player.name}`,
        description,
        status: "todo",
        priority: "medium",
        ownerRole: "assistantCoach",
        dueDate: getRelativeDate(7),
        playerId: String(player.id),
        sourceType: "playerDevelopment",
        sourceId: String(player.id),
        createdAt: new Date().toISOString(),
        completedAt: "",
      },
      ...prev,
    ]);
  }

  const playerSettings = normalizeAppSettings(appSettings) || {};
  const portalPendingInvite = (playerSettings.pendingInvites || []).find(
    (invite) => String(invite.playerId) === String(player.id) && invite.role === "player"
  );
  const portalInvitePending = Boolean(portalPendingInvite);
  const pendingPortalInviteLink = portalPendingInvite?.token && typeof window !== "undefined"
    ? `${window.location.origin}/join?token=${portalPendingInvite.token}`
    : "";

  async function invitePlayerToPortal() {
    if (!canManage) return;
    if (invitingPortal) return;
    if (!team?.id || !player?.email || !isSupabaseConfigured) return;
    setInvitingPortal(true);
    try {
      const settings = normalizeAppSettings(appSettings) || {};
      const token = createId("player-invite").replace("player-invite-", "");

      const pending = {
        id: createId("invite"),
        name: player.name,
        email: player.email,
        role: "player",
        playerId: String(player.id),
        customAreas: {},
        status: "In attesa",
        token,
        sentAt: new Date().toISOString(),
        expiresAt: getInviteExpiryDate(),
      };

      const nextSettings = {
        ...settings,
        pendingInvites: [
          ...(settings.pendingInvites || []).filter(
            (invite) => !(String(invite.playerId) === String(player.id) && invite.role === "player")
          ),
          pending,
        ],
      };

      const { error: flushError } = await supabase
        .from("teams")
        .update({ settings: nextSettings })
        .eq("id", team.id);
      if (flushError) {
        showToast(t("pages.playerDetail.portalInviteError"), "error");
        return;
      }
      setAppSettings?.(() => nextSettings);

      const base = typeof window !== "undefined" ? window.location.origin : "https://calciolab.org";
      const inviteUrl = `${base}/join?token=${token}`;
      // Mostra il link subito — indipendentemente dall'esito dell'email
      setPortalInviteLink(inviteUrl);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const emailResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          type: "player_invite",
          to: player.email,
          playerName: player.name,
          teamName: team.name,
          inviteUrl,
        }),
      });
      const emailResult = await emailResponse.json().catch(() => ({}));
      if (!emailResponse.ok || emailResult?.error) {
        showToast(t("pages.playerDetail.portalInviteEmailFailed", {
          error: emailResult?.error || emailResponse.statusText || "Errore sconosciuto",
        }), "error");
      } else {
        showToast(t("pages.playerDetail.portalInviteSent"), "ok");
      }
    } catch {
      showToast(t("pages.playerDetail.portalInviteError"), "error");
    } finally {
      setInvitingPortal(false);
    }
  }

  async function revokePlayerPortalAccess() {
    if (!canManage) return;
    if (!portalAccountId || !isSupabaseConfigured) return;
    setRevokingPortal(true);
    try {
      const { error } = await supabase
        .from("player_accounts")
        .delete()
        .eq("id", portalAccountId);
      if (error) {
        showToast(t("pages.playerDetail.portalRevokeError"), "error");
        return;
      }
      setPortalAccountState({ playerId: currentPlayerId, accountId: null });
      showToast(t("pages.playerDetail.portalRevokeSuccess"), "ok");
    } catch {
      showToast(t("pages.playerDetail.portalRevokeError"), "error");
    } finally {
      setRevokingPortal(false);
    }
  }

  async function cancelPlayerPortalInvite() {
    if (!canManage) return;
    if (cancellingPortalInvite || !team?.id || !isSupabaseConfigured) return;
    setCancellingPortalInvite(true);
    try {
      const settings = normalizeAppSettings(appSettings) || {};
      const nextPendingInvites = (settings.pendingInvites || []).filter(
        (invite) => !(String(invite.playerId) === String(player.id) && invite.role === "player")
      );
      const stillHasNamedInvites = nextPendingInvites.some((invite) =>
        Boolean(String(invite.email || "").trim())
      );
      const nextSettings = {
        ...settings,
        pendingInvites: nextPendingInvites,
        inviteToken: stillHasNamedInvites ? settings.inviteToken : null,
        inviteTokenExpiresAt: stillHasNamedInvites ? settings.inviteTokenExpiresAt : null,
      };

      const { error } = await supabase
        .from("teams")
        .update({ settings: nextSettings })
        .eq("id", team.id);
      if (error) {
        showToast(t("pages.playerDetail.portalInviteCancelError"), "error");
        return;
      }
      setAppSettings?.(() => nextSettings);
      setPortalInviteLink("");
      showToast(t("pages.playerDetail.portalInviteCancelSuccess"), "ok");
    } catch {
      showToast(t("pages.playerDetail.portalInviteCancelError"), "error");
    } finally {
      setCancellingPortalInvite(false);
    }
  }

  return (
    <div style={styles.page}>
      <PageHeader title={player.name} subtitle={t("pages.playerDetail.subtitle")} />

      <div style={{ ...pageStyles.layout, gridTemplateColumns: isMobile ? "1fr" : pageStyles.layout.gridTemplateColumns }}>
        <div style={pageStyles.sidebar}>
          <PlayerSidebar
            form={form}
            editing={editing && canManage}
            onImageUpload={canManage ? handleImageUpload : undefined}
            onPhotoSizeChange={canManage ? (value) => updateField("photoSize", value) : undefined}
            onPhotoOffsetChange={canManage ? (field, value) => updateField(field, value) : undefined}
            summary={summary}
          />
        </div>

        <div style={pageStyles.main}>
          <PlayerTabs activeTab={activeTab} onChange={setActiveTab} />

          {(activeTab === "cartella" || activeTab === "profilo" || activeTab === "statistiche") && (
            <PlayerKpiStrip summary={summary} />
          )}

          {activeTab === "cartella" && (
            <PlayerTechnicalOverview
              player={player}
              summary={summary}
              activeInjuries={activeInjuries}
              injuryHistory={injuryHistory}
              preventionRecommendations={preventionRecommendations}
              onGoToTab={setActiveTab}
            />
          )}

          {activeTab === "profilo" && (
            <PlayerProfileTab
              form={form}
              player={player}
              editing={editing && canManage}
              onEdit={canManage ? (selectedPlayer) => {
                setForm({ ...selectedPlayer });
                setEditBaseUpdatedAt(selectedPlayer._updatedAt || null);
                setEditing(true);
              } : undefined}
              onCancel={() => {
                setEditing(false);
                setForm({ ...player });
                setEditBaseUpdatedAt(player._updatedAt || null);
              }}
              onSave={savePlayer}
              onFieldChange={canManage ? updateField : undefined}
              onInvitePortal={canManage ? invitePlayerToPortal : undefined}
              invitingPortal={invitingPortal}
              portalInvitePending={portalInvitePending}
              portalInviteLink={portalAccountId ? "" : portalInviteLink || pendingPortalInviteLink}
              portalAccountLinked={Boolean(portalAccountId)}
              portalActivity={portalActivity}
              portalActivityNow={portalActivityNow}
              onCancelPortalInvite={canManage ? cancelPlayerPortalInvite : undefined}
              cancellingPortalInvite={cancellingPortalInvite}
              onRevokePortal={canManage ? revokePlayerPortalAccess : undefined}
              revokingPortal={revokingPortal}
              playerPrefs={playerPrefs}
            />
          )}

          {activeTab === "statistiche" && <PlayerStatsTab summary={summary} seasonSeries={seasonSeries} />}

          {activeTab === "video" && <PlayerVideoTab clips={playerVideoClips} />}

          {activeTab === "wellness" && (
            <PlayerWellnessTab wellnessHistory={wellnessHistory ?? []} loading={wellnessHistory === null} />
          )}

          {activeTab === "fisico" && (
            <PlayerPhysicalTab
              form={form}
              editing={editing && canManage}
              latestTests={summary.latestTests}
              onFieldChange={canManage ? updateField : undefined}
            />
          )}

          {activeTab === "medico" && (
            <PlayerMedicalTab
              activeInjuries={activeInjuries}
              injuryHistory={injuryHistory}
              pastInjuries={pastInjuries}
              totalDaysOut={totalDaysOut}
              totalSessionsMissed={totalSessionsMissed}
              totalMatchesMissed={totalMatchesMissed}
              generalInjuryNotes={player.injuryNotes}
              injuryComparisons={injuryComparisons}
              preventionRecommendations={preventionRecommendations}
              onAddInjuryRecord={canManage ? openInjuryModal : undefined}
              onCreateDifferentiatedWork={canManage ? openDifferentiatedModal : undefined}
              onAddMedicalNote={canManage ? openNoteModal : undefined}
              onMarkRecovered={canManage ? openRecoveredModal : undefined}
            />
          )}

          {activeTab === "assenze" && (
            <PlayerAbsencesSection
              absences={absenceHistory}
              onAddAbsence={canManage ? openAddAbsenceModal : undefined}
              onEditAbsence={canManage ? openEditAbsenceModal : undefined}
              onRemoveAbsence={canManage ? removeAbsenceRecord : undefined}
            />
          )}

          {activeTab === "sviluppo" && (
            <PlayerDevelopmentTab
              form={form}
              editing={editing && canManage}
              summary={summary}
              videoClips={playerVideoClips}
              onCreateStaffTask={canManage ? createDevelopmentTask : undefined}
              onFieldChange={canManage ? updateField : undefined}
            />
          )}

          <Button variant="ghost" onClick={() => navigate("/players")}>
            {t("pages.playerDetail.back")}
          </Button>
        </div>
      </div>

      {medicalModal && (
        <Modal title={getMedicalModalTitle(medicalModal, t)} onClose={() => setMedicalModal(null)}>
          <MedicalActionForm
            type={medicalModal}
            value={medicalForm}
            onChange={setMedicalForm}
            onCancel={() => setMedicalModal(null)}
            onSubmit={
              medicalModal === "differenziato"
                ? saveDifferentiatedWork
                : medicalModal === "infortunio"
                ? saveInjuryRecord
                : medicalModal === "rientro"
                ? saveRecovered
                : saveMedicalNote
            }
          />
        </Modal>
      )}

      {absenceModal && (
        <Modal
          title={t(editingAbsenceId ? "pages.playerDetail.absences.modalEditTitle" : "pages.playerDetail.absences.modalTitle")}
          onClose={() => {
            setAbsenceModal(false);
            setEditingAbsenceId(null);
          }}
        >
          <div style={modalStyles.stack}>
            <label style={modalStyles.field}>
              <span style={modalStyles.label}>{t("pages.playerDetail.absences.fieldType")}</span>
              <select
                value={absenceForm.type}
                onChange={(event) => setAbsenceForm((prev) => ({ ...prev, type: event.target.value }))}
                style={styles.input}
              >
                {ABSENCE_TYPES.map((type) => (
                  <option key={type} value={type}>{t(`pages.playerDetail.absences.type${type.charAt(0).toUpperCase()}${type.slice(1)}`)}</option>
                ))}
              </select>
            </label>

            <label style={modalStyles.field}>
              <span style={modalStyles.label}>{t("pages.playerDetail.absences.fieldStart")}</span>
              <input
                type="date"
                value={absenceForm.dateStart}
                onChange={(event) => setAbsenceForm((prev) => ({ ...prev, dateStart: event.target.value }))}
                style={styles.input}
              />
            </label>

            <label style={modalStyles.field}>
              <span style={modalStyles.label}>{t("pages.playerDetail.absences.fieldEnd")}</span>
              <input
                type="date"
                value={absenceForm.dateEnd}
                onChange={(event) => setAbsenceForm((prev) => ({ ...prev, dateEnd: event.target.value }))}
                style={styles.input}
              />
            </label>

            <label style={modalStyles.field}>
              <span style={modalStyles.label}>{t("pages.playerDetail.absences.fieldNotes")}</span>
              <textarea
                value={absenceForm.notes}
                onChange={(event) => setAbsenceForm((prev) => ({ ...prev, notes: event.target.value }))}
                style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setAbsenceModal(false);
                setEditingAbsenceId(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={saveAbsenceRecord}>{t("pages.playerDetail.absences.saveBtn")}</Button>
          </div>
        </Modal>
      )}

      {conflictModal && (
        <Modal title={t("pages.playerDetail.conflictTitle")} onClose={() => setConflictModal(false)}>
          <div style={modalStyles.stack}>
            <p style={modalStyles.helpText}>
              {t("pages.playerDetail.conflictText")}
            </p>
            <div style={modalStyles.actions}>
              <Button
                variant="ghost"
                onClick={() => {
                  setForm({ ...player });
                  setEditBaseUpdatedAt(player._updatedAt || null);
                  setConflictModal(false);
                }}
              >
                {t("pages.playerDetail.reloadData")}
              </Button>
              <Button onClick={forceSavePlayer}>
                {t("pages.playerDetail.forceSave")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ToastContainer />
    </div>
  );
}

function hasPlayerConflict(player, editBaseUpdatedAt) {
  if (!player?._updatedAt || !editBaseUpdatedAt) return false;
  return String(player._updatedAt) !== String(editBaseUpdatedAt);
}

function getPlayerVideoClips(matches, playerId) {
  if (!playerId) return [];
  return matches
    .flatMap((match) =>
      (match.videoAnalysis || [])
        .filter((clip) => String(clip.playerId) === String(playerId))
        .map((clip) => ({
          ...clip,
          matchId: match.id,
          matchTitle: match.title || match.opponent || "Partita",
          matchDate: match.date,
          opponent: match.opponent || "",
        }))
    )
    .sort((a, b) => new Date(b.matchDate || 0) - new Date(a.matchDate || 0));
}

function getMedicalModalTitle(type, t) {
  if (type === "infortunio") return t("pages.playerDetail.addInjuryRecord");
  if (type === "differenziato") return t("pages.playerDetail.createDifferentiatedWork");
  if (type === "rientro") return t("pages.playerDetail.markReturn");
  return t("pages.playerDetail.addMedicalNote");
}

function getRelativeDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function MedicalActionForm({ type, value, onChange, onCancel, onSubmit }) {
  const { t } = useTranslation();
  const canSubmit = type === "infortunio"
    ? Boolean(value.injuryType && value.startDate)
    : type !== "nota" || value.note.trim();

  return (
    <div style={modalStyles.stack}>
      {type === "differenziato" && (
        <label style={modalStyles.field}>
          <span style={modalStyles.label}>{t("pages.playerDetail.typology")}</span>
          <select
            value={value.differentiatedType}
            onChange={(event) => onChange((prev) => ({ ...prev, differentiatedType: event.target.value }))}
            style={styles.input}
          >
            {DIFFERENTIATED_TYPES.map((item) => (
              <option key={item} value={item}>
                {DIFF_TYPE_LABEL_KEYS[item] ? t(DIFF_TYPE_LABEL_KEYS[item]) : item}
              </option>
            ))}
          </select>
        </label>
      )}

      {type === "infortunio" && (
        <>
          <label style={modalStyles.field}>
            <span style={modalStyles.label}>{t("pages.playerDetail.injuryType")}</span>
            <select
              value={value.injuryType}
              onChange={(event) => onChange((prev) => ({ ...prev, injuryType: event.target.value }))}
              style={styles.input}
            >
              {INJURY_TYPES.map((item) => (
                <option key={item} value={item}>
                  {INJURY_TYPE_LABEL_KEYS[item] ? t(INJURY_TYPE_LABEL_KEYS[item]) : item}
                </option>
              ))}
            </select>
          </label>

          <div style={modalStyles.twoColumns}>
            <label style={modalStyles.field}>
              <span style={modalStyles.label}>{t("pages.playerDetail.injuryStartDate")}</span>
              <input
                type="date"
                value={value.startDate}
                onChange={(event) => onChange((prev) => ({ ...prev, startDate: event.target.value }))}
                style={styles.input}
              />
            </label>

            <label style={modalStyles.field}>
              <span style={modalStyles.label}>{t("pages.playerDetail.expectedReturn")}</span>
              <input
                type="date"
                value={value.expectedReturn}
                onChange={(event) => onChange((prev) => ({ ...prev, expectedReturn: event.target.value }))}
                style={styles.input}
              />
            </label>
          </div>
        </>
      )}

      {type === "rientro" && (
        <label style={modalStyles.field}>
          <span style={modalStyles.label}>{t("pages.playerDetail.returnDate")}</span>
          <input
            type="date"
            value={value.returnDate}
            onChange={(event) => onChange((prev) => ({ ...prev, returnDate: event.target.value }))}
            style={styles.input}
          />
        </label>
      )}

      <label style={modalStyles.field}>
        <span style={modalStyles.label}>
          {type === "rientro"
            ? t("pages.playerDetail.finalNote")
            : type === "differenziato"
            ? t("pages.playerDetail.operationalNotes")
            : type === "infortunio"
            ? t("pages.playerDetail.injuryNote")
            : t("pages.playerDetail.medicalNote")}
        </span>
        <textarea
          value={value.note}
          onChange={(event) => onChange((prev) => ({ ...prev, note: event.target.value }))}
          placeholder={
            type === "rientro"
              ? t("pages.playerDetail.returnNotePlaceholder")
              : type === "differenziato"
              ? t("pages.playerDetail.differentiatedPlaceholder")
              : type === "infortunio"
              ? t("pages.playerDetail.injuryNotePlaceholder")
              : t("pages.playerDetail.medicalNotePlaceholder")
          }
          style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
        />
      </label>

      <div style={modalStyles.actions}>
        <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

const pageStyles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "340px minmax(0, 1fr)",
    gap: 24,
    alignItems: "start",
  },
  sidebar: {
    display: "grid",
    gap: 20,
    minWidth: 0,
  },
  main: {
    display: "grid",
    gap: 20,
    minWidth: 0,
  },
};

const modalStyles = {
  stack: {
    display: "grid",
    gap: 16,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
  },
  helpText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.55,
  },
};

export default PlayerDetail;
