import { useId, useState } from "react";
import { ArrowRight, CalendarCheck2, Check, ChevronDown, ClipboardCheck, ListChecks, Trophy, Users } from "lucide-react";
import { useTranslation } from "../../i18n";
import { formatDate } from "../../utils/helpers";
import AppCard from "../ui/AppCard";

const TASK_ICONS = { callup: Users, result: Trophy, stats: ListChecks, attendance: CalendarCheck2 };
const PREVIEW_COUNT = 3;

export default function CoachActionQueue({ tasks = [], onOpen, loading = false }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const headingId = useId();
  const visibleTasks = expanded ? tasks : tasks.slice(0, PREVIEW_COUNT);
  return (
    <AppCard className="coach-action-queue">
      <section aria-labelledby={headingId}>
        <header className="coach-queue-heading">
          <span className="coach-queue-symbol"><ClipboardCheck size={18} aria-hidden="true" /></span>
          <h2 id={headingId}>{t("coachTasks.title")}</h2>
          <span className="coach-queue-count" aria-label={t("productPolish.taskCount", { count: tasks.length })}>{tasks.length}</span>
        </header>
        <p className="coach-queue-scope">{t("coachTasks.scope")}</p>
        {tasks.length ? (
          <ul id={listId} className={"coach-queue-list" + (expanded ? " is-expanded" : "")}>
            {visibleTasks.map((task) => {
              const Icon = TASK_ICONS[task.kind] || ClipboardCheck;
              return <li key={task.id}><button type="button" onClick={() => onOpen(task.to)} className={"coach-action-task coach-task-" + task.kind}>
                <Icon size={17} className="coach-task-icon" aria-hidden="true" />
                <span className="coach-task-copy"><strong>{t(`coachTasks.${task.kind}`, { count: task.count })}</strong><small>{task.event.opponent || task.event.title || t("common.session")} · {formatDate(task.event.date)}</small></span>
                <ArrowRight size={15} aria-hidden="true" />
              </button></li>;
            })}
          </ul>
        ) : <p role="status" className="coach-queue-empty"><Check size={17} aria-hidden="true" />{t(loading ? "coachTasks.checking" : "coachTasks.empty")}</p>}
        {tasks.length > PREVIEW_COUNT && <button type="button" className="coach-queue-toggle" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>
          {t(expanded ? "productPolish.showLessTasks" : "productPolish.showMoreTasks", { count: tasks.length - PREVIEW_COUNT })}<ChevronDown size={16} aria-hidden="true" />
        </button>}
      </section>
    </AppCard>
  );
}
