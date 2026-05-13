import { useState } from "react";
import { DndContext, useDraggable } from "@dnd-kit/core";
import AppCard from "../components/ui/AppCard";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { Minus, Move, Trash2 } from "lucide-react";

const formationOptions = [
  "Nessuno",
  "4-2-3-1",
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "3-4-3",
  "3-4-1-2",
  "4-3-1-2",
  "4-5-1",
  "5-3-2",
  "5-4-1",
];

const formations = {
  "4-2-3-1": [
    ["POR", 50, 88],
    ["TD", 82, 70],
    ["DC", 62, 74],
    ["DC", 38, 74],
    ["TS", 18, 70],
    ["MED", 42, 55],
    ["REG", 58, 55],
    ["ED", 82, 34],
    ["TQ", 50, 34],
    ["ES", 18, 34],
    ["P", 50, 16],
  ],
  "4-3-3": [
    ["POR", 50, 88],
    ["TD", 82, 70],
    ["DC", 62, 74],
    ["DC", 38, 74],
    ["TS", 18, 70],
    ["CC", 35, 52],
    ["REG", 50, 55],
    ["CC", 65, 52],
    ["ED", 82, 28],
    ["ES", 18, 28],
    ["P", 50, 16],
  ],
  "4-4-2": [
    ["POR", 50, 88],
    ["TD", 82, 70],
    ["DC", 62, 74],
    ["DC", 38, 74],
    ["TS", 18, 70],
    ["ED", 80, 48],
    ["CC", 60, 52],
    ["CC", 40, 52],
    ["ES", 20, 48],
    ["P", 42, 18],
    ["P", 58, 18],
  ],
  "3-5-2": [
    ["POR", 50, 88],
    ["DC", 68, 72],
    ["DC", 50, 76],
    ["DC", 32, 72],
    ["QD", 84, 48],
    ["CC", 64, 52],
    ["REG", 50, 55],
    ["CC", 36, 52],
    ["QS", 16, 48],
    ["P", 42, 18],
    ["P", 58, 18],
  ],
  "3-4-3": [
    ["POR", 50, 88],
    ["DC", 68, 72],
    ["DC", 50, 76],
    ["DC", 32, 72],
    ["ED", 78, 50],
    ["CC", 58, 54],
    ["CC", 42, 54],
    ["ES", 22, 50],
    ["AD", 80, 24],
    ["P", 50, 16],
    ["AS", 20, 24],
  ],
  "3-4-1-2": [
    ["POR", 50, 88],
    ["DC", 68, 72],
    ["DC", 50, 76],
    ["DC", 32, 72],
    ["ED", 78, 50],
    ["CC", 58, 55],
    ["CC", 42, 55],
    ["ES", 22, 50],
    ["TQ", 50, 34],
    ["P", 42, 18],
    ["P", 58, 18],
  ],
  "4-3-1-2": [
    ["POR", 50, 88],
    ["TD", 82, 70],
    ["DC", 62, 74],
    ["DC", 38, 74],
    ["TS", 18, 70],
    ["CC", 35, 54],
    ["REG", 50, 57],
    ["CC", 65, 54],
    ["TQ", 50, 36],
    ["P", 42, 18],
    ["P", 58, 18],
  ],
  "4-5-1": [
    ["POR", 50, 88],
    ["TD", 82, 70],
    ["DC", 62, 74],
    ["DC", 38, 74],
    ["TS", 18, 70],
    ["ED", 82, 48],
    ["CC", 65, 54],
    ["REG", 50, 56],
    ["CC", 35, 54],
    ["ES", 18, 48],
    ["P", 50, 18],
  ],
  "5-3-2": [
    ["POR", 50, 88],
    ["TD", 86, 66],
    ["DC", 68, 74],
    ["DC", 50, 77],
    ["DC", 32, 74],
    ["TS", 14, 66],
    ["CC", 35, 52],
    ["REG", 50, 56],
    ["CC", 65, 52],
    ["P", 42, 18],
    ["P", 58, 18],
  ],
  "5-4-1": [
    ["POR", 50, 88],
    ["TD", 86, 66],
    ["DC", 68, 74],
    ["DC", 50, 77],
    ["DC", 32, 74],
    ["TS", 14, 66],
    ["ED", 80, 48],
    ["CC", 58, 54],
    ["CC", 42, 54],
    ["ES", 20, 48],
    ["P", 50, 18],
  ],
};

