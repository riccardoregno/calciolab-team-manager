import { languages, useTranslation } from "../../i18n";

export default function LanguageSelector({ compact = false }) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <label style={compact ? selectorStyles.compactWrap : selectorStyles.wrap}>
      {!compact && <span style={selectorStyles.label}>{t("language.label")}</span>}
      {compact && (
        <span style={selectorStyles.compactLabel}>{t("language.label")}</span>
      )}
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        style={compact ? selectorStyles.compactSelect : selectorStyles.select}
        aria-label={t("language.label")}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {compact ? item.shortLabel : `${item.flag}  ${t(item.labelKey)}`}
          </option>
        ))}
      </select>
    </label>
  );
}

const selectorStyles = {
  wrap: {
    display: "grid",
    gap: 6,
    padding: "10px 12px",
  },
  compactWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    padding: "0 8px 0 12px",
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },
  compactLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    pointerEvents: "none",
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  select: {
    width: "100%",
    minHeight: 38,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "0 10px",
    fontSize: 13,
    fontWeight: 800,
  },
  compactSelect: {
    minHeight: 30,
    borderRadius: 9,
    border: "none",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: "0 5px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    outline: "none",
  },
};
