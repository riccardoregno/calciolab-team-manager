import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { createId, getSetupProgress, hasPermission, memberRoles, normalizeAppSettings, normalizeMember } from "../utils/helpers";
import { useTranslation } from "../i18n";

const emptyMember = {
  name: "",
  email: "",
  role: "assistantCoach",
  status: "Invitato",
  linkedPlayerId: "",
  sponsorId: "",
};

export default function ClubSettings({
  appSettings = {},
  setAppSettings,
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = normalizeAppSettings(appSettings);
  const [profile, setProfile] = useState(settings.workspaceProfile);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const isMobile = useIsMobile();
  const setup = getSetupProgress({ players, exercises, sessions, matches, appSettings: settings });
  const incomingProfileKey = JSON.stringify(settings.workspaceProfile || {});

  // Auto-save profile after 600ms of inactivity — skip first render
  const profileMounted = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile((prev) => {
      if (hasProfileContent(prev) || !hasProfileContent(settings.workspaceProfile)) return prev;
      return settings.workspaceProfile;
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

  function saveProfile() {
    setAppSettings?.({
      ...settings,
      workspaceProfile: profile,
    });
  }

  function saveMember(event) {
    event.preventDefault();
    const member = normalizeMember({ ...memberForm, id: createId("member") });

    setAppSettings?.({
      ...settings,
      members: [...settings.members, member],
    });
    setMemberForm(emptyMember);
  }

  function updateMemberRole(memberId, role) {
    setAppSettings?.({
      ...settings,
      members: settings.members.map((member) =>
        String(member.id) === String(memberId) ? { ...member, role } : member
      ),
    });
  }

  function removeMember(memberId) {
    setAppSettings?.({
      ...settings,
      members: settings.members.filter((member) => String(member.id) !== String(memberId)),
    });
  }

  return (
    <div style={clubStyles.page}>
      <PageHeader
        title={t("pages.clubSettings.title")}
        subtitle={t("pages.clubSettings.subtitle")}
        badge={t("pages.clubSettings.badgeConfigured", { percent: setup.percent })}
      />

      <div style={{ ...clubStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <AppCard title={t("pages.clubSettings.profileTitle")} subtitle={t("pages.clubSettings.profileSubtitle")}>
          <div style={clubStyles.formGrid}>
            <Field label={t("pages.clubSettings.fieldClub")}>
              <input value={profile.clubName} onChange={(event) => setProfile({ ...profile, clubName: event.target.value })} style={styles.input} />
            </Field>
            <Field label={t("pages.clubSettings.fieldTeam")}>
              <input value={profile.teamName} onChange={(event) => setProfile({ ...profile, teamName: event.target.value })} style={styles.input} />
            </Field>
            <Field label={t("pages.clubSettings.fieldHomeField")}>
              <input value={profile.homeFieldName || ""} onChange={(event) => setProfile({ ...profile, homeFieldName: event.target.value })} placeholder={t("pages.clubSettings.homeFieldPlaceholder")} style={styles.input} />
            </Field>
            <Field label={t("pages.clubSettings.fieldHomeFieldAddress")}>
              <input value={profile.homeFieldAddress || ""} onChange={(event) => setProfile({ ...profile, homeFieldAddress: event.target.value })} placeholder={t("pages.clubSettings.homeFieldAddressPlaceholder")} style={styles.input} />
            </Field>
            <Field label={t("pages.clubSettings.fieldSurface")}>
              <select value={profile.homeFieldSurface || "Erba naturale"} onChange={(event) => setProfile({ ...profile, homeFieldSurface: event.target.value })} style={styles.input}>
                <option value="Erba naturale">{t("pages.clubSettings.surfaceNatural")}</option>
                <option value="Erba sintetica">{t("pages.clubSettings.surfaceSynthetic")}</option>
                <option value="Ibrido">{t("pages.clubSettings.surfaceHybrid")}</option>
                <option value="Terra">{t("pages.clubSettings.surfaceDirt")}</option>
                <option value="Indoor">{t("pages.clubSettings.surfaceIndoor")}</option>
              </select>
            </Field>
            <Field label={t("pages.clubSettings.fieldCategory")}>
              <select value={profile.category} onChange={(event) => setProfile({ ...profile, category: event.target.value })} style={styles.input}>
                <option value="Prima squadra">{t("pages.clubSettings.catPrima")}</option>
                <option value="Juniores">{t("pages.clubSettings.catJuniores")}</option>
                <option value="Allievi">{t("pages.clubSettings.catAllievi")}</option>
                <option value="Giovanissimi">{t("pages.clubSettings.catGiovanissimi")}</option>
                <option value="Esordienti">{t("pages.clubSettings.catEsordienti")}</option>
              </select>
            </Field>
            <Field label={t("pages.clubSettings.fieldUserRole")}>
              <select value={profile.userRole} onChange={(event) => setProfile({ ...profile, userRole: event.target.value })} style={styles.input}>
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Field label={t("pages.clubSettings.fieldSeasonGoal")}>
              <textarea value={profile.seasonGoal} onChange={(event) => setProfile({ ...profile, seasonGoal: event.target.value })} style={{ ...styles.input, minHeight: 96 }} />
            </Field>
          </div>
          <Button onClick={saveProfile}>{t("pages.clubSettings.saveProfile")}</Button>
        </AppCard>

        <AppCard title={t("pages.clubSettings.progressTitle")} subtitle={t("pages.clubSettings.progressSubtitle")}>
          <div style={clubStyles.progressTrack}>
            <div style={{ ...clubStyles.progressBar, width: `${setup.percent}%` }} />
          </div>
          <div style={clubStyles.checkList}>
            {setup.checks.map((check) => (
              <button key={check.key} onClick={() => navigate(check.path)} style={clubStyles.checkRow}>
                <span>{check.done ? "✓" : "○"}</span>
                <strong>{t(check.labelKey)}</strong>
              </button>
            ))}
          </div>
        </AppCard>
      </div>

      <div style={{ ...clubStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <AppCard title={t("pages.clubSettings.inviteTitle")} subtitle={t("pages.clubSettings.inviteSubtitle")}>
          <form onSubmit={saveMember} style={clubStyles.formGrid}>
            <Field label={t("pages.clubSettings.fieldName")}>
              <input required value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} style={styles.input} />
            </Field>
            <Field label={t("pages.clubSettings.fieldEmail")}>
              <input type="email" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} style={styles.input} />
            </Field>
            <Field label={t("pages.clubSettings.fieldRole")}>
              <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })} style={styles.input}>
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Button type="submit">{t("pages.clubSettings.addMember")}</Button>
          </form>
        </AppCard>

        <AppCard title={t("pages.clubSettings.membersTitle")} subtitle={t("pages.clubSettings.membersSubtitle")}>
          <div style={clubStyles.memberList}>
            {settings.members.length ? (
              settings.members.map((member) => (
                <div key={member.id} style={{ ...clubStyles.memberCard, gridTemplateColumns: isMobile ? "1fr" : "1fr 180px 1fr auto" }}>
                  <div>
                    <Badge tone={member.status === "Attivo" ? "green" : "orange"}>{member.status}</Badge>
                    <h3 style={{ lineHeight: 1.2 }}>{member.name}</h3>
                    <p style={clubStyles.muted}>{member.email || t("pages.clubSettings.emailMissing")}</p>
                  </div>
                  <select value={member.role} onChange={(event) => updateMemberRole(member.id, event.target.value)} style={styles.input}>
                    {Object.entries(memberRoles).map(([key, role]) => (
                      <option key={key} value={key}>{role.label}</option>
                    ))}
                  </select>
                  <div style={clubStyles.permissions}>
                    {["manageSessions", "managePlayers", "manageSponsors", "viewOwnProfile"].map((permission) => (
                      <Badge key={permission} tone={hasPermission(member.role, permission) ? "green" : "orange"}>
                        {t(`pages.clubSettings.perm_${permission}`)}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="danger" onClick={() => removeMember(member.id)}>{t("pages.clubSettings.removeMember")}</Button>
                </div>
              ))
            ) : (
              <p style={clubStyles.muted}>{t("pages.clubSettings.noMembers")}</p>
            )}
          </div>
        </AppCard>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={clubStyles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function hasProfileContent(profile = {}) {
  return [
    profile.clubName && profile.clubName !== "CalcioLab",
    profile.teamName,
    profile.logo,
    profile.homeFieldName,
    profile.homeFieldAddress,
    profile.seasonGoal,
    profile.currentSeason && profile.currentSeason !== "2025/2026",
    profile.homeFieldSurface && profile.homeFieldSurface !== "Erba naturale",
  ].some(Boolean);
}

const clubStyles = {
  page: { display: "grid", gap: 20 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" },
  formGrid: { display: "grid", gap: 12 },
  field: { display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 },
  progressTrack: { height: 12, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 14 },
  progressBar: { height: "100%", borderRadius: 999, background: "linear-gradient(135deg,#22c55e,#38bdf8)" },
  checkList: { display: "grid", gap: 9 },
  checkRow: { display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "white", cursor: "pointer", textAlign: "left", lineHeight: 1.25 },
  memberList: { display: "grid", gap: 12 },
  memberCard: { display: "grid", gridTemplateColumns: "1fr 180px 1fr auto", gap: 12, alignItems: "center", padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  permissions: { display: "flex", gap: 6, flexWrap: "wrap" },
  muted: { color: "#94a3b8", margin: 0, lineHeight: 1.4 },
};
