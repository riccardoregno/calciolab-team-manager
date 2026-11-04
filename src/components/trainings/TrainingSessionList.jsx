import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ClipboardCheck, MoreHorizontal, Plus, Search } from "lucide-react";
import { useTranslation } from "../../i18n";
import { getAgendaDateKey } from "../../utils/coachAgenda.js";
import { buildTrainingArchive, getTrainingDuration, getTrainingStatus } from "../../utils/trainingArchive.js";
import { localDateString } from "../../utils/helpers.js";
import "../../styles/training-hub.css";

export default function TrainingSessionList({ sessions = [], loading = false, canManage = false, search = "", onSearch, view = "auto", onView, onCreate, onEdit, onDelete, onToggleCompleted }) {
  const { t, language } = useTranslation();
  const text = (key, params) => t(`trainingHub.${key}`, params);
  const [limit, setLimit] = useState(12);
  const today = localDateString();
  const archive = useMemo(() => buildTrainingArchive(sessions, { today, view, search }), [sessions, today, view, search]);
  const changeView = (value) => { onView(value); setLimit(12); };
  const changeSearch = (value) => { onSearch(value); setLimit(12); };
  const nextId = buildTrainingArchive(sessions, { today, view: "upcoming" }).items[0]?.id;

  return <div className="training-hub">
    <header className="training-hub-heading"><div><span className="training-hub-eyebrow">{text("eyebrow")}</span><h1>{t("pages.trainings.title")}</h1><p>{text("subtitle")}</p></div><div className="training-hub-heading-actions"><Link className="training-hub-secondary" to="/attendance-register"><ClipboardCheck size={16} aria-hidden="true" />{text("register")}</Link>{canManage && <button type="button" className="training-hub-primary" onClick={onCreate}><Plus size={17} aria-hidden="true" />{text("newSession")}</button>}</div></header>
    <section className="training-hub-archive" aria-label={text("archive")}>
      <div className="training-hub-toolbar"><div className="training-hub-tabs" role="group" aria-label={text("filterLabel")}>{["upcoming", "history", "all"].map((value) => <button type="button" key={value} aria-pressed={archive.activeView === value} onClick={() => changeView(value)}>{text(value)}<span>{archive.counts[value]}</span></button>)}</div><label className="training-hub-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label={text("search")} placeholder={text("search")} value={search} onChange={(event) => changeSearch(event.target.value)} /></label></div>
      {loading ? <p className="training-hub-empty" role="status">{text("loading")}</p> : !archive.items.length ? <div className="training-hub-empty"><CalendarDays size={30} aria-hidden="true" /><h2>{text(search ? "noResults" : sessions.length ? "emptyView" : "emptyTitle")}</h2><p>{text(search ? "noResultsHint" : "emptyHint")}</p>{search ? <button className="training-hub-secondary" type="button" onClick={() => changeSearch("")}>{text("clearSearch")}</button> : canManage && <button type="button" className="training-hub-primary" onClick={onCreate}>{text("newSession")}</button>}</div> : <ul className="training-hub-list">{archive.items.slice(0, limit).map((session) => {
        const date = getAgendaDateKey(session.date);
        const parsedDate = date ? new Date(`${date}T12:00:00`) : null;
        const duration = getTrainingDuration(session);
        const status = getTrainingStatus(session, today);
        const present = Object.values(session.attendance || {}).filter((entry) => ["Presente", "Recupero", "Differenziato"].includes(entry?.status)).length;
        const registered = Object.values(session.attendance || {}).some((entry) => entry?.status);
        const title = session.title || text(session.isFriendlyMatch ? "friendly" : "session");
        const primaryPath = session.isFriendlyMatch ? `/match-stats/${session.id}` : `/session-attendance/${session.id}`;
        return <li className={`training-hub-row ${session.id === nextId && archive.activeView !== "history" ? "is-next" : ""}`} key={session.id}>
          <div className="training-hub-date" aria-label={date || text("noDate")}><strong>{parsedDate ? parsedDate.getDate() : "—"}</strong><span>{parsedDate ? parsedDate.toLocaleDateString(language === "en" ? "en-GB" : "it-IT", { month: "short" }) : ""}</span></div>
          <div className="training-hub-session"><div className="training-hub-session-top">{canManage && !session.isFriendlyMatch ? <button type="button" className="training-hub-title" onClick={() => onEdit(session)}>{title}</button> : <Link to={primaryPath} className="training-hub-title">{title}</Link>}<span className={`training-hub-status status-${status}`}>{text(status)}</span>{session.isFriendlyMatch && <span className="training-hub-kind">{text("friendly")}</span>}</div><p>{[parsedDate?.toLocaleDateString(language === "en" ? "en-GB" : "it-IT", { weekday: "long", year: "numeric" }), session.time, duration ? `${duration} min` : "", session.isFriendlyMatch ? "" : registered ? text("presentCount", { count: present }) : text("attendanceMissing")].filter(Boolean).join(" · ")}</p></div>
          <div className="training-hub-row-actions"><Link className="training-hub-attendance" to={primaryPath}>{text(session.isFriendlyMatch ? "matchStats" : "attendance")}<ArrowUpRight size={15} aria-hidden="true" /></Link>{canManage && !session.isFriendlyMatch && <details className="training-hub-menu"><summary aria-label={text("actionsFor", { title })}><MoreHorizontal size={19} aria-hidden="true" /></summary><div><button type="button" onClick={() => onEdit(session)}>{text("edit")}</button>{date && date < today && <button type="button" onClick={(event) => { onToggleCompleted(session.id); event.currentTarget.closest("details").open = false; }}>{text(session.completed ? "markPending" : "markCompleted")}</button>}<button type="button" className="is-delete" onClick={(event) => { onDelete(session.id); event.currentTarget.closest("details").open = false; }}>{text("delete")}</button></div></details>}</div>
        </li>;
      })}</ul>}
      {!loading && archive.items.length > limit && <button type="button" className="training-hub-more" onClick={() => setLimit((value) => value + 12)}>{text("showMore", { count: Math.min(12, archive.items.length - limit) })}</button>}
    </section>
    <footer className="training-hub-footer"><span role="status">{text("resultCount", { count: archive.items.length })}</span><Link to="/calendar">{text("calendar")} <ArrowUpRight size={14} aria-hidden="true" /></Link></footer>
  </div>;
}
