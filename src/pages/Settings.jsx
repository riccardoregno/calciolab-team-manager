import { useState, useEffect, useMemo, useRef } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTabState } from "../hooks/useTabState";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import AuthPanel from "../components/auth/AuthPanel";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import {
  createId,
  getSetupProgress,
  isRoleAllowed,
  memberRoles,
  normalizeAppSettings,
} from "../utils/helpers";
import { useAppSettings } from "../hooks/useAppSettings";
import { useNotifications } from "../hooks/useNotifications";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";

/* ─── tab list ─────────────────────────────────────────────── */
const TABS = [
  { key: "account",       labelKey: "pages.settings.account" },
  { key: "coach",         labelKey: "pages.settings.coachParams" },
  { key: "club",          labelKey: "pages.settings.clubProfile", roles: ["owner", "headCoach", "director"] },
  { key: "notifications", labelKey: "pages.settings.notifications" },
];

const INVITE_MEMBER_MODAL = "invite-member";
const INVITE_MEMBER_DRAFT_KEY = "calciolab_invite_member_draft_v1";
const EMPTY_INVITE_FORM = { email: "", name: "", role: "assistantCoach", customAreas: {} };

function loadInviteMemberDraft() {
  try {
    const stored = localStorage.getItem(INVITE_MEMBER_DRAFT_KEY);
    return stored ? { ...EMPTY_INVITE_FORM, ...JSON.parse(stored) } : EMPTY_INVITE_FORM;
  } catch {
    return EMPTY_INVITE_FORM;
  }
}

function clearInviteMemberDraft() {
  try {
    localStorage.removeItem(INVITE_MEMBER_DRAFT_KEY);
  } catch {
    /* localStorage can be unavailable in restricted browsers */
  }
}

const widgetLabelKeys = {
  hero:             "pages.settings.introOperational",
  nextEvent:        "pages.settings.nextEvent",
  kpis:             "pages.settings.mainKpis",
  weekFocus:        "pages.settings.weekFocus",
  rosterStatus:     "pages.settings.rosterStatus",
  coachAlerts:      "pages.settings.coachAlerts",
  recentActivities: "pages.settings.recentActivities",
  quickActions:     "pages.settings.quickActions",
  rewardCenter:     "pages.settings.rewardPlan",
};

/* ─── Permission areas for custom access overrides ─────────── */
const PERMISSION_AREAS = [
  { key: "players",    icon: "👥" },
  { key: "sessions",   icon: "📋" },
  { key: "matches",    icon: "⚽" },
  { key: "physical",   icon: "📊" },
  { key: "statistics", icon: "📈" },
  { key: "setPlays",   icon: "🎯" },
  { key: "calendar",   icon: "📅" },
];

const AREA_ACCESS_LABEL_KEYS = {
  role:   "pages.settings.accessRole",
  view:   "pages.settings.accessView",
  manage: "pages.settings.accessManage",
  none:   "pages.settings.accessNone",
};

