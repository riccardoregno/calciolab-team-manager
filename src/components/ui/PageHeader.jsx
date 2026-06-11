import { styles } from "../../styles/index.js";

function PageHeader({ title, subtitle, badge, action }) {
  return (
    <div className="page-header" style={{ ...styles.hero, width: "100%" }}>
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
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
