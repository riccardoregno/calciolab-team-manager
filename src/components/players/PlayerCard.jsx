import { useNavigate } from "react-router-dom";

import Button from "../ui/Button";
import Badge from "../ui/Badge";

function PlayerCard({ player, onDelete }) {
  const navigate = useNavigate();

  const initials = player.name
    ? player.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

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
                }}
              />
            ) : (
              initials
            )}
          </div>

          <Badge tone={
            player.status === "Infortunato" ? "red" :
            player.status === "Squalificato" ? "purple" :
            player.status === "Recupero" || player.status === "Differenziato" ? "orange" :
            "green"
          }>
            {player.status || "Disponibile"}
          </Badge>
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
            {player.role || "Ruolo non impostato"}
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
          <MiniValue label="Maglia" value={player.shirtNumber || player.number || "-"} />
          <MiniValue label="Piede" value={player.foot || "-"} />
          <MiniValue label="Età" value={player.age || "-"} />
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
            Scheda
          </Button>

          <Button
            variant="danger"
            onClick={onDelete}
            style={{ flex: "1 1 110px" }}
          >
            Elimina
          </Button>
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
