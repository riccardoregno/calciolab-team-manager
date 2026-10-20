import { AlertCircle, CloudCheck, CloudUpload, HardDrive, LoaderCircle } from "lucide-react";
import { useTranslation } from "../../i18n";
import { getSaveStatus } from "../../utils/saveStatus";

export default function SaveStatus({ loading, source, error, localError, saving, refreshing, lastSyncedAt, onRetry }) {
  const { t, language } = useTranslation();
  const status = getSaveStatus({ loading, source, error, localError, saving, refreshing });
  const Icon = status === "online" ? CloudCheck : status === "saving" || status === "loading" ? LoaderCircle : status === "device" ? HardDrive : status === "pending" ? CloudUpload : AlertCircle;
  const tone = status === "online" ? "#86d9b4" : status === "localError" ? "#fca5a5" : status === "saving" || status === "loading" ? "#93bbff" : "#f2c47d";
  const timestamp = lastSyncedAt && !Number.isNaN(new Date(lastSyncedAt).getTime())
    ? new Date(lastSyncedAt).toLocaleTimeString(language === "en" ? "en-GB" : "it-IT", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="save-status" data-save-status={status}>
      <div role="status" aria-live="polite" aria-atomic="true" style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, color: tone }}>
        <Icon size={17} aria-hidden="true" className={status === "saving" || status === "loading" ? "save-status-spinner" : undefined} style={{ flexShrink: 0 }} />
        <span><strong style={{ fontSize: 12 }}>{t(`saveStatus.${status}`)}</strong>
          {status === "online" && timestamp && <small style={{ display: "block", color: "#94a3b8", marginTop: 2 }}>{t("saveStatus.lastSaved", { time: timestamp })}</small>}
        </span>
      </div>
      {onRetry && !["online", "loading", "saving"].includes(status) && (
        <button type="button" onClick={onRetry} className="save-status-retry">{t("saveStatus.retryAction")}</button>
      )}
    </div>
  );
}
