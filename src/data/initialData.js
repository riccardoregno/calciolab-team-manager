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
    email: "",
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
    photoSize: 100,
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
    premium: false,
    tags: [],
    ageGroup: "Tutte",
    playersRange: "",
    goal: "",
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

// Nessun giocatore demo: il nuovo utente parte con rosa vuota.
// Il guard hasUserLocalRecords in teamData.js è aggiornato di conseguenza.
export const initialPlayers = [];

export const initialExercises = [
  {
    id: "exercise-initial-1",
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
    premium: false,
    tags: ["possesso", "terzo uomo", "orientamento"],
    ageGroup: "Tutte",
    playersRange: "8-10",
    goal: "Possesso",
  },
  {
    id: "exercise-initial-2",
    title: "Pressione alta 7v7+3",
    category: "Pressing",
    phase: "Non possesso",
    objective: "Coordinare uscite, coperture preventive e aggressione sulla prima costruzione.",
    duration: "22",
    players: "17",
    intensity: "Alta",
    difficulty: "Avanzato",
    fieldSize: "55x45",
    material: "Palloni, casacche, porte ridotte, cinesini",
    coachingPoints: "Trigger di pressione, postura del lato debole, tempi della linea.",
    variants: "Partenza dal portiere; bonus riconquista entro 6 secondi.",
    description: "Due squadre cercano di consolidare o rompere la pressione con tre jolly interni.",
    image: "",
    premium: true,
    tags: ["pressing", "riaggressione", "linea alta"],
    ageGroup: "Prima squadra",
    playersRange: "16-20",
    goal: "Pressing",
  },
  {
    id: "exercise-initial-3",
    title: "Transizione positiva con finalizzazione",
    category: "Transizione",
    phase: "Transizione positiva",
    objective: "Attaccare rapidamente la porta dopo recupero palla.",
    duration: "18",
    players: "12",
    intensity: "Alta",
    difficulty: "Intermedio",
    fieldSize: "45x35",
    material: "Palloni, casacche, 2 porte",
    coachingPoints: "Prima giocata avanti, attacco profondita, sostegno sotto palla.",
    variants: "Limite 8 secondi per concludere; aggiungere difendente in rincorsa.",
    description: "Recupero in zona centrale e sviluppo rapido verso la porta.",
    image: "",
    premium: true,
    tags: ["transizione", "finalizzazione", "recupero palla"],
    ageGroup: "Tutte",
    playersRange: "10-14",
    goal: "Transizione",
  },
];

export const initialSessions = [];

export const initialMatches = [];

export const initialPhysicalTests = [];
