import { useNavigationFavorites } from "../../hooks/useNavigationFavorites";
import { searchNavigationItems } from "../../utils/navigationSearch";
import FavoriteButton from "./FavoriteButton";
import { theme } from "../../styles/theme";
import { useState, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { navigationAccent, navigationItemIsActive } from "../../constants/navigationAppearance";
import { ChevronDown, ChevronLeft, ChevronRight, LockKeyhole, Wrench } from "lucide-react";
import { primaryMenuGroups, toolboxGroups, juniorNavigationItems } from "../../constants/navigation";
import { useTranslation } from "../../i18n";
import { getCurrentUserRole, isFeatureUnlocked, isRoleAllowed, normalizeAppSettings } from "../../utils/helpers";

export default function Sidebar({ appSettings = {}, currentRole: currentRoleProp = null, chatUnread = 0, onboardingCompleted = null, navigationKey = "local" }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const { favorites, toggleFavorite, limit, persistent } = useNavigationFavorites(navigationKey);
  const [collapsed, setCollapsed] = useState(false);
  const [toolsOpenOverride, setToolsOpen] = useState(null);
  const currentRole = currentRoleProp || getCurrentUserRole(appSettings);
  const normalizedSettings = normalizeAppSettings(appSettings);
  const shouldHideCompletedOnboarding =
    onboardingCompleted ?? normalizedSettings.onboarding.completed;

  const juniorItems = juniorNavigationItems(normalizedSettings);
  const juniorGroups = juniorItems.length ? [{ titleKey: "navigation.groups.juniors", items: juniorItems }] : [];

  const visiblePrimaryGroups = getVisibleGroups(primaryMenuGroups, currentRole, shouldHideCompletedOnboarding);
  const visibleToolboxGroups = getVisibleGroups([...toolboxGroups, ...juniorGroups], currentRole, shouldHideCompletedOnboarding);
  const visibleToolboxCount = visibleToolboxGroups.reduce((total, group) => total + group.items.length, 0);
  const visibleToolboxAreas = visibleToolboxGroups.length;
  const toolsOpen = toolsOpenOverride ?? visibleToolboxGroups.some((group) => group.items.some((item) => navigationItemIsActive(item, location)));

  const allItems = [...new Map([...visiblePrimaryGroups, ...visibleToolboxGroups].flatMap((group) => group.items).map((item) => [item.to, item])).values()];
  const labelFor = (item) => item.label || t(item.labelKey);
  const searchedItems = searchNavigationItems(allItems, search, labelFor);
  const favoriteItems = favorites.map((path) => allItems.find((item) => item.to === path)).filter(Boolean);
  const favoriteProps = { favorites, onToggleFavorite: (path) => toggleFavorite(path, allItems.map((item) => item.to)), favoriteLimit: favoriteItems.length >= limit };
  const shortcutItems = search.trim() ? searchedItems : favoriteItems;

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 84 : 256,
        minWidth: collapsed ? 84 : 256,
        height: "100dvh",
        background: "radial-gradient(ellipse at top left, rgba(59,130,246,0.09), transparent 48%), #0e1724",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: collapsed ? "24px 12px" : "26px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        boxShadow: "none",
        transition: "all 0.25s ease",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <img src="/favicon.svg" alt="" style={{ width: 36, height: 36 }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 22, letterSpacing: 0 }}>CalcioLab</h2>
              <p style={{ color: "#94a3b8", marginTop: 6, marginBottom: 0 }}>
                {t("common.coachPlatform")}
              </p>
              </div>
            </div>
          )}

          {collapsed && (
            <img src="/favicon.svg" alt="CalcioLab" style={{ width: 38, height: 38 }} />
          )}

          <button
            onClick={() => { setCollapsed(!collapsed); setSearch(""); }}
            style={sidebarStyles.collapseButton}
            title={collapsed ? "Espandi menu" : "Comprimi menu"}
            aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <nav className="sidebar-nav" style={sidebarStyles.nav}>
          {!collapsed && <>
            <label style={{ display: "grid", gap: 7, color: "#94a3b8", fontSize: 11 }}>
              <span>{t("navigationPrefs.searchLabel")}</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("navigationPrefs.searchPlaceholder")}
                style={{ width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(148,163,184,.2)", background: "rgba(255,255,255,.04)", color: "#e2e8f0", fontSize: 13 }} />
            </label>
            <div style={{ display: "grid", gap: 5 }}>
              <strong style={sidebarStyles.groupTitle}>{t(search.trim() ? "navigationPrefs.results" : "navigationPrefs.favorites")}</strong>
              {!shortcutItems.length && <small style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>{t(search.trim() ? "navigationPrefs.noResults" : "navigationPrefs.empty")}</small>}
              {shortcutItems.map((item) => <SidebarLink key={item.to} item={item} label={labelFor(item)} compact locked={Boolean(item.featureKey && !isFeatureUnlocked(item.featureKey, appSettings))}
                onNavigate={() => setSearch("")} {...favoriteProps} />)}
              {!persistent && <small role="status" style={{ color: "#f2c47d" }}>{t("navigationPrefs.temporary")}</small>}
            </div>
          </>}
          {!search.trim() && <>
          {visiblePrimaryGroups.map((group) => (
            <div key={group.titleKey} className="sidebar-group" style={sidebarStyles.group}>
              {!collapsed && <div style={{ ...sidebarStyles.groupTitle, color: navigationAccent(group.titleKey).color }}>{t(group.titleKey)}</div>}

              <div style={sidebarStyles.groupItems}>
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    {...favoriteProps}
                    accent={navigationAccent(group.titleKey)}
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
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setToolsOpen(true); }
                  else setToolsOpen(!toolsOpen);
                }}
                aria-expanded={!collapsed && toolsOpen}
                aria-controls="sidebar-toolbox"
                style={{
                  ...sidebarStyles.toolboxButton,
                  justifyContent: collapsed ? "center" : "space-between",
                  padding: collapsed ? "12px 0" : "11px 13px",
                }}
                title={collapsed ? "Altri strumenti" : undefined}
              >
                <span style={sidebarStyles.toolboxButtonLabel}>
                  <Wrench size={18} />
                  {!collapsed && <span>Altri strumenti</span>}
                </span>
                {!collapsed && (
                  <span style={sidebarStyles.toolboxMeta}>
                    {!toolsOpen && `${visibleToolboxAreas} aree`}
                    <ChevronDown size={15} style={{ transform: toolsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                  </span>
                )}
              </button>

              {!collapsed && toolsOpen && (
                <SidebarToolbox
                  groups={visibleToolboxGroups}
                  {...favoriteProps}
                  appSettings={appSettings}
                  chatUnread={chatUnread}
                  t={t}
                />
              )}
            </div>
          )}
          </>}
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

function SidebarToolbox({ groups, appSettings, chatUnread, t, ...favoriteProps }) {
  const [openGroups, setOpenGroups] = useState({});
  const location = useLocation();

  return (
    <div id="sidebar-toolbox" style={sidebarStyles.toolboxPanel}>
      {groups.map((group) => {
        const open = openGroups[group.titleKey] ?? group.items.some((item) => navigationItemIsActive(item, location));
        const panelId = `sidebar-tools-${group.titleKey.split(".").at(-1)}`;
        return (
        <div key={group.titleKey} style={sidebarStyles.toolboxGroup}>
          <button
            type="button"
            onClick={() => setOpenGroups((prev) => ({ ...prev, [group.titleKey]: !open }))}
            aria-expanded={open}
            aria-controls={panelId}
            style={{ ...sidebarStyles.toolboxGroupButton, color: navigationAccent(group.titleKey).color }}
          >
            <span>{t(group.titleKey)}</span>
            <span style={sidebarStyles.toolboxGroupMeta}>
              {group.items.length}
              <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
            </span>
          </button>

          {open && (
            <div id={panelId} style={sidebarStyles.toolboxList}>
              {group.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  collapsed={false}
                  {...favoriteProps}
                  compact
                  accent={navigationAccent(group.titleKey)}
                  locked={Boolean(item.featureKey && !isFeatureUnlocked(item.featureKey, appSettings))}
                  label={item.label || t(item.labelKey)}
                  badge={item.to === "/staff-chat" && chatUnread > 0 ? chatUnread : 0}
                />
              ))}
            </div>
          )}
        </div>
      ); })}
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

function SidebarLink({ item, collapsed, locked, label, badge = 0, compact = false, accent = navigationAccent(), favorites = [], onToggleFavorite, favoriteLimit = false, onNavigate }) {
  const Icon = item.icon;
  const prefetch = useCallback(() => {
    const loader = ROUTE_PREFETCH_MAP[item.to.split("?")[0]];
    if (loader) loader().catch(() => {});
  }, [item.to]);

  return (
    <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: 2 }}>
    <NavLink
      to={item.to}
      className="sidebar-navigation-link"
      onClick={onNavigate}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        ...sidebarStyles.link,
        flex: 1,
        color: isActive ? "#ffffff" : "#cbd5e1",
        background: isActive
          ? `linear-gradient(100deg, ${accent.soft}, rgba(255,255,255,0.025))`
          : "transparent",
        border: isActive
          ? "1px solid rgba(96,165,250,0.24)"
          : "1px solid transparent",
        padding: collapsed ? "12px 0" : compact ? "9px 10px" : "11px 13px",
        justifyContent: collapsed ? "center" : "flex-start",
        boxShadow: isActive ? `inset 3px 0 0 ${accent.color || theme.colors.primary}` : "none",
        position: "relative",
        minWidth: 0,
        borderRadius: 10,
        minHeight: compact ? 40 : 48,
      })}
    >
      <span style={{ width: compact ? 25 : 32, height: compact ? 25 : 32, borderRadius: 9, background: accent.soft, color: accent.color, position: "relative", flexShrink: 0, display: "grid", placeItems: "center" }}>
        <Icon size={compact ? 16 : 19} strokeWidth={2.1} aria-hidden="true" />
        {badge > 0 && collapsed && (
          <span style={sidebarStyles.badgeDot} />
        )}
      </span>
      {!collapsed && <span style={{ ...sidebarStyles.linkLabel, fontSize: compact ? 12 : 13 }}>{label}</span>}
      {!collapsed && locked && <LockKeyhole size={13} style={sidebarStyles.lockPill} aria-label="Funzione Premium" />}
      {!collapsed && badge > 0 && (
        <span style={sidebarStyles.badge}>{badge > 99 ? "99+" : badge}</span>
      )}
    </NavLink>
    {!collapsed && onToggleFavorite && <FavoriteButton active={favorites.includes(item.to)} label={label} onToggle={() => onToggleFavorite(item.to)} disabled={favoriteLimit} />}
    </div>
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
    fontWeight: 700,
    display: "grid",
    placeItems: "center",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 4,
  },
  group: {
    display: "grid",
    gap: 8,
  },
  groupTitle: {
    color: "#94a6be",
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
    borderRadius: 8,
    fontWeight: 650,
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
    fontSize: 13,
    lineHeight: 1.3,
    width: "100%",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.72)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  toolboxButtonLabel: {
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
    flex: 1,
  },
  toolboxMeta: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: "#94a3b8",
    fontSize: 11,
  },
  toolboxPanel: {
    display: "grid",
    gap: 4,
    padding: "0 0 0 9px",
    borderLeft: "1px solid rgba(148,163,184,0.16)",
  },
  toolboxGroup: {
    display: "grid",
    gap: 6,
  },
  toolboxGroupButton: {
    width: "100%",
    minHeight: 40,
    borderRadius: 0,
    border: 0,
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    background: "transparent",
    color: "#cbd5e1",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  toolboxGroupMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#94a3b8",
    fontSize: 11,
  },
  toolboxList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 6,
    paddingBottom: 8,
  },
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "14px 4px 0",
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
