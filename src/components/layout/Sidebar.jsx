import { useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { getCurrentUserRole, isFeatureUnlocked, isRoleAllowed, normalizeAppSettings } from "../../utils/helpers";

const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];
const onboardingRoles = ["owner", "headCoach"];

const primaryMenuGroups = [
  {
    titleKey: "navigation.groups.home",
    items: [
      { to: "/", labelKey: "navigation.items.dashboard", icon: "🏠", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"] },
    ],
  },
  {
    titleKey: "navigation.groups.team",
    items: [
      { to: "/players", label: "Squadra", icon: "👥", roles: coachRoles },
    ],
  },
  {
    titleKey: "navigation.groups.field",
    items: [
      { to: "/trainings", label: "Allenamenti", icon: "📋", roles: technicalRoles },
    ],
  },
  {
    titleKey: "navigation.groups.match",
    items: [
      { to: "/matches", label: "Centro partite", icon: "⚽", roles: coachRoles },
    ],
  },
];

const toolboxGroups = [
  {
    titleKey: "navigation.groups.home",
    items: [
      { to: "/calendar", labelKey: "navigation.items.calendar", icon: "📅", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player"] },
      { to: "/onboarding", labelKey: "navigation.items.onboarding", icon: "🚀", roles: onboardingRoles },
    ],
  },
  {
    titleKey: "navigation.groups.team",
    items: [
      { to: "/availability", labelKey: "navigation.items.availability", icon: "🩺", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "player"] },
      { to: "/player-compare", labelKey: "navigation.items.playerCompare", icon: "⚡", featureKey: "statistics", roles: coachRoles },
      { to: "/season-goals", labelKey: "navigation.items.seasonGoals", icon: "🎯", roles: coachRoles },
      { to: "/physical-tests", labelKey: "navigation.items.physicalTests", icon: "⏱️", featureKey: "physicalTests", roles: physicalRoles },
      { to: "/physical-workouts", labelKey: "navigation.items.physicalWorkouts", icon: "🏃", featureKey: "physicalWorkouts", roles: physicalRoles },
      { to: "/gps-load", labelKey: "navigation.items.gpsLoad", icon: "📡", featureKey: "physicalTests", roles: physicalRoles },
    ],
  },
  {
    titleKey: "navigation.groups.field",
    items: [
      { to: "/attendance-register", labelKey: "navigation.items.attendanceRegister", icon: "🧾", roles: technicalRoles },
      { to: "/exercises", labelKey: "navigation.items.exercises", icon: "📚", roles: technicalRoles },
      { to: "/microcycle", labelKey: "navigation.items.microcycle", icon: "🗓️", roles: technicalRoles },
      { to: "/tactical-board", labelKey: "navigation.items.tacticalBoard", icon: "🧠", roles: technicalRoles },
      { to: "/set-plays", labelKey: "navigation.items.setPlays", icon: "📐", roles: technicalRoles },
      { to: "/opponents", labelKey: "navigation.items.opponents", icon: "🕵️", featureKey: "opponents", roles: technicalRoles },
    ],
  },
  {
    titleKey: "navigation.groups.system",
    items: [
      { to: "/statistics", labelKey: "navigation.items.statistics", icon: "📊", roles: coachRoles },
      { to: "/staff-tasks", labelKey: "navigation.items.staffTasks", icon: "✅", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"] },
      { to: "/staff-chat", labelKey: "navigation.items.staffChat", icon: "💬", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"] },
      { to: "/exports", labelKey: "navigation.items.exports", icon: "🖨️", featureKey: "exports", roles: managementRoles },
      { to: "/premium", labelKey: "navigation.items.premium", icon: "💎", roles: managementRoles },
      { to: "/settings", labelKey: "navigation.items.settings", icon: "⚙️", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"] },
    ],
  },
  {
    titleKey: "navigation.groups.club",
    items: [
      { to: "/sponsors", labelKey: "navigation.items.sponsors", icon: "🤝", featureKey: "sponsors", roles: ["owner", "director", "sponsor"] },
    ],
  },
];

export default function Sidebar({ appSettings = {}, currentRole: currentRoleProp = null, chatUnread = 0, onboardingCompleted = null }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [juniorsOpen, setJuniorsOpen] = useState(false);
  const currentRole = currentRoleProp || getCurrentUserRole(appSettings);
  const normalizedSettings = normalizeAppSettings(appSettings);
  const profile = normalizedSettings.workspaceProfile;
  const managesJuniores = profile.managesJuniores && profile.teamLevel === "prima";
  const shouldHideCompletedOnboarding =
    onboardingCompleted ?? normalizedSettings.onboarding.completed;

  const juniorGroups = managesJuniores ? [{
    titleKey: "navigation.groups.juniors",
    items: [
      { to: "/players?gruppo=juniores", labelKey: "navigation.items.juniorRoster", icon: "⚡", roles: coachRoles },
    ],
  }] : [];

  const visiblePrimaryGroups = getVisibleGroups(primaryMenuGroups, currentRole, shouldHideCompletedOnboarding);
  const visibleToolboxGroups = getVisibleGroups(toolboxGroups, currentRole, shouldHideCompletedOnboarding);
  const visibleJuniorGroups = getVisibleGroups(juniorGroups, currentRole, shouldHideCompletedOnboarding);
  const visibleToolboxCount = visibleToolboxGroups.reduce((total, group) => total + group.items.length, 0);
  const visibleJuniorCount = visibleJuniorGroups.reduce((total, group) => total + group.items.length, 0);

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
              <h2 style={{ margin: 0, fontSize: 26, letterSpacing: 0 }}>
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
          {visiblePrimaryGroups.map((group) => (
            <div key={group.titleKey} className="sidebar-group" style={sidebarStyles.group}>
              {!collapsed && <div style={sidebarStyles.groupTitle}>{t(group.titleKey)}</div>}

              <div style={sidebarStyles.groupItems}>
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    locked={Boolean(item.featureKey && !isFeatureUnlocked(item.featureKey, appSettings))}
                    label={item.label || t(item.labelKey)}
                    badge={item.to === "/staff-chat" && chatUnread > 0 ? chatUnread : 0}
                  />
                ))}
              </div>
            </div>
          ))}

          {visibleToolboxCount > 0 && (
            <div style={sidebarStyles.toolboxWrap}>
              <button
                onClick={() => setToolsOpen((value) => !value)}
                style={{
                  ...sidebarStyles.toolboxButton,
                  justifyContent: collapsed ? "center" : "space-between",
                  padding: collapsed ? "12px 0" : "11px 13px",
                }}
                title={collapsed ? "Altri strumenti" : undefined}
              >
                <span style={sidebarStyles.toolboxButtonLabel}>
                  <span style={{ fontSize: 18 }}>🧰</span>
                  {!collapsed && <span>Altri strumenti</span>}
                </span>
                {!collapsed && (
                  <span style={sidebarStyles.toolboxMeta}>
                    {toolsOpen ? "Chiudi" : `${visibleToolboxCount} voci`}
                    <span style={{ transform: toolsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>⌄</span>
                  </span>
                )}
              </button>

              {!collapsed && toolsOpen && (
                <SidebarToolbox
                  groups={visibleToolboxGroups}
                  appSettings={appSettings}
                  chatUnread={chatUnread}
                  t={t}
                />
              )}
            </div>
          )}

          {visibleJuniorCount > 0 && (
            <div style={sidebarStyles.toolboxWrap}>
              <button
                onClick={() => setJuniorsOpen((value) => !value)}
                style={{
                  ...sidebarStyles.toolboxButton,
                  ...sidebarStyles.juniorsButton,
                  justifyContent: collapsed ? "center" : "space-between",
                  padding: collapsed ? "12px 0" : "11px 13px",
                }}
                title={collapsed ? "Juniores" : undefined}
              >
                <span style={sidebarStyles.toolboxButtonLabel}>
                  <span style={{ fontSize: 18 }}>⚡</span>
                  {!collapsed && <span>Juniores</span>}
                </span>
                {!collapsed && (
                  <span style={sidebarStyles.toolboxMeta}>
                    {juniorsOpen ? "Chiudi" : "Apri"}
                    <span style={{ transform: juniorsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>⌄</span>
                  </span>
                )}
              </button>

              {!collapsed && juniorsOpen && (
                <SidebarToolbox
                  groups={visibleJuniorGroups}
                  appSettings={appSettings}
                  chatUnread={chatUnread}
                  t={t}
                />
              )}
            </div>
          )}
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

function getVisibleGroups(groups, currentRole, shouldHideCompletedOnboarding) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.to === "/onboarding" && shouldHideCompletedOnboarding) return false;
        return isRoleAllowed(currentRole, item.roles);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

function SidebarToolbox({ groups, appSettings, chatUnread, t }) {
  return (
    <div style={sidebarStyles.toolboxPanel}>
      {groups.map((group) => (
        <div key={group.titleKey} style={sidebarStyles.toolboxGroup}>
          <div style={sidebarStyles.toolboxTitle}>{t(group.titleKey)}</div>
          <div style={sidebarStyles.toolboxList}>
            {group.items.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                collapsed={false}
                compact={false}
                locked={Boolean(item.featureKey && !isFeatureUnlocked(item.featureKey, appSettings))}
                label={item.label || t(item.labelKey)}
                badge={item.to === "/staff-chat" && chatUnread > 0 ? chatUnread : 0}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const ROUTE_PREFETCH_MAP = {
  "/":                  () => import("../../pages/Dashboard"),
  "/players":           () => import("../../pages/Players"),
  "/player-compare":    () => import("../../pages/PlayerComparison"),
  "/availability":      () => import("../../pages/Availability"),
  "/trainings":         () => import("../../pages/Trainings"),
  "/attendance-register": () => import("../../pages/AttendanceRegister"),
  "/matches":           () => import("../../pages/Matches"),
  "/calendar":          () => import("../../pages/Calendar"),
  "/statistics":        () => import("../../pages/Statistics"),
  "/physical-tests":    () => import("../../pages/PhysicalTests"),
  "/physical-workouts": () => import("../../pages/PhysicalWorkouts"),
  "/settings":          () => import("../../pages/Settings"),
  "/staff-chat":        () => import("../../pages/StaffChat"),
};

function SidebarLink({ item, collapsed, locked, label, badge = 0, compact = false }) {
  const prefetch = useCallback(() => {
    const loader = ROUTE_PREFETCH_MAP[item.to.split("?")[0]];
    if (loader) loader().catch(() => {});
  }, [item.to]);

  return (
    <NavLink
      to={item.to}
      onMouseEnter={prefetch}
      onFocus={prefetch}
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
        padding: collapsed ? "12px 0" : compact ? "9px 10px" : "11px 13px",
        justifyContent: collapsed ? "center" : "flex-start",
        boxShadow: isActive ? "0 10px 25px rgba(37,99,235,0.35)" : "none",
        position: "relative",
        minWidth: 0,
        borderRadius: compact ? 10 : 14,
      })}
    >
      <span style={{ fontSize: compact ? 15 : 18, position: "relative", flexShrink: 0 }}>
        {item.icon}
        {badge > 0 && collapsed && (
          <span style={sidebarStyles.badgeDot} />
        )}
      </span>
      {!collapsed && <span style={{ ...sidebarStyles.linkLabel, fontSize: compact ? 12 : 13 }}>{label}</span>}
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
    gap: 16,
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
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lockPill: {
    fontSize: 12,
    opacity: 0.82,
  },
  toolboxWrap: {
    display: "grid",
    gap: 10,
    paddingTop: 2,
  },
  toolboxButton: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.72)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  juniorsButton: {
    border: "1px solid rgba(245,158,11,0.18)",
    background: "rgba(245,158,11,0.07)",
    color: "#fde68a",
  },
  toolboxButtonLabel: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
  },
  toolboxMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#94a3b8",
    fontSize: 12,
  },
  toolboxPanel: {
    display: "grid",
    gap: 14,
    padding: "12px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(2,6,23,0.32)",
  },
  toolboxGroup: {
    display: "grid",
    gap: 8,
  },
  toolboxTitle: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  toolboxList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 6,
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
