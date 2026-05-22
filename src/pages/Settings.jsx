import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  memberRoles,
  normalizeAppSettings,
  normalizePromoCode,
} from "../utils/helpers";
import { useAppSettings } from "../hooks/useAppSettings";
import { useNotifications } from "../hooks/useNotifications";
import { useTranslation } from "../i18n";

/* ─── tab list ─────────────────────────────────────────────── */
const TABS = [
  { key: "account",       labelKey: "pages.settings.account" },
  { key: "coach",         labelKey: "pages.settings.coachParams" },
  { key: "club",          labelKey: "pages.settings.clubProfile" },
  { key: "notifications", labelKey: "pages.settings.notifications" },
];

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
  { key: "players",    label: "Rosa",         icon: "👥" },
  { key: "sessions",   label: "Allenamenti",  icon: "📋" },
  { key: "matches",    label: "Partite",      icon: "⚽" },
  { key: "physical",   label: "Test fisici",  icon: "📊" },
  { key: "statistics", label: "Statistiche",  icon: "📈" },
  { key: "setPlays",   label: "Schemi",       icon: "🎯" },
  { key: "calendar",   label: "Calendario",   icon: "📅" },
];

const AREA_ACCESS_LABELS = {
  role:   "Ruolo",
  view:   "Solo lettura",
  manage: "Lett. + scrittura",
  none:   "Nessun accesso",
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
        {TABS.map((tab) => {
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
function AccountTab({ authConfigured, authLoading, user, team, authError, storageSource }) {
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
            <div style={s.avatar}>{avatarInitial}</div>
            <div>
              <h2 style={s.profileName}>{fullName}</h2>
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

function ClubTab({ appSettings, setAppSettings, players = [], exercises = [], sessions = [], matches = [] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = normalizeAppSettings(appSettings) || {};
  const rawProfile = settings.workspaceProfile || {};
  const [profile, setProfile] = useState({ ...DEFAULT_WORKSPACE_PROFILE, ...rawProfile });
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "assistantCoach", customAreas: {} });
  const [showCustomPerms, setShowCustomPerms] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Genera (o recupera) il token invito del team
  const inviteToken = settings.inviteToken || null;

  function generateInviteToken() {
    const token = createId("invite").replace("invite-", "");
    setAppSettings?.({ ...settings, inviteToken: token });
    return token;
  }

  function getInviteLink(token) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://calciolab.app";
    return `${base}/join?token=${token}`;
  }

  function copyInviteLink() {
    const token = inviteToken || generateInviteToken();
    const link = getInviteLink(token);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2500);
      });
    }
  }

  function sendInvite(e) {
    e.preventDefault();
    if (!inviteForm.email) return;
    const token = inviteToken || generateInviteToken();
    const pending = {
      id:          createId("invite"),
      name:        inviteForm.name,
      email:       inviteForm.email,
      role:        inviteForm.role,
      customAreas: inviteForm.customAreas,
      status:      "In attesa",
      token,
      sentAt:      new Date().toISOString(),
    };
    const currentInvites = settings.pendingInvites || [];
    setAppSettings?.({ ...settings, pendingInvites: [...currentInvites, pending] });
    setInviteForm({ email: "", name: "", role: "assistantCoach", customAreas: {} });
    setShowCustomPerms(false);
    setInviteModal(false);
    // TODO go-live: chiamare Edge Function che invia l'email con il link
  }

  function cancelInvite(id) {
    const currentInvites = settings.pendingInvites || [];
    setAppSettings?.({ ...settings, pendingInvites: currentInvites.filter((i) => i.id !== id) });
  }

  // getSetupProgress è safe solo se helpers è caricato — usiamo try/catch per sicurezza
  let setup = { percent: 0, checks: [], completed: 0, total: 0, next: null };
  try {
    setup = getSetupProgress({ players, exercises, sessions, matches, appSettings: settings });
  } catch {
    // silently use default
  }

  function saveProfile() {
    setAppSettings?.({ ...settings, workspaceProfile: profile });
  }

  function handleClubLogoUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  function updateMemberRole(memberId, role) {
    const currentMembers = settings.members || [];
    setAppSettings?.({
      ...settings,
      members: currentMembers.map((m) =>
        String(m.id) === String(memberId) ? { ...m, role } : m
      ),
    });
  }

  function removeMember(memberId) {
    const currentMembers = settings.members || [];
    setAppSettings?.({
      ...settings,
      members: currentMembers.filter((m) => String(m.id) !== String(memberId)),
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
                <strong>{check.label}</strong>
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
            <Button onClick={() => setInviteModal(true)}>
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

        {/* Inviti in attesa */}
        {(settings.pendingInvites || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#64748b", margin: "0 0 10px", letterSpacing: 0.5 }}>
              {t("pages.settings.clubPendingInvites", { count: (settings.pendingInvites || []).length })}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {(settings.pendingInvites || []).map((inv) => (
                <div key={inv.id} style={inviteStyles.inviteRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13 }}>{inv.name || inv.email}</strong>
                      <Badge tone="orange">{memberRoles[inv.role]?.label || inv.role}</Badge>
                      <Badge tone="blue">In attesa</Badge>
                    </div>
                    <p style={{ color: "#64748b", margin: "3px 0 0", fontSize: 12 }}>{inv.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelInvite(inv.id)}
                    style={inviteStyles.cancelBtn}
                  >
                    {t("pages.settings.clubBtnCancel")}
                  </button>
                </div>
              ))}
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
                <div key={member.id} style={inviteStyles.memberRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={inviteStyles.avatar}>
                        {(member.name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, lineHeight: 1.2 }}>{member.name}</strong>
                        <p style={{ color: "#64748b", margin: 0, fontSize: 12 }}>{member.email || "Email non inserita"}</p>
                      </div>
                    </div>
                  </div>
                  <select
                    value={member.role}
                    onChange={(e) => updateMemberRole(member.id, e.target.value)}
                    style={{ ...styles.input, marginTop: 0, width: "auto", minWidth: 140 }}
                  >
                    {Object.entries(memberRoles).map(([key, role]) => (
                      <option key={key} value={key}>{role.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    style={inviteStyles.cancelBtn}
                  >
                    {t("pages.settings.clubBtnRemove")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!(settings.members || []).length && !(settings.pendingInvites || []).length && (
          <p style={{ color: "#475569", fontSize: 13, margin: "16px 0 0" }}>
            {t("pages.settings.clubNoMembers")}
          </p>
        )}
      </AppCard>

      {/* ── Codici promo / accesso founder ── */}
      <PromoCodesCard appSettings={appSettings} setAppSettings={setAppSettings} />

      {/* ── Modale invito ── */}
      {inviteModal && (
        <div style={inviteStyles.overlay} onClick={() => setInviteModal(false)}>
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
                  <span>🔧 Personalizza accessi per area</span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{showCustomPerms ? "▲" : "▼"}</span>
                </button>

                {showCustomPerms && (
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
                      Imposta un accesso specifico per ogni area. <strong style={{ color: "#93c5fd" }}>Basato sul ruolo</strong> usa i permessi predefiniti del ruolo scelto.
                    </p>
                    {PERMISSION_AREAS.map((area) => {
                      const val = inviteForm.customAreas[area.key] || "role";
                      return (
                        <div key={area.key} style={inviteStyles.permRow}>
                          <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>{area.icon}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{area.label}</span>
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
                                {AREA_ACCESS_LABELS[level]}
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
                <button type="button" onClick={() => setInviteModal(false)} style={inviteStyles.cancelBtn}>
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
   Promo Codes — founder/developer permanent access codes
═══════════════════════════════════════════════════════════════ */
function PromoCodesCard({ appSettings, setAppSettings }) {
  const settings = normalizeAppSettings(appSettings);
  const codes = settings.promoCodes || [];
  const redeemed = settings.redeemedPromo || null;

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: "", plan: "club", permanent: true, maxUses: 1, note: "" });
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemFeedback, setRedeemFeedback] = useState(null);

  function createCode(e) {
    e.preventDefault();
    if (!form.code.trim()) return;
    const newCode = normalizePromoCode({
      code:      form.code.trim().toUpperCase(),
      plan:      form.plan,
      permanent: form.permanent,
      maxUses:   Number(form.maxUses) || 0,
      note:      form.note,
    });
    setAppSettings({ ...settings, promoCodes: [...codes, newCode] });
    setForm({ code: "", plan: "club", permanent: true, maxUses: 1, note: "" });
    setShowCreate(false);
  }

  function deleteCode(id) {
    setAppSettings({ ...settings, promoCodes: codes.filter((c) => c.id !== id) });
  }

  function redeemCode(e) {
    e.preventDefault();
    setRedeemFeedback(null);
    const input = redeemInput.trim().toUpperCase();
    const found = codes.find((c) => c.code === input);
    if (!found) {
      setRedeemFeedback({ ok: false, text: "Codice non trovato o non valido." });
      return;
    }
    if (!found.permanent && found.expiresAt && new Date(found.expiresAt) < new Date()) {
      setRedeemFeedback({ ok: false, text: "Questo codice è scaduto." });
      return;
    }
    if (found.maxUses > 0 && found.uses >= found.maxUses) {
      setRedeemFeedback({ ok: false, text: "Questo codice ha raggiunto il limite di utilizzi." });
      return;
    }
    // Mark code as used and apply plan
    const updatedCodes = codes.map((c) =>
      c.id === found.id ? { ...c, uses: c.uses + 1 } : c
    );
    const redeemedPromo = {
      code:       found.code,
      plan:       found.plan,
      permanent:  found.permanent,
      redeemedAt: new Date().toISOString(),
    };
    setAppSettings({
      ...settings,
      promoCodes: updatedCodes,
      redeemedPromo,
      subscription: {
        ...settings.subscription,
        plan:          found.plan,
        billingStatus: "active",
      },
    });
    setRedeemFeedback({ ok: true, text: `✓ Codice applicato! Piano ${found.plan.toUpperCase()} attivato.` });
    setRedeemInput("");
  }

  const planColors = { premium: "#38bdf8", club: "#a78bfa" };

  return (
    <AppCard>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h3 style={{ margin: 0, lineHeight: 1.2 }}>🎟️ Codici accesso</h3>
          <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            Crea codici che garantiscono accesso Premium o Club — permanenti o con scadenza.
            Condividili con chi vuoi (staff, partner, fondatori).
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Annulla" : "+ Nuovo codice"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={createCode} style={promoStyles.createForm}>
          <label style={s.label}>
            Codice
            <input
              required
              placeholder="es. FOUNDER2025"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              style={{ ...styles.input, textTransform: "uppercase", letterSpacing: 2 }}
            />
          </label>
          <label style={s.label}>
            Piano
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              style={styles.input}
            >
              <option value="premium">Premium Coach</option>
              <option value="club">Club (massimo accesso)</option>
            </select>
          </label>
          <label style={s.label}>
            Usi massimi
            <input
              type="number"
              min="0"
              placeholder="0 = illimitati"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              style={styles.input}
            />
          </label>
          <label style={{ ...s.label, gridColumn: "1 / -1" }}>
            Nota (opzionale)
            <input
              placeholder="es. Founder access - Papà"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              style={styles.input}
            />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.permanent}
                onChange={(e) => setForm({ ...form, permanent: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: "#22c55e" }}
              />
              <span>Permanente (no scadenza)</span>
            </label>
            <div style={{ flex: 1 }} />
            <Button type="submit">Crea codice</Button>
          </div>
        </form>
      )}

      {/* Codes list */}
      {codes.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: redeemed ? 16 : 0 }}>
          {codes.map((c) => (
            <div key={c.id} style={promoStyles.codeRow}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ ...promoStyles.codeBadge, color: planColors[c.plan] || "#94a3b8", borderColor: (planColors[c.plan] || "#94a3b8") + "40" }}>
                  {c.code}
                </span>
                <div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge tone={c.plan === "club" ? "purple" : "blue"}>{c.plan.toUpperCase()}</Badge>
                    {c.permanent && <Badge tone="green">Permanente</Badge>}
                    {c.maxUses > 0 && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>{c.uses}/{c.maxUses} usi</span>
                    )}
                  </div>
                  {c.note && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>{c.note}</p>}
                </div>
              </div>
              <button type="button" onClick={() => deleteCode(c.id)} style={inviteStyles.cancelBtn}>
                Elimina
              </button>
            </div>
          ))}
        </div>
      )}

      {codes.length === 0 && !showCreate && (
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 16px" }}>Nessun codice creato.</p>
      )}

      {/* Redeem section */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, marginTop: codes.length || showCreate ? 16 : 0 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>
          Riscatta un codice
        </p>
        {redeemed ? (
          <div style={promoStyles.redeemedBox}>
            <span style={{ fontSize: 18 }}>✓</span>
            <div>
              <strong style={{ color: planColors[redeemed.plan] || "#22c55e" }}>
                Codice {redeemed.code} attivo — piano {redeemed.plan.toUpperCase()}
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                Riscattato il {new Date(redeemed.redeemedAt).toLocaleDateString("it-IT")}
                {redeemed.permanent ? " · accesso permanente" : ""}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={redeemCode} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <input
              placeholder="Inserisci il codice..."
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              style={{ ...styles.input, flex: "1 1 200px", letterSpacing: 2, textTransform: "uppercase" }}
            />
            <Button type="submit" variant="ghost">Applica</Button>
          </form>
        )}
        {redeemFeedback && (
          <div style={{ ...acctStyles.feedback, marginTop: 10, ...(redeemFeedback.ok ? acctStyles.feedbackOk : acctStyles.feedbackErr) }}>
            {redeemFeedback.text}
          </div>
        )}
      </div>
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
};

/* ─── Promo code styles ─────────────────────────────────────── */
const promoStyles = {
  createForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 18,
    padding: "16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  codeRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    flexWrap: "wrap",
  },
  codeBadge: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 2,
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid",
    background: "rgba(255,255,255,0.04)",
    flexShrink: 0,
  },
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
    setAppSettings?.({ ...settings, notifications: { ...notifSettings, ...patch } });
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
