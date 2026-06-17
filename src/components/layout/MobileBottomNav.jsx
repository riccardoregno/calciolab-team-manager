import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { isRoleAllowed } from "../../utils/helpers";
import { supabase } from "../../lib/supabaseClient";

const allRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];
const playerCalendarRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player"];

// ── Voci principali sempre visibili ──────────────────────────────
const PRIMARY = [
  { to: "/",          labelKey: "navigation.mobile.home", icon: "🏠", roles: allRoles },
  { to: "/players",   labelKey: "navigation.mobile.roster", icon: "👥", roles: coachRoles },
  { to: "/trainings", labelKey: "navigation.mobile.trainings", icon: "📋", roles: technicalRoles },
  { to: "/matches",   labelKey: "navigation.mobile.matches", icon: "⚽", roles: coachRoles },
  { to: "/calendar",  labelKey: "navigation.mobile.calendar", icon: "📅", roles: playerCalendarRoles },
];

// ── Voci nel drawer "Altro" ───────────────────────────────────────
const SECONDARY = [
  { to: "/staff-chat",        labelKey: "navigation.items.staffChat",        icon: "💬", roles: coachRoles, badge: "chat" },
  { to: "/exercises",         labelKey: "navigation.items.exercises",         icon: "📚", roles: technicalRoles },
  { to: "/microcycle",        labelKey: "navigation.items.microcycle",        icon: "🗓️", roles: technicalRoles },
  { to: "/attendance-register", labelKey: "navigation.items.attendanceRegister", icon: "🧾", roles: technicalRoles },
  { to: "/statistics",        labelKey: "navigation.items.statistics",        icon: "📊", roles: coachRoles },
  { to: "/tactical-board",    labelKey: "navigation.items.tacticalBoard",     icon: "🧠", roles: technicalRoles },
  { to: "/availability",      labelKey: "navigation.items.availability",      icon: "🩺", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "player"] },
  { to: "/physical-tests",    labelKey: "navigation.items.physicalTests",     icon: "⏱️", roles: physicalRoles },
  { to: "/physical-workouts", labelKey: "navigation.items.physicalWorkouts",  icon: "🏃", roles: physicalRoles },
  { to: "/gps-load",          labelKey: "navigation.items.gpsLoad",           icon: "📡", roles: physicalRoles },
  { to: "/match-day",         labelKey: "navigation.items.matchDay",          icon: "📋", roles: technicalRoles },
  { to: "/post-match",        labelKey: "navigation.items.postMatch",         icon: "📝", roles: technicalRoles },
  { to: "/set-plays",         labelKey: "navigation.items.setPlays",          icon: "📐", roles: technicalRoles },
  { to: "/staff-tasks",       labelKey: "navigation.items.staffTasks",        icon: "✅", roles: ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"] },
  { to: "/player-portal",     labelKey: "navigation.items.playerPortal",      icon: "🎽", roles: coachRoles },
  { to: "/player-compare",    labelKey: "navigation.items.playerCompare",     icon: "⚡", roles: coachRoles },
  { to: "/opponents",         labelKey: "navigation.items.opponents",         icon: "🕵️", roles: technicalRoles },
  { to: "/season-goals",      labelKey: "navigation.items.seasonGoals",       icon: "🎯", roles: coachRoles },
  { to: "/ai-session-builder", labelKey: "navigation.items.aiBuilder",        icon: "🤖", roles: technicalRoles },
  { to: "/sponsors",          labelKey: "navigation.items.sponsors",          icon: "🤝", roles: ["owner", "director", "sponsor"] },
  { to: "/exports",           labelKey: "navigation.items.exports",           icon: "🖨️", roles: managementRoles },
  { to: "/settings",          labelKey: "navigation.items.settings",          icon: "⚙️", roles: allRoles },
  { to: "/premium",           labelKey: "navigation.items.premium",           icon: "💎", roles: managementRoles },
];

export default function MobileBottomNav({ currentRole = "headCoach", storageSource = null, chatUnread = 0 }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const effectiveRole = currentRole || "headCoach";
  const primaryItems = PRIMARY.filter((item) => isRoleAllowed(effectiveRole, item.roles));
  const secondaryItems = SECONDARY.filter((item) => isRoleAllowed(effectiveRole, item.roles));
  const showSyncDot = Boolean(storageSource && storageSource !== "supabase");
  const syncDotColor = storageSource === "partial" || storageSource === "pending-upload" ? "#fb923c" : "#f87171";
  const showAltroDot = showSyncDot || chatUnread > 0;
  const altroDotColor = chatUnread > 0 ? "#3b82f6" : syncDotColor;

  function goTo(path) {
    navigate(path);
    setOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
    setOpen(false);
  }

  return (
    <>
      {/* ── Drawer "Altro" ─────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(3px)",
              zIndex: 9997,
            }}
          />

          {/* Sheet */}
          <div style={{
            position: "fixed",
            left: 0, right: 0,
            bottom: 0,
            zIndex: 9998,
            background: "#0f172a",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px 20px 0 0",
            padding: "16px 16px calc(76px + env(safe-area-inset-bottom, 0px)) 16px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            maxHeight: "70vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}>
            <div style={{
              width: 36, height: 4, borderRadius: 99,
              background: "rgba(255,255,255,0.2)",
              margin: "0 auto 16px",
            }} />

            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>
              {t("navigation.mobile.moreSections")}
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}>
              {secondaryItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => goTo(item.to)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 8px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    color: "#cbd5e1",
                    cursor: "pointer",
                    minHeight: 72,
                    justifyContent: "center",
                  }}
                >
                  <span style={{ position: "relative", fontSize: 22, lineHeight: 1 }}>
                    {item.icon}
                    {item.badge === "chat" && chatUnread > 0 && (
                      <span style={{
                        position: "absolute",
                        top: -4,
                        right: -8,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        background: "#3b82f6",
                        color: "white",
                        fontSize: 9,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                        boxShadow: "0 0 0 2px #0f172a",
                      }}>
                        {chatUnread > 9 ? "9+" : chatUnread}
                      </span>
                    )}
                    {showSyncDot && item.to === "/settings" && (
                      <span style={{
                        position: "absolute",
                        top: -2,
                        right: -5,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: syncDotColor,
                        boxShadow: "0 0 0 2px #0f172a",
                      }} />
                    )}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.2 }}>{t(item.labelKey)}</span>
                </button>
              ))}
            </div>

            {/* Logout — solo per giocatori */}
            {effectiveRole === "player" && (
              <button
                onClick={handleLogout}
                style={{
                  marginTop: 14, width: "100%",
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px", borderRadius: 12,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  color: "#f87171", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 20 }}>🚪</span>
                Esci dall'account
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Bottom nav bar ─────────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              isActive ? "mobile-nav-item active" : "mobile-nav-item"
            }
          >
            <span>{item.icon}</span>
            <small>{t(item.labelKey)}</small>
          </NavLink>
        ))}

        {/* Pulsante Altro */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={open ? "mobile-nav-item active" : "mobile-nav-item"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{ position: "relative", lineHeight: 1 }}>
            ☰
            {showAltroDot && (
              <span style={{
                position: "absolute",
                top: -2,
                right: -7,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: altroDotColor,
                boxShadow: "0 0 0 2px #0f172a",
              }} />
            )}
          </span>
          <small>{t("navigation.mobile.more")}</small>
        </button>
      </nav>
    </>
  );
}