const fallbackPlayers = [
  { id: 1, name: "Luca Rossi", role: "Centrale", number: 4 },
  { id: 2, name: "Marco Bianchi", role: "Mezzala", number: 8 },
  { id: 3, name: "Davide Neri", role: "Esterno", number: 7 },
];

function clamp(value, min = 5, max = 95) {
  return Math.min(max, Math.max(min, value));
}

function createBoardPlayers(formation, team) {
  if (formation === "Nessuno") return [];

  const isOpponent = team === "opponent";
  const base = formations[formation] || [];

  return base.map(([role, x, y], index) => ({
    id: `${team}-${index + 1}`,
    name: role,
    slotRole: role,
    number: index + 1,
    team,
    x,
    y: isOpponent ? 100 - y : y,
  }));
}

function preventOverlaps(players) {
  const fixed = players.map((p) => ({ ...p }));

  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i];
      const b = fixed[j];

      const tooCloseX = Math.abs(a.x - b.x) < 7;
      const tooCloseY = Math.abs(a.y - b.y) < 7;

      if (tooCloseX && tooCloseY) {
        if (a.team === "own" && b.team === "opponent") {
          a.x = clamp(a.x - 4);
          a.y = clamp(a.y + 3);
          b.x = clamp(b.x + 4);
          b.y = clamp(b.y - 3);
        } else if (a.team === "opponent" && b.team === "own") {
          a.x = clamp(a.x + 4);
          a.y = clamp(a.y - 3);
          b.x = clamp(b.x - 4);
          b.y = clamp(b.y + 3);
        }
      }
    }
  }

  return fixed;
}

function buildBoard(ownFormation, opponentFormation) {
  return preventOverlaps([
    ...createBoardPlayers(ownFormation, "own"),
    ...createBoardPlayers(opponentFormation, "opponent"),
  ]);
}

function getCompatibleRoles(playerRole = "") {
  const role = playerRole.toLowerCase();

  if (role.includes("port")) return ["POR"];
  if (role.includes("dif") || role.includes("terz") || role.includes("centrale")) return ["DC", "TD", "TS", "QD", "QS"];
  if (role.includes("centro") || role.includes("med") || role.includes("reg")) return ["MED", "REG", "CC"];
  if (role.includes("treq") || role.includes("esterno") || role.includes("ala")) return ["TQ", "ED", "ES", "AD", "AS"];
  if (role.includes("att") || role.includes("punta")) return ["P"];

  return [];
}

function getLastName(fullName = "") {
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1] || fullName;
}

export default function TacticalBoard({ players = [] }) {
  const [ownFormation, setOwnFormation] = useState("4-2-3-1");
  const [opponentFormation, setOpponentFormation] = useState("Nessuno");
  const [selectedLineup, setSelectedLineup] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedBenchPlayer, setSelectedBenchPlayer] = useState(null);
  const [activeTool, setActiveTool] = useState("move");
  const [lines, setLines] = useState([]);
