export default function MetricStrip({ items = [], min = 118, style = {} }) {
  const visibleItems = items.filter(Boolean);
  if (!visibleItems.length) return null;

  return (
    <div
      style={{
        ...stripStyles.grid,
        gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`,
        ...style,
      }}
    >
      {visibleItems.map((item) => (
        <div key={item.key || item.label} style={stripStyles.item}>
          <span style={{ ...stripStyles.value, color: item.color || "#e2e8f0" }}>
            {item.value}
          </span>
          <span style={stripStyles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const stripStyles = {
  grid: {
    display: "grid",
    gap: 10,
    width: "100%",
  },
  item: {
    minHeight: 66,
    padding: "11px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    alignContent: "center",
    gap: 6,
    minWidth: 0,
  },
  value: {
    fontSize: 21,
    lineHeight: 1,
    fontWeight: 950,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 1.2,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
