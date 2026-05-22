/**
 * TacticalMiniPreview
 * Renderizza una mini anteprima SVG della lavagna tattica.
 * Accetta `board` (oggetto tacticalBoard) oppure `imageSrc` (stringa base64 SVG/PNG).
 */
function MiniPlayerFigure({ x, y, number, isOpponent }) {
  const shirt = isOpponent ? "#ef4444" : "#38bdf8";
  const shorts = isOpponent ? "#7f1d1d" : "#075985";
  const text = isOpponent ? "#fff1f2" : "#f0f9ff";

  return (
    <g transform={`translate(${x} ${y}) scale(0.22)`}>
      <ellipse cx="0" cy="18" rx="12" ry="3" fill="rgba(0,0,0,0.3)" />
      <circle cx="0" cy="-18" r="5" fill="#f7c59f" stroke="rgba(15,23,42,0.4)" strokeWidth="1" />
      <path
        d="M-11 -8 Q0 -16 11 -8 L9 8 Q0 12 -9 8Z"
        fill={shirt}
        stroke="rgba(15,23,42,0.5)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M-10 -5 L-18 2 M10 -5 L18 2" stroke={shirt} strokeWidth="4" strokeLinecap="round" />
      <path d="M-4 8 L-8 20 M4 8 L8 20" stroke={shorts} strokeWidth="4.2" strokeLinecap="round" />
      <text
        x="0"
        y="1"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="950"
        fontFamily="system-ui,sans-serif"
        fill={text}
      >
        {number || ""}
      </text>
    </g>
  );
}

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
          const isOpponent = p.team === "opponent" || p.team === "opp";
          return (
            <MiniPlayerFigure key={p.id} x={cx} y={cy} number={p.number} isOpponent={isOpponent} />
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
