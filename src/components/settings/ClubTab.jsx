import { useState, useEffect, useRef } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useLocation, useNavigate } from "react-router-dom";
import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { styles } from "../../styles/index.js";
import { createId, getSetupProgress, memberRoles, normalizeAppSettings } from "../../utils/helpers";
import { useTranslation } from "../../i18n";
import { useIsMobile } from "../../hooks/useIsMobile";
import { sharedStyles, inviteStyles, inviteRoleDesc } from "../../styles/settings";
import {
  DEFAULT_WORKSPACE_PROFILE, INVITE_MEMBER_MODAL, INVITE_MEMBER_DRAFT_KEY,
  EMPTY_INVITE_FORM, PERMISSION_AREAS, AREA_ACCESS_LABEL_KEYS,
  loadInviteMemberDraft, clearInviteMemberDraft, getInviteExpiryDate,
  isInviteExpired, hasWorkspaceProfileContent,
} from "../../utils/settingsHelpers";
import { InfoMini, ClubField, VipBadge } from "./SettingsElements";

export function ClubTab({ appSettings, setAppSettings, team, showToast, players = [], exercises = [], sessions = [], matches = [] }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const inviteModal = new URLSearchParams(location.search).get("modal") === INVITE_MEMBER_MODAL;
  const settings = normalizeAppSettings(appSettings) || {};
  const rawProfile = settings.workspaceProfile || {};
  const [profile, setProfile] = useState({ ...DEFAULT_WORKSPACE_PROFILE, ...rawProfile });
  const [inviteForm, setInviteForm] = useState(() => loadInviteMemberDraft());
  const [showCustomPerms, setShowCustomPerms] = useState(false);
  const [expandedMemberPerms, setExpandedMemberPerms] = useState({});
  const [sentInviteUrl, setSentInviteUrl] = useState("");
  const [sentInviteName, setSentInviteName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  // Modifiche ruolo "in sospeso": il cambio nel <select> non si applica subito,
  // l'utente deve premere "Salva" — evita salvataggi accidentali e rende
  // visibile l'esito (sincronizzazione con team_members su Supabase).
  const [pendingMemberRoles, setPendingMemberRoles] = useState({});
  const [savingMemberRole, setSavingMemberRole] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState("");
  const incomingProfileKey = JSON.stringify(rawProfile);

  // Genera (o recupera) il token invito del team
  const inviteToken = settings.inviteToken || null;

  // Auto-save profile — skip first render to avoid overwriting with stale initial value
  const profileMounted = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile((prev) => {
      if (hasWorkspaceProfileContent(prev) || !hasWorkspaceProfileContent(rawProfile)) return prev;
      return { ...DEFAULT_WORKSPACE_PROFILE, ...rawProfile };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingProfileKey]);

  useEffect(() => {
    if (!profileMounted.current) { profileMounted.current = true; return; }
    const timer = setTimeout(() => {
      setAppSettings?.((prev) => {
        const s = normalizeAppSettings(prev);
        return { ...s, workspaceProfile: profile };
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!inviteModal) return;
    try {
      localStorage.setItem(INVITE_MEMBER_DRAFT_KEY, JSON.stringify(inviteForm));
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }, [inviteForm, inviteModal]);

  function openInviteModal() {
    const params = new URLSearchParams(location.search);
    params.set("modal", INVITE_MEMBER_MODAL);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeInviteModal({ resetDraft = false } = {}) {
    if (resetDraft) {
      clearInviteMemberDraft();
      setInviteForm(EMPTY_INVITE_FORM);
      setShowCustomPerms(false);
    }
    setSentInviteUrl("");
    setSentInviteName("");
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  }

  function generateInviteToken() {
    const token = createId("invite").replace("invite-", "");
    setAppSettings?.((prev) => ({ ...normalizeAppSettings(prev), inviteToken: token }));
    return token;
  }

  /**
   * FIX: flush immediato di inviteToken su Supabase.
   * generateInviteToken() aggiorna solo lo stato locale (debounced): se il
   * debounce non ha ancora scritto su Supabase quando il destinatario clicca
   * il link, l'Edge Function accept-team-invite non trova il token in
   * teams.settings e risponde 404. Questo flush bypassa il debounce e scrive
   * direttamente, bloccando l'azione (invio email / copia link) finché il
   * token non è persistito.
   */
  async function flushInviteToken(token) {
    if (!team?.id || !isSupabaseConfigured) return { error: null };
    const currentSettings = normalizeAppSettings(appSettings) || {};
    // Se il token è diverso da quello corrente (o non c'è ancora), assegna una
    // nuova scadenza. Se stiamo solo persistendo lo stesso token (es. secondo
    // click su "copia link"), preserviamo la scadenza originale.
    const isNewToken = currentSettings.inviteToken !== token;
    const inviteTokenExpiresAt = isNewToken || !currentSettings.inviteTokenExpiresAt
      ? getInviteExpiryDate()
      : currentSettings.inviteTokenExpiresAt;
    const { error } = await supabase
      .from("teams")
      .update({ settings: { ...currentSettings, inviteToken: token, inviteTokenExpiresAt } })
      .eq("id", team.id);
    return { error };
  }

  function getInviteLink(token) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://calciolab.org";
    return `${base}/join?token=${token}`;
  }

  async function copyInviteLink() {
    const isNew = !inviteToken;
    const token = inviteToken || generateInviteToken();
    // Se il token è appena stato generato, flush immediato (fire-and-forget:
    // l'utente deve ancora incollare e inviare il link, quindi c'è tempo).
    if (isNew) flushInviteToken(token).catch(() => {});
    const link = getInviteLink(token);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2500);
      });
    }
  }

  async function copyPendingInviteLink(invite) {
    // FIX: l'Edge Function accept-team-invite valida SOLO il token canonico
    // del team (teams.settings.inviteToken). invite.token è solo uno snapshot
    // preso al momento dell'invio e — a causa del bug di normalizzazione ora
    // corretto — poteva essere rimasto disallineato dal token corrente,
    // generando link "morti" che rispondevano sempre "Invito non trovato o
    // non valido". Usiamo sempre il token canonico, mai quello salvato
    // sull'invito.
    const isNew = !inviteToken;
    const token = inviteToken || generateInviteToken();
    if (isNew) flushInviteToken(token).catch(() => {});
    const link = getInviteLink(token);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedInviteId(invite.id);
        setTimeout(() => setCopiedInviteId(""), 2500);
      });
    }
  }

  async function sendInvite(e) {
    e.preventDefault();
    if (!inviteForm.email) return;
    const token = inviteToken || generateInviteToken();

    // FIX (bug inviti): flush immediato e bloccante del token su Supabase.
    // Se il token era appena stato generato e il debounce di setAppSettings
    // non aveva ancora scritto su Supabase, l'Edge Function accept-team-invite
    // non trovava il token (SELECT ... WHERE settings->>inviteToken = ?) e
    // rispondeva 404, rendendo il link nell'email sempre invalido.
    // Aspettiamo che il token sia persistito prima di inviare l'email.
    const { error: flushError } = await flushInviteToken(token);
    if (flushError) {
      showToast?.(t("pages.settings.inviteFlushError"), "error");
      return;
    }

    const pending = {
      id:          createId("invite"),
      name:        inviteForm.name,
      email:       inviteForm.email,
      role:        inviteForm.role,
      customAreas: inviteForm.customAreas,
      status:      "In attesa",
      token,
      sentAt:      new Date().toISOString(),
      expiresAt:   getInviteExpiryDate(),
    };
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, pendingInvites: [...(s.pendingInvites || []), pending] };
    });
    setInviteForm(EMPTY_INVITE_FORM);
    setShowCustomPerms(false);
    clearInviteMemberDraft();

    // Mostra step 2 con link invito (non chiude subito la modale)
    const inviteUrl = getInviteLink(token);
    setSentInviteUrl(inviteUrl);
    setSentInviteName(pending.name || pending.email);
    setLinkCopied(false);

    // Invia email di invito (fire-and-forget — non blocca la UI)
    const teamName  = profile.teamName || profile.clubName || "CalcioLab";
    const roleName  = memberRoles?.find?.((r) => r.id === inviteForm.role)?.label || inviteForm.role || "Membro dello staff";
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const accessToken = sessionData?.session?.access_token || "";
      const inviterName = sessionData?.session?.user?.user_metadata?.first_name
        || sessionData?.session?.user?.email
        || "Il tuo coach";
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "apikey":        import.meta.env.VITE_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            type:        "team_invite",
            to:          inviteForm.email,
            inviterName,
            teamName,
            roleName,
            inviteUrl,
          }),
        }
      ).catch(() => {}); // silenzioso — l'invito è già salvato anche se l'email fallisce
    });
  }

  function cancelInvite(id) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, pendingInvites: (s.pendingInvites || []).filter((i) => i.id !== id) };
    });
  }

  // Filter out pending invites whose email already appears in active members
  const memberEmails = new Set((settings.members || []).map((m) => m.email?.toLowerCase().trim()).filter(Boolean));
  const visiblePendingInvites = (settings.pendingInvites || []).filter(
    (inv) => !memberEmails.has((inv.email || "").toLowerCase().trim())
  );

  // getSetupProgress è safe solo se helpers è caricato — usiamo try/catch per sicurezza
  let setup = { percent: 0, checks: [], completed: 0, total: 0, next: null };
  try {
    setup = getSetupProgress({ players, exercises, sessions, matches, appSettings: settings });
  } catch {
    // silently use default
  }

  function saveProfile() {
    setAppSettings?.((prev) => ({ ...normalizeAppSettings(prev), workspaceProfile: profile }));
  }

  function handleClubLogoUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function updateMemberRole(memberId, role) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, members: (s.members || []).map((m) => String(m.id) === String(memberId) ? { ...m, role } : m) };
    });

    // FIX: il cambio ruolo qui sopra aggiorna SOLO il blob JSON teams.settings.members,
    // usato per la UI. Il controllo accessi reale (RoleGate, vedi App.jsx/RoleGate.jsx)
    // legge invece team_members.role su Supabase — la vera fonte di verità — che
    // restava quindi disallineata: l'utente continuava a vedere "Vista non disponibile"
    // con il vecchio ruolo anche dopo averlo cambiato da qui.
    // I membri uniti via invito hanno id nel formato `member-${user.id}` (vedi
    // accept-team-invite/index.ts); ne ricaviamo lo user_id per l'update mirato.
    // I membri aggiunti manualmente (senza account Supabase) non hanno una riga
    // in team_members: l'update sotto semplicemente non troverà righe da aggiornare,
    // e avvisiamo l'utente invece di far credere che sia tutto a posto.
    const userId = String(memberId).startsWith("member-") ? String(memberId).slice("member-".length) : null;

    if (!userId || !team?.id || !isSupabaseConfigured) {
      showToast?.(t("pages.settings.clubRoleSavedLocalOnly"), "warn");
      return;
    }

    const { data, error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("team_id", team.id)
      .eq("user_id", userId)
      .select("user_id");

    if (error) {
      if (import.meta.env.DEV) console.warn("[Settings] Sync ruolo team_members fallita:", error.message);
      showToast?.(t("pages.settings.clubRoleSyncError"), "error");
      return;
    }

    if (!data || data.length === 0) {
      // Nessuna riga aggiornata: il membro non ha (ancora) un account Supabase
      // collegato a questo team — il ruolo resta sincronizzato solo lato UI.
      showToast?.(t("pages.settings.clubRoleSavedLocalOnly"), "warn");
      return;
    }

    showToast?.(t("pages.settings.clubRoleSaved"), "success");
  }

  function updateMemberArea(memberId, areaKey, level) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, members: (s.members || []).map((m) =>
        String(m.id) === String(memberId)
          ? { ...m, customAreas: { ...(m.customAreas || {}), [areaKey]: level } }
          : m
      )};
    });
  }

  async function removeMember(memberId) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, members: (s.members || []).filter((m) => String(m.id) !== String(memberId)) };
    });

    // FIX: rimuovere il membro solo dal JSON locale lasciava intatta la riga
    // corrispondente in team_members — l'utente rimosso dalla UI manteneva
    // l'accesso reale al team (RoleGate/RLS leggono team_members come fonte
    // di verità). Sincronizziamo la cancellazione, stesso pattern di
    // updateMemberRole (id "member-<user_id>").
    const userId = String(memberId).startsWith("member-") ? String(memberId).slice("member-".length) : null;

    if (!userId || !team?.id || !isSupabaseConfigured) {
      return;
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", userId);

    if (error) {
      if (import.meta.env.DEV) console.warn("[Settings] Rimozione membro da team_members fallita:", error.message);
      showToast?.(t("pages.settings.clubMemberRemoveSyncError"), "error");
      return;
    }

    showToast?.(t("pages.settings.clubMemberRemoved"), "success");
  }

  function toggleMemberVip(memberId) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, members: (s.members || []).map((m) =>
        String(m.id) === String(memberId) ? { ...m, vip: !m.vip } : m
      )};
    });
  }

  return (
    <div style={sharedStyles.panel}>
      <AppCard style={{ marginBottom: 18 }}>
        <div style={sharedStyles.clubIntro}>
          <div>
            <Badge tone="blue">Profilo società</Badge>
            <h2 style={{ margin: "12px 0 6px", lineHeight: 1.15 }}>
              {t("pages.settings.clubIntroTitle")}
            </h2>
            <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              Qui configuri i dati che rendono CalcioLab riconoscibile per staff, giocatori,
              sponsor ed export: società, squadra, categoria, membri, inviti e checklist iniziale.
            </p>
          </div>
          <div style={sharedStyles.clubIntroStats}>
            <InfoMini label={t("pages.settings.clubLabelSetup")}   value={`${setup.percent}%`} />
            <InfoMini label={t("pages.settings.clubLabelMembers")} value={(settings.members || []).length} />
            <InfoMini label={t("pages.settings.clubLabelInvites")} value={(settings.pendingInvites || []).length} />
          </div>
        </div>
      </AppCard>

      <div style={sharedStyles.grid2}>
        <AppCard title="Profilo società" subtitle="Identità, squadra, categoria e obiettivi della stagione.">
          <div style={sharedStyles.formStack}>
            <div style={sharedStyles.clubLogoBox}>
              {profile.logo ? (
                <div style={sharedStyles.clubLogoFrame}>
                  <img
                    src={profile.logo}
                    alt={profile.clubName || "Logo società"}
                    style={{
                      ...sharedStyles.clubLogoPreview,
                      width: `${Number(profile.logoSize || 100)}%`,
                      height: `${Number(profile.logoSize || 100)}%`,
                    }}
                  />
                </div>
              ) : (
                <div style={sharedStyles.clubLogoFallback}>{(profile.clubName || "CL").slice(0, 2).toUpperCase()}</div>
              )}
              <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                <strong style={{ lineHeight: 1.2 }}>{t("pages.settings.clubLogoLabel")}</strong>
                <span style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.4 }}>
                  {t("pages.settings.clubLogoDesc")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleClubLogoUpload(event.target.files?.[0])}
                  style={styles.input}
                />
                {profile.logo && (
                  <label style={sharedStyles.logoSizeControl}>
                    {t("pages.settings.clubLogoSize", { percent: Number(profile.logoSize || 100) })}
                    <input
                      type="range"
                      min="60"
                      max="160"
                      step="5"
                      value={Number(profile.logoSize || 100)}
                      onChange={(event) => setProfile({ ...profile, logoSize: Number(event.target.value) })}
                    />
                  </label>
                )}
              </div>
            </div>
            <ClubField label={t("pages.settings.clubFieldClub")}>
              <input
                value={profile.clubName}
                onChange={(e) => setProfile({ ...profile, clubName: e.target.value })}
                style={styles.input}
              />
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldTeam")}>
              <input
                value={profile.teamName}
                onChange={(e) => setProfile({ ...profile, teamName: e.target.value })}
                style={styles.input}
              />
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldHomeField")}>
              <input
                value={profile.homeFieldName || ""}
                onChange={(e) => setProfile({ ...profile, homeFieldName: e.target.value })}
                placeholder="Es. Centro Sportivo Comunale"
                style={styles.input}
              />
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldAddress")}>
              <input
                value={profile.homeFieldAddress || ""}
                onChange={(e) => setProfile({ ...profile, homeFieldAddress: e.target.value })}
                placeholder="Es. Via Roma 12, Milano"
                style={styles.input}
              />
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldSurface")}>
              <select
                value={profile.homeFieldSurface || "Erba naturale"}
                onChange={(e) => setProfile({ ...profile, homeFieldSurface: e.target.value })}
                style={styles.input}
              >
                <option>{t("pages.settings.clubSurfaceGrass")}</option>
                <option>{t("pages.settings.clubSurfaceSynthetic")}</option>
                <option>{t("pages.settings.clubSurfaceHybrid")}</option>
                <option>{t("pages.settings.clubSurfaceDirt")}</option>
                <option>{t("pages.settings.clubSurfaceIndoor")}</option>
              </select>
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldCategory")}>
              <select
                value={profile.category}
                onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                style={styles.input}
              >
                <option>{t("pages.settings.clubCategoryPrima")}</option>
                <option>{t("pages.settings.clubCategoryJuniores")}</option>
                <option>{t("pages.settings.clubCategoryAllievi")}</option>
                <option>{t("pages.settings.clubCategoryGiovanissimi")}</option>
                <option>{t("pages.settings.clubCategoryEsordienti")}</option>
              </select>
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldRole")}>
              <select
                value={profile.userRole}
                onChange={(e) => setProfile({ ...profile, userRole: e.target.value })}
                style={styles.input}
              >
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </ClubField>
            <ClubField label={t("pages.settings.clubFieldGoal")}>
              <textarea
                value={profile.seasonGoal}
                onChange={(e) => setProfile({ ...profile, seasonGoal: e.target.value })}
                style={{ ...styles.input, minHeight: 80 }}
              />
            </ClubField>
          </div>
          <Button onClick={saveProfile} style={{ marginTop: 14 }}>{t("pages.settings.clubBtnSave")}</Button>
        </AppCard>

        <AppCard title="Progresso configurazione" subtitle="Checklist di onboarding e trial.">
          <div style={sharedStyles.progressTrack}>
            <div style={{ ...sharedStyles.progressBar, width: `${setup.percent}%` }} />
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px" }}>
            {t("pages.settings.clubProgressLabel", { percent: setup.percent })}
          </p>
          <div style={sharedStyles.checkList}>
            {setup.checks.map((check) => (
              <button
                key={check.key}
                type="button"
                onClick={() => navigate(check.path)}
                style={sharedStyles.checkRow}
              >
                <span style={{ color: check.done ? "#22c55e" : "#64748b" }}>
                  {check.done ? "✓" : "○"}
                </span>
                <strong>{t(check.labelKey)}</strong>
              </button>
            ))}
          </div>
        </AppCard>
      </div>

      {/* ── Invita Staff e Giocatori ── */}
      <AppCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, lineHeight: 1.2 }}>{t("pages.settings.clubInviteTitle")}</h3>
            <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              Condividi dati, sedute e report con il tuo team. Ogni membro accede solo alle aree del suo ruolo.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={copyInviteLink}
              style={inviteStyles.copyLinkBtn}
            >
              {inviteCopied ? t("pages.settings.clubLinkCopied") : t("pages.settings.clubCopyLink")}
            </button>
            <Button onClick={openInviteModal}>
              {t("pages.settings.clubBtnInvite")}
            </Button>
          </div>
        </div>

        {/* Link invito visibile */}
        {inviteToken && (
          <div style={inviteStyles.linkBox}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginRight: 8 }}>{t("pages.settings.clubLinkLabel")}</span>
            <span style={{ fontSize: 12, color: "#93c5fd", wordBreak: "break-all" }}>
              {getInviteLink(inviteToken)}
            </span>
          </div>
        )}

        {/* Inviti in attesa — già accettati filtrati automaticamente */}
        {visiblePendingInvites.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 10px", letterSpacing: 0.5 }}>
              {t("pages.settings.clubPendingInvites", { count: visiblePendingInvites.length })}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {visiblePendingInvites.map((inv) => {
                const expired = isInviteExpired(inv);
                return (
                  <div key={inv.id} style={inviteStyles.inviteRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 13 }}>{inv.name || inv.email}</strong>
                        <Badge tone="orange">{memberRoles[inv.role]?.label || inv.role}</Badge>
                        <Badge tone={expired ? "red" : "blue"}>{expired ? t("pages.settings.clubInviteExpired") : t("pages.settings.clubInviteRequestSent")}</Badge>
                      </div>
                      <p style={{ color: "#64748b", margin: "3px 0 0", fontSize: 12 }}>{inv.email}</p>
                      <p style={{ color: "#475569", margin: "3px 0 0", fontSize: 11 }}>
                        Inviato {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString("it-IT") : "-"}
                        {" · "}
                        Scade {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("it-IT") : "-"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => copyPendingInviteLink(inv)}
                        style={inviteStyles.copySmallBtn}
                      >
                        {copiedInviteId === inv.id ? "Copiato" : "Copia link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelInvite(inv.id)}
                        style={inviteStyles.cancelBtn}
                      >
                        {t("pages.settings.clubBtnCancel")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Membri attivi */}
        {(settings.members || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 10px", letterSpacing: 0.5 }}>
              {t("pages.settings.clubActiveMembers", { count: (settings.members || []).length })}
            </p>
            <div style={sharedStyles.memberList}>
              {(settings.members || []).map((member) => (
                <div key={member.id} style={{ display: "grid", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div
                  style={{
                    ...inviteStyles.memberRow,
                    border: "none",
                    borderRadius: 0,
                    alignItems: isMobile ? "stretch" : inviteStyles.memberRow.alignItems,
                    ...(member.vip ? inviteStyles.memberRowVip : {}),
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={member.vip ? inviteStyles.avatarVip : inviteStyles.avatar}>
                        {(member.name || "?")[0].toUpperCase()}
                        {member.vip && (
                          <span style={inviteStyles.avatarVipStar}>⭐</span>
                        )}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ fontSize: 13, lineHeight: 1.2 }}>{member.name}</strong>
                          {member.vip && <VipBadge />}
                        </div>
                        <p style={{ color: "#64748b", margin: 0, fontSize: 12 }}>{member.email || "Email non inserita"}</p>
                      </div>
                    </div>
                  </div>
                  <select
                    value={pendingMemberRoles[member.id] ?? member.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setPendingMemberRoles((prev) => {
                        if (nextRole === member.role) {
                          const { [member.id]: _drop, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, [member.id]: nextRole };
                      });
                    }}
                    style={{ ...styles.input, marginTop: 0, width: isMobile ? "100%" : "auto", minWidth: isMobile ? 0 : 140 }}
                  >
                    {Object.entries(memberRoles).map(([key, role]) => (
                      <option key={key} value={key}>{role.label}</option>
                    ))}
                  </select>
                  {pendingMemberRoles[member.id] && pendingMemberRoles[member.id] !== member.role && (
                    <button
                      type="button"
                      disabled={savingMemberRole === member.id}
                      onClick={async () => {
                        const nextRole = pendingMemberRoles[member.id];
                        setSavingMemberRole(member.id);
                        try {
                          await updateMemberRole(member.id, nextRole);
                          setPendingMemberRoles((prev) => {
                            const { [member.id]: _drop, ...rest } = prev;
                            return rest;
                          });
                        } finally {
                          setSavingMemberRole("");
                        }
                      }}
                      style={{ ...inviteStyles.copySmallBtn, whiteSpace: "nowrap", width: isMobile ? "100%" : "auto", opacity: savingMemberRole === member.id ? 0.6 : 1 }}
                    >
                      {savingMemberRole === member.id ? t("common.saving") : t("common.save")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedMemberPerms((prev) => ({ ...prev, [member.id]: !prev[member.id] }))}
                    style={{ ...inviteStyles.copySmallBtn, whiteSpace: "nowrap", flex: isMobile ? "1 1 100%" : "0 0 auto" }}
                  >
                    {expandedMemberPerms[member.id] ? "▲ Permessi" : "▼ Permessi"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMemberVip(member.id)}
                    title={member.vip ? "Rimuovi VIP" : "Assegna VIP"}
                    style={{
                      ...inviteStyles.cancelBtn,
                      flex: isMobile ? "1 1 0" : "0 0 auto",
                      ...(member.vip ? inviteStyles.vipActiveBtn : {}),
                    }}
                  >
                    {member.vip ? "⭐ VIP" : "☆ VIP"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    style={{ ...inviteStyles.cancelBtn, flex: isMobile ? "1 1 0" : "0 0 auto" }}
                  >
                    {t("pages.settings.clubBtnRemove")}
                  </button>
                </div>{/* end inner memberRow */}
                {expandedMemberPerms[member.id] && (
                  <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "grid", gap: 6 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {t("pages.settings.permCustomizeBtn").replace("🔧 ", "")}
                    </p>
                    {PERMISSION_AREAS.map((area) => {
                      const val = (member.customAreas || {})[area.key] || "role";
                      return (
                        <div key={area.key} style={inviteStyles.permRow}>
                          <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>{area.icon}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                            {t(`pages.settings.permArea${area.key.charAt(0).toUpperCase()}${area.key.slice(1)}`)}
                          </span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {["role", "view", "manage", "none"].map((level) => (
                              <button
                                key={level}
                                type="button"
                                onClick={() => updateMemberArea(member.id, area.key, level)}
                                style={{
                                  ...inviteStyles.permBtn,
                                  ...(val === level ? inviteStyles.permBtnActive[level] || inviteStyles.permBtnActiveDefault : {}),
                                }}
                              >
                                {t(AREA_ACCESS_LABEL_KEYS[level])}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!(settings.members || []).length && !visiblePendingInvites.length && (
          <p style={{ color: "#475569", fontSize: 13, margin: "16px 0 0" }}>
            {t("pages.settings.clubNoMembers")}
          </p>
        )}
      </AppCard>


      {/* ── Modale invito ── */}
      {inviteModal && (
        <div style={inviteStyles.overlay} onClick={() => closeInviteModal({ resetDraft: Boolean(sentInviteUrl) })}>
          <div style={inviteStyles.modal} onClick={(e) => e.stopPropagation()}>
            {sentInviteUrl ? (
              /* ── Step 2: link pronto da condividere ── */
              <div style={{ display: "grid", gap: 18 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10 }}>✅</div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>Invito inviato a {sentInviteName}</h3>
                  <p style={{ color: "#94a3b8", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    Se l&apos;email non arriva, condividi direttamente il link qui sotto.
                  </p>
                </div>

                <div style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#93c5fd",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}>
                  {sentInviteUrl}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(sentInviteUrl).then(() => {
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2500);
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: linkCopied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                      color: linkCopied ? "#22c55e" : "#e2e8f0",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {linkCopied ? "✓ Copiato!" : "📋 Copia link"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Ciao! Ti invito su CalcioLab. Clicca qui per accedere: ${sentInviteUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(37,211,102,0.18)",
                      color: "#25d366",
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    📱 Invia su WhatsApp
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => closeInviteModal()}
                  style={{ ...inviteStyles.cancelBtn, width: "100%", textAlign: "center" }}
                >
                  Chiudi
                </button>
              </div>
            ) : (
              /* ── Step 1: form invito ── */
              <>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{t("pages.settings.clubModalTitle")}</h3>
            <p style={{ color: "#94a3b8", margin: "0 0 20px", fontSize: 13, lineHeight: 1.5 }}>
              Inserisci i dati del membro. Riceverà un link per accedere al workspace con il suo ruolo.
            </p>
            <form onSubmit={sendInvite} style={{ display: "grid", gap: 12 }}>
              <input
                placeholder={t("pages.settings.clubInviteNamePlaceholder")}
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                style={styles.input}
              />
              <input
                type="email"
                required
                placeholder="Email *"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                style={styles.input}
              />
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                style={styles.input}
              >
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label} — {role.description || ""}</option>
                ))}
              </select>

              <div style={inviteStyles.rolePreview}>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  <strong style={{ color: "white" }}>{memberRoles[inviteForm.role]?.label}</strong>
                  {" "}— {inviteRoleDesc[inviteForm.role] || "Accesso personalizzato all'area assegnata."}
                </p>
              </div>

              {/* ── Personalizza accessi ── */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCustomPerms((v) => !v)}
                  style={inviteStyles.expandBtn}
                >
                  <span>{t("pages.settings.permCustomizeBtn")}</span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{showCustomPerms ? "▲" : "▼"}</span>
                </button>

                {showCustomPerms && (
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
                      {t("pages.settings.permHint")} <strong style={{ color: "#93c5fd" }}>{t("pages.settings.permHintRole")}</strong> {t("pages.settings.permHintSuffix")}
                    </p>
                    {PERMISSION_AREAS.map((area) => {
                      const val = inviteForm.customAreas[area.key] || "role";
                      return (
                        <div key={area.key} style={inviteStyles.permRow}>
                          <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>{area.icon}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{t(`pages.settings.permArea${area.key.charAt(0).toUpperCase()}${area.key.slice(1)}`)}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {["role", "view", "manage", "none"].map((level) => (
                              <button
                                key={level}
                                type="button"
                                onClick={() => setInviteForm((f) => ({
                                  ...f,
                                  customAreas: { ...f.customAreas, [area.key]: level },
                                }))}
                                style={{
                                  ...inviteStyles.permBtn,
                                  ...(val === level ? inviteStyles.permBtnActive[level] || inviteStyles.permBtnActiveDefault : {}),
                                }}
                              >
                                {t(AREA_ACCESS_LABEL_KEYS[level])}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => closeInviteModal({ resetDraft: true })} style={inviteStyles.cancelBtn}>
                  {t("pages.settings.clubBtnCancel")}
                </button>
                <Button type="submit">{t("pages.settings.clubBtnSendInvite")}</Button>
              </div>
            </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
