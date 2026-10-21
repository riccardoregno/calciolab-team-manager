import { ArrowUpRight, Clock3, ClipboardCheck, Goal, HandHelping } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { isGoalkeeper } from "../../utils/helpers";
import AppCard from "../ui/AppCard";
import GoalkeeperMetrics from "./GoalkeeperMetrics";

export default function PlayerStatisticsCard({ player, stats }) {
  const { t, language } = useTranslation();
  if (!player) return null;
  const goalkeeper = isGoalkeeper(player);
  const number = new Intl.NumberFormat(language === "en" ? "en-GB" : "it-IT");
  const metrics = [
    { label: t("pages.statistics.presences"), value: stats?.presences || 0, Icon: ClipboardCheck },
    { label: t("common.minutes"), value: stats?.minutes || 0, Icon: Clock3 },
    { label: t(goalkeeper ? "pages.dashboard.goalsConcededLabel" : "common.goals"), value: goalkeeper ? stats?.goalsConceded ?? "—" : stats?.goals || 0, Icon: Goal, tone: goalkeeper ? "conceded" : "goals" },
    { label: t("common.assists"), value: stats?.assists || 0, Icon: HandHelping, tone: "assists" },
  ];
  return <AppCard className="player-statistics-card">
    <section aria-label={t("productPolish.playerSummary")}>
      <div className="player-statistics-heading">
        <div className="player-statistics-identity">
          <div className="player-statistics-avatar">{player.photo ? <img src={player.photo} alt="" /> : <span>{player.name?.[0] || "?"}</span>}</div>
          <div><p className="cl-field-caption">{t("productPolish.playerSummary")}</p><h2>{player.name}</h2><p>{player.role || t("pages.statistics.roleNotSet")}</p></div>
        </div>
        <Link to={"/players/" + player.id} className="player-statistics-profile" aria-label={t("productPolish.openPlayer", { name: player.name })}>{t("productPolish.openProfile")}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <dl className="player-statistics-metrics">{metrics.map(({ label, value, Icon, tone }) => <div key={label} data-tone={tone}><dt><Icon size={15} aria-hidden="true" />{label}</dt><dd>{typeof value === "number" ? number.format(value) : value}</dd></div>)}</dl>
      {goalkeeper && <GoalkeeperMetrics stats={stats} />}
    </section>
  </AppCard>;
}
