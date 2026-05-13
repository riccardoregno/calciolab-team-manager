export function formatDate(d){
  if(!d) return "-";

  return new Intl.DateTimeFormat("it-IT",{
    weekday:"long",
    day:"2-digit",
    month:"long",
    year:"numeric"
  }).format(new Date(d));
}

export function formatShortDate(d){
  if(!d) return "-";

  return new Intl.DateTimeFormat("it-IT",{
    day:"2-digit",
    month:"2-digit",
    year:"numeric"
  }).format(new Date(d));
}

export function defaultPlayerEventData(){
  return {
    status:"Presente",
    minutes:"",
    goals:"0",
    assists:"0",
    rating:"",
    rpe:"",
    yellowCards:"0",
    redCards:"0"
  };
}

export function normalizeSession(s){
  if(!s) return s;

  return {
    ...s,
    type:s.type || "Allenamento",
    date:s.date || new Date().toISOString().slice(0, 10),
    title:s.title || "Seduta",
    exercises:s.exercises || [],
    attendance:s.attendance || {}
  };
}

export function getSessionLoad(session){
  const duration = Number(session.duration || 0);
  const rpeValues = Object.values(session.attendance || {})
    .map((entry) => Number(entry.rpe || 0))
    .filter(Boolean);
  const avgRpe = rpeValues.length
    ? Math.round(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length)
    : Number(session.rpe || 0);

  return duration * avgRpe;
}

