export default function Button({ children, onClick, variant = "primary", style = {}, disabled, type = "button", ...props }) {
  const base = {
    border: "none",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "0.2s",
    opacity: disabled ? 0.45 : 1,
  };

  const variants = {
    primary: {
      background: "linear-gradient(135deg,#38bdf8,#2563eb)",
      color: "white",
      boxShadow: "0 12px 30px rgba(37,99,235,0.28)",
    },
    ghost: {
      background: "rgba(255,255,255,0.06)",
      color: "white",
      border: "1px solid rgba(255,255,255,0.10)",
    },
    danger: {
      background: "linear-gradient(135deg,#fb7185,#e11d48)",
      color: "white",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`cl-btn-${variant}`}
      style={{ ...base, ...variants[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
