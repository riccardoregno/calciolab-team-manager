import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { getCurrentUserRole, isFeatureUnlocked, isRoleAllowed, normalizeAppSettings } from "../../utils/helpers";

const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];

const menuGroups = [
  {
    titleKey: "navigation.groups.home",
    items: [
      { to: "/", labelKey: "navigation.items.dashboard", icon: "🏠", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"] },
      { to: "/onboarding", labelKey: "navigation.items.onboarding", icon: "🚀", roles: managementRoles },
      { to: "/calendar", labelKey: "navigation.items.calendar", icon: "📅", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player"] },
    ],
  },
  {
    titleKey: "navigation.groups.team",
    items: [
      { to: "/players", labelKey: "navigation.items.roster", icon: "👥", roles: coachRoles },
      { to: "/player-compare", labelKey: "navigation.items.playerCompare", icon: "⚡", featureKey: "statistics", roles: coachRoles },
      { to: "/availability", labelKey: "navigation.items.availability", icon: "🩺", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "player"] },
      { to: "/physical-tests", labelKey: "navigation.items.physicalTests", icon: "⏱️", featureKey: "physicalTests", roles: physicalRoles },
      { to: "/physical-workouts", labelKey: "navigation.items.physicalWorkouts", icon: "🏃", featureKey: "physicalWorkouts", roles: physicalRoles },
      { to: "/gps-load", labelKey: "navigation.items.gpsLoad", icon: "📡", featureKey: "physicalTests", roles: physicalRoles },
    ],
  },
  {
    titleKey: "navigation.groups.field",
    items: [
      { to: "/exercises", labelKey: "navigation.items.exercises", icon: "📚", roles: technicalRoles },
      { to: "/trainings", labelKey: "navigation.items.trainings", icon: "📋", roles: technicalRoles },
      { to: "/microcycle", labelKey: "navigation.items.microcycle", icon: "🗓️", roles: technicalRoles },
      { to: "/tactical-board", labelKey: "navigation.items.tacticalBoard", icon: "🧠", roles: technicalRoles },
    ],
  },
  {
    titleKey: "navigation.groups.match",
    items: [
      { to: "/matches", labelKey: "navigation.items.matches", icon: "⚽", roles: coachRoles },
      { to: "/set-plays", labelKey: "navigation.items.setPlays", icon: "📐", roles: technicalRoles },
      { to: "/match-day", labelKey: "navigation.items.matchDay", icon: "📋", featureKey: "matchDay", roles: technicalRoles },
      { to: "/post-match", labelKey: "navigation.items.postMatch", icon: "📝", featureKey: "postMatch", roles: technicalRoles },
      { to: "/opponents", labelKey: "navigation.items.opponents", icon: "🕵️", featureKey: "opponents", roles: technicalRoles },
    ],
  },
  {
    titleKey: "navigation.groups.system",
    items: [
      { to: "/statistics", labelKey: "navigation.items.statistics", icon: "📊", roles: coachRoles },
      { to: "/season-goals", labelKey: "navigation.items.seasonGoals", icon: "🎯", roles: coachRoles },
      { to: "/staff-tasks", labelKey: "navigation.items.staffTasks", icon: "✅", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"] },
      { to: "/staff-chat", labelKey: "navigation.items.staffChat", icon: "💬", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"] },
      { to: "/exports", labelKey: "navigation.items.exports", icon: "🖨️", featureKey: "exports", roles: managementRoles },
      { to: "/premium", labelKey: "navigation.items.premium", icon: "💎", roles: managementRoles },
      { to: "/coach-settings", labelKey: "navigation.items.coach", icon: "🎛️", roles: physicalRoles },
      { to: "/settings", labelKey: "navigation.items.settings", icon: "⚙️", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"] },
    ],
  },
  {
    titleKey: "navigation.groups.club",
    items: [
      { to: "/settings?tab=club", labelKey: "navigation.items.clubProfile", icon: "🏢", roles: managementRoles },
      { to: "/player-portal", labelKey: "navigation.items.playerPortal", icon: "🎽", featureKey: "playerPortal", roles: ["owner", "headCoach", "director", "player"] },
      { to: "/sponsors", labelKey: "navigation.items.sponsors", icon: "🤝", featureKey: "sponsors", roles: ["owner", "director", "sponsor"] },
    ],
  },
];

export default function Sidebar({ appSettings = {}, chatUnread = 0 }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const currentRole = getCurrentUserRole(appSettings);
  const profile = normalizeAppSettings(appSettings).workspaceProfile;
  const managesJuniores = profile.managesJuniores && profile.teamLevel === "prima";

  const junioresiGroup = managesJuniores ? [{
    titleKey: "navigation.groups.juniors",
    items: [
      { to: "/players?gruppo=juniores", labelKey: "navigation.items.juniorRoster", icon: "⚡", roles: coachRoles },
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
                {t("common.coachPlatform")}
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
            <div key={group.titleKey} className="sidebar-group" style={sidebarStyles.group}>
              {!collapsed && <div style={sidebarStyles.groupTitle}>{t(group.titleKey)}</div>}

              <div style={sidebarStyles.groupItems}>
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    locked={Boolean(item.featureKey && !isFeatureUnlocked(item.featureKey, appSettings))}
                    label={t(item.labelKey)}
                    badge={item.to === "/staff-chat" && chatUnread > 0 ? chatUnread : 0}
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
            {t("common.roleView", { role: t(`roles.${currentRole}`) })}
          </>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({ item, collapsed, locked, label, badge = 0 }) {
  return (
    <NavLink
      to={item.to}
      title={collapsed ? label : undefined}
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
        position: "relative",
      })}
    >
      <span style={{ fontSize: 18, position: "relative" }}>
        {item.icon}
        {badge > 0 && collapsed && (
          <span style={sidebarStyles.badgeDot} />
        )}
      </span>
      {!collapsed && <span style={sidebarStyles.linkLabel}>{label}</span>}
      {!collapsed && locked && <span style={sidebarStyles.lockPill}>🔒</span>}
      {!collapsed && badge > 0 && (
        <span style={sidebarStyles.badge}>{badge > 99 ? "99+" : badge}</span>
      )}
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
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: "#ef4444",
    color: "white",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
    lineHeight: 1,
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#ef4444",
    border: "2px solid #0f172a",
    display: "block",
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
