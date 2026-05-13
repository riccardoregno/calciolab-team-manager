import { styles } from "../../styles/index.js";

function PageHeader({ title, subtitle, badge, action }) {
  return (
    <div style={styles.hero}>
      <div>
        <h1 style={styles.pageTitle}>{title}</h1>

        {subtitle && (
          <p style={styles.pageSubtitle}>
            {subtitle}
          </p>
        )}
      </div>

      {action || (badge && (
        <div style={styles.heroBadge}>
          {badge}
        </div>
      ))}
    </div>
  );
}

export default PageHeader;
