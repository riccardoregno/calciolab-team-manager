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
      {visibleItems.map((item) => {
        const Component = item.onClick ? "button" : "div";

        return (
          <Component
            key={item.key || item.label}
            type={item.onClick ? "button" : undefined}
            onClick={item.onClick}
            aria-pressed={item.onClick ? Boolean(item.active) : undefined}
            title={item.title || item.label}
            style={{
              ...stripStyles.item,
              ...(item.onClick ? stripStyles.clickable : {}),
              ...(item.active ? stripStyles.active : {}),
            }}
          >
            <span style={{ ...stripStyles.value, color: item.color || "#e2e8f0" }}>
              {item.value}
            </span>
            <span style={stripStyles.label}>{item.label}</span>
          </Component>
        );
      })}
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
    color: "inherit",
    textAlign: "left",
  },
  clickable: {
    cursor: "pointer",
    transition: "border-color 0.16s ease, background 0.16s ease, transform 0.16s ease",
  },
  active: {
    background: "rgba(59,130,246,0.13)",
    border: "1px solid rgba(96,165,250,0.42)",
    boxShadow: "inset 0 0 0 1px rgba(147,197,253,0.08)",
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
