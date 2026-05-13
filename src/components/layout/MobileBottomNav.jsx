import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/players", label: "Rosa", icon: "👥" },
  { to: "/exercises", label: "Esercizi", icon: "⚽" },
  { to: "/trainings", label: "Sedute", icon: "📋" },
  { to: "/matches", label: "Gare", icon: "🏆" },
];

export default function MobileBottomNav() {
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
          <small>{item.label}</small>
        </NavLink>
      ))}
    </nav>
  );
}