import { Star } from "lucide-react";
import { useTranslation } from "../../i18n";

export default function FavoriteButton({ active, label, onToggle, disabled = false, style = {} }) {
  const { t } = useTranslation();
  return <button type="button" onClick={onToggle} disabled={disabled && !active}
    aria-label={t(active ? "navigationPrefs.remove" : "navigationPrefs.add", { label })}
    aria-pressed={active} title={disabled && !active ? t("navigationPrefs.limit") : t("navigationPrefs.device")}
    style={{ width: 28, minWidth: 28, height: 36, display: "grid", placeItems: "center", padding: 0, border: 0, borderRadius: 8, background: "transparent", color: active ? "#f2c47d" : "#7d8da5", cursor: disabled && !active ? "default" : "pointer", opacity: disabled && !active ? .45 : 1, ...style }}>
    <Star size={15} fill={active ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}
