import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";
import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import AuthPanel from "../auth/AuthPanel";
import { styles } from "../../styles/index.js";
import { normalizeAppSettings } from "../../utils/helpers";
import { useTranslation } from "../../i18n";
import { sharedStyles, acctStyles } from "../../styles/settings";
import { VipBadge, InfoItem, RoadmapItem, RedeemPromoCard } from "./SettingsElements";

export function AccountTab({ authConfigured, authLoading, user, team, authError, storageSource, appSettings = {}, showToast }) {
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
    <div style={sharedStyles.panel}>
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

          <div style={sharedStyles.profileBox}>
            <div style={{ position: "relative" }}>
              <div style={isVipOwner ? { ...sharedStyles.avatar, ...sharedStyles.avatarVip } : sharedStyles.avatar}>{avatarInitial}</div>
              {isVipOwner && <span style={sharedStyles.avatarVipStarOwner}>⭐</span>}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={sharedStyles.profileName}>{fullName}</h2>
                {isVipOwner && <VipBadge />}
              </div>
              <p style={sharedStyles.profileRole}>{user?.email || "—"}</p>
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

          <div style={sharedStyles.infoGrid}>
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
                aria-label={showPwd.current ? t("common.hidePassword") : t("common.showPassword")}
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
                aria-label={showPwd.next ? t("common.hidePassword") : t("common.showPassword")}
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
                aria-label={showPwd.confirm ? t("common.hidePassword") : t("common.showPassword")}
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
        <div style={sharedStyles.roadmap}>
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
