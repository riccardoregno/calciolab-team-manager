import AppCard from "./AppCard";

export default function ActionBar({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  children,
  style = {},
}) {
  return (
    <AppCard style={{ padding: "14px 18px", marginBottom: 18, ...style }}>
      <div style={barStyles.inner}>
        <div style={barStyles.copy}>
          {eyebrow && <span style={barStyles.eyebrow}>{eyebrow}</span>}
          {title && <h3 style={barStyles.title}>{title}</h3>}
          {subtitle && <p style={barStyles.subtitle}>{subtitle}</p>}
          {children}
        </div>

        {(meta || actions) && (
          <div style={barStyles.side}>
            {meta && <div style={barStyles.meta}>{meta}</div>}
            {actions && <div style={barStyles.actions}>{actions}</div>}
          </div>
        )}
      </div>
    </AppCard>
  );
}

const barStyles = {
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  copy: {
    minWidth: 0,
    flex: "1 1 260px",
  },
  eyebrow: {
    display: "block",
    marginBottom: 5,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: "0 0 4px",
    color: "#e2e8f0",
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.45,
  },
  side: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    flex: "0 1 auto",
  },
  meta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
};
