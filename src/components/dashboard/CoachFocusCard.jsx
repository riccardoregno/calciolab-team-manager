import { ArrowRight, CalendarDays, MapPin, Clock3, ChevronRight, Users, TriangleAlert } from "lucide-react";
import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { useTranslation } from "../../i18n";
import { formatDate } from "../../utils/helpers";
import { getAgendaDateKey } from "../../utils/coachAgenda";

export default function CoachFocusCard({ event, todayEvents = [], weekCount = 0, available = 0, playerCount = 0, alerts = [], clubName, onOpenEvent, onCreateSession, onOpenCalendar, onOpenAlert, rsvpSummary, children, nextEvents = [], showMetrics = true, showAgenda = true }) {
  const { t, language } = useTranslation();
  const isMatch = event?.type === "Partita" || Boolean(event?.opponent);
  const dateKey = getAgendaDateKey(event?.date);
  const eventDate = dateKey ? new Date(dateKey + "T12:00:00") : null;
  const todayKey = getAgendaDateKey(new Date());
  const title = event ? (isMatch ? [clubName, event.opponent].filter(Boolean).join(" · ") : event.title || t("common.session")) : t("pages.dashboard.focus.emptyTitle");
  const clock = event?.time || event?.startTime;
  return (
    <AppCard className="coach-focus-card" noPadding>
      <div className="coach-focus-layout">
      <div className="coach-focus-main">
        <div className="coach-focus-eyebrow"><span className="coach-focus-marker" />{t(event ? dateKey === todayKey ? "pages.dashboard.focus.today" : "pages.dashboard.focus.next" : "pages.dashboard.focus.plan")}</div>
        <div className="coach-focus-heading">
          {eventDate && <div className="coach-focus-date" aria-hidden="true"><strong>{eventDate.getDate()}</strong><span>{eventDate.toLocaleDateString(language === "en" ? "en-GB" : "it-IT", { month: "short" })}</span></div>}
          <div className="coach-focus-copy"><span className="coach-focus-type">{event ? t(isMatch ? "common.match" : "common.session") : t("pages.dashboard.focus.noAgenda")}</span><h2>{title}</h2>{event && <p>{formatDate(event.date)}</p>}{!event && <p>{t("pages.dashboard.focus.emptyHint")}</p>}</div>
        </div>
        {event && <div className="coach-focus-meta">
          {clock && <span><Clock3 size={15} aria-hidden="true" />{clock}</span>}
          {event.location && <span><MapPin size={15} aria-hidden="true" />{event.location}</span>}
          {!isMatch && event.theme && <span>{event.theme}</span>}
          {!isMatch && Number(event.duration) > 0 && <span>{event.duration} min</span>}
          {isMatch && <span>{t(event.lineup?.ready ? "pages.dashboard.lineupReady" : "pages.dashboard.lineupDraft")}</span>}
        </div>}
        <div className="coach-focus-actions">
          <Button onClick={event ? () => onOpenEvent(event) : onCreateSession}>{t(event ? isMatch ? "pages.dashboard.openMatch" : "pages.dashboard.focus.openTraining" : "pages.dashboard.newSession")}<ArrowRight size={17} aria-hidden="true" /></Button>
          <Button variant="ghost" onClick={onOpenCalendar}><CalendarDays size={16} aria-hidden="true" />{t("pages.dashboard.openCalendar")}</Button>
        </div>
        {rsvpSummary && isMatch && <p className="coach-focus-rsvp">{t("pages.dashboard.rsvpAvailable", { count: rsvpSummary.available })} · {t("pages.dashboard.rsvpPending", { count: rsvpSummary.pending })} · {t("pages.dashboard.rsvpUnavailable", { count: rsvpSummary.unavailable })}{rsvpSummary.pending > 0 && <button type="button" className="coach-agenda-all" onClick={() => onOpenAlert(`/match-convocation/${event.id}`)}>{t("coachTasks.reviewConfirmations")}<ArrowRight size={14} aria-hidden="true" /></button>}</p>}
        {children && <details className="coach-focus-details"><summary>{t("pages.dashboard.focus.matchDetails")}</summary><div>{children}</div></details>}
      </div>
      {showAgenda && nextEvents.length > 0 && <aside className="coach-focus-agenda" aria-label={t("pages.dashboard.focus.upNext")}>
        <p className="cl-field-caption">{t("pages.dashboard.focus.upNext")}</p>
        {nextEvents.slice(0, 3).map((item) => <button type="button" className="coach-agenda-item" key={item.type + ":" + item.id} onClick={() => onOpenEvent(item)}><span><strong>{item.opponent || item.title || t("common.session")}</strong><small>{formatDate(item.date)}{item.time ? " · " + item.time : ""}</small></span><ChevronRight size={16} aria-hidden="true" /></button>)}
        <button type="button" className="coach-agenda-all" onClick={onOpenCalendar}>{t("pages.dashboard.focus.allEvents")}<ArrowRight size={15} aria-hidden="true" /></button>
      </aside>}
      </div>
      {showMetrics && <div className="coach-focus-bottom">
        <div><CalendarDays size={17} aria-hidden="true" /><span><strong>{todayEvents.length}</strong>{t("pages.dashboard.today")}</span></div>
        <div><Clock3 size={17} aria-hidden="true" /><span><strong>{weekCount}</strong>{t("pages.dashboard.days7")}</span></div>
        <button type="button" onClick={() => onOpenAlert("/players")}><Users size={17} aria-hidden="true" /><span><strong>{available}/{playerCount}</strong>{t("pages.dashboard.availableCount")}</span><ChevronRight size={15} aria-hidden="true" /></button>
        <button type="button" onClick={() => onOpenAlert(alerts[0]?.path || "/availability")}><TriangleAlert size={17} aria-hidden="true" /><span><strong>{alerts.length}</strong>{t("pages.dashboard.focus.toReview")}</span><ChevronRight size={15} aria-hidden="true" /></button>
      </div>}
    </AppCard>
  );
}
