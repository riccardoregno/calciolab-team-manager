import { languages, useTranslation } from "../../i18n";

export default function LanguageSelector({ compact = false }) {
  const { language, setLanguage, t } = useTranslation();
  const current = languages.find((l) => l.code === language) || languages[0];

  return (
    <label style={compact ? selectorStyles.compactWrap : selectorStyles.wrap}>
      {!compact && <span style={selectorStyles.label}>{t("language.label")}</span>}
      {compact && (
        <span style={selectorStyles.flag} aria-hidden="true">{current.flag}</span>
      )}
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        style={compact ? selectorStyles.compactSelect : selectorStyles.select}
        aria-label={t("language.label")}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {compact ? `${item.flag} ${item.shortLabel}` : `${item.flag}  ${t(item.labelKey)}`}
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
    gap: 4,
  },
  flag: {
    fontSize: 18,
    lineHeight: 1,
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
    minHeight: 34,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "0 6px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};
