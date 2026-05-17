import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { supabase } from "../../lib/supabaseClient";
import { styles } from "../../styles/index.js";
import DevelopmentPlanSwitcher from "./DevelopmentPlanSwitcher";
import DevelopmentRoleSwitcher from "./DevelopmentRoleSwitcher";
import LanguageSelector from "./LanguageSelector";

export default function Topbar({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  profile = null,
  developmentPlanPreview = "club",
  onDevelopmentPlanPreviewChange,
  developmentRolePreview = "headCoach",
  onDevelopmentRolePreviewChange,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

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

  const notifications = useMemo(() => {
    const today = new Date();

    const upcomingSessions = sessions
      .filter((s) => s.date && new Date(s.date) >= today)
      .slice(0, 2)
      .map((s) => ({
        id: `session-note-${s.id}`,
        title: s.title || t("topbar.notificationsText.upcomingSession"),
        text: s.date || t("topbar.resultMeta.undefinedDate"),
        to: "/trainings",
      }));

    const upcomingMatches = matches
      .filter((m) => m.date && new Date(m.date) >= today)
      .slice(0, 2)
      .map((m) => ({
        id: `match-note-${m.id}`,
        title: t("topbar.notificationsText.matchVs", { opponent: m.opponent || t("topbar.notificationsText.opponent") }),
        text: m.date || t("topbar.resultMeta.undefinedDate"),
        to: "/matches",
      }));

    const injuredPlayers = players
      .filter((p) => p.status === "Infortunato")
      .slice(0, 2)
      .map((p) => ({
        id: `injury-note-${p.id}`,
        title: t("topbar.notificationsText.injuredPlayer", { name: p.name }),
        text: p.injury || t("topbar.notificationsText.checkPhysicalStatus"),
        to: `/players/${p.id}`,
      }));

    return [...upcomingSessions, ...upcomingMatches, ...injuredPlayers].slice(0, 5);
  }, [sessions, matches, players, t]);

  function renderProfileMenu(extraStyle = {}) {
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
          onClick={() => setOpenProfile(false)}
        >
          ⚙️ {t("topbar.settings")}
        </Link>

        <Link
          to="/statistics"
          style={styles.topbarProfileMenuItem}
          onClick={() => setOpenProfile(false)}
        >
          📊 {t("topbar.performanceDashboard")}
        </Link>

        <Link
          to="/players"
          style={styles.topbarProfileMenuItem}
          onClick={() => setOpenProfile(false)}
        >
          👥 {t("topbar.rosterManagement")}
        </Link>

        <Link
          to="/trainings"
          style={styles.topbarProfileMenuItem}
          onClick={() => setOpenProfile(false)}
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

      <div style={{ position: "relative" }}>
        <button
          type="button"
          style={mobileTopbarStyles.avatarButton}
          onClick={() => setOpenProfile(!openProfile)}
          aria-label={t("common.profileCoach")}
        >
          {initials}
        </button>

        {openProfile && renderProfileMenu({
          right: 0,
          width: "min(280px, calc(100vw - 28px))",
        })}
      </div>
    </header>

    <header className="mobile-hide" style={styles.topbar}>
      <div style={styles.topbarLeft}>
        <p style={styles.topbarEyebrow}>{t("topbar.greeting", { name: firstName })}</p>
        <h1 style={styles.topbarTitle}>{t("topbar.title")}</h1>
      </div>

      <div style={styles.topbarActions}>
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
            {notifications.length > 0 && <span style={styles.topbarNotificationDot} />}
          </button>

          {openNotifications && (
            <div style={styles.topbarNotificationsPanel}>
              <div style={styles.topbarNotificationsHeader}>
                <strong>{t("topbar.activityCenter")}</strong>
                <span>{notifications.length}</span>
              </div>

              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={styles.topbarNotificationItem}
                    onClick={() => setOpenNotifications(false)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
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
            onClick={() => setOpenProfile(!openProfile)}
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

          {openProfile && renderProfileMenu()}
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
    height: 56,
    margin: "-4px 0 16px",
    padding: "6px 0",
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
    width: 38,
    height: 38,
    borderRadius: 14,
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
    fontSize: 17,
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
    width: 42,
    height: 42,
    minHeight: 42,
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#052e16",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
};
