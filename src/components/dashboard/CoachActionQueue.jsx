import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useTranslation } from "../../i18n";
import { formatDate } from "../../utils/helpers";
import AppCard from "../ui/AppCard";

export default function CoachActionQueue({ tasks = [], onOpen, loading = false }) {
  const { t } = useTranslation();
  return <AppCard style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}><ClipboardCheck size={19} color="#7dd3fc" /><h2 style={{ margin: 0, fontSize: 16 }}>{t("coachTasks.title")}</h2><span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 12 }}>{tasks.length}</span></div>
    <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 12 }}>{t("coachTasks.scope")}</p>
    {tasks.length ? <div style={{ display: "grid", gap: 8 }}>{tasks.slice(0, 5).map((task) => <button key={task.id} type="button" onClick={() => onOpen(task.to)} className="coach-action-task">
      <span style={{ minWidth: 0 }}><strong>{t(`coachTasks.${task.kind}`, { count: task.count })}</strong><small>{task.event.opponent || task.event.title || t("common.session")} · {formatDate(task.event.date)}</small></span><ArrowRight size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
    </button>)}</div> : <p role="status" style={{ color: "#86d9b4", fontSize: 13, margin: 0 }}>{t(loading ? "coachTasks.checking" : "coachTasks.empty")}</p>}
    {tasks.length > 5 && <p style={{ color: "#94a3b8", fontSize: 12 }}>{t("coachTasks.remaining", { count: tasks.length - 5 })}</p>}
  </AppCard>;
}
