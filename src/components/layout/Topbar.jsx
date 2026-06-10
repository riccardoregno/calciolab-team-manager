import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { supabase } from "../../lib/supabaseClient";
import { styles } from "../../styles/index.js";
import DevelopmentPlanSwitcher from "./DevelopmentPlanSwitcher";
import DevelopmentRoleSwitcher from "./DevelopmentRoleSwitcher";
import LanguageSelector from "./LanguageSelector";
import { useInAppNotifications } from "../../hooks/useInAppNotifications";

export default function Topbar({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  staffTasks = [],
  chatUnread = 0,
  profile = null,
  developmentPlanPreview = "club",
  onDevelopmentPlanPreviewChange,
  developmentRolePreview = "headCoach",
  onDevelopmentRolePreviewChange,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openProfileMobile, setOpenProfileMobile] = useState(false);
  const [openProfileDesktop, setOpenProfileDesktop] = useState(false);

  const { notifications, unreadCount, isRead, markAllRead, markRead } = useInAppNotifications({
    players, sessions, matches, staffTasks, chatUnread,
  });

  const firstName = profile?.first_name || "Coach";
  const lastName = profile?.last_name || "";
  const initials = `${firstName?.[0] || "C"}${lastName?.[0] || ""}`.toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const playerResults = players
      .filter((p) => `${p.name} ${p.role} ${p.status}`.toLowerCase().includes(q))
      .map((p) => ({
        id: `player-${p.id}`,
        label: p.name,
        meta: t("topbar.resultMeta.player", { role: p.role || t("topbar.resultMeta.undefinedRole") }),
        to: `/players/${p.id}`,
      }));

    const exerciseResults = exercises
      .filter((e) => `${e.title} ${e.category} ${e.objective}`.toLowerCase().includes(q))
      .map((e) => ({
        id: `exercise-${e.id}`,
        label: e.title,
        meta: t("topbar.resultMeta.exercise", { category: e.category || t("topbar.resultMeta.category") }),
        to: "/exercises",
      }));

    const sessionResults = sessions
      .filter((s) => `${s.title} ${s.date} ${s.objective}`.toLowerCase().includes(q))
      .map((s) => ({
        id: `session-${s.id}`,
        label: s.title || t("navigation.items.trainings"),
        meta: t("topbar.resultMeta.session", { date: s.date || t("topbar.resultMeta.undefinedDate") }),
        to: "/trainings",
      }));

    const matchResults = matches
      .filter((m) =>
        `${m.opponent} ${m.date} ${m.competition} ${m.location}`.toLowerCase().includes(q)
      )
      .map((m) => ({
        id: `match-${m.id}`,
        label: m.opponent || t("navigation.items.matches"),
        meta: t("topbar.resultMeta.match", { date: m.date || t("topbar.resultMeta.undefinedDate") }),
        to: "/matches",
      }));

    return [...playerResults, ...exerciseResults, ...sessionResults, ...matchResults].slice(0, 8);
  }, [search, players, exercises, sessions, matches, t]);


  function renderProfileMenu(extraStyle = {}, onClose = () => {}) {
    return (
      <div style={{ ...styles.topbarProfileMenu, ...extraStyle }}>
        <div style={styles.topbarProfileMenuHeader}>
          <strong>
            {firstName} {lastName}
          </strong>
          <span>{profile?.email || t("common.profileCoach")}</span>
        </div>

        <LanguageSelector />

        <Link
          to="/settings"
          style={styles.topbarProfileMenuItem}
          onClick={onClose}
        >
          ⚙️ {t("topbar.settings")}
        </Link>

        <Link
          to="/statistics"
          style={styles.topbarProfileMenuItem}
          onClick={onClose}
        >
          📊 {t("topbar.performanceDashboard")}
        </Link>

        <Link
          to="/players"
          style={styles.topbarProfileMenuItem}
          onClick={onClose}
        >
          👥 {t("topbar.rosterManagement")}
        </Link>

        <Link
          to="/trainings"
          style={styles.topbarProfileMenuItem}
          onClick={onClose}
        >
          🗓️ {t("topbar.planning")}
        </Link>

        <button style={styles.topbarProfileLogout} onClick={handleLogout}>
          {t("topbar.logout")}
        </button>
      </div>
    );
  }

  return (
    <>
    <header className="mobile-only mobile-topbar" style={mobileTopbarStyles.header}>
      <div style={mobileTopbarStyles.brand}>
        <div style={mobileTopbarStyles.logo}>CL</div>
        <div style={{ minWidth: 0 }}>
          <strong style={mobileTopbarStyles.appName}>CalcioLab</strong>
          <span style={mobileTopbarStyles.subtitle}>{t("topbar.title")}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LanguageSelector compact />

        <div style={{ position: "relative" }}>
          <button
            type="button"
            style={mobileTopbarStyles.avatarButton}
            onClick={() => setOpenProfileMobile(!openProfileMobile)}
            aria-label={t("common.profileCoach")}
          >
            {initials}
          </button>

          {openProfileMobile && renderProfileMenu(
            { right: 0, width: "min(280px, calc(100vw - 28px))" },
            () => setOpenProfileMobile(false),
          )}
        </div>
      </div>
    </header>

    <header className="mobile-hide" style={styles.topbar}>
      <div style={styles.topbarLeft}>
        <p style={styles.topbarEyebrow}>{t("topbar.greeting", { name: firstName })}</p>
        <h1 style={styles.topbarTitle}>{t("topbar.title")}</h1>
      </div>

      <div style={styles.topbarActions}>
        <LanguageSelector compact />

        <DevelopmentPlanSwitcher
          value={developmentPlanPreview}
          onChange={onDevelopmentPlanPreviewChange}
        />

        <DevelopmentRoleSwitcher
          value={developmentRolePreview}
          onChange={onDevelopmentRolePreviewChange}
        />

        <div style={styles.topbarSearchWrapper}>
          <div style={styles.topbarSearchBox}>
            <span style={styles.topbarSearchIcon}>⌕</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("topbar.searchPlaceholder")}
              style={styles.topbarSearchInput}
            />
          </div>

          {search && (
            <div style={styles.topbarSearchResults}>
              {results.length > 0 ? (
                results.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={styles.topbarSearchResult}
                    onClick={() => setSearch("")}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.meta}</span>
                  </Link>
                ))
              ) : (
                <div style={styles.topbarSearchEmpty}>{t("common.noResults")}</div>
              )}
            </div>
          )}
        </div>

        <Link to="/trainings" style={styles.topbarPrimaryAction}>
          <span style={styles.topbarPlus}>+</span>
          {t("topbar.newSession")}
        </Link>

        <div style={{ position: "relative" }}>
          <button
            style={styles.topbarIconButton}
            title={t("topbar.notifications")}
            onClick={() => setOpenNotifications(!openNotifications)}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{
                ...styles.topbarNotificationDot,
                width: "auto",
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                padding: "0 4px",
                fontSize: 10,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {openNotifications && (
            <div style={{ ...styles.topbarNotificationsPanel, width: 320, maxHeight: 420, overflowY: "auto" }}>
              <div style={{ ...styles.topbarNotificationsHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{t("topbar.activityCenter")}</strong>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {unreadCount > 0 && (
                    <span style={{ background: "#ef4444", color: "white", borderRadius: 8, padding: "1px 7px", fontSize: 11, fontWeight: 900 }}>
                      {unreadCount}
                    </span>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}
                    >
                      ✓ Leggi tutto
                    </button>
                  )}
                </div>
              </div>

              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={{
                      ...styles.topbarNotificationItem,
                      opacity: isRead(item.id) ? 0.5 : 1,
                      borderLeft: isRead(item.id)
                        ? "3px solid transparent"
                        : item.type === "injury"   ? "3px solid #ef4444"
                        : item.type === "match"    ? "3px solid #fb923c"
                        : item.type === "task"     ? "3px solid #eab308"
                        : item.type === "chat"     ? "3px solid #60a5fa"
                        : "3px solid #22c55e",
                    }}
                    onClick={() => { markRead(item.id); setOpenNotifications(false); }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 18, lineHeight: 1.2 }}>{item.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: 13, color: isRead(item.id) ? "#64748b" : "#e2e8f0" }}>
                          {item.title}
                        </strong>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{item.text}</span>
                      </div>
                      {!isRead(item.id) && (
                        <span style={{ width: 7, height: 7, minWidth: 7, borderRadius: "50%", background: "#3b82f6", marginTop: 5, marginLeft: "auto" }} />
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div style={styles.topbarNotificationEmpty}>{t("common.noUrgentActivity")}</div>
              )}
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            style={styles.topbarProfileButton}
            onClick={() => setOpenProfileDesktop(!openProfileDesktop)}
          >
            <div style={styles.topbarAvatar}>{initials}</div>

            <div style={styles.topbarProfileText}>
              <strong style={styles.topbarProfileName}>
                {firstName} {lastName}
              </strong>
              <span style={styles.topbarProfileRole}>Coach CalcioLab</span>
            </div>

            <span style={styles.topbarChevron}>⌄</span>
          </button>

          {openProfileDesktop && renderProfileMenu(
            {},
            () => setOpenProfileDesktop(false),
          )}
        </div>
      </div>
    </header>
    </>
  );
}

const mobileTopbarStyles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 80,
    height: 50,
    margin: "-2px 0 10px",
    padding: "4px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "rgba(15,17,21,0.94)",
    backdropFilter: "blur(14px)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 13,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #2563eb, #38bdf8)",
    color: "white",
    fontSize: 13,
    fontWeight: 950,
    flexShrink: 0,
  },
  appName: {
    display: "block",
    color: "white",
    fontSize: 16,
    lineHeight: 1.05,
  },
  subtitle: {
    display: "block",
    maxWidth: 210,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 800,
  },
  avatarButton: {
    width: 38,
    height: 38,
    minHeight: 38,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#052e16",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
};
