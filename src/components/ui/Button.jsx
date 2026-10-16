import { theme } from "../../styles/theme";

export default function Button({ children, onClick, variant = "primary", style = {}, disabled, className = "", type = "button", ...props }) {
  const base = {
    border: "none",
    borderRadius: theme.radius.md,
    minHeight: 44,
    padding: "10px 15px",
    fontWeight: 650,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease",
    opacity: disabled ? 0.45 : 1,
  };

  const variants = {
    primary: {
      background: theme.colors.primary,
      color: "white",
      boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
    },
    ghost: {
      background: "rgba(148,163,184,0.06)",
      color: "#dce7f5",
      border: "1px solid rgba(255,255,255,0.10)",
    },
    danger: {
      background: "#be3455",
      color: "white",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`cl-btn-${variant} ${className}`.trim()}
      style={{ ...base, ...variants[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
