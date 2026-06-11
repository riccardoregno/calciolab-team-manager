export function getCompatibleRoles(playerRole = "") {
  const role = playerRole.toLowerCase();

  if (role.includes("port")) return ["POR"];
  if (role.includes("dif") || role.includes("terz") || role.includes("centrale")) return ["DC", "TD", "TS", "QD", "QS"];
  if (role.includes("centro") || role.includes("med") || role.includes("reg")) return ["MED", "REG", "CC"];
  if (role.includes("treq") || role.includes("esterno") || role.includes("ala")) return ["TQ", "ED", "ES", "AD", "AS"];
  if (role.includes("att") || role.includes("punta")) return ["P"];

  return [];
}

export function getLastName(fullName = "") {
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1] || fullName;
}

// ─── Colori disponibili per linee e frecce ────────────────────────────────────
export const DRAW_COLORS = [
  { value: "white",   label: "Bianco" },
  { value: "#fbbf24", label: "Giallo" },
  { value: "#ef4444", label: "Rosso"  },
  { value: "#38bdf8", label: "Blu"    },
];

export const FIELD_REFERENCE_SIZE = { width: 68, length: 105 };
export const defaultAreaSize = { width: 20, length: 20 };
export const AREA_SIZE_LIMITS = {
  width: { min: 1, max: 60 },
  length: { min: 1, max: 110 },
};

// Converte un colore CSS in un ID SVG-safe (niente # o caratteri speciali)
export const colorId = (c) => c.replace(/[^a-zA-Z0-9]/g, "");

export const formationOptions = [
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

export const formations = {
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

export const fallbackPlayers = [
  { id: 1, name: "Luca Rossi", role: "Centrale", number: 4 },
  { id: 2, name: "Marco Bianchi", role: "Mezzala", number: 8 },
  { id: 3, name: "Davide Neri", role: "Esterno", number: 7 },
];

export function clamp(value, min = 5, max = 95) {
  return Math.min(max, Math.max(min, value));
}

export function createBoardPlayers(formation, team) {
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

export function preventOverlaps(players) {
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

export function buildBoard(ownFormation, opponentFormation) {
  return preventOverlaps([
    ...createBoardPlayers(ownFormation, "own"),
    ...createBoardPlayers(opponentFormation, "opponent"),
  ]);
}

export function clampBoard(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function makeShapeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

export function normalizeLines(lines = []) {
  return lines.map((line, index) => ({
    id: line.id ?? `shape-${index}-${Date.now()}`,
    type: line.type ?? "line",
    color: line.color ?? "white",
    rotation: Number(line.rotation ?? 0),
    startX: Number(line.startX ?? 25),
    startY: Number(line.startY ?? 25),
    endX: Number(line.endX ?? 75),
    endY: Number(line.endY ?? 25),
    controlX: Number(line.controlX ?? ((Number(line.startX ?? 25) + Number(line.endX ?? 75)) / 2)),
    controlY: Number(line.controlY ?? ((Number(line.startY ?? 25) + Number(line.endY ?? 25)) / 2) - 10),
  }));
}

export function normalizeBoardObjects(objects = []) {
  return objects.map((obj, index) => ({
    id: obj.id ?? `obj-${index}-${Date.now()}`,
    type: obj.type ?? "ball",
    x: Number(obj.x ?? 50),
    y: Number(obj.y ?? 50),
    scale: Number(obj.scale ?? 1),
    rotation: Number(obj.rotation ?? 0),
    color: obj.color,
    text: obj.text ?? "",
  }));
}

export function getShapeBounds(shape) {
  const x = Math.min(shape.startX, shape.endX);
  const y = Math.min(shape.startY, shape.endY);
  const width = Math.abs(shape.endX - shape.startX);
  const height = Math.abs(shape.endY - shape.startY);
  const cx = x + width / 2;
  const cy = y + height / 2;

  return { x, y, width, height, cx, cy };
}

export function rotatePoint(point, center, angle) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getAngle(center, point) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

export function getSelectedShape(lines, selectedItem) {
  if (selectedItem?.kind !== "shape") return null;
  return lines.find((line) => line.id === selectedItem.id) ?? null;
}

export function getSelectedObject(boardObjects, selectedItem) {
  if (selectedItem?.kind !== "object") return null;
  return boardObjects.find((obj) => obj.id === selectedItem.id) ?? null;
}

export function buildFrameSnapshot({ boardPlayers, lines, boardObjects, notes }) {
  return {
    id: makeShapeId("frame"),
    label: "",
    boardPlayers,
    lines,
    boardObjects,
    notes,
  };
}

export function clampAreaSize(key, value) {
  const limits = AREA_SIZE_LIMITS[key];
  const fallback = defaultAreaSize[key];
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(limits.min, Math.min(limits.max, numericValue));
}

export function normalizeAreaSize(value) {
  return {
    width: clampAreaSize("width", value?.width),
    length: clampAreaSize("length", value?.length),
  };
}

export function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

export function easeInOut(progress) {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

export function interpolateItems(fromItems = [], toItems = [], progress = 1) {
  const fromMap = new Map(fromItems.map((item) => [item.id, item]));

  return toItems.map((toItem) => {
    const fromItem = fromMap.get(toItem.id);
    if (!fromItem) return toItem;

    return {
      ...toItem,
      x: lerp(Number(fromItem.x ?? toItem.x ?? 0), Number(toItem.x ?? fromItem.x ?? 0), progress),
      y: lerp(Number(fromItem.y ?? toItem.y ?? 0), Number(toItem.y ?? fromItem.y ?? 0), progress),
      scale: lerp(Number(fromItem.scale ?? toItem.scale ?? 1), Number(toItem.scale ?? fromItem.scale ?? 1), progress),
      rotation: lerp(Number(fromItem.rotation ?? toItem.rotation ?? 0), Number(toItem.rotation ?? fromItem.rotation ?? 0), progress),
    };
  });
}

