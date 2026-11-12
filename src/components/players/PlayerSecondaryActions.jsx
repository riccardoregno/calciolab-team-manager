import Button from "../ui/Button";
import { useTranslation } from "../../i18n";

export default function PlayerSecondaryActions({ onDelete }) {
  const { t } = useTranslation();
  if (!onDelete) return null;
  return (
    <details className="player-secondary-actions">
      <summary aria-label={t("components.playerCard.otherActions")}>⋯</summary>
      <Button variant="danger" onClick={onDelete}>{t("common.delete")}</Button>
    </details>
  );
}
