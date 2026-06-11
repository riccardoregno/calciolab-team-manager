import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { useTranslation } from "../../i18n";
import { matchDayStyles } from "../../styles/matchDay";

export function PlayerList({
  players,
  empty,
  actionLabel,
  onAction,
  disableAction = false,
  lineup,
  listKey,
  onMove,
  onCaptain,
  onRoleChange,
  isMobile = false,
}) {
  const { t } = useTranslation();
  if (players.length === 0) {
    return <p style={matchDayStyles.muted}>{empty}</p>;
  }

  const rowGrid = isMobile
    ? "46px 1fr auto"
    : "46px 1fr minmax(120px, 0.7fr) auto auto auto";

  return (
    <div style={matchDayStyles.playerList}>
      {players.map((player) => (
        <div key={player.id} style={{ ...matchDayStyles.playerRow, gridTemplateColumns: rowGrid }}>
          <div style={matchDayStyles.playerAvatar}>
            {player.photo ? (
              <img src={player.photo} alt={player.name} style={matchDayStyles.avatarImg} />
            ) : (
              player.name?.[0] || "?"
            )}
          </div>
          <div style={matchDayStyles.playerInfo}>
            <strong style={{ lineHeight: 1.2 }}>{player.name}</strong>
            <span>
              #{player.shirtNumber || "-"} · {lineup?.roles?.[player.id] || player.role || "—"}
              {lineup?.captainId === player.id ? " · C" : ""}
            </span>
            {isMobile && onRoleChange && (
              <input
                placeholder={t("pages.matchDay.rolePlaceholderInput")}
                value={lineup?.roles?.[player.id] || ""}
                onChange={(event) => onRoleChange(player.id, event.target.value)}
                style={{ ...matchDayStyles.roleInput, marginTop: 4, fontSize: 12, padding: "5px 8px" }}
              />
            )}
          </div>
          {!isMobile && onRoleChange && (
            <input
              placeholder={t("pages.matchDay.rolePlaceholderInput")}
              value={lineup?.roles?.[player.id] || ""}
              onChange={(event) => onRoleChange(player.id, event.target.value)}
              style={matchDayStyles.roleInput}
            />
          )}
          {!isMobile && onMove && listKey && (
            <div style={matchDayStyles.moveButtons}>
              <button onClick={() => onMove(player.id, listKey, "up")}>↑</button>
              <button onClick={() => onMove(player.id, listKey, "down")}>↓</button>
            </div>
          )}
          {!isMobile && onCaptain && (
            <Button variant="ghost" onClick={() => onCaptain(player.id)}>
              C
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onAction(player)}
            disabled={disableAction}
          >
            {actionLabel}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function TeamMark({ logo, logoSize = 100, name, fallback }) {
  return (
    <div style={matchDayStyles.teamMark}>
      {logo ? (
        <div style={matchDayStyles.teamLogoFrame}>
          <img
            src={logo}
            alt={name}
            style={{
              ...matchDayStyles.teamLogo,
              width: `${Number(logoSize || 100)}%`,
              height: `${Number(logoSize || 100)}%`,
            }}
          />
        </div>
      ) : (
        <div style={matchDayStyles.teamFallback}>{fallback}</div>
      )}
      <strong style={{ lineHeight: 1.2 }}>{name}</strong>
    </div>
  );
}

export function MiniStat({ label, value, valueColor }) {
  return (
    <div style={matchDayStyles.statCard}>
      <span>{label}</span>
      <strong style={{ lineHeight: 1, ...(valueColor ? { color: valueColor } : {}) }}>{value}</strong>
    </div>
  );
}

export function PrintKpi({ label, value }) {
  return (
    <div className="print-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PrintBox({ title, value }) {
  return (
    <div className="print-box">
      <span>{title}</span>
      <p>{value}</p>
    </div>
  );
}

export function PlayerPrintTable({ players, lineup, empty, t }) {
  if (!players.length) {
    return (
      <div className="print-box">
        <span>{empty}</span>
        <p>-</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t("pages.matchDay.printTableNumber")}</th>
          <th>{t("pages.matchDay.printTableShirt")}</th>
          <th>{t("pages.matchDay.printTablePlayer")}</th>
          <th>{t("pages.matchDay.printTableRole")}</th>
          <th>{t("pages.matchDay.printTableNotes")}</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player, index) => {
          const displayName = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "-";
          const role = lineup?.roles?.[player.id] || player.role || "-";
          const isCaptain = lineup?.captainId === player.id;

          return (
            <tr key={player.id}>
              <td>{index + 1}</td>
              <td>#{player.shirtNumber || "-"}</td>
              <td>{displayName}</td>
              <td>{role}</td>
              <td>{isCaptain ? t("pages.matchDay.playerTableCaptain") : player.status || "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SectionHeader({ title, badge }) {
  return (
    <div style={matchDayStyles.sectionHeader}>
      <h3 style={{ margin: 0, lineHeight: 1.2 }}>{title}</h3>
      <Badge tone="blue">{badge}</Badge>
    </div>
  );
}

export function MatchCommandCenter({ steps, completed, total, onMicrocycle, onSetPlays, onOpponents }) {
  const { t } = useTranslation();
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const criticalOpen = steps.filter((step) => !step.done).slice(0, 2);

  return (
    <AppCard>
      <div style={matchDayStyles.commandHead}>
        <div>
          <p style={matchDayStyles.commandEyebrow}>{t("pages.matchDay.commandCabina")}</p>
          <h3 style={matchDayStyles.commandTitle}>{t("pages.matchDay.commandTitle")}</h3>
          <p style={matchDayStyles.muted}>
            {t("pages.matchDay.commandSubtitle")}
          </p>
        </div>
        <div style={matchDayStyles.readinessBox}>
          <strong>{pct}%</strong>
          <span>{t("pages.matchDay.commandCompleted", { done: completed, total })}</span>
        </div>
      </div>

      <div style={matchDayStyles.progressTrack}>
        <span style={{ ...matchDayStyles.progressFill, width: `${pct}%` }} />
      </div>

      <div style={matchDayStyles.commandGrid}>
        {steps.map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={step.onClick}
            style={{
              ...matchDayStyles.commandCard,
              ...(step.done ? matchDayStyles.commandCardDone : {}),
            }}
          >
            <div style={matchDayStyles.commandCardTop}>
              <span style={step.done ? matchDayStyles.checkDone : matchDayStyles.checkTodo}>
                {step.done ? "✓" : "•"}
              </span>
              <strong>{step.title}</strong>
            </div>
            <small>{step.detail}</small>
            <span style={matchDayStyles.commandAction}>{step.action} →</span>
          </button>
        ))}
      </div>

      <div style={matchDayStyles.commandFooter}>
        <div style={matchDayStyles.openAlerts}>
          {criticalOpen.length ? (
            criticalOpen.map((step) => (
              <span key={step.key}>{t("pages.matchDay.commandToClose", { title: step.title })}</span>
            ))
          ) : (
            <span>{t("pages.matchDay.commandReady")}</span>
          )}
        </div>
        <div style={matchDayStyles.commandLinks}>
          <Button variant="ghost" onClick={onMicrocycle}>{t("pages.matchDay.commandMicrocycle")}</Button>
          <Button variant="ghost" onClick={onSetPlays}>{t("pages.matchDay.commandSetPlays")}</Button>
          <Button variant="ghost" onClick={onOpponents}>{t("pages.matchDay.commandOpponents")}</Button>
        </div>
      </div>
    </AppCard>
  );
}
