import { ArrowUpRight } from "lucide-react";
import AppCard from "../ui/AppCard";
import { useTranslation } from "../../i18n";

function AlertRow({ alert, onOpen }) {
  const { t } = useTranslation();
  const labels = { red: "toneUrgent", orange: "toneWarning", green: "toneOk", blue: "toneInfo", purple: "toneNote" };
  const Tag = alert.path ? "button" : "div";
  return <Tag className={`coach-alert-row coach-alert-${alert.tone || "blue"}`} type={alert.path ? "button" : undefined} onClick={alert.path ? () => onOpen(alert.path) : undefined}><span className="coach-alert-dot" aria-hidden="true" /><span><span className="coach-sr-only">{t("pages.dashboard." + (labels[alert.tone] || "toneInfo"))}: </span>{alert.text}</span>{alert.path && <ArrowUpRight size={16} aria-hidden="true" />}</Tag>;
}
export default function CoachAlertList({ alerts = [], onOpen }) {
  const { t } = useTranslation();
  return (
    <AppCard title={t("pages.dashboard.coachAlerts")} subtitle={t("pages.dashboard.focus.alertsSummary")} rightContent={<span className="coach-alert-count">{alerts.length}</span>}>
      {alerts.length === 0 ? <p className="cl-context-note">{t("pages.dashboard.noAlerts")}</p> : <>
        <div className="coach-alert-list">{alerts.slice(0, 3).map((alert, index) => <AlertRow key={index} alert={alert} onOpen={onOpen} />)}</div>
        {alerts.length > 3 && <details className="coach-secondary-details"><summary>{t("pages.dashboard.focus.moreAlerts", { count: alerts.length - 3 })}</summary><div className="coach-alert-list">{alerts.slice(3).map((alert, index) => <AlertRow key={index} alert={alert} onOpen={onOpen} />)}</div></details>}
      </>}
    </AppCard>
  );
}
