import { useTranslation } from "../../i18n";

export default function GoalkeeperMetrics({ stats }) {
  const { t } = useTranslation();
  const record = stats?.goalkeeperRecord;
  if (!record) return null;
  return (
    <section style={{ gridColumn: "1 / -1", marginTop: 14, padding: 14, borderRadius: 12, background: "rgba(56,189,248,.04)", border: "1px solid rgba(56,189,248,.15)" }} aria-label={t("pages.statistics.goalkeepers")}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        {[["cleanSheetsLabel", record.cleanSheets], ["rateLabel", record.goalsAgainstPer90 ?? "—"]].map(([key, value]) => (
          <div key={key}><span style={{ color: "#94a3b8", fontSize: 11 }}>{t(`goalkeeperStats.${key}`)}</span><strong style={{ display: "block", color: "#7dd3fc", fontSize: 21, marginTop: 4 }}>{value}</strong></div>
        ))}
      </div>
      <p style={{ color: record.complete ? "#94a3b8" : "#f2c47d", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>
        {record.appearances ? t("goalkeeperStats.coverage", { known: record.knownAppearances, total: record.appearances, rate: record.rateMatches }) : t("goalkeeperStats.none")}
        {record.appearances > 0 && !record.complete && <> {t("goalkeeperStats.partial")}</>}
      </p>
      <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>{t("goalkeeperStats.definition")}</p>
    </section>
  );
}
