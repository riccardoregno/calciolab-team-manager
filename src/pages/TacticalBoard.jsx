import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DndContext, useDraggable } from "@dnd-kit/core";
import AppCard from "../components/ui/AppCard";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { ArrowRight, Move, Pause, Play, Plus, Undo2 } from "lucide-react";
import { emptyExercise } from "../data/initialData";
import { createId } from "../utils/helpers";

// ─── Persistenza localStorage ─────────────────────────────────────────────────
const STORAGE_KEY = "calciolab_tactical_board_v1";
const SCHEMAS_KEY  = "calciolab_tactical_schemas_v1";

const defaultNotes = {
  costruzione: "Uscita pulita, superiorità posizionale e linee interne leggibili.",
  rifinitura: "Connessioni tra le linee, ampiezza utile e attacco coordinato della profondità.",
  transizione: "Riaggressione immediata o protezione centrale dopo perdita.",
  nonPossesso: "Squadra corta, distanze compatte e orientamento sul lato forte.",
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage piena o private mode — ignoriamo silenziosamente
  }
}

function loadSchemas() {
  try {
    const raw = localStorage.getItem(SCHEMAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSchemas(schemas) {
  try {
    localStorage.setItem(SCHEMAS_KEY, JSON.stringify(schemas));
  } catch {
    // silently ignore
  }
}

// ─── Preset schemi palle inattive ─────────────────────────────────────────────
const PRESET_SCHEMAS = [
  {
    id: "preset-corner-sx",
    name: "Calcio d'angolo — sx",
    category: "Corner",
    ownFormation: "Nessuno",
    boardObjects: [{ id: "obj-ball-corner", type: "ball", x: 3, y: 8, scale: 1, rotation: 0, text: "" }],
    lines: [],
    boardPlayers: [
      { id: "p-cor-1",  name: "POR", slotRole: "POR", number: 1,  team: "own", x: 50, y: 88 },
      { id: "p-cor-2",  name: "BAT", slotRole: "DC",  number: 2,  team: "own", x: 72, y: 22 },
      { id: "p-cor-3",  name: "DC",  slotRole: "DC",  number: 5,  team: "own", x: 58, y: 18 },
      { id: "p-cor-4",  name: "DC",  slotRole: "DC",  number: 6,  team: "own", x: 44, y: 18 },
      { id: "p-cor-5",  name: "1°",  slotRole: "TQ",  number: 9,  team: "own", x: 53, y: 12 },
      { id: "p-cor-6",  name: "2°",  slotRole: "P",   number: 10, team: "own", x: 36, y: 14 },
      { id: "p-cor-7",  name: "BLK", slotRole: "CC",  number: 8,  team: "own", x: 28, y: 20 },
      { id: "p-cor-8",  name: "SCH", slotRole: "CC",  number: 4,  team: "own", x: 22, y: 14 },
      { id: "p-cor-9",  name: "BDG", slotRole: "TD",  number: 3,  team: "own", x: 65, y: 14 },
      { id: "p-cor-10", name: "BAT", slotRole: "TS",  number: 11, team: "own", x: 8,  y: 12 },
      { id: "p-cor-11", name: "EXE", slotRole: "ED",  number: 7,  team: "own", x: 3,  y: 8 },
    ],
  },
  {
    id: "preset-corner-dx",
    name: "Calcio d'angolo — dx",
    category: "Corner",
    ownFormation: "Nessuno",
    boardObjects: [{ id: "obj-ball-corner-dx", type: "ball", x: 97, y: 8, scale: 1, rotation: 0, text: "" }],
    lines: [],
    boardPlayers: [
      { id: "p-cdx-1",  name: "POR", slotRole: "POR", number: 1,  team: "own", x: 50, y: 88 },
      { id: "p-cdx-2",  name: "BAT", slotRole: "DC",  number: 2,  team: "own", x: 28, y: 22 },
      { id: "p-cdx-3",  name: "DC",  slotRole: "DC",  number: 5,  team: "own", x: 42, y: 18 },
      { id: "p-cdx-4",  name: "DC",  slotRole: "DC",  number: 6,  team: "own", x: 56, y: 18 },
      { id: "p-cdx-5",  name: "1°",  slotRole: "TQ",  number: 9,  team: "own", x: 47, y: 12 },
      { id: "p-cdx-6",  name: "2°",  slotRole: "P",   number: 10, team: "own", x: 64, y: 14 },
      { id: "p-cdx-7",  name: "BLK", slotRole: "CC",  number: 8,  team: "own", x: 72, y: 20 },
      { id: "p-cdx-8",  name: "SCH", slotRole: "CC",  number: 4,  team: "own", x: 78, y: 14 },
      { id: "p-cdx-9",  name: "BDG", slotRole: "TS",  number: 3,  team: "own", x: 35, y: 14 },
      { id: "p-cdx-10", name: "BAT", slotRole: "ED",  number: 11, team: "own", x: 92, y: 12 },
      { id: "p-cdx-11", name: "EXE", slotRole: "ES",  number: 7,  team: "own", x: 97, y: 8 },
    ],
  },
  {
    id: "preset-punizione-fronte",
    name: "Punizione frontale",
    category: "Punizione",
    ownFormation: "Nessuno",
    boardObjects: [{ id: "obj-ball-pun", type: "ball", x: 50, y: 26, scale: 1, rotation: 0, text: "" }],
    lines: [],
    boardPlayers: [
      { id: "p-pun-1",  name: "POR", slotRole: "POR", number: 1,  team: "own", x: 50, y: 88 },
      { id: "p-pun-2",  name: "DC",  slotRole: "DC",  number: 5,  team: "own", x: 60, y: 14 },
      { id: "p-pun-3",  name: "DC",  slotRole: "DC",  number: 6,  team: "own", x: 40, y: 14 },
      { id: "p-pun-4",  name: "DC",  slotRole: "TD",  number: 2,  team: "own", x: 74, y: 18 },
      { id: "p-pun-5",  name: "DC",  slotRole: "TS",  number: 3,  team: "own", x: 26, y: 18 },
      { id: "p-pun-6",  name: "1°",  slotRole: "CC",  number: 8,  team: "own", x: 50, y: 10 },
      { id: "p-pun-7",  name: "2°",  slotRole: "TQ",  number: 10, team: "own", x: 35, y: 10 },
      { id: "p-pun-8",  name: "3°",  slotRole: "P",   number: 9,  team: "own", x: 65, y: 10 },
      { id: "p-pun-9",  name: "BAR", slotRole: "CC",  number: 4,  team: "own", x: 30, y: 22 },
      { id: "p-pun-10", name: "COL", slotRole: "MED", number: 11, team: "own", x: 70, y: 22 },
      { id: "p-pun-11", name: "TIR", slotRole: "ED",  number: 7,  team: "own", x: 50, y: 26 },
    ],
  },
  {
    id: "preset-rimessa-lat",
    name: "Rimessa laterale",
    category: "Rimessa",
    ownFormation: "Nessuno",
    boardObjects: [{ id: "obj-ball-rim", type: "ball", x: 2, y: 40, scale: 1, rotation: 0, text: "" }],
    lines: [],
    boardPlayers: [
      { id: "p-rim-1",  name: "POR", slotRole: "POR", number: 1,  team: "own", x: 50, y: 88 },
      { id: "p-rim-2",  name: "DC",  slotRole: "DC",  number: 5,  team: "own", x: 42, y: 68 },
      { id: "p-rim-3",  name: "DC",  slotRole: "DC",  number: 6,  team: "own", x: 30, y: 62 },
      { id: "p-rim-4",  name: "TD",  slotRole: "TD",  number: 2,  team: "own", x: 20, y: 54 },
      { id: "p-rim-5",  name: "1°",  slotRole: "CC",  number: 8,  team: "own", x: 24, y: 42 },
      { id: "p-rim-6",  name: "2°",  slotRole: "CC",  number: 4,  team: "own", x: 20, y: 30 },
      { id: "p-rim-7",  name: "3°",  slotRole: "ED",  number: 7,  team: "own", x: 38, y: 28 },
      { id: "p-rim-8",  name: "REG", slotRole: "REG", number: 6,  team: "own", x: 40, y: 44 },
      { id: "p-rim-9",  name: "TS",  slotRole: "TS",  number: 3,  team: "own", x: 55, y: 60 },
      { id: "p-rim-10", name: "P",   slotRole: "P",   number: 9,  team: "own", x: 52, y: 32 },
      { id: "p-rim-11", name: "EXE", slotRole: "ES",  number: 11, team: "own", x: 2,  y: 40 },
    ],
  },
];

// Caricato una sola volta al mount del modulo
const _saved = loadSaved();

// ─── Colori disponibili per linee e frecce ────────────────────────────────────
const DRAW_COLORS = [
  { value: "white",   label: "Bianco" },
  { value: "#fbbf24", label: "Giallo" },
  { value: "#ef4444", label: "Rosso"  },
  { value: "#38bdf8", label: "Blu"    },
];

const FIELD_REFERENCE_SIZE = { width: 68, length: 105 };
const defaultAreaSize = { width: 20, length: 20 };
const AREA_SIZE_LIMITS = {
  width: { min: 1, max: 60 },
  length: { min: 1, max: 110 },
};

// Converte un colore CSS in un ID SVG-safe (niente # o caratteri speciali)
const colorId = (c) => c.replace(/[^a-zA-Z0-9]/g, "");

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

function clampBoard(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function makeShapeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function normalizeLines(lines = []) {
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

function normalizeBoardObjects(objects = []) {
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

function getShapeBounds(shape) {
  const x = Math.min(shape.startX, shape.endX);
  const y = Math.min(shape.startY, shape.endY);
  const width = Math.abs(shape.endX - shape.startX);
  const height = Math.abs(shape.endY - shape.startY);
  const cx = x + width / 2;
  const cy = y + height / 2;

  return { x, y, width, height, cx, cy };
}

function rotatePoint(point, center, angle) {
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

function getAngle(center, point) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function getSelectedShape(lines, selectedItem) {
  if (selectedItem?.kind !== "shape") return null;
  return lines.find((line) => line.id === selectedItem.id) ?? null;
}

function getSelectedObject(boardObjects, selectedItem) {
  if (selectedItem?.kind !== "object") return null;
  return boardObjects.find((obj) => obj.id === selectedItem.id) ?? null;
}

function buildFrameSnapshot({ boardPlayers, lines, boardObjects, notes }) {
  return {
    id: makeShapeId("frame"),
    label: "",
    boardPlayers,
    lines,
    boardObjects,
    notes,
  };
}

function clampAreaSize(key, value) {
  const limits = AREA_SIZE_LIMITS[key];
  const fallback = defaultAreaSize[key];
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(limits.min, Math.min(limits.max, numericValue));
}

function normalizeAreaSize(value) {
  return {
    width: clampAreaSize("width", value?.width),
    length: clampAreaSize("length", value?.length),
  };
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function easeInOut(progress) {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function interpolateItems(fromItems = [], toItems = [], progress = 1) {
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

export default function TacticalBoard({ players = [], exercises = [], setExercises }) {
  const navigate   = useNavigate();
  const location   = useLocation();

  // Quando si arriva da Exercises con ?edit=<exerciseId>
  const editingExerciseId   = location.state?.exerciseId   ?? null;
  const editingExerciseName = location.state?.exerciseName ?? null;

  const [ownFormation, setOwnFormation] = useState(_saved?.ownFormation ?? "4-2-3-1");
  const [opponentFormation, setOpponentFormation] = useState(_saved?.opponentFormation ?? "Nessuno");
  const [selectedLineup, setSelectedLineup] = useState(_saved?.selectedLineup ?? []);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [selectedBenchPlayer, setSelectedBenchPlayer] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTool, setActiveTool] = useState("move");
  const [lines, setLines] = useState(() => normalizeLines(_saved?.lines ?? []));
  const [drawingLine, setDrawingLine] = useState(null);
  const [editDrag, setEditDrag] = useState(null);
  const [notes, setNotes] = useState(_saved?.notes ?? defaultNotes);
  const [boardObjects, setBoardObjects] = useState(() => normalizeBoardObjects(_saved?.boardObjects ?? []));
  const [drawColor, setDrawColor] = useState("white");
  const [areaSize, setAreaSize] = useState(() => normalizeAreaSize(_saved?.areaSize ?? _saved?.fieldSize ?? defaultAreaSize));
  const [boardFrames, setBoardFrames] = useState(_saved?.boardFrames ?? []);
  const [activeFrameId, setActiveFrameId] = useState(_saved?.activeFrameId ?? "");
  const [isPlayingFrames, setIsPlayingFrames] = useState(false);
  const [savedSchemas, setSavedSchemas] = useState(() => loadSchemas());
  const [schemaName, setSchemaName] = useState("");
  const [schemaSaved, setSchemaSaved] = useState(false);

  // ── Esercizio da lavagna ──────────────────────────────────────────────────────
  const [exModalOpen, setExModalOpen] = useState(!!editingExerciseId);
  const [exName,      setExName]      = useState(editingExerciseName ?? "");
  const [exFeedback,  setExFeedback]  = useState(null); // { ok: bool, text: string }

  const availablePlayers = players.length ? players : fallbackPlayers;

  const [boardPlayers, setBoardPlayers] = useState(() =>
    _saved?.boardPlayers ?? buildBoard("4-2-3-1", "Nessuno")
  );

  // Auto-salvataggio: persiste formazione, posizioni, linee, note e titolari
  useEffect(() => {
    saveToStorage({
      ownFormation,
      opponentFormation,
      boardPlayers,
      lines,
      notes,
      selectedLineup,
      boardObjects,
      areaSize,
      boardFrames,
      activeFrameId,
    });
  }, [ownFormation, opponentFormation, boardPlayers, lines, notes, selectedLineup, boardObjects, areaSize, boardFrames, activeFrameId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!selectedItem) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.target?.tagName === "TEXTAREA" || event.target?.tagName === "INPUT") return;

      event.preventDefault();
      if (selectedItem.kind === "shape") {
        setLines((prev) => prev.filter((shape) => shape.id !== selectedItem.id));
      }
      if (selectedItem.kind === "object") {
        setBoardObjects((prev) => prev.filter((obj) => obj.id !== selectedItem.id));
      }
      setSelectedItem(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem]);

  useEffect(() => {
    if (!isPlayingFrames || boardFrames.length < 2) return undefined;

    let cancelled = false;
    let animationId = 0;
    let nextStepTimer = 0;

    function showFrame(frame) {
      setBoardPlayers(frame.boardPlayers ?? []);
      setLines(normalizeLines(frame.lines ?? []));
      setBoardObjects(normalizeBoardObjects(frame.boardObjects ?? []));
      setNotes(frame.notes ?? defaultNotes);
      setSelectedItem(null);
      setActiveFrameId(frame.id);
    }

    function playStep(index) {
      if (cancelled) return;
      if (index >= boardFrames.length - 1) {
        showFrame(boardFrames[boardFrames.length - 1]);
        setIsPlayingFrames(false);
        return;
      }

      const fromFrame = boardFrames[index];
      const toFrame = boardFrames[index + 1];
      const fromPlayers = fromFrame.boardPlayers ?? [];
      const toPlayers = toFrame.boardPlayers ?? [];
      const fromObjects = normalizeBoardObjects(fromFrame.boardObjects ?? []);
      const toObjects = normalizeBoardObjects(toFrame.boardObjects ?? []);
      const startedAt = performance.now();
      const duration = 900;

      setLines(normalizeLines(toFrame.lines ?? []));
      setNotes(toFrame.notes ?? defaultNotes);
      setSelectedItem(null);

      function animate(now) {
        if (cancelled) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = easeInOut(progress);

        setBoardPlayers(interpolateItems(fromPlayers, toPlayers, eased));
        setBoardObjects(interpolateItems(fromObjects, toObjects, eased));
        setActiveFrameId(progress < 1 ? fromFrame.id : toFrame.id);

        if (progress < 1) {
          animationId = window.requestAnimationFrame(animate);
          return;
        }

        showFrame(toFrame);
        nextStepTimer = window.setTimeout(() => playStep(index + 1), 180);
      }

      animationId = window.requestAnimationFrame(animate);
    }

    const activeIndex = boardFrames.findIndex((frame) => frame.id === activeFrameId);
    const startIndex = activeIndex >= 0 && activeIndex < boardFrames.length - 1 ? activeIndex : 0;
    playStep(startIndex);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationId);
      window.clearTimeout(nextStepTimer);
    };
  }, [activeFrameId, boardFrames, isPlayingFrames]);

  const ownCount = boardPlayers.filter((p) => p.team === "own").length;
  const opponentCount = boardPlayers.filter((p) => p.team === "opponent").length;
  const selectedShape = getSelectedShape(lines, selectedItem);
  const selectedObject = getSelectedObject(boardObjects, selectedItem);

  function deleteSelectedItem() {
    if (!selectedItem) return;

    if (selectedItem.kind === "shape") {
      setLines((prev) => prev.filter((shape) => shape.id !== selectedItem.id));
    }

    if (selectedItem.kind === "object") {
      setBoardObjects((prev) => prev.filter((obj) => obj.id !== selectedItem.id));
    }

    setSelectedItem(null);
  }

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
    const dx = (delta.x / rect.width) * 100;
    const dy = (delta.y / rect.height) * 100;

    if (String(active.id).startsWith("obj-")) {
      setBoardObjects((prev) =>
        prev.map((obj) =>
          obj.id !== active.id ? obj : { ...obj, x: clamp(obj.x + dx), y: clamp(obj.y + dy) }
        )
      );
      setSelectedItem({ kind: "object", id: String(active.id) });
    } else {
      setBoardPlayers((prev) =>
        prev.map((player) =>
          player.id !== active.id ? player : { ...player, x: clamp(player.x + dx), y: clamp(player.y + dy) }
        )
      );
    }
  }
  function getBoardCoordinates(event) {
    const board = document.getElementById("tactical-board-field");

    if (!board) return null;

    const rect = board.getBoundingClientRect();

    return {
      x: clampBoard(((event.clientX - rect.left) / rect.width) * 100),
      y: clampBoard(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  const isDrawTool = (tool) =>
    tool === "line" ||
    tool === "arrow" ||
    tool === "dashed" ||
    tool === "curve" ||
    tool === "curve-dashed" ||
    tool === "zone";

  function startEditorDrag(event, payload) {
    event.preventDefault();
    event.stopPropagation();

    const point = getBoardCoordinates(event);
    if (!point) return;

    setSelectedItem({ kind: payload.kind, id: payload.id });
    setEditDrag({
      ...payload,
      origin: point,
      originalLines: lines,
      originalObjects: boardObjects,
    });
  }

  function updateShapeDrag(point, drag) {
    const original = drag.originalLines.find((shape) => shape.id === drag.id);
    if (!original) return;

    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;

    setLines((prev) =>
      prev.map((shape) => {
        if (shape.id !== drag.id) return shape;

        if (drag.action === "move") {
          return {
            ...shape,
            startX: clampBoard(original.startX + dx),
            startY: clampBoard(original.startY + dy),
            endX: clampBoard(original.endX + dx),
            endY: clampBoard(original.endY + dy),
          };
        }

        if (drag.action === "start" || drag.action === "end") {
          return {
            ...shape,
            [drag.action === "start" ? "startX" : "endX"]: point.x,
            [drag.action === "start" ? "startY" : "endY"]: point.y,
          };
        }

        if (drag.action === "control") {
          return { ...shape, controlX: point.x, controlY: point.y };
        }

        if (shape.type === "zone" && drag.action?.startsWith("corner-")) {
          const bounds = getShapeBounds(original);
          const localPoint = rotatePoint(point, { x: bounds.cx, y: bounds.cy }, -Number(original.rotation ?? 0));
          const localX = clampBoard(localPoint.x);
          const localY = clampBoard(localPoint.y);

          if (drag.action === "corner-start") {
            return { ...shape, startX: localX, startY: localY };
          }
          if (drag.action === "corner-end") {
            return { ...shape, endX: localX, endY: localY };
          }
          if (drag.action === "corner-start-end") {
            return { ...shape, startX: localX, endY: localY };
          }
          if (drag.action === "corner-end-start") {
            return { ...shape, endX: localX, startY: localY };
          }
        }

        if (shape.type === "zone" && drag.action === "rotate") {
          const bounds = getShapeBounds(original);
          const angle = getAngle({ x: bounds.cx, y: bounds.cy }, point) + 90;
          return { ...shape, rotation: Math.round(angle) };
        }

        return shape;
      })
    );
  }

  function updateObjectDrag(point, drag) {
    const original = drag.originalObjects.find((obj) => obj.id === drag.id);
    if (!original) return;

    setBoardObjects((prev) =>
      prev.map((obj) => {
        if (obj.id !== drag.id) return obj;

        if (drag.action === "scale") {
          const delta = (point.x - drag.origin.x + point.y - drag.origin.y) / 16;
          return { ...obj, scale: Math.max(0.45, Math.min(3.2, Number(original.scale ?? 1) + delta)) };
        }

        if (drag.action === "rotate") {
          return { ...obj, rotation: Math.round(getAngle({ x: original.x, y: original.y }, point) + 90) };
        }

        return obj;
      })
    );
  }

  function handleBoardMouseDown(event) {
    const point = getBoardCoordinates(event);
    if (!point) return;

    const onToken = event.target.closest?.("[data-board-token]");

    if (activeTool.startsWith("stamp-")) {
      if (onToken) return;
      const type = activeTool.replace("stamp-", "");
      const nextObject = {
        id: makeShapeId("obj"),
        type,
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0,
        color: drawColor,
        text: "",
      };
      setBoardObjects((prev) => [...prev, nextObject]);
      setSelectedItem({ kind: "object", id: nextObject.id });
      return;
    }

    if (isDrawTool(activeTool) && !onToken) {
      setDrawingLine({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
      setSelectedItem(null);
      return;
    }

    if (!onToken && activeTool === "move") {
      setSelectedItem(null);
    }
  }

  function handleBoardMouseMove(event) {
    const point = getBoardCoordinates(event);
    if (!point) return;

    if (editDrag) {
      if (editDrag.kind === "shape") updateShapeDrag(point, editDrag);
      if (editDrag.kind === "object") updateObjectDrag(point, editDrag);
      return;
    }

    if (!drawingLine || !isDrawTool(activeTool)) return;
    setDrawingLine((prev) => ({ ...prev, endX: point.x, endY: point.y }));
  }

  function handleBoardMouseUp() {
    if (editDrag) {
      setEditDrag(null);
      return;
    }

    if (!drawingLine || !isDrawTool(activeTool)) return;
    const dx = Math.abs(drawingLine.endX - drawingLine.startX);
    const dy = Math.abs(drawingLine.endY - drawingLine.startY);
    if (dx < 1 && dy < 1) {
      setDrawingLine(null);
      return;
    }

    const nextShape = {
      id: makeShapeId("shape"),
      ...drawingLine,
      controlX: (drawingLine.startX + drawingLine.endX) / 2,
      controlY: ((drawingLine.startY + drawingLine.endY) / 2) - 10,
      color: drawColor,
      type: activeTool,
      rotation: 0,
    };
    setLines((prev) => [...prev, nextShape]);
    setSelectedItem({ kind: "shape", id: nextShape.id });
    setDrawingLine(null);
  }

  function updateSelectedShape(patch) {
    if (!selectedShape) return;
    setLines((prev) => prev.map((shape) => (shape.id === selectedShape.id ? { ...shape, ...patch } : shape)));
  }

  function updateSelectedObject(patch) {
    if (!selectedObject) return;
    setBoardObjects((prev) => prev.map((obj) => (obj.id === selectedObject.id ? { ...obj, ...patch } : obj)));
  }

  function updateAreaSize(key, value) {
    setAreaSize((prev) => ({ ...prev, [key]: clampAreaSize(key, value) }));
  }

  function addSizedArea() {
    const normalizedSize = normalizeAreaSize(areaSize);
    const widthPct = Math.min(96, (normalizedSize.width / FIELD_REFERENCE_SIZE.width) * 100);
    const heightPct = Math.min(96, (normalizedSize.length / FIELD_REFERENCE_SIZE.length) * 100);
    const nextShape = {
      id: makeShapeId("shape"),
      type: "zone",
      color: drawColor,
      rotation: 0,
      startX: clampBoard(50 - widthPct / 2),
      startY: clampBoard(50 - heightPct / 2),
      endX: clampBoard(50 + widthPct / 2),
      endY: clampBoard(50 + heightPct / 2),
      controlX: 50,
      controlY: 40,
      label: `${normalizedSize.width} x ${normalizedSize.length} m`,
    };

    setLines((prev) => [...prev, nextShape]);
    setSelectedItem({ kind: "shape", id: nextShape.id });
    setActiveTool("move");
  }

  function addFrame() {
    setIsPlayingFrames(false);
    const nextFrame = {
      ...buildFrameSnapshot({ boardPlayers, lines, boardObjects, notes }),
      label: `Frame ${boardFrames.length + 1}`,
    };

    setBoardFrames((prev) => [...prev, nextFrame]);
    setActiveFrameId(nextFrame.id);
  }

  function updateActiveFrame() {
    if (!activeFrameId) return;
    setIsPlayingFrames(false);
    const snapshot = buildFrameSnapshot({ boardPlayers, lines, boardObjects, notes });

    setBoardFrames((prev) =>
      prev.map((frame, index) =>
        frame.id === activeFrameId
          ? {
              ...snapshot,
              id: frame.id,
              label: frame.label || `Frame ${index + 1}`,
            }
          : frame
      )
    );
  }

  function loadFrame(frame) {
    setIsPlayingFrames(false);
    setBoardPlayers(frame.boardPlayers ?? []);
    setLines(normalizeLines(frame.lines ?? []));
    setBoardObjects(normalizeBoardObjects(frame.boardObjects ?? []));
    setNotes(frame.notes ?? defaultNotes);
    setSelectedItem(null);
    setActiveFrameId(frame.id);
  }

  function deleteActiveFrame() {
    if (!activeFrameId) return;
    setIsPlayingFrames(false);

    const currentIndex = boardFrames.findIndex((frame) => frame.id === activeFrameId);
    const nextFrames = boardFrames.filter((frame) => frame.id !== activeFrameId);
    const nextFrame = nextFrames[Math.min(currentIndex, nextFrames.length - 1)] ?? null;

    setBoardFrames(nextFrames);
    setSelectedItem(null);

    if (nextFrame) {
      setBoardPlayers(nextFrame.boardPlayers ?? []);
      setLines(normalizeLines(nextFrame.lines ?? []));
      setBoardObjects(normalizeBoardObjects(nextFrame.boardObjects ?? []));
      setNotes(nextFrame.notes ?? defaultNotes);
      setActiveFrameId(nextFrame.id);
      return;
    }

    setActiveFrameId("");
  }

  function resetFrames() {
    setIsPlayingFrames(false);
    setBoardFrames([]);
    setActiveFrameId("");
  }

  function toggleFramePlayback() {
    if (boardFrames.length < 2) return;
    setIsPlayingFrames((prev) => !prev);
  }

  function resetBoard() {
    setOwnFormation("Nessuno");
    setOpponentFormation("Nessuno");
    setBoardPlayers([]);
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
    setSelectedItem(null);
    setLines([]);
    setDrawingLine(null);
    setEditDrag(null);
    setBoardObjects([]);
    setNotes(defaultNotes);
    setBoardFrames([]);
    setActiveFrameId("");
    setIsPlayingFrames(false);
  }

  // ─── Schema save / load ───────────────────────────────────────────────────────
  function saveCurrentSchema() {
    const name = schemaName.trim();
    if (!name) { alert("Inserisci un nome per lo schema"); return; }
    const schema = {
      id: `schema-${Date.now()}`,
      name,
      category: "Personalizzato",
      ownFormation,
      boardPlayers: boardPlayers.map((p) => ({ ...p })),
      lines: lines.map((l) => ({ ...l })),
      boardObjects: boardObjects.map((o) => ({ ...o })),
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedSchemas, schema];
    setSavedSchemas(updated);
    persistSchemas(updated);
    setSchemaName("");
    setSchemaSaved(true);
    setTimeout(() => setSchemaSaved(false), 2200);
  }

  function loadSchema(schema) {
    if (schema.ownFormation && schema.ownFormation !== "Nessuno") {
      setOwnFormation(schema.ownFormation);
    }
    setBoardPlayers(schema.boardPlayers ?? []);
    setLines(normalizeLines(schema.lines ?? []));
    setBoardObjects(normalizeBoardObjects(schema.boardObjects ?? []));
    setSelectedLineup([]);
    setSelectedSlotId(null);
    setSelectedBenchPlayer(null);
    setSelectedItem(null);
  }

  function deleteSchema(id) {
    const updated = savedSchemas.filter((s) => s.id !== id);
    setSavedSchemas(updated);
    persistSchemas(updated);
  }

  // ── Esporta la lavagna corrente come esercizio ────────────────────────────────
  function exportToExercise() {
    // Quando si modifica un esercizio esistente il nome viene dall'esercizio stesso
    const name = editingExerciseId
      ? (editingExerciseName ?? "Esercizio")
      : exName.trim();

    if (!editingExerciseId && !name) {
      setExFeedback({ ok: false, text: "Inserisci il nome dell'esercizio." });
      return;
    }

    const boardSnapshot = {
      boardPlayers: boardPlayers.map((p) => ({ ...p })),
      lines:        lines.map((l) => ({ ...l })),
      boardObjects: boardObjects.map((o) => ({ ...o })),
      ownFormation,
    };

    if (editingExerciseId && setExercises) {
      // Aggiorna il disegno su un esercizio esistente
      setExercises(
        exercises.map((ex) =>
          ex.id === editingExerciseId
            ? { ...ex, tacticalBoard: boardSnapshot }
            : ex
        )
      );
      setExFeedback({ ok: true, text: `Disegno salvato in "${name}". Torna agli esercizi per completarlo.` });
    } else if (setExercises) {
      // Crea un nuovo esercizio con il disegno incorporato
      const newExercise = {
        ...emptyExercise(),
        id:           createId("exercise"),
        title:        name,
        tacticalBoard: boardSnapshot,
      };
      setExercises([...exercises, newExercise]);
      setExFeedback({ ok: true, text: `Esercizio "${name}" creato! Vai agli esercizi per aggiungere descrizione e dettagli.` });
    }
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

      {/* ── Banner: si arriva da un esercizio specifico ── */}
      {editingExerciseId && (
        <div style={exStyles.banner}>
          <span style={exStyles.bannerText}>
            ✏️ Stai modificando il disegno di: <strong>{editingExerciseName || "esercizio"}</strong>
          </span>
          <button
            type="button"
            onClick={() => navigate("/exercises")}
            style={exStyles.bannerBack}
          >
            ← Torna agli esercizi
          </button>
        </div>
      )}

      {/* ── Modal "Inserisci come esercizio" ── */}
      {exModalOpen && (
        <div style={exStyles.modalOverlay} onClick={() => { setExModalOpen(false); setExFeedback(null); }}>
          <div style={exStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>
              {editingExerciseId ? "Salva disegno nell'esercizio" : "Inserisci come esercizio"}
            </h3>
            <p style={{ color: "#94a3b8", margin: "0 0 18px", fontSize: 13, lineHeight: 1.5 }}>
              {editingExerciseId
                ? `Il disegno corrente della lavagna verrà salvato nell'esercizio "${editingExerciseName}".`
                : "La lavagna corrente (giocatori, linee e oggetti) verrà associata a un nuovo esercizio nella libreria."}
            </p>
            {!editingExerciseId && (
              <input
                placeholder="Nome esercizio"
                value={exName}
                onChange={(e) => { setExName(e.target.value); setExFeedback(null); }}
                onKeyDown={(e) => e.key === "Enter" && exportToExercise()}
                autoFocus
                style={exStyles.input}
              />
            )}
            {exFeedback && (
              <div style={{ ...exStyles.feedback, ...(exFeedback.ok ? exStyles.feedbackOk : exStyles.feedbackErr) }}>
                {exFeedback.text}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setExModalOpen(false); setExFeedback(null); }} style={exStyles.btnGhost}>
                Annulla
              </button>
              {exFeedback?.ok ? (
                <button type="button" onClick={() => navigate("/exercises")} style={exStyles.btnPrimary}>
                  Vai agli esercizi →
                </button>
              ) : (
                <button type="button" onClick={exportToExercise} style={exStyles.btnPrimary}>
                  {editingExerciseId ? "Salva disegno" : "Crea esercizio"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

            {/* ── Riga 1: formazioni + azioni gara ── */}
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
              <div style={{ ...boardStyles.actions, marginLeft: "auto" }}>
                <button style={boardStyles.secondaryButton} onClick={clearLineup}>Pulisci titolari</button>
                <button style={boardStyles.primaryButton} onClick={resetBoard}>Reset board</button>
              </div>
            </div>

            {/* ── Riga 2: strumenti di disegno ── */}
            <div style={boardStyles.drawBar}>
              {/* Modalità */}
              <div style={boardStyles.toolGroup}>
                <ToolButton icon={<Move size={17} />} active={activeTool === "move"} onClick={() => setActiveTool("move")} title="Muovi giocatori" />
                <ToolButton
                  icon={<svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}
                  active={activeTool === "line"} onClick={() => setActiveTool("line")} title="Linea continua"
                />
                <ToolButton
                  icon={<svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 3"/></svg>}
                  active={activeTool === "dashed"} onClick={() => setActiveTool("dashed")} title="Linea tratteggiata (traiettoria)"
                />
                <ToolButton icon={<ArrowRight size={17} />} active={activeTool === "arrow"} onClick={() => setActiveTool("arrow")} title="Freccia direzionale" />
                <ToolButton
                  icon={<svg viewBox="0 0 24 18" width="22" height="16"><path d="M2 14 C7 2, 15 2, 22 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}
                  active={activeTool === "curve"} onClick={() => setActiveTool("curve")} title="Linea curva"
                />
                <ToolButton
                  icon={<svg viewBox="0 0 24 18" width="22" height="16"><path d="M2 14 C7 2, 15 2, 22 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3"/></svg>}
                  active={activeTool === "curve-dashed"} onClick={() => setActiveTool("curve-dashed")} title="Linea curva tratteggiata"
                />
                <ToolButton
                  icon={<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"/></svg>}
                  active={activeTool === "zone"} onClick={() => setActiveTool("zone")} title="Zona (rettangolo evidenziato)"
                />
              </div>
              <div style={boardStyles.toolSep} />
              {/* Oggetti campo */}
              <div style={boardStyles.toolGroup}>
                {[
                  { key: "ball", title: "Pallone", icon: <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="8" fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth="1.2"/><polygon points="10,4 13.5,8 12,13 8,13 6.5,8" fill="#333" opacity="0.4"/></svg> },
                  { key: "cone", title: "Cinesino", icon: <svg viewBox="0 0 18 20" width="14" height="17"><polygon points="9,1 17,19 1,19" fill="#f97316"/><ellipse cx="9" cy="19" rx="7" ry="2" fill="#ea580c"/></svg> },
                  { key: "goal", title: "Porta", icon: <svg viewBox="0 0 28 18" width="22" height="15"><rect x="1" y="1" width="26" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
                  { key: "pole", title: "Paletto", icon: <svg viewBox="0 0 10 22" width="9" height="20"><rect x="3" y="0" width="4" height="22" rx="1" fill="currentColor"/><rect x="3" y="0" width="4" height="5" fill="#ef4444"/><rect x="3" y="5" width="4" height="5" fill="white"/><rect x="3" y="10" width="4" height="5" fill="#ef4444"/></svg> },
                  { key: "hurdle", title: "Ostacolino", icon: <svg viewBox="0 0 26 18" width="22" height="16"><path d="M4 16 V5 H22 V16" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/><path d="M6 5 H20" stroke="white" strokeWidth="2"/></svg> },
                  { key: "ring", title: "Cerchio", icon: <svg viewBox="0 0 22 22" width="18" height="18"><circle cx="11" cy="11" r="8" fill="none" stroke="#fbbf24" strokeWidth="3"/></svg> },
                  { key: "ladder", title: "Speed ladder", icon: <svg viewBox="0 0 26 18" width="23" height="16"><path d="M3 3 H23 M3 15 H23" stroke="currentColor" strokeWidth="2"/><path d="M7 3 V15 M13 3 V15 M19 3 V15" stroke="#fbbf24" strokeWidth="2"/></svg> },
                ].map(({ key, title, icon }) => (
                  <ToolButton key={key} icon={icon} active={activeTool === `stamp-${key}`} onClick={() => setActiveTool(`stamp-${key}`)} title={title} />
                ))}
              </div>
              <div style={boardStyles.toolSep} />
              {/* Colori */}
              <div style={boardStyles.toolGroup}>
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setDrawColor(c.value);
                      if (selectedShape) updateSelectedShape({ color: c.value });
                      if (selectedObject) updateSelectedObject({ color: c.value });
                    }}
                    style={{
                      ...boardStyles.colorDot,
                      background: c.value,
                      boxShadow: drawColor === c.value ? `0 0 0 2px rgba(255,255,255,0.9)` : "none",
                    }}
                  />
                ))}
              </div>
              <div style={boardStyles.toolSep} />
              {/* Undo / Cancella */}
              <div style={boardStyles.toolGroup}>
                <ToolButton icon={<Undo2 size={17} />} active={false} onClick={() => setLines((p) => p.slice(0, -1))} title="Annulla ultima linea" />
              </div>
            </div>

            <div style={boardStyles.boardConfigBar}>
              <div style={boardStyles.fieldSizeGroup}>
                <span>Area</span>
                <label style={boardStyles.fieldSizeLabel}>
                  Largh.
                  <input style={boardStyles.fieldSizeInput} type="number" value={areaSize.width} min="1" max="60" onChange={(event) => updateAreaSize("width", event.target.value)} />
                </label>
                <label style={boardStyles.fieldSizeLabel}>
                  Lung.
                  <input style={boardStyles.fieldSizeInput} type="number" value={areaSize.length} min="1" max="110" onChange={(event) => updateAreaSize("length", event.target.value)} />
                </label>
                <small>metri</small>
                <button type="button" style={boardStyles.frameAddButton} onClick={addSizedArea}>
                  Inserisci area
                </button>
              </div>
              <div style={boardStyles.framesGroup}>
                <button type="button" style={boardStyles.frameAddButton} onClick={addFrame}>
                  <Plus size={15} /> Frame
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: activeFrameId ? 1 : 0.5,
                    cursor: activeFrameId ? "pointer" : "not-allowed",
                  }}
                  onClick={updateActiveFrame}
                  disabled={!activeFrameId}
                >
                  Aggiorna
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: boardFrames.length < 2 ? 0.5 : 1,
                    cursor: boardFrames.length < 2 ? "not-allowed" : "pointer",
                  }}
                  onClick={toggleFramePlayback}
                  disabled={boardFrames.length < 2}
                >
                  {isPlayingFrames ? <Pause size={15} /> : <Play size={15} />}
                  Play
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: activeFrameId ? 1 : 0.5,
                    cursor: activeFrameId ? "pointer" : "not-allowed",
                  }}
                  onClick={deleteActiveFrame}
                  disabled={!activeFrameId}
                >
                  Elimina frame
                </button>
                <button
                  type="button"
                  style={{
                    ...boardStyles.frameAddButton,
                    opacity: boardFrames.length ? 1 : 0.5,
                    cursor: boardFrames.length ? "pointer" : "not-allowed",
                  }}
                  onClick={resetFrames}
                  disabled={!boardFrames.length}
                >
                  Reset timeline
                </button>
                {boardFrames.map((frame, index) => (
                  <button
                    key={frame.id}
                    type="button"
                    style={{
                      ...boardStyles.frameButton,
                      ...(activeFrameId === frame.id ? boardStyles.frameButtonActive : {}),
                    }}
                    onClick={() => loadFrame(frame)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {(selectedShape || selectedObject) && (
              <div style={boardStyles.editorBar}>
                <div style={boardStyles.editorMeta}>
                  <strong>{selectedShape ? "Elemento selezionato" : "Oggetto selezionato"}</strong>
                  <span>
                    {selectedShape
                      ? "Trascina endpoint, angoli o maniglia rotazione. Cambia tipo e colore dalla barra."
                      : "Trascina l'oggetto, usa le maniglie per scala e rotazione."}
                  </span>
                </div>
                {selectedShape && (
                  <select
                    value={selectedShape.type}
                    onChange={(event) => updateSelectedShape({ type: event.target.value })}
                    style={boardStyles.editorSelect}
                  >
                    <option value="line">Linea continua</option>
                    <option value="dashed">Linea tratteggiata</option>
                    <option value="arrow">Freccia</option>
                    <option value="curve">Linea curva</option>
                    <option value="curve-dashed">Curva tratteggiata</option>
                    <option value="zone">Zona rettangolare</option>
                  </select>
                )}
                {selectedObject && (
                  <div style={boardStyles.objectControls}>
                    <label style={boardStyles.rangeLabel}>
                      Scala {Number(selectedObject.scale ?? 1).toFixed(1)}x
                      <input
                        type="range"
                        min="0.45"
                        max="3.2"
                        step="0.05"
                        value={Number(selectedObject.scale ?? 1)}
                        onChange={(event) => updateSelectedObject({ scale: Number(event.target.value) })}
                        style={boardStyles.rangeInput}
                      />
                    </label>
                    <label style={boardStyles.rangeLabel}>
                      Rotazione {Math.round(selectedObject.rotation ?? 0)}°
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        value={Number(selectedObject.rotation ?? 0)}
                        onChange={(event) => updateSelectedObject({ rotation: Number(event.target.value) })}
                        style={boardStyles.rangeInput}
                      />
                    </label>
                  </div>
                )}
                <button type="button" style={boardStyles.dangerButton} onClick={deleteSelectedItem}>
                  Elimina
                </button>
              </div>
            )}

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

    <svg style={boardStyles.svgLayer} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        {DRAW_COLORS.map((c) => (
          <marker
            key={c.value}
            id={`ah-${colorId(c.value)}`}
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={c.value} />
          </marker>
        ))}
      </defs>

      {lines.map((shape) => {
        const c = shape.color ?? "white";
        const isSelected = selectedItem?.kind === "shape" && selectedItem.id === shape.id;
        if (shape.type === "zone") {
          const bounds = getShapeBounds(shape);
          const rotation = Number(shape.rotation ?? 0);
          const corners = {
            start: rotatePoint({ x: shape.startX, y: shape.startY }, { x: bounds.cx, y: bounds.cy }, rotation),
            end: rotatePoint({ x: shape.endX, y: shape.endY }, { x: bounds.cx, y: bounds.cy }, rotation),
            startEnd: rotatePoint({ x: shape.startX, y: shape.endY }, { x: bounds.cx, y: bounds.cy }, rotation),
            endStart: rotatePoint({ x: shape.endX, y: shape.startY }, { x: bounds.cx, y: bounds.cy }, rotation),
            rotate: rotatePoint({ x: bounds.cx, y: bounds.y - 7 }, { x: bounds.cx, y: bounds.cy }, rotation),
          };

          return (
            <g key={shape.id}>
              <g transform={`rotate(${rotation} ${bounds.cx} ${bounds.cy})`}>
                <rect
                  data-board-token="true"
                  x={`${bounds.x}%`}
                  y={`${bounds.y}%`}
                  width={`${bounds.width}%`}
                  height={`${bounds.height}%`}
                  fill={c}
                  fillOpacity="0.12"
                  stroke={isSelected ? "#ffffff" : c}
                  strokeWidth={isSelected ? "3" : "2"}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="6 3"
                  strokeOpacity="0.9"
                  onMouseDown={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "move" })}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setLines((prev) => prev.filter((line) => line.id !== shape.id));
                    setSelectedItem(null);
                  }}
                  style={{ cursor: "move" }}
                />
                {shape.label && (
                  <text
                    x={`${bounds.cx}%`}
                    y={`${bounds.cy}%`}
                    fill="#f8fafc"
                    fontSize="3"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: "none" }}
                  >
                    {shape.label}
                  </text>
                )}
              </g>
              {isSelected && (
                <ShapeHandles
                  points={corners}
                  onStart={(event, action) => startEditorDrag(event, { kind: "shape", id: shape.id, action })}
                />
              )}
            </g>
          );
        }

        if (shape.type === "curve" || shape.type === "curve-dashed") {
          const path = `M ${shape.startX} ${shape.startY} Q ${shape.controlX} ${shape.controlY} ${shape.endX} ${shape.endY}`;

          return (
            <g key={shape.id}>
              <path
                data-board-token="true"
                d={path}
                vectorEffect="non-scaling-stroke"
                fill="none"
                stroke={c}
                strokeWidth={isSelected ? "6" : "3"}
                strokeLinecap="round"
                strokeOpacity={isSelected ? "0.9" : "1"}
                strokeDasharray={shape.type === "curve-dashed" ? "10 5" : undefined}
                onMouseDown={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "move" })}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setLines((prev) => prev.filter((line) => line.id !== shape.id));
                  setSelectedItem(null);
                }}
                style={{ cursor: "move" }}
              />
              {isSelected && (
                <>
                  <path
                    d={`M ${shape.startX} ${shape.startY} L ${shape.controlX} ${shape.controlY} L ${shape.endX} ${shape.endY}`}
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.55"
                  />
                  <LineHandle x={shape.startX} y={shape.startY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "start" })} />
                  <LineHandle x={shape.controlX} y={shape.controlY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "control" })} fill="#fbbf24" />
                  <LineHandle x={shape.endX} y={shape.endY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "end" })} />
                </>
              )}
            </g>
          );
        }

        return (
          <g key={shape.id}>
            <line
              data-board-token="true"
              x1={`${shape.startX}%`}
              y1={`${shape.startY}%`}
              x2={`${shape.endX}%`}
              y2={`${shape.endY}%`}
              stroke={c}
              strokeWidth={isSelected ? "6" : "3"}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeOpacity={isSelected ? "0.9" : "1"}
              strokeDasharray={shape.type === "dashed" ? "10 5" : undefined}
              markerEnd={shape.type === "arrow" ? `url(#ah-${colorId(c)})` : undefined}
              onMouseDown={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "move" })}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setLines((prev) => prev.filter((line) => line.id !== shape.id));
                setSelectedItem(null);
              }}
              style={{ cursor: "move" }}
            />
            {isSelected && (
              <>
                <LineHandle x={shape.startX} y={shape.startY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "start" })} />
                <LineHandle x={shape.endX} y={shape.endY} onStart={(event) => startEditorDrag(event, { kind: "shape", id: shape.id, action: "end" })} />
              </>
            )}
          </g>
        );
      })}

      {drawingLine && (() => {
        const c = drawColor;
        if (activeTool === "zone") {
          const x = Math.min(drawingLine.startX, drawingLine.endX);
          const y = Math.min(drawingLine.startY, drawingLine.endY);
          const w = Math.abs(drawingLine.endX - drawingLine.startX);
          const h = Math.abs(drawingLine.endY - drawingLine.startY);
          return (
            <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`}
              fill={c} fillOpacity="0.08" stroke={c} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 3" opacity="0.65" />
          );
        }
        if (activeTool === "curve" || activeTool === "curve-dashed") {
          const controlX = (drawingLine.startX + drawingLine.endX) / 2;
          const controlY = ((drawingLine.startY + drawingLine.endY) / 2) - 10;
          return (
            <path
              d={`M ${drawingLine.startX} ${drawingLine.startY} Q ${controlX} ${controlY} ${drawingLine.endX} ${drawingLine.endY}`}
              vectorEffect="non-scaling-stroke"
              fill="none"
              stroke={c}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.65"
              strokeDasharray={activeTool === "curve-dashed" ? "10 5" : undefined}
            />
          );
        }
        return (
          <line
            x1={`${drawingLine.startX}%`} y1={`${drawingLine.startY}%`}
            x2={`${drawingLine.endX}%`} y2={`${drawingLine.endY}%`}
            stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.6"
            strokeDasharray={activeTool === "dashed" ? "10 5" : undefined}
            markerEnd={activeTool === "arrow" ? `url(#ah-${colorId(c)})` : undefined}
          />
        );
      })()}
    </svg>

    {boardObjects.map((obj) => (
      <FieldObject
        key={obj.id}
        obj={obj}
        activeTool={activeTool}
        selected={selectedItem?.kind === "object" && selectedItem.id === obj.id}
        onSelect={() => setSelectedItem({ kind: "object", id: obj.id })}
        onEditStart={startEditorDrag}
        onRemove={(id) => {
          setBoardObjects((prev) => prev.filter((o) => o.id !== id));
          setSelectedItem(null);
        }}
      />
    ))}

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
              <Note title="Costruzione" value={notes.costruzione} onChange={(v) => setNotes((p) => ({ ...p, costruzione: v }))} />
              <Note title="Rifinitura" value={notes.rifinitura} onChange={(v) => setNotes((p) => ({ ...p, rifinitura: v }))} />
              <Note title="Transizione" value={notes.transizione} onChange={(v) => setNotes((p) => ({ ...p, transizione: v }))} />
              <Note title="Non possesso" value={notes.nonPossesso} onChange={(v) => setNotes((p) => ({ ...p, nonPossesso: v }))} />
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

          {/* ── Schemi Salvati ── */}
          <AppCard>
            <h3 style={styles.cardTitle}>Schemi salvati</h3>

            {/* Salva schema corrente */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                placeholder="Nome schema..."
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCurrentSchema()}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 10,
                  color: "white",
                  padding: "8px 11px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={saveCurrentSchema}
                style={boardStyles.frameAddButton}
              >
                Salva
              </button>
              {schemaSaved && <span style={{ color: "#4ade80", fontSize: 13, marginLeft: 8 }}>✓ Salvato</span>}
            </div>

            {/* Esporta in esercizi */}
            <button
              type="button"
              onClick={() => { setExName(""); setExFeedback(null); setExModalOpen(true); }}
              style={boardStyles.exportExerciseBtn}
            >
              📋 Inserisci come esercizio
            </button>

            {/* Preset palle inattive */}
            <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0, color: "#64748b", margin: "12px 0 8px" }}>
              Preset palle inattive
            </p>
            <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              {PRESET_SCHEMAS.map((preset) => (
                <div key={preset.id} style={boardStyles.schemaRow}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 12, lineHeight: 1.2, display: "block" }}>{preset.name}</strong>
                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{preset.category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSchema(preset)}
                    style={boardStyles.schemaLoadBtn}
                  >
                    Carica
                  </button>
                </div>
              ))}
            </div>

            {/* Schemi personalizzati */}
            {savedSchemas.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0, color: "#64748b", margin: "0 0 8px" }}>
                  Personalizzati ({savedSchemas.length})
                </p>
                <div style={{ display: "grid", gap: 6 }}>
                  {savedSchemas.map((schema) => (
                    <div key={schema.id} style={boardStyles.schemaRow}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 12, lineHeight: 1.2, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {schema.name}
                        </strong>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{schema.ownFormation}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => loadSchema(schema)}
                          style={boardStyles.schemaLoadBtn}
                        >
                          Carica
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSchema(schema.id)}
                          style={{ ...boardStyles.schemaLoadBtn, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {savedSchemas.length === 0 && (
              <p style={{ color: "#475569", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Salva la posizione corrente per ritrovarla in qualsiasi momento.
              </p>
            )}
          </AppCard>
        </div>
      </div>
    </div>
  );
}
// ─── Icone oggetti campo ──────────────────────────────────────────────────────
function FieldObjectIcon({ type }) {
  if (type === "ball") return (
    <svg viewBox="0 0 36 36" width="30" height="30" style={{ display: "block" }}>
      <defs>
        <radialGradient id="ballLight" cx="33%" cy="26%" r="72%">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.66" stopColor="#e5e7eb" />
          <stop offset="1" stopColor="#64748b" />
        </radialGradient>
      </defs>
      <circle cx="18" cy="18" r="15" fill="url(#ballLight)" stroke="#0f172a" strokeWidth="1.1" />
      <path d="M18 7 L24 12 L22 20 H14 L12 12 Z" fill="#0f172a" opacity="0.95" />
      <path d="M18 7 C14 8 12 10 12 12 M18 7 C22 8 24 10 24 12 M14 20 C15 23 21 23 22 20" stroke="#f8fafc" strokeWidth="1.2" fill="none" opacity="0.65" />
      <path d="M12 12 L5 10 M24 12 L31 10 M14 20 L9 28 M22 20 L27 28" stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.78" />
      <path d="M5 10 C6 6 10 4 14 3 M31 10 C30 6 26 4 22 3 M9 28 C14 32 22 32 27 28" stroke="#0f172a" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
  if (type === "cone") return (
    <svg viewBox="0 0 22 24" width="22" height="24" style={{ display: "block" }}>
      <polygon points="11,1 21,23 1,23" fill="#f97316" />
      <ellipse cx="11" cy="23" rx="8" ry="2" fill="#ea580c" />
      <line x1="5" y1="14" x2="17" y2="14" stroke="white" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
  if (type === "goal") return (
    <svg viewBox="0 0 54 34" width="48" height="30" style={{ display: "block" }}>
      <path d="M5 29 V7 H49 V29" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinejoin="round" />
      <path d="M9 29 V11 H45 V29" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.2" />
      <path d="M13 11 V29 M21 11 V29 M29 11 V29 M37 11 V29 M9 17 H45 M9 23 H45" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
      <path d="M5 29 H49" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (type === "pole") return (
    <svg viewBox="0 0 14 38" width="14" height="38" style={{ display: "block" }}>
      <rect x="5" y="0" width="4" height="38" rx="2" fill="#fbbf24" />
      <rect x="5" y="0" width="4" height="8" rx="2" fill="#ef4444" />
      <rect x="5" y="8" width="4" height="8" fill="white" />
      <rect x="5" y="16" width="4" height="8" fill="#ef4444" />
    </svg>
  );
  if (type === "hurdle") return (
    <svg viewBox="0 0 40 26" width="38" height="24" style={{ display: "block" }}>
      <path d="M7 23 V8 H33 V23" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8 H30" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 23 H13 M27 23 H33" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (type === "ring") return (
    <svg viewBox="0 0 34 34" width="32" height="32" style={{ display: "block" }}>
      <circle cx="17" cy="17" r="12" fill="none" stroke="#fbbf24" strokeWidth="4" />
      <circle cx="17" cy="17" r="8" fill="rgba(251,191,36,0.08)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" />
    </svg>
  );
  if (type === "ladder") return (
    <svg viewBox="0 0 58 28" width="54" height="26" style={{ display: "block" }}>
      <path d="M5 5 H53 M5 23 H53" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 5 V23 M23 5 V23 M33 5 V23 M43 5 V23" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  return null;
}

function LineHandle({ x, y, onStart, fill = "#0f172a" }) {
  return (
    <circle
      data-board-token="true"
      cx={`${x}%`}
      cy={`${y}%`}
      r="1.4"
      fill={fill}
      stroke="#ffffff"
      strokeWidth="0.45"
      onMouseDown={onStart}
      style={{ cursor: "grab" }}
    />
  );
}

function ShapeHandles({ points, onStart }) {
  return (
    <>
      <line
        x1={`${points.rotate.x}%`}
        y1={`${points.rotate.y}%`}
        x2={`${(points.start.x + points.end.x) / 2}%`}
        y2={`${(points.start.y + points.end.y) / 2}%`}
        stroke="#ffffff"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeDasharray="4 3"
        opacity="0.8"
      />
      <LineHandle x={points.start.x} y={points.start.y} onStart={(event) => onStart(event, "corner-start")} />
      <LineHandle x={points.end.x} y={points.end.y} onStart={(event) => onStart(event, "corner-end")} />
      <LineHandle x={points.startEnd.x} y={points.startEnd.y} onStart={(event) => onStart(event, "corner-start-end")} />
      <LineHandle x={points.endStart.x} y={points.endStart.y} onStart={(event) => onStart(event, "corner-end-start")} />
      <circle
        data-board-token="true"
        cx={`${points.rotate.x}%`}
        cy={`${points.rotate.y}%`}
        r="1.4"
        fill="#fbbf24"
        stroke="#111827"
        strokeWidth="0.45"
        onMouseDown={(event) => onStart(event, "rotate")}
        style={{ cursor: "grab" }}
      />
    </>
  );
}

// ─── Oggetto campo draggable ──────────────────────────────────────────────────
function FieldObject({ obj, activeTool, selected, onSelect, onEditStart, onRemove }) {
  const isDraggable = activeTool === "move" || selected;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: obj.id,
    disabled: !isDraggable,
  });

  return (
    <div
      ref={setNodeRef}
      data-board-token="true"
      title="Doppio click per rimuovere"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onRemove(obj.id);
      }}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      style={{
        position: "absolute",
        left: `${obj.x}%`,
        top: `${obj.y}%`,
        transform: transform
          ? `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) rotate(${obj.rotation ?? 0}deg) scale(${obj.scale ?? 1})`
          : `translate(-50%, -50%) rotate(${obj.rotation ?? 0}deg) scale(${obj.scale ?? 1})`,
        zIndex: 20,
        cursor: isDraggable ? "grab" : "crosshair",
        userSelect: "none",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
        outline: selected ? "2px solid rgba(255,255,255,0.9)" : "none",
        outlineOffset: 5,
        borderRadius: 10,
      }}
    >
      <FieldObjectIcon type={obj.type} />
      {selected && (
        <>
          <button
            type="button"
            data-board-token="true"
            title="Elimina"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(obj.id);
            }}
            style={{ ...boardStyles.objectHandle, right: -16, top: -16, background: "#ef4444", color: "white", fontSize: 10, fontWeight: 900 }}
          >
            x
          </button>
          <button
            type="button"
            data-board-token="true"
            title="Scala"
            onMouseDown={(event) => onEditStart(event, { kind: "object", id: obj.id, action: "scale" })}
            style={{ ...boardStyles.objectHandle, right: -14, bottom: -14, cursor: "nwse-resize" }}
          />
          <button
            type="button"
            data-board-token="true"
            title="Ruota"
            onMouseDown={(event) => onEditStart(event, { kind: "object", id: obj.id, action: "rotate" })}
            style={{ ...boardStyles.objectHandle, left: "50%", top: -24, transform: "translateX(-50%)", background: "#fbbf24" }}
          />
        </>
      )}
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
      data-board-token="true"
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

function Note({ title, value, onChange }) {
  return (
    <div style={boardStyles.note}>
      <strong style={{ fontSize: 13, color: "#e2e8f0" }}>{title}</strong>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={boardStyles.noteTextarea}
        rows={3}
      />
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

/* ─── Esercizio export styles ─────────────────────────────────────────────── */
const exStyles = {
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 18px",
    marginBottom: 16,
    borderRadius: 14,
    background: "rgba(234,179,8,0.1)",
    border: "1px solid rgba(234,179,8,0.3)",
    flexWrap: "wrap",
  },
  bannerText: {
    fontSize: 13,
    color: "#fde68a",
    lineHeight: 1.4,
  },
  bannerBack: {
    background: "transparent",
    border: "none",
    color: "#fbbf24",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
    padding: 0,
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
    padding: 20,
  },
  modal: {
    background: "#1a1f2e",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 28,
    width: "min(460px, 100%)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 15,
    outline: "none",
    marginBottom: 4,
  },
  feedback: {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 600,
  },
  feedbackOk: {
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.28)",
    color: "#86efac",
  },
  feedbackErr: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.26)",
    color: "#fca5a5",
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#94a3b8",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
};

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
    marginBottom: 10,
  },

  drawBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 16,
  },

  toolGroup: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },

  toolSep: {
    width: 1,
    height: 28,
    background: "rgba(255,255,255,0.1)",
    margin: "0 4px",
  },

  colorDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.25)",
    cursor: "pointer",
    transition: "box-shadow 0.15s",
    padding: 0,
    minHeight: 0,
  },

  boardConfigBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    margin: "-6px 0 14px",
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(255,255,255,0.07)",
  },

  fieldSizeGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },

  fieldSizeLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#94a3b8",
  },

  fieldSizeInput: {
    width: 58,
    background: "rgba(255,255,255,0.05)",
    color: "#f8fafc",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 9,
    padding: "6px 7px",
    fontWeight: 900,
    outline: "none",
  },

  framesGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },

  schemaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "9px 11px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },

  schemaLoadBtn: {
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(37,99,235,0.14)",
    color: "#93c5fd",
    borderRadius: 9,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1.2,
  },

  exportExerciseBtn: {
    width: "100%",
    marginBottom: 4,
    padding: "9px 14px",
    borderRadius: 11,
    border: "1px solid rgba(34,197,94,0.3)",
    background: "rgba(34,197,94,0.1)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.2,
  },

  frameAddButton: {
    border: "1px solid rgba(96,165,250,0.25)",
    background: "rgba(37,99,235,0.16)",
    color: "#dbeafe",
    borderRadius: 12,
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  frameButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    fontWeight: 900,
    cursor: "pointer",
  },

  frameButtonActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid rgba(147,197,253,0.6)",
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

  svgLayer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 15,
    overflow: "visible",
  },

  editorBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "10px 12px",
    margin: "-6px 0 14px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  editorMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    color: "#e2e8f0",
    fontSize: 12,
    minWidth: 220,
    flex: 1,
  },

  editorSelect: {
    backgroundColor: "#0f172a",
    color: "#fff",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 800,
    outline: "none",
    colorScheme: "dark",
  },

  editorValue: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    padding: "9px 10px",
    borderRadius: 12,
    background: "rgba(37,99,235,0.14)",
    border: "1px solid rgba(96,165,250,0.18)",
  },

  objectControls: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(150px, 1fr))",
    gap: 10,
    minWidth: 320,
  },

  rangeLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(37,99,235,0.14)",
    border: "1px solid rgba(96,165,250,0.18)",
  },

  rangeInput: {
    width: "100%",
    accentColor: "#60a5fa",
  },

  dangerButton: {
    border: "1px solid rgba(248,113,113,0.24)",
    background: "rgba(239,68,68,0.14)",
    color: "#fecaca",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  objectHandle: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #ffffff",
    background: "#0f172a",
    padding: 0,
    zIndex: 90,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
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

  noteTextarea: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.5,
    padding: "8px 10px",
    resize: "vertical",
    outline: "none",
    marginTop: 2,
    boxSizing: "border-box",
    minHeight: 68,
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