const [drawingLine, setDrawingLine] = useState(null);

  const availablePlayers = players.length ? players : fallbackPlayers;

  const [boardPlayers, setBoardPlayers] = useState(() =>
    buildBoard("4-2-3-1", "Nessuno")
  );

  const ownCount = boardPlayers.filter((p) => p.team === "own").length;
  const opponentCount = boardPlayers.filter((p) => p.team === "opponent").length;

  function applyFormations(nextOwn, nextOpponent) {
    setBoardPlayers(buildBoard(nextOwn, nextOpponent));
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
  }

  function changeOwnFormation(value) {
    setOwnFormation(value);
    applyFormations(value, opponentFormation);
  }

  function changeOpponentFormation(value) {
    setOpponentFormation(value);
    applyFormations(ownFormation, value);
  }

  function handleDragEnd(event) {
    const { active, delta } = event;
    const board = document.getElementById("tactical-board-field");
    if (!board) return;

    const rect = board.getBoundingClientRect();

    setBoardPlayers((prev) =>
      prev.map((player) => {
        if (player.id !== active.id) return player;

        return {
          ...player,
          x: clamp(player.x + (delta.x / rect.width) * 100),
          y: clamp(player.y + (delta.y / rect.height) * 100),
        };
      })
    );
  }
function getBoardCoordinates(event) {
  const board = document.getElementById("tactical-board-field");

  if (!board) return null;

  const rect = board.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100,
  };
}

function handleBoardMouseDown(event) {
  if (activeTool !== "line") return;

  const point = getBoardCoordinates(event);

  if (!point) return;

  setDrawingLine({
    startX: point.x,
    startY: point.y,
    endX: point.x,
    endY: point.y,
  });
}

function handleBoardMouseMove(event) {
  if (!drawingLine || activeTool !== "line") return;

  const point = getBoardCoordinates(event);

  if (!point) return;

  setDrawingLine((prev) => ({
    ...prev,
    endX: point.x,
    endY: point.y,
  }));
}

function handleBoardMouseUp() {
  if (!drawingLine || activeTool !== "line") return;

  setLines((prev) => [...prev, drawingLine]);

  setDrawingLine(null);
}

