const planOptions = [
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "club", label: "Club" },
];

export default function DevelopmentPlanSwitcher({ value = "club", onChange }) {
  if (!import.meta.env?.DEV) return null;

  return (
    <div style={styles.wrapper} title="Visibile solo in sviluppo locale">
      <span style={styles.label}>Vista admin</span>
      <div style={styles.segmented}>
        {planOptions.map((plan) => {
          const active = value === plan.id;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange?.(plan.id)}
              style={{
                ...styles.button,
                ...(active ? styles.buttonActive : null),
              }}
            >
              {plan.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 8px",
    borderRadius: 16,
    background: "rgba(251,191,36,0.09)",
    border: "1px solid rgba(251,191,36,0.24)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
  },
  label: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  segmented: {
    display: "flex",
    gap: 3,
    padding: 3,
    borderRadius: 12,
    background: "rgba(15,23,42,0.72)",
  },
  button: {
    minWidth: 58,
    border: "none",
    borderRadius: 9,
    padding: "7px 9px",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  buttonActive: {
    background: "linear-gradient(135deg,#facc15,#fb923c)",
    color: "#1f2937",
    boxShadow: "0 8px 18px rgba(251,146,60,0.22)",
  },
};
