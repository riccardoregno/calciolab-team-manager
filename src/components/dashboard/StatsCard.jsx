import { styles } from "../../styles/index.js";

function StatsCard({
  title,
  value,
  icon,
  color = "#2563eb",
  subtitle,
}) {
  return (
    <div
      className="cl-stat-card"
      style={{
        ...styles.card,
        position: "relative",
        overflow: "hidden",
        background:
          "var(--cl-surface, #121c2a)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 20,
        boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {title}
          </p>

          <h2
            style={{
              margin: "8px 0 0",
              fontSize: 32,
              lineHeight: 1,
            }}
          >
            {value}
          </h2>
        </div>

        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            border: `1px solid ${color}33`,
            background: `${color}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          {icon}
        </div>
      </div>

      {subtitle && (
        <p
          style={{
            margin: 0,
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default StatsCard;
