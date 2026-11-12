import { useTranslation } from "../../i18n";
import { getTeamBillingTestState, teamBillingTestEnabled } from "../../lib/teamBillingTest";

export default function TeamContextBar({ auth }) {
  const { t } = useTranslation();
  const { team, teams, selectTeam } = auth;
  if (!team || team.role === "player") return null;

  const roleLabel = (role) => t("roles." + role);
  const activeLabel = (membership) => teamBillingTestEnabled && getTeamBillingTestState(membership.team_billing_test) === "active"
    ? " · " + t("teamContext.active") : "";

  return (
    <section className="team-context-bar" aria-label={t("teamContext.label")}>
      <div className="team-context-identity">
        <span>{t("teamContext.label")}</span>
        <strong>{team.name}</strong>
        <span className="team-context-role">{roleLabel(team.role)}{activeLabel(team)}</span>
      </div>
      {teams.length > 1 && (
        <label className="team-context-switch">
          <span>{t("teamContext.switch")}</span>
          <select value={team.id} onChange={(event) => selectTeam(event.target.value)}>
            {teams.map((membership) => (
              <option key={membership.id} value={membership.id}>
                {membership.name} · {roleLabel(membership.role)}{activeLabel(membership)}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
