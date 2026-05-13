import AppCard from "./AppCard";

export default function EmptyState({
  icon = "📭",
  title = "Nessun elemento trovato",
  text = "Aggiungi un nuovo contenuto per iniziare.",
  action,
}) {
  return (
    <AppCard>
      <div style={{ textAlign: "center", padding: 30 }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>{icon}</div>

        <h3 style={{ margin: 0, fontSize: 22 }}>
          {title}
        </h3>

        <p style={{ color: "#94a3b8", marginTop: 10, marginBottom: 20 }}>
          {text}
        </p>

        {action}
      </div>
    </AppCard>
  );
}
