import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";

// ── Voci principali sempre visibili ──────────────────────────────
const PRIMARY = [
  { to: "/",          labelKey: "navigation.mobile.home", icon: "🏠" },
  { to: "/players",   labelKey: "navigation.mobile.roster", icon: "👥" },
  { to: "/trainings", labelKey: "navigation.mobile.trainings", icon: "📋" },
  { to: "/matches",   labelKey: "navigation.mobile.matches", icon: "⚽" },
  { to: "/calendar",  labelKey: "navigation.mobile.calendar", icon: "📅" },
];

// ── Voci nel drawer "Altro" ───────────────────────────────────────
const SECONDARY = [
  { to: "/exercises", labelKey: "navigation.items.exercises", icon: "📚" },
  { to: "/microcycle",       labelKey: "navigation.items.microcycle", icon: "🗓️" },
  { to: "/attendance-register", labelKey: "navigation.items.attendanceRegister", icon: "🧾" },
  { to: "/statistics",       labelKey: "navigation.items.statistics", icon: "📊" },
  { to: "/tactical-board",   labelKey: "navigation.items.tacticalBoard", icon: "🧠" },
  { to: "/availability",     labelKey: "navigation.items.availability", icon: "🩺" },
  { to: "/physical-tests",   labelKey: "navigation.items.physicalTests", icon: "⏱️" },
  { to: "/physical-workouts",labelKey: "navigation.items.physicalWorkouts", icon: "🏃" },
  { to: "/gps-load",         labelKey: "navigation.items.gpsLoad", icon: "📡" },
  { to: "/staff-tasks",      labelKey: "navigation.items.staffTasks", icon: "✅" },
  { to: "/exports",          labelKey: "navigation.items.exports", icon: "🖨️" },
  { to: "/settings",         labelKey: "navigation.items.settings", icon: "⚙️" },
  { to: "/premium",          labelKey: "navigation.items.premium", icon: "💎" },
];

export default function MobileBottomNav() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function goTo(path) {
    navigate(path);
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
            padding: "16px 16px calc(88px + env(safe-area-inset-bottom, 0px)) 16px",
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
              {SECONDARY.map((item) => (
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
                  <span style={{ fontSize: 22 }}>{item.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.2 }}>{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav bar ─────────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        {PRIMARY.map((item) => (
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
          <span>☰</span>
          <small>{t("navigation.mobile.more")}</small>
        </button>
      </nav>
    </>
  );
}
