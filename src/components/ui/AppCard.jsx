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
      className={className}
      style={{
        ...styles.sectionCard,
        padding: noPadding ? 0 : styles.sectionCard.padding,
        ...style,
      }}
    >
      {(title || subtitle || rightContent) && (
        <div style={styles.cardHeader}>
          <div>
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
