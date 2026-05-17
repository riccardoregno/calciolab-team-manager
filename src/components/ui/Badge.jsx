export default function Badge({ children, tone, variant }) {
  const resolvedTone = tone || variant || "blue";
  const tones = {
    blue: {
      background: "rgba(56,189,248,0.13)",
      color: "#7dd3fc",
      border: "rgba(125,211,252,0.22)",
    },
    green: {
      background: "rgba(34,197,94,0.13)",
      color: "#86efac",
      border: "rgba(134,239,172,0.22)",
    },
    orange: {
      background: "rgba(251,146,60,0.13)",
      color: "#fdba74",
      border: "rgba(253,186,116,0.24)",
    },
    red: {
      background: "rgba(248,113,113,0.13)",
      color: "#fca5a5",
      border: "rgba(252,165,165,0.24)",
    },
    purple: {
      background: "rgba(168,85,247,0.13)",
      color: "#d8b4fe",
      border: "rgba(216,180,254,0.24)",
    },
  };
  const toneStyle = tones[resolvedTone] || tones.blue;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 26,
        padding: "5px 9px",
        borderRadius: 999,
        background: toneStyle.background,
        color: toneStyle.color,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: "nowrap",
        border: `1px solid ${toneStyle.border}`,
      }}
    >
      {children}
    </span>
  );
}
