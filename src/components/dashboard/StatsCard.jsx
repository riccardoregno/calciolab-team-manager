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
      style={{
        ...styles.card,
        position: "relative",
        overflow: "hidden",
        background:
          "#141820",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 20,
        boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
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
            width: 52,
            height: 52,
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
