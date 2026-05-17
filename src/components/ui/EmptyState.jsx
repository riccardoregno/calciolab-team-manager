import AppCard from "./AppCard";

export default function EmptyState({
  icon = "📭",
  title = "Nessun elemento trovato",
  text = "Aggiungi un nuovo contenuto per iniziare.",
  action,
}) {
  return (
    <AppCard>
      <div
        style={{
          textAlign: "center",
          padding: "28px 18px",
          maxWidth: 440,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            margin: "0 auto 16px",
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            fontSize: 30,
            background: "rgba(15,23,42,0.56)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {icon}
        </div>

        <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.2 }}>
          {title}
        </h3>

        <p
          style={{
            color: "#94a3b8",
            marginTop: 10,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {text}
        </p>

        {action}
      </div>
    </AppCard>
  );
}