/* ─── main component ────────────────────────────────────────── */
export default function Settings({
  /* auth props */
  authConfigured,
  authLoading,
  user,
  team,
  authError,
  storageSource,
  currentUserRole,
  /* data props */
  appSettings = {},
  setAppSettings,
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useTabState("tab", "account");
  const [confirmState, setConfirmState] = useState(null);
  const { showToast, ToastContainer } = useToast();
  const effectiveRole = currentUserRole || team?.role || normalizeAppSettings(appSettings).workspaceProfile.userRole || "headCoach";
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => !tab.roles || isRoleAllowed(effectiveRole, tab.roles)),
    [effectiveRole]
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("account");
    }
  }, [activeTab, setActiveTab, visibleTabs]);

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.settings.title")}
        subtitle={t("pages.settings.subtitle")}
      />

      {/* ── Tab bar ── */}
      <div style={s.tabBar}>
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{ ...s.tab, ...(active ? s.tabActive : s.tabInactive) }}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ── Panels ── */}
      {activeTab === "account" && (
        <AccountTab
          authConfigured={authConfigured}
          authLoading={authLoading}
          user={user}
          team={team}
          authError={authError}
          storageSource={storageSource}
          appSettings={appSettings}
          showToast={showToast}
        />
      )}

      {activeTab === "coach" && (
        <CoachTab
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          setConfirmState={setConfirmState}
          showToast={showToast}
        />
      )}

      {activeTab === "club" && (
        <ClubTab
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          team={team}
          showToast={showToast}
          players={players}
          exercises={exercises}
          sessions={sessions}
          matches={matches}
        />
      )}

      {activeTab === "notifications" && (
        <NotificationsTab
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          sessions={sessions}
          matches={matches}
          players={players}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1 — Account
═══════════════════════════════════════════════════════════════ */
function AccountTab({ authConfigured, authLoading, user, team, authError, storageSource, appSettings = {}, showToast }) {
  const accountSettings = normalizeAppSettings(appSettings);
  const isVipOwner = Boolean(accountSettings.redeemedPromo?.permanent);
  const { t } = useTranslation();
  /* ── Profile form ── */
  const [profileForm,    setProfileForm]    = useState({ first_name: "", last_name: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFeedback,setProfileFeedback]= useState(null);

  /* ── Password form ── */
  const [pwdForm,    setPwdForm]    = useState({ current: "", next: "", confirm: "" });
  const [showPwd,    setShowPwd]    = useState({ current: false, next: false, confirm: false });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdFeedback,setPwdFeedback]= useState(null);

  /* Load profile on mount */
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileForm({ first_name: data.first_name || "", last_name: data.last_name || "" });
      });
  }, [user?.id]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileFeedback(null);
    if (!profileForm.first_name.trim() || !profileForm.last_name.trim()) {
      setProfileFeedback({ ok: false, text: t("pages.settings.acctFieldsRequired") });
      return;
    }
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: profileForm.first_name.trim(), last_name: profileForm.last_name.trim() })
        .eq("id", user.id);
      if (error) setProfileFeedback({ ok: false, text: error.message });
      else setProfileFeedback({ ok: true, text: t("pages.settings.acctProfileSaved") });
    } finally { setProfileLoading(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwdFeedback(null);
    if (!pwdForm.next || pwdForm.next.length < 8) {
      setPwdFeedback({ ok: false, text: t("pages.settings.acctPwdTooShort") });
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdFeedback({ ok: false, text: t("pages.settings.acctPwdNoMatch") });
      return;
    }
    setPwdLoading(true);
    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: pwdForm.current,
      });
      if (signInError) {
        setPwdFeedback({ ok: false, text: t("pages.settings.acctPwdWrong") });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwdForm.next });
      if (error) setPwdFeedback({ ok: false, text: error.message });
      else {
        setPwdFeedback({ ok: true, text: t("pages.settings.acctPwdUpdated") });
        setPwdForm({ current: "", next: "", confirm: "" });
      }
    } finally { setPwdLoading(false); }
  }

  const avatarInitial = profileForm.first_name
    ? profileForm.first_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "C";

  const fullName = [profileForm.first_name, profileForm.last_name].filter(Boolean).join(" ") || "Coach";

  return (
    <div style={s.panel}>
      <div style={styles.grid2}>
        <AuthPanel
          authConfigured={authConfigured}
          authLoading={authLoading}
          user={user}
          team={team}
          authError={authError}
        />

        {/* Profile editing card */}
        <AppCard>
          <h3 style={{ ...styles.cardTitle, lineHeight: 1.2 }}>{t("pages.settings.acctProfileTitle")}</h3>

          <div style={s.profileBox}>
            <div style={{ position: "relative" }}>
              <div style={isVipOwner ? { ...s.avatar, ...s.avatarVip } : s.avatar}>{avatarInitial}</div>
              {isVipOwner && <span style={s.avatarVipStarOwner}>⭐</span>}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={s.profileName}>{fullName}</h2>
                {isVipOwner && <VipBadge />}
              </div>
              <p style={s.profileRole}>{user?.email || "—"}</p>
            </div>
          </div>

          <form onSubmit={saveProfile} style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={acctStyles.fieldLabel}>{t("pages.settings.acctFirstName")}</label>
                <input
                  style={acctStyles.input}
                  type="text"
                  placeholder={t("pages.settings.acctFirstName")}
                  value={profileForm.first_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div>
                <label style={acctStyles.fieldLabel}>{t("pages.settings.acctLastName")}</label>
                <input
                  style={acctStyles.input}
                  type="text"
                  placeholder={t("pages.settings.acctLastName")}
                  value={profileForm.last_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            {profileFeedback && (
              <div style={{ ...acctStyles.feedback, ...(profileFeedback.ok ? acctStyles.feedbackOk : acctStyles.feedbackErr) }}>
                {profileFeedback.text}
              </div>
            )}

            <button
              type="submit"
              style={{ ...acctStyles.btn, ...(profileLoading ? acctStyles.btnDisabled : {}) }}
              disabled={profileLoading}
            >
              {profileLoading ? t("pages.settings.acctSaving") : t("pages.settings.acctSaveProfile")}
            </button>
          </form>
        </AppCard>

        {/* Squadra */}
        <AppCard>
          <h3 style={{ ...styles.cardTitle, lineHeight: 1.2 }}>{t("pages.settings.acctTeamTitle")}</h3>

          <div style={s.infoGrid}>
            <InfoItem label={t("pages.settings.acctTeamName")}     value={team?.name     || "CalcioLab Team"} />
            <InfoItem label={t("pages.settings.acctTeamCategory")} value={team?.category || "Prima squadra"} />
            <InfoItem label={t("pages.settings.acctTeamSeason")}   value={team?.season   || "2025/2026"} />
            <InfoItem label={t("pages.settings.acctTeamMode")}     value={storageSource === "supabase" ? t("pages.settings.acctModeCloud") : t("pages.settings.acctModeLocal")} />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            <Badge tone="blue">Gestione rosa</Badge>
            <Badge tone="green">Allenamenti</Badge>
            <Badge tone="purple">Analytics</Badge>
          </div>
        </AppCard>
      </div>

      {/* Password change card */}
      <AppCard>
        <h3 style={{ ...styles.cardTitle, lineHeight: 1.2 }}>{t("pages.settings.acctPasswordTitle")}</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 18px" }}>
          Usa una password sicura di almeno 8 caratteri. Non riutilizzare la stessa di altri servizi.
        </p>

        <form onSubmit={savePassword} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {/* Current password */}
          <div>
            <label style={acctStyles.fieldLabel}>{t("pages.settings.acctCurrentPwd")}</label>
            <div style={acctStyles.pwdWrap}>
              <input
                style={acctStyles.input}
                type={showPwd.current ? "text" : "password"}
                placeholder={t("pages.settings.acctCurrentPwd")}
                value={pwdForm.current}
                onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
                autoComplete="current-password"
              />
              <button type="button" tabIndex={-1} style={acctStyles.eyeBtn}
                onClick={() => setShowPwd((p) => ({ ...p, current: !p.current }))}>
                {showPwd.current ? <EyeOff size={15} color="#64748b" /> : <Eye size={15} color="#64748b" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label style={acctStyles.fieldLabel}>{t("pages.settings.acctNewPwd")}</label>
            <div style={acctStyles.pwdWrap}>
              <input
                style={acctStyles.input}
                type={showPwd.next ? "text" : "password"}
                placeholder={t("pages.settings.acctNewPwdPlaceholder")}
                value={pwdForm.next}
                onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
                autoComplete="new-password"
              />
              <button type="button" tabIndex={-1} style={acctStyles.eyeBtn}
                onClick={() => setShowPwd((p) => ({ ...p, next: !p.next }))}>
                {showPwd.next ? <EyeOff size={15} color="#64748b" /> : <Eye size={15} color="#64748b" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label style={acctStyles.fieldLabel}>{t("pages.settings.acctConfirmPwd")}</label>
            <div style={acctStyles.pwdWrap}>
              <input
                style={{
                  ...acctStyles.input,
                  borderColor: pwdForm.confirm && pwdForm.confirm !== pwdForm.next
                    ? "rgba(239,68,68,0.5)" : undefined,
                }}
                type={showPwd.confirm ? "text" : "password"}
                placeholder={t("pages.settings.acctConfirmPwdPlaceholder")}
                value={pwdForm.confirm}
                onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))}
                autoComplete="new-password"
              />
              <button type="button" tabIndex={-1} style={acctStyles.eyeBtn}
                onClick={() => setShowPwd((p) => ({ ...p, confirm: !p.confirm }))}>
                {showPwd.confirm ? <EyeOff size={15} color="#64748b" /> : <Eye size={15} color="#64748b" />}
              </button>
            </div>
          </div>

          {/* Feedback + submit — span full width */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 10 }}>
            {pwdFeedback && (
              <div style={{ ...acctStyles.feedback, ...(pwdFeedback.ok ? acctStyles.feedbackOk : acctStyles.feedbackErr) }}>
                {pwdFeedback.text}
              </div>
            )}
            <button
              type="submit"
              style={{ ...acctStyles.btn, ...(pwdLoading ? acctStyles.btnDisabled : {}) }}
              disabled={pwdLoading}
            >
              {pwdLoading ? t("pages.settings.acctUpdating") : t("pages.settings.acctUpdatePwd")}
            </button>
          </div>
        </form>
      </AppCard>

      <AppCard>
        <h3 style={{ ...styles.cardTitle, lineHeight: 1.2 }}>{t("pages.settings.acctRoadmapTitle")}</h3>
        <div style={s.roadmap}>
          <RoadmapItem title="Cloud sync"  text="Attivo con Supabase e fallback locale automatico." />
          <RoadmapItem title="Multi team"  text="Base dati pronta con teams e team_members." />
          <RoadmapItem title="Export PDF"  text="Prossimo step per sedute, distinta e match plan." />
          <RoadmapItem title="Staff roles" text="Estendere permessi per coach, preparatore e osservatore." />
        </div>
      </AppCard>

      <RedeemPromoCard team={team} appSettings={appSettings} showToast={showToast} />
    </div>
  );
}

