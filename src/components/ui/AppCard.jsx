import { styles } from "../../styles/index.js";

function AppCard({
  children,
  title,
  subtitle,
  rightContent,
  noPadding = false,
}) {
  return (
    <div
      style={{
        ...styles.sectionCard,
        padding: noPadding ? 0 : styles.sectionCard.padding,
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
