import { useState } from "react";
import { NavLink } from "react-router-dom";
import { getCurrentUserRole, isFeatureUnlocked, isRoleAllowed, normalizeAppSettings } from "../../utils/helpers";

const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];

const menuGroups = [
  {
    title: "Home",
    items: [
      { to: "/", label: "Dashboard", icon: "🏠", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"] },
      { to: "/onboarding", label: "Onboarding", icon: "🚀", roles: managementRoles },
      { to: "/calendar", label: "Calendario", icon: "📅", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player"] },
    ],
  },
  {
    title: "Squadra",
    items: [
      { to: "/players", label: "Rosa", icon: "👥", roles: coachRoles },
      { to: "/availability", label: "Disponibilità", icon: "🩺", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "player"] },
      { to: "/physical-tests", label: "Test fisici", icon: "⏱️", featureKey: "physicalTests", roles: physicalRoles },
      { to: "/physical-workouts", label: "Lavori fisici", icon: "🏃", featureKey: "physicalWorkouts", roles: physicalRoles },
    ],
  },
  {
    title: "Campo",
    items: [
      { to: "/exercises", label: "Esercizi", icon: "🎯", roles: technicalRoles },
      { to: "/exercise-library", label: "Eserciziario", icon: "📚", roles: technicalRoles },
      { to: "/trainings", label: "Sedute", icon: "📋", roles: technicalRoles },
      { to: "/ai-session-builder", label: "Genera con AI", icon: "✨", featureKey: "aiSessionBuilder", roles: technicalRoles },
      { to: "/tactical-board", label: "Lavagna", icon: "🧠", roles: technicalRoles },
    ],
  },
  {
    title: "Gara",
    items: [
      { to: "/matches", label: "Partite", icon: "⚽", roles: coachRoles },
      { to: "/match-day", label: "Match Day", icon: "📋", featureKey: "matchDay", roles: technicalRoles },
      { to: "/post-match", label: "Post gara", icon: "📝", featureKey: "postMatch", roles: technicalRoles },
      { to: "/opponents", label: "Avversari", icon: "🕵️", featureKey: "opponents", roles: technicalRoles },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/statistics", label: "Statistiche", icon: "📊", roles: coachRoles },
      { to: "/exports", label: "Export", icon: "🖨️", featureKey: "exports", roles: managementRoles },
      { to: "/premium", label: "Premium", icon: "💎", roles: managementRoles },
      { to: "/coach-settings", label: "Coach", icon: "🎛️", roles: physicalRoles },
      { to: "/settings", label: "Impostazioni", icon: "⚙️", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"] },
    ],
  },
  {
    title: "Club",
    items: [
      { to: "/settings?tab=club", label: "Profilo società", icon: "🏢", roles: managementRoles },
      { to: "/player-portal", label: "Area giocatori", icon: "🎽", featureKey: "playerPortal", roles: ["owner", "headCoach", "director", "player"] },
      { to: "/sponsors", label: "Sponsor", icon: "🤝", featureKey: "sponsors", roles: ["owner", "director", "sponsor"] },
    ],
  },
];

export default function Sidebar({ appSettings = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const currentRole = getCurrentUserRole(appSettings);
  const profile = normalizeAppSettings(appSettings).workspaceProfile;
  const managesJuniores = profile.managesJuniores && profile.teamLevel === "prima";

  const junioresiGroup = managesJuniores ? [{
    title: "Juniores",
    items: [
      { to: "/players?gruppo=juniores", label: "Rosa Juniores", icon: "⚡", roles: coachRoles },
    ],
  }] : [];

  const allGroups = [...menuGroups, ...junioresiGroup];

  const visibleGroups = allGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isRoleAllowed(currentRole, item.roles)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 92 : 286,
        minWidth: collapsed ? 92 : 286,
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0f172a 0%, #080b12 100%)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: collapsed ? "24px 14px" : "28px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "12px 0 40px rgba(0,0,0,0.25)",
        transition: "all 0.25s ease",
        position: "sticky",
        top: 0,
      }}
    >
      <div>
        <div
          className="sidebar-brand"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            marginBottom: 26,
            gap: 12,
          }}
        >
          {!collapsed && (
            <div>
              <h2 style={{ margin: 0, fontSize: 26, letterSpacing: -0.5 }}>
                ⚽ CalcioLab
              </h2>
              <p style={{ color: "#94a3b8", marginTop: 6, marginBottom: 0 }}>
                Coach Platform
              </p>
            </div>
          )}

          {collapsed && (
            <div style={{ fontSize: 28 }} title="CalcioLab">
              ⚽
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={sidebarStyles.collapseButton}
            title={collapsed ? "Espandi menu" : "Comprimi menu"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="sidebar-nav" style={sidebarStyles.nav}>
          {visibleGroups.map((group) => (
            <div key={group.title} className="sidebar-group" style={sidebarStyles.group}>
              {!collapsed && <div style={sidebarStyles.groupTitle}>{group.title}</div>}

              <div style={sidebarStyles.groupItems}>
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    locked={Boolean(item.featureKey && !isFeatureUnlocked(item.featureKey, appSettings))}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer" style={collapsed ? sidebarStyles.footerCollapsed : sidebarStyles.footer}>
        {collapsed ? "MVP" : (
          <>
            <strong style={{ color: "#fff" }}>Workspace Coach</strong>
            <br />
            Vista ruolo: {roleLabels[currentRole] || "Coach"}
          </>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({ item, collapsed, locked }) {
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        ...sidebarStyles.link,
        color: isActive ? "#ffffff" : "#cbd5e1",
        background: isActive
          ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
          : "rgba(255,255,255,0.035)",
        border: isActive
          ? "1px solid rgba(147,197,253,0.6)"
          : "1px solid rgba(255,255,255,0.07)",
        padding: collapsed ? "12px 0" : "11px 13px",
        justifyContent: collapsed ? "center" : "flex-start",
        boxShadow: isActive ? "0 10px 25px rgba(37,99,235,0.35)" : "none",
      })}
    >
      <span style={{ fontSize: 18 }}>{item.icon}</span>
      {!collapsed && <span style={sidebarStyles.linkLabel}>{item.label}</span>}
      {!collapsed && locked && <span style={sidebarStyles.lockPill}>🔒</span>}
    </NavLink>
  );
}

const sidebarStyles = {
  collapseButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxHeight: "calc(100vh - 190px)",
    overflowY: "auto",
    paddingRight: 4,
  },
  group: {
    display: "grid",
    gap: 8,
  },
  groupTitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    padding: "0 4px",
  },
  groupItems: {
    display: "grid",
    gap: 8,
  },
  link: {
    textDecoration: "none",
    borderRadius: 14,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 11,
    transition: "all 0.25s ease",
  },
  linkLabel: {
    flex: 1,
  },
  lockPill: {
    fontSize: 12,
    opacity: 0.82,
  },
  footer: {
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
  },
  footerCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 16,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.25)",
    color: "#86efac",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    margin: "0 auto",
  },
};

const roleLabels = {
  owner: "Owner",
  headCoach: "Allenatore",
  assistantCoach: "Assistente",
  athleticTrainer: "Preparatore",
  director: "Dirigente",
  player: "Giocatore",
  sponsor: "Sponsor",
};