function resetBoard() {
  setOwnFormation("Nessuno");
  setOpponentFormation("Nessuno");
  setBoardPlayers([]);
  setSelectedLineup([]);
  setSelectedSlotId(null);
  setSelectedBenchPlayer(null);
  setLines([]);
  setDrawingLine(null);
}

  function clearLineup() {
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);

    setBoardPlayers((prev) =>
      prev.map((slot) => ({
        ...slot,
        realPlayerId: undefined,
        name: slot.slotRole,
        number: Number(slot.id.split("-")[1]),
        role: undefined,
      }))
    );
  }

  function assignPlayerToSlot(slot, playerToAssign = selectedBenchPlayer) {
    if (!slot || !playerToAssign) return;
    if (slot.team !== "own" || slot.realPlayerId) return;
    if (selectedLineup.some((p) => p.id === playerToAssign.id)) return;

    setBoardPlayers((prev) =>
      prev.map((item) =>
        item.id === slot.id
          ? {
              ...item,
              realPlayerId: playerToAssign.id,
              name: playerToAssign.name,
              number: playerToAssign.number || item.number,
              role: playerToAssign.role || item.slotRole,
            }
          : item
      )
    );

    setSelectedLineup((prev) => [...prev, playerToAssign]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
  }

  function addPlayerToLineup(player) {
    const compatibleRoles = getCompatibleRoles(player.role);

    const selectedSlot = boardPlayers.find(
      (slot) => slot.id === selectedSlotId && slot.team === "own" && !slot.realPlayerId
    );

    const compatibleSlot = boardPlayers.find(
      (slot) =>
        slot.team === "own" &&
        !slot.realPlayerId &&
        compatibleRoles.includes(slot.slotRole)
    );

    const fallbackSlot = boardPlayers.find(
      (slot) => slot.team === "own" && !slot.realPlayerId
    );

    assignPlayerToSlot(selectedSlot || compatibleSlot || fallbackSlot, player);
  }

  function removePlayerFromLineup(player) {
    setSelectedLineup((prev) => prev.filter((p) => p.id !== player.id));

    setBoardPlayers((prev) =>
      prev.map((slot) =>
        slot.realPlayerId === player.id
          ? {
              ...slot,
              realPlayerId: undefined,
              name: slot.slotRole,
              number: Number(slot.id.split("-")[1]),
              role: undefined,
            }
          : slot
      )
    );
  }

  return (
    <div>
      <PageHeader
        title="Lavagna tattica"
        subtitle="Costruisci struttura, principi, rotazioni e distinta gara in un unico ambiente professionale."
      />

      <div style={boardStyles.layout}>
        <div style={boardStyles.mainColumn}>
          <AppCard>
            <div style={boardStyles.header}>
              <div>
                <div style={boardStyles.kicker}>CALCIOLAB TACTICAL PAD</div>
                <h2 style={boardStyles.title}>Match Plan</h2>
                <p style={boardStyles.subtitle}>
                  Trascina, assegna i giocatori e confronta la struttura della partita.
                </p>
              </div>

              <div style={boardStyles.counters}>
                <div style={boardStyles.counterBlue}>
                  <span>Squadra</span>
                  <strong>{ownCount}</strong>
                </div>
                <div style={boardStyles.counterRed}>
                  <span>Avversari</span>
                  <strong>{opponentCount}</strong>
                </div>
              </div>
            </div>

            <div style={boardStyles.toolbar}>
              <label style={boardStyles.label}>
                Squadra
                <select value={ownFormation} onChange={(e) => changeOwnFormation(e.target.value)} style={boardStyles.select}>
                  {formationOptions.map((formation) => (
                    <option key={formation}>{formation}</option>
                  ))}
                </select>
              </label>

              <label style={boardStyles.label}>
                Avversari
                <select value={opponentFormation} onChange={(e) => changeOpponentFormation(e.target.value)} style={boardStyles.select}>
                  {formationOptions.map((formation) => (
                    <option key={formation}>{formation}</option>
                  ))}
                </select>
              </label>

              <div style={boardStyles.actions}>
                <ToolButton
                  icon={<Move size={20} />}
                  active={activeTool === "move"}
                  onClick={() => setActiveTool("move")}
                  title="Muovi"
                />
                <ToolButton
                  icon={<Minus size={20} />}
                  active={activeTool === "line"}
                  onClick={() => setActiveTool("line")}
                  title="Linea"
                />
                <ToolButton
                  icon={<Trash2 size={20} />}
                  active={false}
                  onClick={() => setLines([])}
                  title="Cancella linee"
                />
                <button style={boardStyles.secondaryButton} onClick={clearLineup}>
                  Pulisci titolari
                </button>
                <button style={boardStyles.primaryButton} onClick={resetBoard}>
                  Reset board
                </button>
              </div>
            </div>

            <DndContext onDragEnd={handleDragEnd}>
  <div
  id="tactical-board-field"
  style={boardStyles.field}
  onMouseDown={handleBoardMouseDown}
  onMouseMove={handleBoardMouseMove}
  onMouseUp={handleBoardMouseUp}
>
    <div style={boardStyles.pitchTexture} />
    <div style={boardStyles.halfwayLine} />
    <div style={boardStyles.zoneTop} />
    <div style={boardStyles.zoneBottom} />
    <div style={boardStyles.centerCircle} />
    <div style={boardStyles.centerSpot} />
    <div style={boardStyles.boxTop} />
    <div style={boardStyles.smallBoxTop} />
    <div style={boardStyles.boxBottom} />
    <div style={boardStyles.smallBoxBottom} />

    <svg style={boardStyles.svgLayer}>
      {lines.map((line, index) => (
        <line
          key={index}
          x1={`${line.startX}%`}
          y1={`${line.startY}%`}
          x2={`${line.endX}%`}
          y2={`${line.endY}%`}
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}

      {drawingLine && (
        <line
          x1={`${drawingLine.startX}%`}
          y1={`${drawingLine.startY}%`}
          x2={`${drawingLine.endX}%`}
          y2={`${drawingLine.endY}%`}
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
    </svg>

    {boardPlayers.map((player) => (
      <DraggablePlayer
        key={player.id}
        player={player}
        selectedSlotId={selectedSlotId}
        selectedBenchPlayer={selectedBenchPlayer}
        onSelectSlot={setSelectedSlotId}
        onAssignToSlot={assignPlayerToSlot}
        onRemove={(slotPlayer) => {
          const linkedPlayer = selectedLineup.find(
            (p) => p.id === slotPlayer.realPlayerId
          );

          if (linkedPlayer) removePlayerFromLineup(linkedPlayer);
        }}
      />
    ))}
  </div>
</DndContext>

            <div style={boardStyles.legend}>
              <span style={boardStyles.legendItem}><i style={boardStyles.dotBlue} />Squadra</span>
              <span style={boardStyles.legendItem}><i style={boardStyles.dotRed} />Avversari</span>
            </div>
          </AppCard>
        </div>



        <div style={boardStyles.sideColumn}>
          <AppCard>
            <h3 style={styles.cardTitle}>Principi di gioco</h3>
            <div style={boardStyles.notes}>
              <Note title="Costruzione" text="Uscita pulita, superiorità posizionale e linee interne leggibili." />
              <Note title="Rifinitura" text="Connessioni tra le linee, ampiezza utile e attacco coordinato della profondità." />
              <Note title="Transizione" text="Riaggressione immediata o protezione centrale dopo perdita." />
              <Note title="Non possesso" text="Squadra corta, distanze compatte e orientamento sul lato forte." />
            </div>
          </AppCard>

          <AppCard>
            <h3 style={styles.cardTitle}>Titolari ({selectedLineup.length}/11)</h3>
            <div style={boardStyles.lineup}>
              {selectedLineup.length ? (
                selectedLineup.map((player) => (
                  <div key={player.id} style={boardStyles.lineupPlayer} onClick={() => removePlayerFromLineup(player)}>
                    <div style={boardStyles.lineupNumber}>{player.number || "--"}</div>
                    <div style={boardStyles.lineupInfo}>
                      <strong>{player.name}</strong>
                      <span>{player.role || "Giocatore"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={boardStyles.emptyLineup}>Nessun titolare selezionato</div>
              )}
            </div>
          </AppCard>

          <AppCard>
            <h3 style={styles.cardTitle}>Panchina ({availablePlayers.length - selectedLineup.length})</h3>

            {selectedSlotId && (
              <div style={boardStyles.slotHint}>
                Slot selezionato: <strong>{boardPlayers.find((p) => p.id === selectedSlotId)?.slotRole}</strong>
              </div>
            )}

            <div style={boardStyles.bench}>
              {availablePlayers
                .filter((player) => !selectedLineup.some((selected) => selected.id === player.id))
                .map((player) => (
                  <div
                    key={player.id}
                    style={{
                      ...boardStyles.benchPlayer,
                      ...(selectedBenchPlayer?.id === player.id ? boardStyles.benchPlayerSelected : {}),
                    }}
                    onClick={() => {
                      setSelectedBenchPlayer(player);
                      addPlayerToLineup(player);
                    }}
                  >
                    <div style={boardStyles.benchNumber}>{player.number || "--"}</div>
                    <div style={boardStyles.benchInfo}>
                      <strong>{player.name}</strong>
                      <span>{player.role || "Giocatore"}</span>
                    </div>
                  </div>
                ))}
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
}
function DraggablePlayer({
  player,
  onRemove,
  selectedSlotId,
  onSelectSlot,
  selectedBenchPlayer,
  onAssignToSlot,
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: player.id,
  });

  const isOwn = player.team === "own";
  const isOpponent = player.team === "opponent";
  const isRealPlayer = Boolean(player.realPlayerId);

  const compatibleRoles = selectedBenchPlayer
    ? getCompatibleRoles(selectedBenchPlayer.role)
    : [];

  const isCompatible =
    selectedBenchPlayer &&
    isOwn &&
    !isRealPlayer &&
    compatibleRoles.includes(player.slotRole);

  const style = {
    ...boardStyles.player,
    ...(isOwn ? boardStyles.ownPlayer : {}),
    ...(isOpponent ? boardStyles.opponentPlayer : {}),
    ...(isRealPlayer ? boardStyles.realPlayer : {}),
    ...(selectedSlotId === player.id ? boardStyles.selectedPlayer : {}),
    ...(isCompatible ? boardStyles.compatiblePlayer : {}),
    left: `${player.x}%`,
    top: `${player.y}%`,
    transform: transform
      ? `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px)`
      : "translate(-50%, -50%)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (selectedBenchPlayer && isOwn && !isRealPlayer) {
          onAssignToSlot(player);
          return;
        }

        if (isOwn && !isRealPlayer) {
          onSelectSlot(player.id);
        }
      }}
      onDoubleClick={() => isRealPlayer && onRemove(player)}
      title={isRealPlayer ? "Doppio click per rimuovere" : "Trascina"}
    >
    <div style={boardStyles.playerNumber}>
  {player.number}
</div>
{selectedSlotId === player.id && (
  <div style={boardStyles.playerTooltip}>
    <strong>{isRealPlayer ? getLastName(player.name) : player.slotRole}</strong>
    <span>{isRealPlayer ? player.role : "Slot"}</span>
  </div>
)}
    </div>
  );
}

function Note({ title, text }) {
  return (
    <div style={boardStyles.note}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ToolButton({ icon, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        border: active
          ? "1px solid rgba(59,130,246,0.7)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
          : "rgba(255,255,255,0.04)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "0.2s",
        boxShadow: active
          ? "0 10px 30px rgba(37,99,235,0.35)"
          : "none",
      }}
    >
      {icon}
    </button>
  );
}

const boardStyles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 330px",
    gap: 18,
    alignItems: "start",
  },

  mainColumn: {
    minWidth: 0,
  },

  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 18,
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
  },

  title: {
    margin: "4px 0 0",
    color: "#f8fafc",
    fontSize: 28,
    letterSpacing: -0.8,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontSize: 13,
  },

  counters: {
    display: "flex",
    gap: 10,
  },

  counterBlue: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(37,99,235,0.16)",
    border: "1px solid rgba(96,165,250,0.28)",
    color: "#bfdbfe",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 78,
  },

  counterRed: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(239,68,68,0.13)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#fecaca",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 78,
  },

  playerTooltip: {
  position: "absolute",
  left: "50%",
  top: 42,
  transform: "translateX(-50%)",
  minWidth: 82,
  padding: "7px 9px",
  borderRadius: 10,
  background: "rgba(15,23,42,0.92)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 10px 22px rgba(0,0,0,0.3)",
  color: "#e2e8f0",
  fontSize: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  zIndex: 80,
  pointerEvents: "none",
},

  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "end",
    flexWrap: "wrap",
    marginBottom: 16,
  },

  label: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
  },

  select: {
    minWidth: 155,
    backgroundColor: "#0f172a",
    color: "#fff",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 14,
    padding: "11px 12px",
    fontWeight: 900,
    outline: "none",
    colorScheme: "dark",
  },

  actions: {
    marginLeft: "auto",
    display: "flex",
    gap: 10,
  },

  secondaryButton: {
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  primaryButton: {
    border: "1px solid rgba(96,165,250,0.25)",
    background: "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.7))",
    color: "#fff",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  field: {
    position: "relative",
    width: "100%",
    aspectRatio: "10 / 6.6",
    minHeight: 520,
    overflow: "hidden",
    borderRadius: 30,
    background:
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 26%), linear-gradient(180deg, rgba(34,197,94,0.42), rgba(20,83,45,0.28)), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 72px, transparent 72px, transparent 144px)",
    border: "2px solid rgba(134,239,172,0.22)",
    boxShadow: "inset 0 0 90px rgba(0,0,0,0.32), 0 24px 60px rgba(0,0,0,0.28)",
  },

  pitchTexture: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, rgba(15,23,42,0.32), transparent 18%, transparent 82%, rgba(15,23,42,0.32))",
    pointerEvents: "none",
  },

  halfwayLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    background: "rgba(255,255,255,0.25)",
  },

  zoneTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "25%",
    borderTop: "1px dashed rgba(255,255,255,0.22)",
  },

  zoneBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "75%",
    borderTop: "1px dashed rgba(255,255,255,0.22)",
  },

  centerCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 112,
    height: 112,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.23)",
    transform: "translate(-50%, -50%)",
  },

  centerSpot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.5)",
    transform: "translate(-50%, -50%)",
  },

  boxTop: {
    position: "absolute",
    left: "25%",
    top: 0,
    width: "50%",
    height: "16%",
    border: "2px solid rgba(255,255,255,0.18)",
    borderTop: "none",
  },

  smallBoxTop: {
    position: "absolute",
    left: "39%",
    top: 0,
    width: "22%",
    height: "7%",
    border: "2px solid rgba(255,255,255,0.13)",
    borderTop: "none",
  },

  boxBottom: {
    position: "absolute",
    left: "25%",
    bottom: 0,
    width: "50%",
    height: "16%",
    border: "2px solid rgba(255,255,255,0.18)",
    borderBottom: "none",
  },

  smallBoxBottom: {
    position: "absolute",
    left: "39%",
    bottom: 0,
    width: "22%",
    height: "7%",
    border: "2px solid rgba(255,255,255,0.13)",
    borderBottom: "none",
  },

 player: {
  position: "absolute",
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "grab",
  userSelect: "none",
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
  zIndex: 30,
  transition: "0.15s ease",
},

 ownPlayer: {
  background: "#2563eb",
  border: "2px solid rgba(255,255,255,0.9)",
  boxShadow: "0 0 18px rgba(37,99,235,0.45)",
},