export function createId(prefix = "id"){
  if(typeof crypto !== "undefined" && crypto.randomUUID){
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizePlayer(player){
  return {
    ...player,
    shirtNumber: player.shirtNumber || player.number || "",
    status: player.status || "Disponibile",
    returnPhase: player.returnPhase || "",
    weeklyGoal: player.weeklyGoal || "",
    ratings: player.ratings || {},
  };
}

export function normalizeExercise(exercise){
  return {
    ...exercise,
    fieldSize: exercise.fieldSize || exercise.space || "",
  };
}

export function normalizeMatch(match){
  return {
    ...match,
    type: "Partita",
    title: match.title || `CalcioLab - ${match.opponent || "Avversario"}`,
    attendance: match.attendance || {},
    lineup: {
      calledUpIds: match.lineup?.calledUpIds || [],
      starterIds: match.lineup?.starterIds || [],
      benchIds: match.lineup?.benchIds || [],
      captainId: match.lineup?.captainId || "",
      roles: match.lineup?.roles || {},
      ready: Boolean(match.lineup?.ready),
    },
    matchPlan: match.matchPlan || "",
    opponentNotes: match.opponentNotes || "",
    opponentScouting: {
      formation: match.opponentScouting?.formation || "",
      lineup: match.opponentScouting?.lineup || [],
      keyPlayers: match.opponentScouting?.keyPlayers || "",
      strengths: match.opponentScouting?.strengths || "",
      weaknesses: match.opponentScouting?.weaknesses || "",
      setPiecesFor: match.opponentScouting?.setPiecesFor || "",
      setPiecesAgainst: match.opponentScouting?.setPiecesAgainst || "",
      returnLegNotes: match.opponentScouting?.returnLegNotes || "",
    },
    staffNotes: match.staffNotes || "",
  };
}

export function normalizePhysicalTest(test){
  return {
    ...test,
    date: test.date || new Date().toISOString().slice(0, 10),
    playerId: test.playerId || "",
    gaconLevel: test.gaconLevel || "",
  };
}

export function normalizeAppState(state = {}){
  return {
    players: (state.players || []).map(normalizePlayer),
    exercises: (state.exercises || []).map(normalizeExercise),
    sessions: (state.sessions || []).map(normalizeSession),
    matches: (state.matches || []).map(normalizeMatch),
    physicalTests: (state.physicalTests || []).map(normalizePhysicalTest),
    appSettings: normalizeAppSettings(state.appSettings || {}),
  };
}

export function normalizeAppSettings(settings = {}){
  return {
    coachParameters: {
      method: settings.coachParameters?.method || "standard",
      category: settings.coachParameters?.category || "adulti",
      groupA: Number(settings.coachParameters?.groupA || 19),
      groupB: Number(settings.coachParameters?.groupB || 17),
      groupC: Number(settings.coachParameters?.groupC || 15),
      workBlocks: settings.coachParameters?.workBlocks || [
        { label: "15/15", seconds: 15, percent: 0.95, reps: 10, sets: 2, recovery: "2' tra serie" },
        { label: "30/30", seconds: 30, percent: 0.9, reps: 8, sets: 2, recovery: "3' tra serie" },
        { label: "45/15", seconds: 45, percent: 0.85, reps: 6, sets: 2, recovery: "3' tra serie" },
      ],
    },
    dashboardWidgets: settings.dashboardWidgets || {
      hero: true,
      nextEvent: true,
      kpis: true,
      weekFocus: true,
      rosterStatus: true,
      coachAlerts: true,
      recentActivities: true,
      quickActions: true,
    },
  };
}

export function getAvailabilityGroups(players = []){
  return {
    available: players.filter((player) => player.status === "Disponibile"),
    limited: players.filter((player) =>
      ["Recupero", "Differenziato"].includes(player.status)
    ),
    injured: players.filter((player) => player.status === "Infortunato"),
    suspended: players.filter((player) => player.status === "Squalificato"),
    unavailable: players.filter((player) =>
      ["Permesso", "Assente"].includes(player.status)
    ),
  };
}

export function getLineup(match){
  return {
    calledUpIds: match?.lineup?.calledUpIds || [],
    starterIds: match?.lineup?.starterIds || [],
    benchIds: match?.lineup?.benchIds || [],
    captainId: match?.lineup?.captainId || "",
    roles: match?.lineup?.roles || {},
    ready: Boolean(match?.lineup?.ready),
  };
}

export function uniqueIds(ids){
  return Array.from(new Set(ids));
}

export function estimateMasFromGacon(level){
  const value = Number(level || 0);
  if(!value) return 0;

  return Number((8 + value * 0.5).toFixed(1));
}

export function estimateMasFromYoYo(distance){
  const value = Number(distance || 0);
  if(!value) return 0;

  return Number((10 + value / 400).toFixed(1));
}

export function getPhysicalReference(test = {}, parameters = {}){
  const settings = normalizeAppSettings({ coachParameters: parameters }).coachParameters;
  const gaconMas = estimateMasFromGacon(test.gaconLevel);
  const yoYoMas = estimateMasFromYoYo(test.yoYo);
  const mas = gaconMas || yoYoMas;

  if(!mas){
    return {
      mas: 0,
      group: "Da testare",
      intensity: "Inserisci Gacon o Yo-Yo",
      reps: [],
    };
  }

  const group = mas >= settings.groupA ? "Gruppo A"
    : mas >= settings.groupB ? "Gruppo B"
    : mas >= settings.groupC ? "Gruppo C"
    : "Gruppo D";

  const intensity = mas >= settings.groupA ? "Alta capacita aerobica"
    : mas >= settings.groupB ? "Intermedio alto"
    : mas >= settings.groupC ? "Costruzione"
    : "Da proteggere";

  const distanceForSeconds = (seconds, percent) =>
    Math.round((mas * 1000 / 3600) * seconds * percent);

  return {
    mas,
    group,
    intensity,
    reps: settings.workBlocks.map((block) => ({
      ...block,
      meters: distanceForSeconds(block.seconds, block.percent),
    })),
  };
}

export function generatePhysicalWorkout(players = [], tests = [], parameters = {}){
  return players.map((player) => {
    const latest = tests
      .filter((test) => String(test.playerId) === String(player.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const reference = getPhysicalReference(latest, parameters);

    return { player, latest, reference };
  });
}

export function getCoachAlerts({ players = [], matches = [], physicalTests = [], sessions = [] } = {}){
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const alerts = [];

  players.forEach((player) => {
    const latestTest = physicalTests
      .filter((test) => String(test.playerId) === String(player.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!latestTest || new Date(latestTest.date) < thirtyDaysAgo) {
      alerts.push({ tone: "orange", text: `${player.name}: test fisico da aggiornare` });
    }

    if (player.status === "Infortunato" && player.expectedReturn) {
      alerts.push({ tone: "red", text: `${player.name}: rientro previsto ${player.expectedReturn}` });
    }
  });

  matches
    .filter((match) => new Date(match.date) >= now)
    .forEach((match) => {
      if (!match.lineup?.ready) alerts.push({ tone: "blue", text: `${match.title}: distinta non pronta` });
      if (!match.opponentScouting?.formation && !match.opponentScouting?.lineup?.length) {
        alerts.push({ tone: "purple", text: `${match.opponent || "Avversario"}: scouting mancante` });
      }
    });

  sessions.forEach((session) => {
    if (!session.objective) alerts.push({ tone: "orange", text: `${session.title}: obiettivo seduta mancante` });
  });

  return alerts.slice(0, 8);
}

export function getPlayerSummary(player, { sessions = [], matches = [], physicalTests = [] } = {}){
  if(!player){
    return {
      stats: { presences: 0, minutes: 0, goals: 0, assists: 0, avgRpe: 0, load: 0 },
      latestTests: [],
      recentEvents: [],
      alerts: [],
    };
  }

  const events = [...sessions, ...matches];
  const playerEvents = events
    .map((event) => {
      const data = event.attendance?.[player.id];
      if(!data) return null;
      return { event, data };
    })
    .filter(Boolean);

  const rpeValues = playerEvents
    .map(({ data }) => Number(data.rpe || 0))
    .filter(Boolean);
  const minutes = playerEvents.reduce((sum, { data }) => sum + Number(data.minutes || 0), 0);
  const load = playerEvents.reduce((sum, { event, data }) => {
    const duration = Number(data.minutes || event.duration || 0);
    const rpe = Number(data.rpe || 0);
    return sum + duration * rpe;
  }, 0);
  const latestTests = physicalTests
    .filter((test) => String(test.playerId) === String(player.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const alerts = [];
  if(player.status && player.status !== "Disponibile"){
    alerts.push(`${player.status}${player.expectedReturn ? ` · rientro ${player.expectedReturn}` : ""}`);
  }
  if(latestTests.length === 0){
    alerts.push("Nessun test fisico registrato");
  }
  if(load > 900){
    alerts.push("Carico recente alto");
  }

  return {
    stats: {
      presences: playerEvents.filter(({ data }) => data.status === "Presente").length,
      minutes,
      goals: playerEvents.reduce((sum, { data }) => sum + Number(data.goals || 0), 0),
      assists: playerEvents.reduce((sum, { data }) => sum + Number(data.assists || 0), 0),
      avgRpe: rpeValues.length ? Math.round(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) : 0,
      load,
    },
    latestTests,
    recentEvents: playerEvents
      .sort((a, b) => new Date(b.event.date) - new Date(a.event.date))
      .slice(0, 6),
    alerts,
  };
}
