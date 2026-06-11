export const STORAGE_KEY = "calciolab_tactical_board_v1";
export const SCHEMAS_KEY  = "calciolab_tactical_schemas_v1";
export const EXERCISE_MODAL = "export-exercise";
export const EXERCISE_DRAFT_KEY = "calciolab_tactical_exercise_draft_v1";

export const defaultNotes = {
  costruzione: "Uscita pulita, superiorità posizionale e linee interne leggibili.",
  rifinitura: "Connessioni tra le linee, ampiezza utile e attacco coordinato della profondità.",
  transizione: "Riaggressione immediata o protezione centrale dopo perdita.",
  nonPossesso: "Squadra corta, distanze compatte e orientamento sul lato forte.",
};

export function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage piena o private mode — ignoriamo silenziosamente
  }
}

export function loadExerciseDraftName(fallback = "") {
  try {
    return localStorage.getItem(EXERCISE_DRAFT_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function clearExerciseDraftName() {
  try {
    localStorage.removeItem(EXERCISE_DRAFT_KEY);
  } catch {
    // storage unavailable — silently ignore
  }
}

export function loadSchemas() {
  try {
    const raw = localStorage.getItem(SCHEMAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function persistSchemas(schemas) {
  try {
    localStorage.setItem(SCHEMAS_KEY, JSON.stringify(schemas));
  } catch {
    // silently ignore
  }
}

// ─── Preset schemi palle inattive ─────────────────────────────────────────────
export const PRESET_SCHEMAS = [
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

