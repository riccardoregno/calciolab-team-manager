import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "../../i18n";
import { formatDate } from "../../utils/helpers";
import MatchScopeFilters from "../statistics/MatchScopeFilters";
import { isLeagueStatsMatch } from "../../utils/helpers.js";
import { buildCoachAnalysis } from "../../utils/coachAnalysis.js";
import "../../styles/coach-analysis.css";

const nameOf = (player) => player.name || [player.firstName, player.lastName].filter(Boolean).join(" ") || "—";

export default function CoachAnalysisDashboard({ matchScope, players = [], matches = [], sessions = [], rows = [], profile = {}, loading = false, statsLoading = false, statsError = null, onRetryStats, now = new Date(), canManage = true }) {
  const { t, language } = useTranslation();
  const text = (key, params) => t(`coachOverview.${key}`, params);
  const [group, setGroup] = useState("prima");
  const hasFirst = players.some((player) => (player.gruppo || "prima") === "prima");
  const hasJuniors = players.some((player) => player.gruppo === "juniores");
  const effectiveGroup = group === "prima" && !hasFirst && hasJuniors ? "juniores" : group;
  const model = useMemo(() => buildCoachAnalysis({ players, matches, sessions, rows, now, group: effectiveGroup, season: matchScope ? "" : profile.currentSeason || "", leagueOnly: !matchScope, canCheckStats: !statsLoading && !statsError }), [players, matches, sessions, rows, now, effectiveGroup, matchScope, profile.currentSeason, statsLoading, statsError]);
  const teamName = profile.teamName || profile.clubName || "CalcioLab";
  const statsPending = loading || statsLoading;
  const number = (value, digits = 0) => value == null ? "—" : Number(value).toLocaleString(language === "en" ? "en-GB" : "it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const count = (value) => loading ? "—" : number(value);
  const formPoints = model.form.reduce((total, item) => total + item.earned, 0);
  const calledUp = new Set([...(model.nextMatch?.convocazione?.playerIds || []), ...(model.nextMatch?.lineup?.calledUpIds || [])].map(String)).size;
  const showPoints = !matchScope || matches.every(isLeagueStatsMatch);
  const metrics = [
    ["points", count(model.points), text("pointsNote"), TrendingUp],
    ["played", count(model.record.played), `${model.record.wins} ${text("winsShort")} · ${model.record.draws} ${text("drawsShort")} · ${model.record.losses} ${text("lossesShort")}`, ShieldCheck],
    ["goals", loading ? "—" : <><span>{model.record.goalsFor}</span><span>/</span><span>{model.record.goalsAgainst}</span></>, text("goalsNote"), Target],
    ["average", loading ? "—" : number(model.pointsPerGame, 2), text("averageNote"), TrendingUp],
  ].filter(([key]) => showPoints || (key !== "points" && key !== "average"));

  function MatchPanel({ match, previous = false }) {
    const score = previous ? model.latestScore : null;
    const isAway = match?.location === "Trasferta";
    const home = isAway ? match.opponent : teamName;
    const away = isAway ? teamName : match?.opponent;
    const path = previous ? (score ? `/match-stats/${match?.id}` : canManage ? `/matches?modal=match&edit=${encodeURIComponent(match?.id || "")}` : "/matches") : (canManage ? `/match-convocation/${match?.id}` : "/matches");
    return <section className={`analysis-panel analysis-fixture ${previous ? "is-previous" : "is-next"}`} aria-label={text(previous ? "lastMatch" : "nextMatch")}>
      <div className="analysis-panel-head"><span className="analysis-overline">{text(previous ? "lastMatch" : "nextMatch")}</span><CalendarDays size={17} aria-hidden="true" /></div>
      {!match ? <div className="analysis-fixture-empty"><h3>{text(previous ? "noLastMatch" : "noNextMatch")}</h3><p>{text(previous ? "noLastMatchHint" : "noNextMatchHint")}</p><Link to="/matches" className="analysis-text-link">{text("matchArchive")} <ArrowUpRight size={16} /></Link></div> : <>
        <p className="analysis-fixture-date">{formatDate(match.date)}{match.time ? ` · ${match.time}` : ""}</p>
        <div className="analysis-scoreboard"><strong>{home || "—"}</strong><div className="analysis-score">{score ? `${score.homeGoals}–${score.awayGoals}` : previous ? "—" : "vs"}</div><strong>{away || "—"}</strong></div>
        <p className="analysis-fixture-meta">{[match.competition || match.matchKind, match.location, match.matchday ? text("matchday", { count: match.matchday }) : ""].filter(Boolean).join(" · ")}</p>
        <div className="analysis-fixture-footer"><span>{previous ? text(score ? "resultRecorded" : "resultMissing") : text(calledUp ? "calledUp" : "callupMissing", { count: calledUp })}</span><Link to={path} className="analysis-text-link">{text(previous ? (score ? "matchStats" : "addResult") : (canManage ? "prepareMatch" : "matchArchive"))} <ArrowUpRight size={16} /></Link></div>
      </>}
    </section>;
  }

  function Leaderboard({ title, items, field, suffix = "" }) {
    return <section className="analysis-leaderboard"><h3>{title}</h3>{statsPending ? <p className="analysis-muted" role="status">{text("loadingStats")}</p> : statsError ? <p className="analysis-muted">{text("unavailableStats")}</p> : !items.length ? <p className="analysis-muted">{text("noContributions")}</p> : <ol>{items.map(({ player, ...stats }, index) => <li key={player.id}><span className="analysis-rank">{index + 1}</span><Link to={`/players/${player.id}`}><strong>{nameOf(player)}</strong><small>{player.role || text("player")}</small></Link><span className="analysis-contribution">{number(stats[field])}{suffix && <small>{suffix}</small>}</span></li>)}</ol>}</section>;
  }

  const chart = model.trend;
  const minPoints = Math.max(0, (chart[0]?.cumulative || 0) - (chart[0]?.earned || 0));
  const span = Math.max(1, (chart.at(-1)?.cumulative || 0) - minPoints);
  const line = chart.map((item, index) => `${chart.length === 1 ? 160 : 12 + index * 296 / (chart.length - 1)},${78 - (item.cumulative - minPoints) / span * 60}`).join(" ");

  return <div className="coach-analysis" aria-busy={loading}>
    <header className="analysis-heading"><div><span className="analysis-overline">{text("eyebrow")}</span><h1>{teamName}</h1><p>{text("subtitle")}</p></div><Link to="/statistics" className="analysis-primary-link">{text("openAnalysis")} <ArrowUpRight size={18} /></Link></header>
    <MatchScopeFilters scope={matchScope} />
    {loading && <p className="analysis-loading" role="status">{text("loading")}</p>}
    {statsError && <div className="analysis-data-warning" role="alert"><span>{text("syncError")}</span>{onRetryStats && <button type="button" onClick={onRetryStats} disabled={statsLoading}>{text(statsLoading ? "checking" : "retry")}</button>}</div>}

    <div className="analysis-metrics">{metrics.map(([key, value, note, Icon]) => <Link to="/statistics" className={`analysis-metric metric-${key}`} key={key}><div><span>{text(key)}</span><Icon size={17} aria-hidden="true" /></div><strong>{value}</strong><small>{loading ? text("loading") : note}</small></Link>)}</div>

    <div className="analysis-season-grid">
      <section className="analysis-panel analysis-season"><div className="analysis-panel-head"><div><span className="analysis-overline">{text("seasonPulse")}</span><h2>{text("recentForm")}</h2></div><Link className="analysis-icon-link" to="/statistics" aria-label={text("openAnalysis")}><ArrowUpRight size={20} /></Link></div>
        {!model.form.length ? <div className="analysis-blank"><TrendingUp size={32} aria-hidden="true" /><h3>{text("noResults")}</h3><p>{text("noResultsHint")}</p></div> : <>
          <div className="analysis-form">{showPoints && <div className="analysis-form-points"><strong>{formPoints}<span>/{model.form.length * 3}</span></strong><small>{text("recentPoints", { count: model.form.length })}</small></div>}<div className="analysis-form-results">{model.form.map(({ match, score, outcome }) => <Link key={match.id} className={`analysis-result outcome-${outcome}`} to={`/match-stats/${match.id}`} aria-label={`${match.opponent}, ${formatDate(match.date)}, ${score.homeGoals}-${score.awayGoals}, ${text(outcome)}`}><strong>{text(`${outcome}Letter`)}</strong><small>{score.homeGoals}–{score.awayGoals}</small></Link>)}</div></div>
          {showPoints && <><div className="analysis-chart-heading"><span>{text("pointsTrend")}</span><strong>{model.trend.at(-1)?.cumulative} {text("pointsUnit")}</strong></div>
          <svg className="analysis-chart" viewBox="0 0 320 96" role="img" aria-label={text("chartLabel", { count: chart.length })}><line x1="12" x2="308" y1="80" y2="80" stroke="currentColor" opacity="0.12" /><line x1="12" x2="308" y1="48" y2="48" stroke="currentColor" opacity="0.08" /><polyline points={line} fill="none" stroke="#74d5b2" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{chart.map((item, index) => <circle key={item.match.id} cx={chart.length === 1 ? 160 : 12 + index * 296 / (chart.length - 1)} cy={78 - (item.cumulative - minPoints) / span * 60} r="4" fill="#74d5b2"><title>{`${item.match.opponent}: ${item.cumulative} ${text("pointsUnit")}`}</title></circle>)}</svg>
          <div className="analysis-chart-foot"><span>{text("oldest")}</span><span>{text("latest")}</span></div></>}
        </>}
      </section>
      <div className="analysis-fixtures"><MatchPanel match={model.latest} previous /><MatchPanel match={model.nextMatch} /></div>
    </div>

    <div className="analysis-bottom-grid">
      <section className="analysis-panel analysis-availability"><div className="analysis-panel-head"><div><span className="analysis-overline">{text("roster")}</span><h2>{text("availability")}</h2></div><Users size={20} aria-hidden="true" /></div>
        {hasFirst && hasJuniors && <div className="analysis-group-switch" role="group" aria-label={text("rosterGroup")}>{["prima", "juniores", "tutti"].map((value) => <button type="button" key={value} aria-pressed={group === value} onClick={() => setGroup(value)}>{text(value)}</button>)}</div>}
        <p className="analysis-muted">{text(model.nextMatch ? "availabilityNext" : "availabilityToday", { date: formatDate(model.referenceDate) })}</p>
        {!model.roster.length ? <p className="analysis-muted">{text("noPlayers")}</p> : <>
          <div className="analysis-roster-total"><strong>{loading ? "—" : model.availability.available.length}<span>/{model.roster.length}</span></strong><span>{text("available")}</span></div>
          <div className="analysis-availability-track" aria-hidden="true">{Object.entries(model.availability).map(([key, items]) => <span key={key} className={`status-${key}`} style={{ width: `${items.length / model.roster.length * 100}%` }} />)}</div>
          <div className="analysis-availability-key">{Object.entries(model.availability).map(([key, items]) => <span key={key}><i className={`status-${key}`} /><span>{text(key)}</span><strong>{items.length}</strong></span>)}</div>
          <div className="analysis-player-flags">{[...model.availability.unavailable, ...model.availability.limited].slice(0, 3).map((player) => <Link key={player.id} to={`/players/${player.id}`}><span>{nameOf(player)}</span><small>{player.reason}</small></Link>)}</div>
        </>}
        <Link to={canManage ? "/availability" : "/players"} className="analysis-text-link">{text(canManage ? "openAvailability" : "viewRoster")} <ArrowUpRight size={16} /></Link>
      </section>

      <section className="analysis-panel analysis-quality"><div className="analysis-panel-head"><div><span className="analysis-overline">{text("dataQuality")}</span><h2>{text("toComplete")}</h2></div><ClipboardList size={20} aria-hidden="true" /></div>
        <p className="analysis-muted">{text("qualityHint")}</p>
        <div className="analysis-quality-numbers"><Link to="/matches?view=pending"><strong>{count(model.missingResults.length)}</strong><span>{text("missingResults")}</span></Link><Link to="/matches?view=pending"><strong>{statsPending || statsError ? "—" : model.missingLineups.length}</strong><span>{text("missingLineups")}</span></Link></div>
        {statsPending || statsError ? <p className="analysis-muted" role="status">{text(statsError ? "unavailableStats" : "checking")}</p> : !model.missingResults.length && !model.missingLineups.length ? <p className="analysis-all-set"><CheckCircle2 size={18} />{text(model.record.played ? "allSet" : "noPlayedData")}</p> : <ul className="analysis-quality-list">{[...model.missingResults.map((match) => ({ match, kind: "result", to: `/matches?view=pending&modal=match&edit=${encodeURIComponent(match.id)}` })), ...model.missingLineups.map((match) => ({ match, kind: "lineup", to: `/match-stats/${match.id}` }))].slice(0, 3).map(({ match, kind, to }) => <li key={`${kind}-${match.id}`}><Link to={canManage ? to : "/matches?view=pending"}><span><strong>{match.opponent || text("opponent")}</strong><small>{formatDate(match.date)} · {text(kind === "result" ? "resultMissing" : "lineupMissing")}</small></span><ArrowUpRight size={16} /></Link></li>)}</ul>}
        <small className="analysis-coverage">{statsPending || statsError ? text("coverageUnavailable") : text("coverage", { count: model.recordedLineups, total: model.record.played })}</small>
      </section>
    </div>

    <section className="analysis-panel analysis-contributions"><div className="analysis-panel-head"><div><span className="analysis-overline">{text("contributions")}</span><h2>{text("playersInFocus")}</h2><p className="analysis-muted">{text("contributionsNote")}</p></div><Link to="/player-compare" className="analysis-text-link">{text("comparePlayers")} <ArrowUpRight size={16} /></Link></div><div className="analysis-leaderboards"><Leaderboard title={text("scorers")} items={model.topScorers} field="goals" /><Leaderboard title={text("assists")} items={model.topAssists} field="assists" /><Leaderboard title={text("minutes")} items={model.topMinutes} field="minutes" suffix="′" /></div></section>
    <footer className="analysis-footer"><span>{text("footerNote")}</span>{model.nextTraining && <Link to={canManage ? "/trainings" : "/calendar"} state={canManage ? { editSessionId: model.nextTraining.id } : undefined} className="analysis-text-link">{text("nextTraining")} · {formatDate(model.nextTraining.date)} <ArrowUpRight size={16} /></Link>}</footer>
  </div>;
}
