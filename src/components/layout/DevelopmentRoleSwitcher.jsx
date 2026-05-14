const roleOptions = [
  { id: "owner", label: "Owner" },
  { id: "headCoach", label: "Coach" },
  { id: "assistantCoach", label: "Assist." },
  { id: "athleticTrainer", label: "Prep." },
  { id: "director", label: "Dir." },
  { id: "player", label: "Player" },
  { id: "sponsor", label: "Sponsor" },
];

export default function DevelopmentRoleSwitcher({ value = "headCoach", onChange }) {
  if (!import.meta.env?.DEV) return null;

  return (
    <div style={styles.wrapper} title="Visibile solo in sviluppo locale">
      <span style={styles.label}>Ruolo</span>
      <div style={styles.segmented}>
        {roleOptions.map((role) => {
          const active = value === role.id;

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange?.(role.id)}
              style={{
                ...styles.button,
                ...(active ? styles.buttonActive : null),
              }}
            >
              {role.label}
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
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.22)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
  },
  label: {
    color: "#7dd3fc",
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
    minWidth: 48,
    border: "none",
    borderRadius: 9,
    padding: "7px 8px",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  buttonActive: {
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "white",
    boxShadow: "0 8px 18px rgba(37,99,235,0.24)",
  },
};
