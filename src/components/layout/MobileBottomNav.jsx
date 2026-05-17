import { NavLink } from "react-router-dom";
import { useTranslation } from "../../i18n";

const items = [
  { to: "/", labelKey: "navigation.mobile.home", icon: "🏠" },
  { to: "/players", labelKey: "navigation.mobile.roster", icon: "👥" },
  { to: "/exercises", labelKey: "navigation.mobile.exercises", icon: "⚽" },
  { to: "/trainings", labelKey: "navigation.mobile.trainings", icon: "📋" },
  { to: "/matches", labelKey: "navigation.mobile.matches", icon: "🏆" },
  { to: "/premium", labelKey: "navigation.mobile.premium", icon: "💎" },
];

export default function MobileBottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="mobile-bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            isActive ? "mobile-nav-item active" : "mobile-nav-item"
          }
        >
          <span>{item.icon}</span>
          <small>{t(item.labelKey)}</small>
        </NavLink>
      ))}
    </nav>
  );
}