opponentPlayer: {
  background: "#ef4444",
  border: "2px solid rgba(255,255,255,0.9)",
  boxShadow: "0 0 18px rgba(239,68,68,0.35)",
  zIndex: 25,
},



  selectedPlayer: {
    outline: "2px solid rgba(147,197,253,0.95)",
    outlineOffset: 4,
  },

  compatiblePlayer: {
    outline: "2px solid rgba(34,197,94,0.95)",
    outlineOffset: 4,
  },

  playerNumber: {
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1,
  },



  legend: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
  },

  dotBlue: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#3b82f6",
    boxShadow: "0 0 12px rgba(59,130,246,0.8)",
  },

  dotRed: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#ef4444",
    boxShadow: "0 0 12px rgba(239,68,68,0.8)",
  },

  notes: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  note: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#94a3b8",
    fontSize: 13,
  },

  lineup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  lineupPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    cursor: "pointer",
  },

  lineupNumber: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 950,
    flexShrink: 0,
  },

  lineupInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#cbd5e1",
    fontSize: 12,
  },

  emptyLineup: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.03)",
    border: "1px dashed rgba(255,255,255,0.1)",
    color: "#94a3b8",
    fontSize: 13,
  },

  slotHint: {
    marginBottom: 12,
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 900,
  },

  bench: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  benchPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    cursor: "pointer",
  },

  benchPlayerSelected: {
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.12)",
  },

  benchNumber: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 950,
    flexShrink: 0,
  },

    benchInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#94a3b8",
    fontSize: 12,
  },

  toolsBar: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 18,
    background: "rgba(15,23,42,0.88)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
};
