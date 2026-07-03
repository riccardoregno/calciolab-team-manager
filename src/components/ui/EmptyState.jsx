import AppCard from "./AppCard";

export default function EmptyState({
  icon = "📭",
  title = "Nessun elemento trovato",
  text = "Aggiungi un nuovo contenuto per iniziare.",
  action,
  steps,
}) {
  return (
    <AppCard>
      <div
        style={{
          textAlign: "center",
          padding: "28px 18px",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 18px",
            borderRadius: 20,
            display: "grid",
            placeItems: "center",
            fontSize: 34,
            background: "rgba(15,23,42,0.56)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {icon}
        </div>

        <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
          {title}
        </h3>

        <p style={{ color: "#94a3b8", marginTop: 10, marginBottom: steps ? 20 : 20, lineHeight: 1.6, fontSize: 15 }}>
          {text}
        </p>

        {steps && (
          <div style={{ textAlign: "left", marginBottom: 20 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: i < steps.length - 1 ? 14 : 0 }}>
                <div style={{
                  flexShrink: 0,
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: "#38bdf8",
                }}>
                  {i + 1}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3 }}>{step.title}</p>
                  {step.text && <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>{step.text}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {action}
      </div>
    </AppCard>
  );
}
