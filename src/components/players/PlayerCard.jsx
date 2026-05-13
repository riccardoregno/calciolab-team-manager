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
        borderRadius: 24,
        padding: 20,
        background:
          "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "rgba(56,189,248,0.18)",
          filter: "blur(20px)",
          right: -50,
          top: -50,
        }}
      />

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
              width: 72,
              height: 72,
              borderRadius: 22,
              background:
                "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(37,99,235,0.20))",
              border: "1px solid rgba(255,255,255,0.16)",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
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

          <Badge tone={player.status === "Infortunato" ? "red" : "green"}>
            {player.status || "Disponibile"}
          </Badge>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 22,
              letterSpacing: "-0.03em",
            }}
          >
            {player.name}
          </h3>

          <p
            style={{
              margin: "6px 0 0",
              color: "#94a3b8",
              fontWeight: 700,
            }}
          >
            {player.role || "Ruolo non impostato"}
          </p>
        </div>

        <div
          style={{
            marginTop: 18,
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
            marginTop: 20,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="ghost"
            onClick={() => navigate(`/players/${player.id}`)}
            style={{ flex: 1 }}
          >
            Scheda
          </Button>

          <Button
            variant="danger"
            onClick={onDelete}
            style={{ flex: 1 }}
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
        borderRadius: 16,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "10px 8px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
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
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default PlayerCard;
