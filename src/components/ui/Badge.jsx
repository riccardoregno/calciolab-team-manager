export default function Badge({ children, tone, variant }) {
  const resolvedTone = tone || variant || "blue";
  const tones = {
    blue: "rgba(56,189,248,0.14)",
    green: "rgba(34,197,94,0.14)",
    orange: "rgba(251,146,60,0.14)",
    red: "rgba(248,113,113,0.14)",
    purple: "rgba(168,85,247,0.14)",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: tones[resolvedTone] || tones.blue,
        color: "white",
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </span>
  );
}
