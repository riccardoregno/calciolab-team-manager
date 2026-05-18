/**
 * TacticalMiniPreview
 * Renderizza una mini anteprima SVG della lavagna tattica.
 * Accetta `board` (oggetto tacticalBoard) oppure `imageSrc` (stringa base64 SVG/PNG).
 */
export default function TacticalMiniPreview({ board = null, imageSrc = null, height = 160 }) {
  // Preferisce l'immagine statica SVG se presente e il board è vuoto
  if (!board && imageSrc) {
    return (
      <div style={{ height, borderRadius: 12, overflow: "hidden", background: "#0f2518" }}>
        <img
          src={imageSrc}
          alt="Diagramma tattico"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  if (!board) return null;

  const { boardPlayers = [], lines = [], boardObjects = [] } = board;
  const W = 100, H = 60;

  return (
    <div style={{ position: "relative", background: "#166534", borderRadius: 12, overflow: "hidden", height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Campo */}
        <rect x={0} y={0} width={W} height={H} fill="#15803d" />
        <rect x={2} y={2} width={W - 4} height={H - 4} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
        {/* Cerchio centrale */}
        <circle cx={W / 2} cy={H / 2} r={8} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
        <line x1={W / 2} y1={2} x2={W / 2} y2={H - 2} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
        {/* Porte */}
        <rect x={2} y={H / 2 - 6} width={4} height={12} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
        <rect x={W - 6} y={H / 2 - 6} width={4} height={12} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />

        {/* Linee / frecce */}
        {lines.map((line, i) => {
          const pts = (line.points || []).map((p) => `${p.x},${p.y}`).join(" ");
          if (!pts) return null;
          return (
            <polyline
              key={i}
              points={pts}
              fill="none"
              stroke={line.color || "white"}
              strokeWidth={0.8}
              strokeLinecap="round"
              opacity={0.75}
            />
          );
        })}

        {/* Oggetti campo (palla, coni…) */}
        {boardObjects.map((obj) => (
          <circle
            key={obj.id}
            cx={obj.x}
            cy={(obj.y / 100) * H}
            r={1.5}
            fill={obj.type === "ball" ? "white" : "#fbbf24"}
            opacity={0.9}
          />
        ))}

        {/* Giocatori */}
        {boardPlayers.map((p) => {
          const cx = p.x;
          const cy = (p.y / 100) * H;
          const isOwn = p.team !== "opp";
          return (
            <g key={p.id}>
              <circle cx={cx} cy={cy} r={2.6} fill={isOwn ? "#38bdf8" : "#f87171"} stroke="white" strokeWidth={0.4} />
              <text
                x={cx}
                y={cy + 0.9}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={1.8}
                fill="white"
                fontWeight="bold"
              >
                {p.number || ""}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Badge formazione */}
      {board.ownFormation && board.ownFormation !== "Nessuno" && (
        <span style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(0,0,0,0.55)",
          color: "white",
          fontSize: 10,
          fontWeight: 900,
          padding: "3px 7px",
          borderRadius: 8,
          lineHeight: 1.2,
        }}>
          {board.ownFormation}
        </span>
      )}
    </div>
  );
}
