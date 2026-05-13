export const STORAGE_KEY = "calciolab-platform-v2";

export const emptyRatings = {
  technique: 5,
  vision: 5,
  intensity: 5,
  speed: 5,
  physicality: 5,
  leadership: 5,
  tactics: 5,
  mentality: 5,
};

export function emptyPlayer() {
  return {
    name: "",
    role: "",
    secondaryRole: "",
    foot: "Dx",
    status: "Disponibile",
    birthDate: "",
    height: "",
    weight: "",
    nationality: "",
    shirtNumber: "",
    injuryType: "",
    expectedReturn: "",
    returnPhase: "",
    weeklyGoal: "",
    strengths: "",
    improvements: "",
    individualGoals: "",
    videoLink: "",
    notes: "",
    photo: "",
    ratings: { ...emptyRatings },
  };
}

export function emptyExercise() {
  return {
    title: "",
    category: "Possesso",
    phase: "Possesso consolidato",
    objective: "",
    duration: "20",
    players: "",
    intensity: "Media",
    difficulty: "Intermedio",
    fieldSize: "",
    material: "",
    coachingPoints: "",
    variants: "",
    description: "",
    image: "",
  };
}

export function emptyPhysicalTest() {
  return {
    playerId: "",
    date: new Date().toISOString().slice(0, 10),
    gaconLevel: "",
    sprint10m: "",
    sprint30m: "",
    jumpCm: "",
    yoYo: "",
    weight: "",
    bodyFat: "",
    notes: "",
  };
}

export const initialPlayers = [
  {
    id: 1,
    name: "Luca Rossi",
    role: "Centrale",
    secondaryRole: "Braccetto destro",
    foot: "Dx",
    status: "Disponibile",
    birthDate: "2001-04-12",
    height: "186",
    weight: "78",
    nationality: "Italia",
    shirtNumber: "5",
    injuryType: "",
    expectedReturn: "",
    strengths: "Leadership difensiva, lettura preventiva, duello aereo.",
    improvements: "Velocizzare la prima giocata sotto pressione.",
    individualGoals: "Aumentare precisione nel cambio gioco e gestione linea alta.",
    videoLink: "",
    notes: "Leader difensivo, buona lettura preventiva.",
    photo: "",
    ratings: { technique: 7, vision: 7, intensity: 8, speed: 6, physicality: 8, leadership: 9, tactics: 8, mentality: 8 },
  },
];

export const initialExercises = [
  {
    id: 1,
    title: "Rondo posizionale 5v2+2",
    category: "Possesso",
    phase: "Possesso consolidato",
    objective: "Allenare orientamento del corpo, terzo uomo e linee di passaggio.",
    duration: "18",
    players: "9",
    intensity: "Media",
    difficulty: "Intermedio",
    fieldSize: "22x18",
    material: "Cinesini, palloni, casacche",
    coachingPoints: "Postura aperta, controllo orientato, tempi del terzo uomo.",
    variants: "Ridurre spazio; obbligo due tocchi.",
    description: "Cinque giocatori esterni, due jolly interni e due difendenti.",
    image: "",
  },
];

export const initialSessions = [];

export const initialMatches = [];

export const initialPhysicalTests = [];
