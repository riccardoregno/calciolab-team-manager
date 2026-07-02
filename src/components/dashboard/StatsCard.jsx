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
          "linear-gradient(180deg, #171b24 0%, #11151d 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 24,
        boxShadow: `0 10px 30px ${color}22`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `${color}22`,
          filter: "blur(20px)",
        }}
      />

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
              fontSize: "clamp(20px, 8vw, 34px)",
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
            borderRadius: 18,
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