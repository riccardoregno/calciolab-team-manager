import { useState } from "react";
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
        subtitle="Ruoli, permessi, configurazione workspace e progresso commerciale del club."
        badge={`${setup.percent}% configurato`}
      />

      <div style={{ ...clubStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <AppCard title="Profilo workspace" subtitle="Identita e obiettivi della societa.">
          <div style={clubStyles.formGrid}>
            <Field label="Societa">
              <input value={profile.clubName} onChange={(event) => setProfile({ ...profile, clubName: event.target.value })} style={styles.input} />
            </Field>
            <Field label="Squadra">
              <input value={profile.teamName} onChange={(event) => setProfile({ ...profile, teamName: event.target.value })} style={styles.input} />
            </Field>
            <Field label="Campo di casa">
              <input value={profile.homeFieldName || ""} onChange={(event) => setProfile({ ...profile, homeFieldName: event.target.value })} placeholder="Es. Centro Sportivo Comunale" style={styles.input} />
            </Field>
            <Field label="Indirizzo campo">
              <input value={profile.homeFieldAddress || ""} onChange={(event) => setProfile({ ...profile, homeFieldAddress: event.target.value })} placeholder="Es. Via Roma 12, Milano" style={styles.input} />
            </Field>
            <Field label="Superficie campo">
              <select value={profile.homeFieldSurface || "Erba naturale"} onChange={(event) => setProfile({ ...profile, homeFieldSurface: event.target.value })} style={styles.input}>
                <option>Erba naturale</option>
                <option>Erba sintetica</option>
                <option>Ibrido</option>
                <option>Terra</option>
                <option>Indoor</option>
              </select>
            </Field>
            <Field label="Categoria">
              <select value={profile.category} onChange={(event) => setProfile({ ...profile, category: event.target.value })} style={styles.input}>
                <option>Prima squadra</option>
                <option>Juniores</option>
                <option>Allievi</option>
                <option>Giovanissimi</option>
                <option>Esordienti</option>
              </select>
            </Field>
            <Field label="Ruolo principale">
              <select value={profile.userRole} onChange={(event) => setProfile({ ...profile, userRole: event.target.value })} style={styles.input}>
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Obiettivo stagione">
              <textarea value={profile.seasonGoal} onChange={(event) => setProfile({ ...profile, seasonGoal: event.target.value })} style={{ ...styles.input, minHeight: 96 }} />
            </Field>
          </div>
          <Button onClick={saveProfile}>Salva profilo Club</Button>
        </AppCard>

        <AppCard title="Progresso configurazione" subtitle="Checklist che guida onboarding e trial.">
          <div style={clubStyles.progressTrack}>
            <div style={{ ...clubStyles.progressBar, width: `${setup.percent}%` }} />
          </div>
          <div style={clubStyles.checkList}>
            {setup.checks.map((check) => (
              <button key={check.key} onClick={() => navigate(check.path)} style={clubStyles.checkRow}>
                <span>{check.done ? "✓" : "○"}</span>
                <strong>{check.label}</strong>
              </button>
            ))}
          </div>
        </AppCard>
      </div>

      <div style={{ ...clubStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <AppCard title="Invita membro" subtitle="Simulazione ruoli pronta per Supabase/RLS.">
          <form onSubmit={saveMember} style={clubStyles.formGrid}>
            <Field label="Nome">
              <input required value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} style={styles.input} />
            </Field>
            <Field label="Email">
              <input type="email" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} style={styles.input} />
            </Field>
            <Field label="Ruolo">
              <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })} style={styles.input}>
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Button type="submit">Aggiungi membro</Button>
          </form>
        </AppCard>

        <AppCard title="Membri e permessi" subtitle="Controlla chi puo' vedere o modificare le aree chiave.">
          <div style={clubStyles.memberList}>
            {settings.members.length ? (
              settings.members.map((member) => (
                <div key={member.id} style={{ ...clubStyles.memberCard, gridTemplateColumns: isMobile ? "1fr" : "1fr 180px 1fr auto" }}>
                  <div>
                    <Badge tone={member.status === "Attivo" ? "green" : "orange"}>{member.status}</Badge>
                    <h3 style={{ lineHeight: 1.2 }}>{member.name}</h3>
                    <p style={clubStyles.muted}>{member.email || "Email non inserita"}</p>
                  </div>
                  <select value={member.role} onChange={(event) => updateMemberRole(member.id, event.target.value)} style={styles.input}>
                    {Object.entries(memberRoles).map(([key, role]) => (
                      <option key={key} value={key}>{role.label}</option>
                    ))}
                  </select>
                  <div style={clubStyles.permissions}>
                    {["manageSessions", "managePlayers", "manageSponsors", "viewOwnProfile"].map((permission) => (
                      <Badge key={permission} tone={hasPermission(member.role, permission) ? "green" : "orange"}>
                        {permission}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="danger" onClick={() => removeMember(member.id)}>Rimuovi</Button>
                </div>
              ))
            ) : (
              <p style={clubStyles.muted}>Nessun membro invitato.</p>
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
