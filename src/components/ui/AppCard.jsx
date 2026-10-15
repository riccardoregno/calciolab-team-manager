import { styles } from "../../styles/index.js";

function AppCard({
  children,
  title,
  subtitle,
  rightContent,
  noPadding = false,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`cl-app-card ${className}`.trim()}
      style={{
        ...styles.sectionCard,
        padding: noPadding ? 0 : "var(--cl-card-padding, 22px)",
        ...style,
      }}
    >
      {(title || subtitle || rightContent) && (
        <div className="cl-card-heading" style={styles.cardHeader}>
          <div style={{ minWidth: 0, flex: "1 1 180px" }}>
            {title && (
              <h3 style={styles.cardHeaderTitle}>
                {title}
              </h3>
            )}

            {subtitle && (
              <p style={styles.cardHeaderSubtitle}>
                {subtitle}
              </p>
            )}
          </div>

          {rightContent}
        </div>
      )}

      {children}
    </div>
  );
}

export default AppCard;