/* Stili specifici AccountTab */
const acctStyles = {
  fieldLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 },
  input: {
    padding: "11px 40px 11px 13px", borderRadius: 10, border: "1px solid #2b3444",
    background: "#0b1018", color: "white", fontSize: 14, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  pwdWrap:  { position: "relative" },
  eyeBtn: {
    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", cursor: "pointer",
    padding: 4, display: "flex", alignItems: "center",
  },
  feedback:    { padding: "10px 13px", borderRadius: 9, fontSize: 13, lineHeight: 1.45, fontWeight: 600 },
  feedbackOk:  { background: "rgba(34,197,94,0.14)",  border: "1px solid rgba(34,197,94,0.28)",  color: "#86efac" },
  feedbackErr: { background: "rgba(239,68,68,0.12)",  border: "1px solid rgba(239,68,68,0.26)",  color: "#fca5a5" },
  btn: {
    padding: "12px 18px", borderRadius: 11, border: "none",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "white", fontWeight: 900, fontSize: 14, cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37,99,235,0.22)", transition: "opacity 0.15s",
  },
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" },
};

/* ═══════════════════════════════════════════════════════════════
   TAB 2 — Coach parameters
═══════════════════════════════════════════════════════════════ */
function CoachTab({ appSettings, setAppSettings, setConfirmState, showToast }) {
  const { t } = useTranslation();
  const settings   = useAppSettings(appSettings);
  const parameters = settings.coachParameters   || {};
  const metrics    = settings.physicalMetrics    || [];

  const [newMetric, setNewMetric] = useState({
    label: "", unit: "", higherIsBetter: true, icon: "📌",
  });

  function updateMetrics(updated) {
    setAppSettings({ ...settings, physicalMetrics: updated });
  }

  function toggleMetric(key) {
    updateMetrics(metrics.map((m) => m.key === key ? { ...m, enabled: !m.enabled } : m));
  }

  function deleteCustomMetric(key) {
    setConfirmState({
      message: t("pages.settings.coachDeleteMetricMsg"),
      confirmLabel: t("pages.settings.coachDeleteMetricConfirm"),
      confirmTone: "red",
      onConfirm: () => updateMetrics(metrics.filter((m) => m.key !== key)),
    });
  }

  function addCustomMetric() {
    if (!newMetric.label.trim()) {
      showToast(t("pages.settings.coachMetricNameRequired"), "warn");
      return;
    }
    const key = `custom_${createId("m")}`;
    updateMetrics([...metrics, { ...newMetric, key, enabled: true, custom: true }]);
    setNewMetric({ label: "", unit: "", higherIsBetter: true, icon: "📌" });
  }

  function updateParameters(patch) {
    setAppSettings({ ...settings, coachParameters: { ...parameters, ...patch } });
  }

  function updateWidget(key, value) {
    setAppSettings({ ...settings, dashboardWidgets: { ...settings.dashboardWidgets, [key]: value } });
  }

  return (
    <div style={s.panel}>
      <div style={s.grid2}>
        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.settings.coachParamsTitle")}</h3>
          <div style={s.formGrid}>
            <label style={s.label}>
              {t("pages.settings.coachCategoryLabel")}
              <select
                value={parameters.category}
                onChange={(e) => updateParameters({ category: e.target.value })}
                style={styles.input}
              >
                <option value="adulti">{t("pages.settings.clubCategoryPrima")}</option>
                <option value="juniores">{t("pages.settings.clubCategoryJuniores")}</option>
                <option value="allievi">{t("pages.settings.clubCategoryAllievi")}</option>
                <option value="giovanissimi">{t("pages.settings.clubCategoryGiovanissimi")}</option>
              </select>
            </label>
            <label style={s.label}>
              {t("pages.settings.coachMethodLabel")}
              <select
                value={parameters.method}
                onChange={(e) => updateParameters({ method: e.target.value })}
                style={styles.input}
              >
                <option value="prudente">{t("pages.settings.coachMethodPrudent")}</option>
                <option value="standard">{t("pages.settings.coachMethodStandard")}</option>
                <option value="aggressivo">{t("pages.settings.coachMethodAggressive")}</option>
              </select>
            </label>
            <NumberField label={t("pages.settings.coachGroupA")} value={parameters.groupA} onChange={(v) => updateParameters({ groupA: v })} />
            <NumberField label={t("pages.settings.coachGroupB")} value={parameters.groupB} onChange={(v) => updateParameters({ groupB: v })} />
            <NumberField label={t("pages.settings.coachGroupC")} value={parameters.groupC} onChange={(v) => updateParameters({ groupC: v })} />
          </div>
          <Badge tone="blue">{t("pages.settings.coachThresholdsHint")}</Badge>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.settings.coachWidgetsTitle")}</h3>
          <div style={s.widgetList}>
            {Object.entries(widgetLabelKeys).map(([key, labelKey]) => (
              <label key={key} style={s.widgetRow}>
                <span>{t(labelKey)}</span>
                <input
                  type="checkbox"
                  checked={settings.dashboardWidgets[key]}
                  onChange={(e) => updateWidget(key, e.target.checked)}
                />
              </label>
            ))}
          </div>
        </AppCard>
      </div>

      <AppCard>
        <h3 style={{ marginTop: 0, marginBottom: 4, lineHeight: 1.2 }}>{t("pages.settings.coachMetricsTitle")}</h3>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 18, lineHeight: 1.45 }}>
          Scegli quali metriche mostrare nelle schede giocatore. Puoi anche aggiungerne di personalizzate.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 22 }}>
          {metrics.map((m) => (
            <div key={m.key} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
              borderRadius: 12,
              background: m.enabled ? "rgba(37,99,235,0.10)" : "rgba(255,255,255,0.04)",
              border: m.enabled ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13, color: m.enabled ? "#e2e8f0" : "#64748b" }}>{m.label}</strong>
                {m.unit && <span style={{ fontSize: 11, color: "#475569", marginLeft: 6 }}>{m.unit}</span>}
                {m.custom && <span style={{ fontSize: 10, marginLeft: 6, color: "#a78bfa", fontWeight: 700 }}>CUSTOM</span>}
              </div>
              {m.higherIsBetter !== null && (
                <span style={{ fontSize: 11, color: m.higherIsBetter ? "#22c55e" : "#f87171", fontWeight: 700 }}>
                  {m.higherIsBetter ? t("pages.settings.coachMetricHigherBetter") : t("pages.settings.coachMetricLowerBetter")}
                </span>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => toggleMetric(m.key)}
                  style={{
                    borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800,
                    cursor: "pointer", border: "none",
                    background: m.enabled ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.08)",
                    color: m.enabled ? "#93c5fd" : "#475569",
                  }}
                >
                  {m.enabled ? t("pages.settings.coachMetricActive") : t("pages.settings.coachMetricInactive")}
                </button>
                {m.custom && (
                  <button
                    type="button"
                    onClick={() => deleteCustomMetric(m.key)}
                    style={{ borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer", border: "none", background: "rgba(239,68,68,0.12)", color: "#f87171" }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 18 }}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#64748b" }}>
            {t("pages.settings.coachCustomMetricTitle")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <label style={s.label}>
              {t("pages.settings.coachMetricName")}
              <input
                placeholder="es. Cooper, Forza squat..."
                value={newMetric.label}
                onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })}
                style={styles.input}
              />
            </label>
            <label style={s.label}>
              {t("pages.settings.coachMetricUnit")}
              <input
                placeholder="es. m, kg, s"
                value={newMetric.unit}
                onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                style={styles.input}
              />
            </label>
            <label style={s.label}>
              {t("pages.settings.coachMetricIcon")}
              <input
                placeholder="emoji"
                value={newMetric.icon}
                onChange={(e) => setNewMetric({ ...newMetric, icon: e.target.value })}
                style={styles.input}
              />
            </label>
            <label style={s.label}>
              {t("pages.settings.coachMetricTrend")}
              <select
                value={newMetric.higherIsBetter === null ? "null" : String(newMetric.higherIsBetter)}
                onChange={(e) => setNewMetric({
                  ...newMetric,
                  higherIsBetter: e.target.value === "null" ? null : e.target.value === "true",
                })}
                style={styles.input}
              >
                <option value="true">{t("pages.settings.coachMetricTrendUp")}</option>
                <option value="false">{t("pages.settings.coachMetricTrendDown")}</option>
                <option value="null">{t("pages.settings.coachMetricTrendNeutral")}</option>
              </select>
            </label>
            <Button onClick={addCustomMetric}>{t("pages.settings.coachBtnAdd")}</Button>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.settings.coachWorkBlocksTitle")}</h3>
        <div style={s.blocksGrid}>
          {parameters.workBlocks.map((block) => (
            <div key={block.label} style={s.block}>
              <strong>{block.label}</strong>
              <span>{block.seconds}s · {Math.round(block.percent * 100)}% MAS · {block.reps} reps · {block.sets} serie</span>
              <span>{block.recovery}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={() => showToast(t("pages.settings.coachBlocksComingSoon"), "info")}>
          {t("pages.settings.coachBtnCustomize")}
        </Button>
      </AppCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3 — Club & members
═══════════════════════════════════════════════════════════════ */
const DEFAULT_WORKSPACE_PROFILE = {
  clubName: "", teamName: "", category: "Prima squadra", logoSize: 100,
  homeFieldName: "", homeFieldAddress: "", homeFieldSurface: "Erba naturale",
  userRole: "headCoach", seasonGoal: "", currentSeason: "2025/26",
};
const INVITE_EXPIRY_DAYS = 14;

function getInviteExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
  return expiresAt.toISOString();
}

function isInviteExpired(invite) {
  return Boolean(invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now());
}

function ClubTab({ appSettings, setAppSettings, team, showToast, players = [], exercises = [], sessions = [], matches = [] }) {
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
    closeInviteModal();

    // Invia email di invito (fire-and-forget — non blocca la UI)
    const inviteUrl = getInviteLink(token);
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
    <div style={s.panel}>
      <AppCard style={{ marginBottom: 18 }}>
        <div style={s.clubIntro}>
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
          <div style={s.clubIntroStats}>
            <InfoMini label={t("pages.settings.clubLabelSetup")}   value={`${setup.percent}%`} />
            <InfoMini label={t("pages.settings.clubLabelMembers")} value={(settings.members || []).length} />
            <InfoMini label={t("pages.settings.clubLabelInvites")} value={(settings.pendingInvites || []).length} />
          </div>
        </div>
      </AppCard>

      <div style={s.grid2}>
        <AppCard title="Profilo società" subtitle="Identità, squadra, categoria e obiettivi della stagione.">
          <div style={s.formStack}>
            <div style={s.clubLogoBox}>
              {profile.logo ? (
                <div style={s.clubLogoFrame}>
                  <img
                    src={profile.logo}
                    alt={profile.clubName || "Logo società"}
                    style={{
                      ...s.clubLogoPreview,
                      width: `${Number(profile.logoSize || 100)}%`,
                      height: `${Number(profile.logoSize || 100)}%`,
                    }}
                  />
                </div>
              ) : (
                <div style={s.clubLogoFallback}>{(profile.clubName || "CL").slice(0, 2).toUpperCase()}</div>
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
                  <label style={s.logoSizeControl}>
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
          <div style={s.progressTrack}>
            <div style={{ ...s.progressBar, width: `${setup.percent}%` }} />
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px" }}>
            {t("pages.settings.clubProgressLabel", { percent: setup.percent })}
          </p>
          <div style={s.checkList}>
            {setup.checks.map((check) => (
              <button
                key={check.key}
                type="button"
                onClick={() => navigate(check.path)}
                style={s.checkRow}
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
            <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#64748b", margin: "0 0 10px", letterSpacing: 0.5 }}>
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
            <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#64748b", margin: "0 0 10px", letterSpacing: 0.5 }}>
              {t("pages.settings.clubActiveMembers", { count: (settings.members || []).length })}
            </p>
            <div style={s.memberList}>
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
        <div style={inviteStyles.overlay} onClick={() => closeInviteModal()}>
          <div style={inviteStyles.modal} onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Redeem Promo — shown in Account tab
   FIX: il riscatto ora passa interamente dall'Edge Function
   redeem-promo-code (vedi supabase/functions/redeem-promo-code).
   Prima la lista dei codici (incluso un codice permanente "club"
   hardcoded nel bundle JS, leggibile da chiunque con devtools) e
   il riscatto vivevano lato client e scrivevano in teams.settings
   (JSON owner-writable): bastava conoscere/creare un codice per
   ottenere un piano premium gratuito per sempre, bypassando Stripe.
   Ora la validazione e l'aggiornamento del piano avvengono
   server-side sulle colonne trusted (subscription_plan/billing_status).
═══════════════════════════════════════════════════════════════ */
function RedeemPromoCard({ team, appSettings = {}, showToast }) {
  const settings = normalizeAppSettings(appSettings);
  const plan = settings.subscription?.plan || "free";
  const billingStatus = settings.subscription?.billingStatus || "free";
  const alreadyActive = billingStatus === "active" && plan !== "free";

  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRedeem(e) {
    e.preventDefault();
    setFeedback(null);
    const code = input.trim().toUpperCase();
    if (!code) return;

    if (!team?.id) {
      setFeedback({ ok: false, text: "Nessun team attivo: impossibile riscattare il codice." });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-promo-code", {
        body: { teamId: team.id, code },
      });

      if (error || !data?.success) {
        const message = data?.error || error?.message || "Codice non valido.";
        setFeedback({ ok: false, text: message });
        return;
      }

      setFeedback({ ok: true, text: `Codice applicato! Piano ${String(data.plan || "").toUpperCase()} attivato.` });
      setInput("");
      showToast?.(`Piano ${String(data.plan || "").toUpperCase()} attivato tramite codice promozionale.`, "success");
    } catch (err) {
      setFeedback({ ok: false, text: err?.message || "Errore durante il riscatto del codice." });
    } finally {
      setSubmitting(false);
    }
  }

  const planColors = { premium: "#38bdf8", club: "#a78bfa" };

  return (
    <AppCard>
      <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>Codice promozionale</h3>
      <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
        Hai ricevuto un codice di accesso? Inseriscilo qui per attivare il piano associato.
      </p>

      {alreadyActive ? (
        <div style={promoStyles.redeemedBox}>
          <span style={{ fontSize: 20 }}>OK</span>
          <div>
            <strong style={{ color: planColors[plan] || "#22c55e" }}>
              Accesso attivo — piano {plan.toUpperCase()}
            </strong>
          </div>
        </div>
      ) : (
        <form onSubmit={handleRedeem} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            placeholder="Inserisci il codice..."
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            disabled={submitting}
            style={{
              ...styles.input,
              flex: "1 1 200px",
              letterSpacing: 3,
              textTransform: "uppercase",
              fontFamily: "monospace",
              fontWeight: 700,
            }}
          />
          <Button type="submit" disabled={submitting}>{submitting ? "Verifica..." : "Applica"}</Button>
        </form>
      )}

      {feedback && (
        <div style={{
          ...acctStyles.feedback,
          marginTop: 12,
          ...(feedback.ok ? acctStyles.feedbackOk : acctStyles.feedbackErr),
        }}>
          {feedback.text}
        </div>
      )}
    </AppCard>
  );
}


/* ─── shared small components ──────────────────────────────── */
function InfoItem({ label, value }) {
  return (
    <div style={s.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoadmapItem({ title, text }) {
  return (
    <div style={s.roadmapItem}>
      <strong style={{ lineHeight: 1.2 }}>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label style={s.label}>
      {label}
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.input}
      />
    </label>
  );
}

function ClubField({ label, children }) {
  return (
    <label style={s.clubField}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function hasWorkspaceProfileContent(profile = {}) {
  return [
    profile.clubName && profile.clubName !== "CalcioLab",
    profile.teamName,
    profile.logo,
    profile.homeFieldName,
    profile.homeFieldAddress,
    profile.seasonGoal,
    profile.currentSeason && profile.currentSeason !== "2025/2026" && profile.currentSeason !== "2025/26",
    profile.homeFieldSurface && profile.homeFieldSurface !== "Erba naturale",
  ].some(Boolean);
}

function InfoMini({ label, value }) {
  return (
    <div style={s.infoMini}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ─── styles ────────────────────────────────────────────────── */
/* ─── Invite role descriptions ──────────────────────────────── */
const inviteRoleDesc = {
  owner:          "Accesso completo a tutto il workspace.",
  headCoach:      "Gestisce rosa, sedute, partite, tattiche e report.",
  assistantCoach: "Vede sedute e partite, può aggiungere note tattiche.",
  athleticTrainer:"Accede a test fisici, lavori e stato disponibilità rosa.",
  director:       "Vede report, esportazioni e gestione finanziaria sponsor.",
  player:         "Vede il proprio profilo, programma e prossimi impegni.",
  sponsor:        "Accede al portale sponsor con report visibilità.",
};

/* ─── Invite styles ─────────────────────────────────────────── */
const inviteStyles = {
  copyLinkBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.3)",
    background: "rgba(37,99,235,0.12)",
    color: "#93c5fd",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  linkBox: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 11,
    background: "rgba(37,99,235,0.08)",
    border: "1px solid rgba(56,189,248,0.15)",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 8,
  },
  inviteRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    flexWrap: "wrap",
  },
  memberRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    flexWrap: "wrap",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(56,189,248,0.18)",
    border: "1px solid rgba(56,189,248,0.3)",
    display: "grid",
    placeItems: "center",
    color: "#38bdf8",
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#64748b",
    borderRadius: 9,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  copySmallBtn: {
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(56,189,248,0.22)",
    color: "#93c5fd",
    borderRadius: 9,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
    padding: 20,
  },
  modal: {
    background: "#1a1f2e",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 28,
    width: "min(500px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
  },
  rolePreview: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  expandBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "9px 14px",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
    gap: 8,
  },
  permRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    flexWrap: "wrap",
  },
  permBtn: {
    padding: "4px 8px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#64748b",
    whiteSpace: "nowrap",
    transition: "all 0.12s",
  },
  permBtnActive: {
    role:   { background: "rgba(56,189,248,0.18)",  border: "1px solid rgba(56,189,248,0.4)",  color: "#38bdf8"  },
    view:   { background: "rgba(250,204,21,0.18)",  border: "1px solid rgba(250,204,21,0.4)",  color: "#facc15"  },
    manage: { background: "rgba(34,197,94,0.18)",   border: "1px solid rgba(34,197,94,0.4)",   color: "#22c55e"  },
    none:   { background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171"  },
  },
  permBtnActiveDefault: { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd" },

  /* VIP member row */
  memberRowVip: {
    background: "rgba(250,204,21,0.05)",
    border: "1px solid rgba(250,204,21,0.25)",
  },
  avatarVip: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(250,204,21,0.35), rgba(251,146,60,0.25))",
    border: "1.5px solid rgba(250,204,21,0.55)",
    display: "grid",
    placeItems: "center",
    color: "#fbbf24",
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
    position: "relative",
    boxShadow: "0 0 10px rgba(250,204,21,0.25)",
  },
  avatarVipStar: {
    position: "absolute",
    bottom: -4,
    right: -4,
    fontSize: 10,
    lineHeight: 1,
  },
  vipActiveBtn: {
    background: "rgba(250,204,21,0.14)",
    border: "1px solid rgba(250,204,21,0.4)",
    color: "#fbbf24",
  },
};

/* ─── VIP badge component ───────────────────────────────────── */
function VipBadge() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 1,
      textTransform: "uppercase",
      background: "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(251,146,60,0.16))",
      border: "1px solid rgba(250,204,21,0.45)",
      color: "#fbbf24",
      boxShadow: "0 0 8px rgba(250,204,21,0.2)",
    }}>
      ⭐ VIP
    </span>
  );
}

/* ─── Promo code styles ─────────────────────────────────────── */
const promoStyles = {
  redeemedBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.25)",
    color: "#86efac",
    fontSize: 13,
  },
};

const s = {
  tabBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    padding: "14px 0",
    marginBottom: 20,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  tab: {
    borderRadius: 12,
    padding: "9px 20px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "background 0.18s, border-color 0.18s",
    lineHeight: 1.2,
  },
  tabActive: {
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(37,99,235,0.16))",
    border: "1px solid rgba(56,189,248,0.38)",
    color: "#38bdf8",
  },
  tabInactive: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
  },

  panel: { display: "grid", gap: 20 },

  /* profile */
  profileBox:  { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  avatar:      { width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#052e16", fontSize: 26, fontWeight: 950 },
  avatarVip:   { background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#1c1917", border: "2px solid rgba(250,204,21,0.6)", boxShadow: "0 0 20px rgba(250,204,21,0.3)" },
  avatarVipStarOwner: { position: "absolute", bottom: -6, right: -6, fontSize: 18, lineHeight: 1, filter: "drop-shadow(0 0 4px rgba(250,204,21,0.6))" },
  profileName: { margin: 0, color: "white", fontSize: 22, lineHeight: 1.2 },
  profileRole: { margin: "5px 0 0", color: "#94a3b8", lineHeight: 1.35 },
  infoGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  infoItem:    { display: "flex", flexDirection: "column", gap: 6, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8", fontSize: 12 },
  roadmap:     { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  roadmapItem: { display: "flex", flexDirection: "column", gap: 6, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" },

  /* coach */
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" },
  formGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 },
  label:     { color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0, display: "grid", gap: 5 },
  widgetList: { display: "grid", gap: 10 },
  widgetRow: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.25, cursor: "pointer" },
  blocksGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16 },
  block:     { display: "grid", gap: 6, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", lineHeight: 1.35 },

  /* club */
  clubIntro: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, alignItems: "center" },
  clubIntroStats: { display: "grid", gridTemplateColumns: "repeat(3, minmax(80px,1fr))", gap: 10 },
  infoMini: { display: "grid", gap: 5, minWidth: 86, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 11, fontWeight: 900, textTransform: "uppercase" },
  formStack:     { display: "grid", gap: 12 },
  clubLogoBox:   { display: "grid", gridTemplateColumns: "92px minmax(0,1fr)", gap: 14, alignItems: "center", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" },
  clubLogoFrame: { width: 92, height: 92, borderRadius: 18, overflow: "hidden", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(15,23,42,0.7)" },
  clubLogoPreview: { maxWidth: "160%", maxHeight: "160%", objectFit: "contain", transition: "width 0.2s ease, height 0.2s ease" },
  clubLogoFallback: { width: 92, height: 92, borderRadius: 18, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#2563eb,#38bdf8)", color: "white", fontWeight: 950, fontSize: 26 },
  logoSizeControl: { display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 800 },
  clubField:     { display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 },
  progressTrack: { height: 12, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 },
  progressBar:   { height: "100%", borderRadius: 999, background: "linear-gradient(135deg,#22c55e,#38bdf8)", transition: "width 0.4s" },
  checkList:     { display: "grid", gap: 9 },
  checkRow:      { display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "white", cursor: "pointer", textAlign: "left", lineHeight: 1.25 },
  memberList:    { display: "grid", gap: 12 },
  memberCard:    { display: "grid", gridTemplateColumns: "1fr 200px 1fr auto", gap: 12, alignItems: "center", padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
};

/* ─── Notifications Tab ─────────────────────────────────────── */
function NotificationsTab({ appSettings, setAppSettings, sessions = [], matches = [], players = [] }) {
  const { t } = useTranslation();
  const settings = normalizeAppSettings(appSettings);
  const notifSettings = settings.notifications || { enabled: false, remindersEnabled: false };

  const { supported, permission, requestPermission, notify } = useNotifications();

  function updateNotif(patch) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, notifications: { ...(s.notifications || {}), ...patch } };
    });
  }

  async function handleEnable() {
    const result = await requestPermission();
    if (result === "granted") {
      updateNotif({ enabled: true });
      notify({ title: t("pages.settings.notifGranted"), body: t("pages.settings.notifEnabledLabel") });
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(tomorrow.getDate() + 1);

  const tomorrowMatches = matches.filter((m) => { const d = new Date(m.date); return d >= tomorrow && d < dayAfter; });
  const tomorrowSessions = sessions.filter((s) => { const d = new Date(s.date); return d >= tomorrow && d < dayAfter; });
  const injuredPlayers = players.filter((p) => p.status === "Infortunato");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <AppCard>
        <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{t("pages.settings.notifTitle")}</h3>
        <p style={{ color: "#94a3b8", margin: "0 0 18px", fontSize: 14, lineHeight: 1.5 }}>
          Ricevi avvisi per partite imminenti, sedute programmate e stato infortuni — direttamente nel browser o come notifica sul telefono (se aggiungi l&apos;app alla schermata Home).
        </p>

        {!supported ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fca5a5", fontSize: 14 }}>
            {t("pages.settings.notifUnsupported")}
          </div>
        ) : permission === "denied" ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fca5a5", fontSize: 14 }}>
            {t("pages.settings.notifDenied")}
          </div>
        ) : permission === "granted" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", fontSize: 14, display: "flex", gap: 10, alignItems: "center" }}>
              {t("pages.settings.notifGranted")}
            </div>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              <div>
                <strong style={{ fontSize: 14 }}>{t("pages.settings.notifEnabledLabel")}</strong>
                <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 13 }}>Ricevi avvisi per partite, sedute e infortuni il giorno prima</p>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.enabled}
                onChange={(e) => updateNotif({ enabled: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: "#22c55e", cursor: "pointer" }}
              />
            </label>

            {notifSettings.enabled && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (tomorrowMatches.length > 0) {
                    notify({ title: `⚽ ${t("pages.settings.notifMatchTomorrow")}`, body: `${tomorrowMatches[0].opponent}`, tag: "test-match" });
                  } else if (tomorrowSessions.length > 0) {
                    notify({ title: `📋 ${t("pages.settings.notifSessionTomorrow")}`, body: tomorrowSessions[0].title || "Seduta programmata", tag: "test-session" });
                  } else if (injuredPlayers.length > 0) {
                    notify({ title: `🚑 ${t("pages.settings.notifInjuredPlayer")}`, body: injuredPlayers[0].name, tag: "test-injury" });
                  } else {
                    notify({ title: "🔔 CalcioLab", body: "Notifiche funzionanti correttamente!", tag: "test" });
                  }
                }}
              >
                {t("pages.settings.notifBtnTest")}
              </Button>
            )}
          </div>
        ) : (
          <Button onClick={handleEnable}>
            {t("pages.settings.notifBtnEnable")}
          </Button>
        )}
      </AppCard>

      {/* Preview eventi prossimi */}
      <AppCard>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>{t("pages.settings.notifUpcomingTitle")}</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {tomorrowMatches.map((m) => (
            <NotifPreviewRow key={m.id} icon="⚽" title={t("pages.settings.notifMatchTomorrow")} desc={m.opponent || "Avversario"} tone="blue" />
          ))}
          {tomorrowSessions.map((s) => (
            <NotifPreviewRow key={s.id} icon="📋" title={t("pages.settings.notifSessionTomorrow")} desc={s.title || "Seduta"} tone="purple" />
          ))}
          {injuredPlayers.map((p) => (
            <NotifPreviewRow key={p.id} icon="🚑" title={t("pages.settings.notifInjuredPlayer")} desc={p.name} tone="red" />
          ))}
          {tomorrowMatches.length === 0 && tomorrowSessions.length === 0 && injuredPlayers.length === 0 && (
            <p style={{ color: "#475569", fontSize: 14 }}>{t("pages.settings.notifNone")}</p>
          )}
        </div>
      </AppCard>
    </div>
  );
}

function NotifPreviewRow({ icon, title, desc, tone }) {
  const colors = { blue: "#38bdf8", purple: "#a78bfa", red: "#f87171", green: "#22c55e" };
  const color = colors[tone] || "#94a3b8";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: `${color}11`, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <strong style={{ fontSize: 13, color }}>{title}</strong>
        <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 13 }}>{desc}</p>
      </div>
    </div>
  );
}
