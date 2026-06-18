import { useNavigate } from "react-router-dom";

import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { useTranslation } from "../../i18n";
import { calcPlayerAge, getPlayerQuickStats } from "../../utils/helpers";

const SUSPENSION_THRESHOLD = 5;

function PlayerCard({ player, onDelete, sessions = [], matches = [], yellowCards = 0, avgRating = null }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const computedAge = calcPlayerAge(player.birthDate);
  const ageValue = computedAge ?? player.age ?? "-";
  const { appearances, trainingPct } = getPlayerQuickStats(player, sessions, matches);
  const trainingPctValue = trainingPct === null ? "-" : `${trainingPct}%`;

  const initials = player.name
    ? player.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";
  const photoSize    = Math.min(180, Math.max(60,  Number(player.photoSize    || 100)));
  const photoOffsetX = Math.min(50,  Math.max(-50, Number(player.photoOffsetX || 0)));
  const photoOffsetY = Math.min(50,  Math.max(-50, Number(player.photoOffsetY || 0)));

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        padding: 18,
        background:
          "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92))",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 18px 42px rgba(0,0,0,0.24)",
      }}
    >
      <div style={{ position: "relative", zIndex: 2 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(37,99,235,0.18))",
              border: "1px solid rgba(255,255,255,0.16)",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              fontWeight: 900,
              color: "white",
              overflow: "hidden",
            }}
          >
            {player.photo ? (
              <img
                src={player.photo}
                alt={player.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${photoSize / 100}) translate(${photoOffsetX}%, ${photoOffsetY}%)`,
                }}
              />
            ) : (
              initials
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <Badge tone={
              player.status === "Infortunato" ? "red" :
              player.status === "Squalificato" ? "purple" :
              player.status === "Recupero" || player.status === "Differenziato" ? "orange" :
              "green"
            }>
              {player.status || "Disponibile"}
            </Badge>
            {yellowCards >= SUSPENSION_THRESHOLD - 1 && (
              <span style={{
                fontSize: 11, fontWeight: 900, padding: "2px 7px", borderRadius: 7,
                background: yellowCards >= SUSPENSION_THRESHOLD ? "rgba(248,113,113,0.18)" : "rgba(251,191,36,0.18)",
                border: `1px solid ${yellowCards >= SUSPENSION_THRESHOLD ? "rgba(248,113,113,0.4)" : "rgba(251,191,36,0.4)"}`,
                color: yellowCards >= SUSPENSION_THRESHOLD ? "#f87171" : "#fbbf24",
              }}>
                🟨 {yellowCards} {yellowCards >= SUSPENSION_THRESHOLD ? "SQUALIFICA" : "DIFFIDA"}
              </span>
            )}
            {avgRating !== null && (
              <span style={{
                fontSize: 11, fontWeight: 900, padding: "2px 7px", borderRadius: 7,
                background: avgRating >= 7 ? "rgba(34,197,94,0.15)" : avgRating >= 5 ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.15)",
                border: `1px solid ${avgRating >= 7 ? "rgba(34,197,94,0.4)" : avgRating >= 5 ? "rgba(251,191,36,0.4)" : "rgba(148,163,184,0.3)"}`,
                color: avgRating >= 7 ? "#22c55e" : avgRating >= 5 ? "#fbbf24" : "#94a3b8",
              }}>
                ⭐ {avgRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 21,
              lineHeight: 1.16,
              letterSpacing: 0,
            }}
          >
            {player.name}
          </h3>

          <p
            style={{
              margin: "6px 0 0",
              color: "#94a3b8",
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {player.role || t("components.playerCard.noRole")}
          </p>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          <MiniValue label={t("components.playerCard.appearances")} value={appearances} />
          <MiniValue label={t("components.playerCard.trainingPctAbbr")} value={trainingPctValue} />
          <MiniValue label={t("components.playerCard.age")} value={ageValue} />
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="ghost"
            onClick={() => navigate(`/players/${player.id}`)}
            style={{ flex: "1 1 110px" }}
          >
            {t("components.playerCard.profile")}
          </Button>

          {onDelete && (
            <Button
              variant="danger"
              onClick={onDelete}
              style={{ flex: "1 1 110px" }}
            >
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniValue({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "9px 8px",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0,
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display: "block",
          marginTop: 5,
          fontSize: 16,
          color: "white",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default PlayerCard;
