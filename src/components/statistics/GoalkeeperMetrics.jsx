import { useTranslation } from "../../i18n";

export default function GoalkeeperMetrics({ stats }) {
  const { t, language } = useTranslation();
  const record = stats?.goalkeeperRecord;
  if (!record) return null;
  return (
    <section className="goalkeeper-metrics" aria-label={t("pages.statistics.goalkeepers")}>
      <dl className="goalkeeper-metrics-grid">
        {[["cleanSheetsLabel", record.cleanSheets], ["rateLabel", record.goalsAgainstPer90 ?? "—"]].map(([key, value]) => (
          <div key={key}><dt>{t(`goalkeeperStats.${key}`)}</dt><dd>{typeof value === "number" ? new Intl.NumberFormat(language === "en" ? "en-GB" : "it-IT", { maximumFractionDigits: 2 }).format(value) : value}</dd></div>
        ))}
      </dl>
      <p style={{ color: record.complete ? "#94a3b8" : "#f2c47d", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>
        {record.appearances ? t("goalkeeperStats.coverage", { known: record.knownAppearances, total: record.appearances, rate: record.rateMatches }) : t("goalkeeperStats.none")}
        {record.appearances > 0 && !record.complete && <> {t("goalkeeperStats.partial")}</>}
      </p>
      <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>{t("goalkeeperStats.definition")}</p>
    </section>
  );
}
