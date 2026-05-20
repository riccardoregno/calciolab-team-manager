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
    // FIX #12: ID sempre stringa
    id: s.id ? String(s.id) : s.id,
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
    // FIX #12: ID sempre stringa — elimina type mismatch tra numeric initialData e UUID creati dall'utente
    id: String(player.id),
    shirtNumber: player.shirtNumber || player.number || "",
    status: player.status || "Disponibile",
    returnPhase: player.returnPhase || "",
    weeklyGoal: player.weeklyGoal || "",
    strengths: player.strengths || "",
    improvements: player.improvements || "",
    individualGoals: player.individualGoals || "",
    thirtyDayGoal: player.thirtyDayGoal || "",
    developmentFocus: player.developmentFocus || "",
    trainingActions: player.trainingActions || "",
    videoReviewNotes: player.videoReviewNotes || "",
    successMetrics: player.successMetrics || "",
    coachFeedback: player.coachFeedback || "",
    ratings: player.ratings || {},
    gruppo: player.gruppo || "prima",
    injuries: Array.isArray(player.injuries) ? player.injuries : [],
  };
}

export function normalizeExercise(exercise){
  return {
    ...exercise,
    fieldSize: exercise.fieldSize || exercise.space || "",
    premium: Boolean(exercise.premium),
    tags: Array.isArray(exercise.tags)
      ? exercise.tags
      : String(exercise.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ageGroup: exercise.ageGroup || "Tutte",
    playersRange: exercise.playersRange || exercise.players || "",
    goal: exercise.goal || exercise.objective || "",
  };
}

export function normalizeMatch(match){
  return {
    ...match,
    // FIX #12: ID sempre stringa
    id: match.id ? String(match.id) : match.id,
    type: "Partita",
    title: match.title || `CalcioLab - ${match.opponent || "Avversario"}`,
    homeLogo: match.homeLogo || "",
    awayLogo: match.awayLogo || "",
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
      lineup: (match.opponentScouting?.lineup || []).map((player) => ({
        ...player,
        birthYear: player.birthYear || "",
      })),
      keyPlayers: match.opponentScouting?.keyPlayers || "",
      strengths: match.opponentScouting?.strengths || "",
      weaknesses: match.opponentScouting?.weaknesses || "",
      setPiecesFor: match.opponentScouting?.setPiecesFor || "",
      setPiecesAgainst: match.opponentScouting?.setPiecesAgainst || "",
      returnLegNotes: match.opponentScouting?.returnLegNotes || "",
      attachment: normalizeAttachment(match.opponentScouting?.attachment),
    },
    videoAnalysis: (match.videoAnalysis || []).map((clip) => ({
      id: clip.id || createId("clip"),
      minute: clip.minute || "",
      category: clip.category || "Tattica",
      phase: clip.phase || "Possesso",
      playerId: clip.playerId ? String(clip.playerId) : "",
      audience: clip.audience || "Staff",
      url: clip.url || "",
      tags: clip.tags || "",
      note: clip.note || "",
    })),
    staffNotes: match.staffNotes || "",
  };
}

function normalizeAttachment(attachment) {
  if (!attachment) return null;
  return {
    name: attachment.name || "",
    type: attachment.type || "",
    size: attachment.size || 0,
    bucket: attachment.bucket || "",
    path: attachment.path || "",
    url: attachment.url || "",
    uploadedAt: attachment.uploadedAt || "",
    // Compatibilità temporanea con allegati salvati prima del passaggio a Storage.
    dataUrl: attachment.url || attachment.path ? "" : attachment.dataUrl || "",
  };
}

export function normalizePhysicalTest(test){
  return {
    ...test,
    // FIX #12: ID e playerId sempre stringa
    id:       test.id       ? String(test.id)       : test.id,
    playerId: test.playerId ? String(test.playerId) : "",
    date:     test.date || new Date().toISOString().slice(0, 10),
    gaconLevel: test.gaconLevel || "",
  };
}

export function normalizeInjuryRecord(r = {}) {
  return {
    id:               r.id               || "",
    playerId:         r.playerId         ? String(r.playerId) : "",
    dateStart:        r.dateStart        || new Date().toISOString().slice(0, 10),
    dateEndExpected:  r.dateEndExpected  || "",
    dateEndActual:    r.dateEndActual    || "",
    bodyArea:         r.bodyArea         || "Coscia",
    injuryType:       r.injuryType       || "Muscolare",
    severity:         ["lieve", "media", "grave"].includes(r.severity)    ? r.severity  : "media",
    status:           ["attivo", "recupero", "rientrato"].includes(r.status) ? r.status : "attivo",
    recurrence:       Boolean(r.recurrence),
    daysLost:         Number(r.daysLost  || 0),
    notes:            r.notes            || "",
    preventionPlan: {
      focus:             r.preventionPlan?.focus             || "",
      exercises:         r.preventionPlan?.exercises         || "",
      weeklyRoutine:     r.preventionPlan?.weeklyRoutine     || "",
      loadLimits:        r.preventionPlan?.loadLimits        || "",
      returnToPlayNotes: r.preventionPlan?.returnToPlayNotes || "",
    },
  };
}

export function normalizeGpsSession(s = {}) {
  return {
    id:     s.id     || "",
    date:   s.date   || new Date().toISOString().slice(0, 10),
    title:  s.title  || "",
    type:   s.type   || "training",   // "training" | "match" | "test"
    source: s.source || "manual_csv",
    notes:  s.notes  || "",
    rows: (s.rows || []).map((r) => ({
      id:               r.id               || "",
      playerId:         r.playerId         || "",
      playerName:       r.playerName       || "",
      duration:         Number(r.duration         || 0),
      totalDistance:    Number(r.totalDistance     || 0),
      highSpeedDistance:Number(r.highSpeedDistance || 0),
      sprintDistance:   Number(r.sprintDistance    || 0),
      maxSpeed:         Number(r.maxSpeed          || 0),
      accelerations:    Number(r.accelerations     || 0),
      decelerations:    Number(r.decelerations     || 0),
      playerLoad:       Number(r.playerLoad        || 0),
      rpe:              Number(r.rpe               || 0),
      notes:            r.notes           || "",
    })),
  };
}

export function normalizeStaffTask(task = {}) {
  return {
    id: task.id || createId("task"),
    title: task.title || "",
    description: task.description || "",
    status: ["todo", "doing", "done"].includes(task.status) ? task.status : "todo",
    priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
    ownerRole: task.ownerRole || "headCoach",
    dueDate: task.dueDate || "",
    playerId: task.playerId ? String(task.playerId) : "",
    sourceType: task.sourceType || "manual",
    sourceId: task.sourceId ? String(task.sourceId) : "",
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || "",
  };
}

function expandSetPlayAssignments(rows = [], length, fallback = {}) {
  return Array.from({ length }, (_, index) => ({
    id: index + 1,
    ...fallback,
    ...(rows[index] || {}),
  }));
}

function normalizeSetPlayPresets(presets = []) {
  if (!Array.isArray(presets)) return [];

  return presets
    .filter((preset) => preset && preset.id && preset.sectionKey)
    .map((preset) => ({
      id: String(preset.id),
      sectionKey: preset.sectionKey,
      name: preset.name || "Preset",
      payload: preset.payload || {},
      updatedAt: preset.updatedAt || "",
    }));
}

export function normalizeSetPlays(sp = {}) {
  const empty = {
    corners: {
      offSchemeName: "", offCallCode: "", offVariant: "", offTrigger: "", offQuickNote: "",
      offTakerLeft: "", offTakerRight: "", offSecondTakerLeft: "", offSecondTakerRight: "",
      offAssignments: Array.from({length:8}, (_,i) => ({id:i+1,playerId:"",zone:"",role:""})),
      offNotes: "",
      defSchemeName: "", defCallCode: "", defVariant: "", defTrigger: "", defQuickNote: "",
      defSystem: "zona", defPoleSx: "", defPoleDx: "",
      defAssignments: Array.from({length:10}, (_,i) => ({id:i+1,playerId:"",task:"",opponent:"",zone:""})),
      defNotes: "",
    },
    freekicks: {
      offSchemeName: "", offCallCode: "", offVariant: "", offTrigger: "", offQuickNote: "",
      offTaker1:"", offTaker2:"", offSchema:"diretto",
      offAssignments: Array.from({length:6}, (_,i) => ({id:i+1,playerId:"",zone:""})),
      offNotes: "",
      defSchemeName: "", defCallCode: "", defVariant: "", defTrigger: "", defQuickNote: "",
      defWall:["","","","","",""],
      defAssignments: Array.from({length:6}, (_,i) => ({id:i+1,playerId:"",task:"",opponent:"",zone:""})),
      defNotes:"",
    },
    penalties: { takers:["","","","",""], notes:"" },
    presets: [],
  };

  const corners = { ...empty.corners, ...(sp.corners || {}) };
  const freekicks = { ...empty.freekicks, ...(sp.freekicks || {}) };

  return {
    corners: {
      ...corners,
      defAssignments: expandSetPlayAssignments(
        corners.defAssignments,
        10,
        { playerId: "", task: "", opponent: "", zone: "" }
      ),
    },
    freekicks: {
      ...freekicks,
      defWall: [...(freekicks.defWall || []), "", "", "", "", "", ""].slice(0, 6),
      defAssignments: expandSetPlayAssignments(
        freekicks.defAssignments,
        6,
        { playerId: "", task: "", opponent: "", zone: "" }
      ),
    },
    penalties: { ...empty.penalties, ...(sp.penalties || {}) },
    presets: normalizeSetPlayPresets(sp.presets || empty.presets),
  };
}

export function normalizeAppState(state = {}){
  return {
    players: (state.players || []).map(normalizePlayer),
    exercises: (state.exercises || []).map(normalizeExercise),
    sessions: (state.sessions || []).map(normalizeSession),
    matches: (state.matches || []).map(normalizeMatch),
    physicalTests: (state.physicalTests || []).map(normalizePhysicalTest),
    gpsSessions: (state.gpsSessions || []).map(normalizeGpsSession),
    staffTasks: (state.staffTasks || []).map(normalizeStaffTask),
    injuryRecords: (state.injuryRecords || []).map(normalizeInjuryRecord),
    appSettings: normalizeAppSettings(state.appSettings || {}),
    setPlays: normalizeSetPlays(state.setPlays || {}),
  };
}

export const subscriptionPlans = {
  free: {
    id: "free",
    name: "Free",
    price: "0",
    description: "Per iniziare a gestire rosa, calendario e sedute base.",
  },
  premium: {
    id: "premium",
    name: "Premium Coach",
    price: "14,90",
    description: "Per allenatori che vogliono automatizzare, esportare e lavorare sui dati.",
  },
  club: {
    id: "club",
    name: "Club",
    price: "49,90",
    description: "Per societa' con staff, sponsor, area giocatori e moduli condivisi.",
  },
};

const planRank = {
  free: 0,
  premium: 1,
  club: 2,
};

const activeBillingStatuses = ["trialing", "active"];
const developmentPreviewPlans = ["free", "premium", "club"];
const developmentPreviewStorageKey = "calciolab_plan_preview";
const developmentPreviewRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const developmentPreviewRoleStorageKey = "calciolab_role_preview";

export function getDevelopmentPreviewPlan(settings = {}){
  if (!import.meta.env?.DEV) return "";

  const explicitPlan = settings.developmentPreviewPlan;
  if (developmentPreviewPlans.includes(explicitPlan)) {
    return explicitPlan;
  }

  if (typeof window !== "undefined") {
    const storedPlan = window.localStorage.getItem(developmentPreviewStorageKey);
    if (developmentPreviewPlans.includes(storedPlan)) {
      return storedPlan;
    }
  }

  return import.meta.env?.VITE_UNLOCK_PREMIUM === "true" ? "club" : "";
}

export function isDevelopmentPremiumUnlocked(settings = {}){
  const plan = getDevelopmentPreviewPlan(settings);
  return plan === "premium" || plan === "club";
}

export function getDevelopmentPreviewRole(settings = {}){
  if (!import.meta.env?.DEV) return "";

  const explicitRole = settings.developmentPreviewRole;
  if (developmentPreviewRoles.includes(explicitRole)) {
    return explicitRole;
  }

  if (typeof window !== "undefined") {
    const storedRole = window.localStorage.getItem(developmentPreviewRoleStorageKey);
    if (developmentPreviewRoles.includes(storedRole)) {
      return storedRole;
    }
  }

  return "";
}

export const premiumFeatures = {
  physicalTests: {
    label: "Test fisici",
    plan: "premium",
    description: "Test Gacon, Yo-Yo, sprint e riferimenti per i lavori.",
  },
  physicalWorkouts: {
    label: "Lavori fisici",
    plan: "premium",
    description: "Gruppi e metri personalizzati in base ai test.",
  },
  matchDay: {
    label: "Match Day avanzato",
    plan: "premium",
    description: "Distinta, ruoli, piano gara e scouting avversario.",
  },
  postMatch: {
    label: "Report post gara",
    plan: "premium",
    description: "Analisi tecnica, focus settimanale e alert fisici.",
  },
  opponents: {
    label: "Scouting avversari",
    plan: "premium",
    description: "Archivio avversari, ritorno e informazioni condivisibili.",
  },
  exports: {
    label: "Export PDF",
    plan: "premium",
    description: "Template professionali per staff, giocatori e societa'.",
  },
  sessionGenerator: {
    label: "Builder guidato sedute",
    plan: "premium",
    description: "Funzione legacy integrata nel flusso Sedute.",
  },
  aiSessionBuilder: {
    label: "Genera sedute con AI",
    plan: "premium",
    description: "Sedute generate da obiettivo, durata, categoria, campo e giocatori disponibili.",
  },
  playerPortal: {
    label: "Area giocatori",
    plan: "club",
    description: "Accesso giocatori a rendimento, obiettivi e programmi.",
  },
  sponsors: {
    label: "Sponsor hub",
    plan: "club",
    description: "Spazi sponsor, offerte, report visibilita' e contatti.",
  },
  marketplace: {
    label: "Marketplace professionisti",
    plan: "club",
    description: "Preparatore, fisioterapista, nutrizionista e consulenze.",
  },
  exerciseLibrary: {
    label: "Eserciziario Premium",
    plan: "premium",
    description: "893 esercizi con diagrammi tattici SVG, descrizioni complete e varianti.",
  },
};

export const memberRoles = {
  owner: {
    label: "Owner",
    description: "Gestisce piano, impostazioni, ruoli e tutti i dati.",
    permissions: ["manageBilling", "manageMembers", "manageTeam", "manageSessions", "managePlayers", "viewReports", "manageSponsors"],
  },
  headCoach: {
    label: "Head Coach",
    description: "Gestisce sedute, rosa, gare, test e report tecnici.",
    permissions: ["manageTeam", "manageSessions", "managePlayers", "viewReports"],
  },
  assistantCoach: {
    label: "Assistant Coach",
    description: "Collabora su sedute, presenze e osservazioni tecniche.",
    permissions: ["manageSessions", "viewReports"],
  },
  athleticTrainer: {
    label: "Preparatore",
    description: "Gestisce test fisici, lavori individuali e carichi.",
    permissions: ["managePhysical", "viewReports"],
  },
  director: {
    label: "Dirigente",
    description: "Consulta report, sponsor, export e stato Club.",
    permissions: ["viewReports", "manageSponsors"],
  },
  player: {
    label: "Giocatore",
    description: "Vede solo il proprio rendimento e programma.",
    permissions: ["viewOwnProfile"],
  },
  sponsor: {
    label: "Sponsor",
    description: "Vede solo visibilita', offerte e report dedicati.",
    permissions: ["viewSponsorReports"],
  },
};

export const DEFAULT_PHYSICAL_METRICS = [
  { key: "gaconLevel", label: "Gacon",         unit: "",    higherIsBetter: true,  icon: "🏃", enabled: true,  custom: false },
  { key: "yoYo",       label: "Yo-Yo",         unit: "",    higherIsBetter: true,  icon: "🔄", enabled: true,  custom: false },
  { key: "sprint10m",  label: "Sprint 10m",    unit: "s",   higherIsBetter: false, icon: "⚡", enabled: true,  custom: false },
  { key: "sprint30m",  label: "Sprint 30m",    unit: "s",   higherIsBetter: false, icon: "⚡", enabled: true,  custom: false },
  { key: "jumpCm",     label: "Salto",         unit: "cm",  higherIsBetter: true,  icon: "↑",  enabled: true,  custom: false },
  { key: "weight",     label: "Peso",          unit: "kg",  higherIsBetter: null,  icon: "⚖️", enabled: true,  custom: false },
  { key: "bodyFat",    label: "Massa grassa",  unit: "%",   higherIsBetter: false, icon: "📊", enabled: true,  custom: false },
  { key: "agility",    label: "Agilità",       unit: "s",   higherIsBetter: false, icon: "🔀", enabled: false, custom: false },
  { key: "restingHR",  label: "FC riposo",     unit: "bpm", higherIsBetter: false, icon: "❤️", enabled: false, custom: false },
  { key: "height",     label: "Altezza",       unit: "cm",  higherIsBetter: null,  icon: "📏", enabled: true,  custom: false },
];

export function normalizeAppSettings(settings = {}){
  const workspaceCategory = settings.workspaceProfile?.category === "Adulti"
    ? "Prima squadra"
    : settings.workspaceProfile?.category;

  return {
    subscription: {
      plan: settings.subscription?.plan || "free",
      billingCycle: settings.subscription?.billingCycle || "monthly",
      billingStatus: settings.subscription?.billingStatus || "free",
      trialPlan: settings.subscription?.trialPlan || "",
      trialStartedAt: settings.subscription?.trialStartedAt || "",
      trialEndsAt: settings.subscription?.trialEndsAt || "",
      customerId: settings.subscription?.customerId || "",
      subscriptionId: settings.subscription?.subscriptionId || "",
      priceId: settings.subscription?.priceId || "",
      currentPeriodEnd: settings.subscription?.currentPeriodEnd || "",
      cancelAtPeriodEnd: Boolean(settings.subscription?.cancelAtPeriodEnd),
    },
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
      rewardCenter: true,
    },
    playerPortal: {
      enabled: Boolean(settings.playerPortal?.enabled),
      welcomeMessage: settings.playerPortal?.welcomeMessage || "Benvenuto nella tua area personale CalcioLab.",
      visibleMetrics: settings.playerPortal?.visibleMetrics || ["minutes", "tests", "goals", "load"],
      programs: settings.playerPortal?.programs || {},
      goals: settings.playerPortal?.goals || {},
      staffNotes: settings.playerPortal?.staffNotes || {},
    },
    sponsorHub: {
      enabled: Boolean(settings.sponsorHub?.enabled),
      mainSponsorId: settings.sponsorHub?.mainSponsorId || "",
      sponsors: (settings.sponsorHub?.sponsors || []).map(normalizeSponsor),
      reportNotes: settings.sponsorHub?.reportNotes || "",
    },
    onboarding: {
      completed: Boolean(settings.onboarding?.completed),
      completedAt: settings.onboarding?.completedAt || "",
      currentStep: Number(settings.onboarding?.currentStep || 0),
    },
    workspaceProfile: {
      clubName: settings.workspaceProfile?.clubName || "CalcioLab",
      teamName: settings.workspaceProfile?.teamName || "",
      logo: settings.workspaceProfile?.logo || "",
      logoSize: Number(settings.workspaceProfile?.logoSize || 100),
      category: workspaceCategory || "Prima squadra",
      homeFieldName: settings.workspaceProfile?.homeFieldName || "",
      homeFieldAddress: settings.workspaceProfile?.homeFieldAddress || "",
      homeFieldSurface: settings.workspaceProfile?.homeFieldSurface || "Erba naturale",
      seasonGoal: settings.workspaceProfile?.seasonGoal || "",
      currentSeason: settings.workspaceProfile?.currentSeason || "2025/2026",
      userRole: settings.workspaceProfile?.userRole || "headCoach",
      recommendedPlan: settings.workspaceProfile?.recommendedPlan || "premium",
      modules: settings.workspaceProfile?.modules || ["trainings", "matches", "players"],
      teamLevel: settings.workspaceProfile?.teamLevel || "prima",
      managesJuniores: Boolean(settings.workspaceProfile?.managesJuniores),
    },
    physicalMetrics: Array.isArray(settings.physicalMetrics) && settings.physicalMetrics.length > 0
      ? settings.physicalMetrics
      : DEFAULT_PHYSICAL_METRICS,
    members: (settings.members || []).map(normalizeMember),
    communications: (settings.communications || []).map(normalizeComm),
    developmentPreviewPlan: settings.developmentPreviewPlan || "",
    developmentPreviewRole: settings.developmentPreviewRole || "",
  };
}

export function normalizeComm(c = {}) {
  return {
    id:       c.id       || createId("comm"),
    title:    c.title    || "",
    body:     c.body     || "",
    date:     c.date     || new Date().toISOString().slice(0, 10),
    priority: c.priority === "urgent" ? "urgent" : "info",
  };
}

export function normalizeMember(member = {}){
  const role = memberRoles[member.role] ? member.role : "assistantCoach";

  return {
    id: member.id || createId("member"),
    name: member.name || "",
    email: member.email || "",
    role,
    status: member.status || "Invitato",
    linkedPlayerId: member.linkedPlayerId || "",
    sponsorId: member.sponsorId || "",
  };
}

export function normalizeSponsor(sponsor = {}){
  return {
    id: sponsor.id || createId("sponsor"),
    name: sponsor.name || "",
    package: sponsor.package || "Bronze",
    contact: sponsor.contact || "",
    website: sponsor.website || "",
    logo: sponsor.logo || "",
    offer: sponsor.offer || "",
    visibility: sponsor.visibility || "Dashboard, report PDF e materiali squadra",
    notes: sponsor.notes || "",
    active: sponsor.active !== false,
  };
}

export function getSubscriptionPlan(settings = {}){
  const developmentPreviewPlan = getDevelopmentPreviewPlan(settings);
  if (developmentPreviewPlan) {
    return subscriptionPlans[developmentPreviewPlan] || subscriptionPlans.free;
  }

  const normalized = normalizeAppSettings(settings);
  const planId = getEffectivePlanId(normalized);
  return subscriptionPlans[planId] || subscriptionPlans.free;
}

export function isFeatureUnlocked(featureKey, settings = {}){
  const feature = premiumFeatures[featureKey];
  if(!feature) return true;

  const plan = getSubscriptionPlan(settings);
  return (planRank[plan.id] || 0) >= (planRank[feature.plan] || 0);
}

export function getEffectivePlanId(settings = {}){
  const developmentPreviewPlan = getDevelopmentPreviewPlan(settings);
  if (developmentPreviewPlan) {
    return developmentPreviewPlan;
  }

  const normalized = normalizeAppSettings(settings);
  const subscription = normalized.subscription;

  if (subscription.billingStatus === "trialing" && isTrialActive(normalized)) {
    return subscription.trialPlan || subscription.plan || "free";
  }

  if (activeBillingStatuses.includes(subscription.billingStatus) && subscription.plan !== "free") {
    return subscription.plan;
  }

  return "free";
}

export function isTrialActive(settings = {}){
  const subscription = normalizeAppSettings(settings).subscription;
  if (subscription.billingStatus !== "trialing" || !subscription.trialEndsAt) return false;
  return new Date(subscription.trialEndsAt).getTime() >= Date.now();
}

export function getTrialDaysLeft(settings = {}){
  const subscription = normalizeAppSettings(settings).subscription;
  if (!subscription.trialEndsAt) return 0;

  const diff = new Date(subscription.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getBillingStatus(settings = {}){
  const normalized = normalizeAppSettings(settings);
  const subscription = normalized.subscription;
  const effectivePlanId = getEffectivePlanId(normalized);
  const trialActive = isTrialActive(normalized);
  const trialExpired = subscription.billingStatus === "trialing" && !trialActive && Boolean(subscription.trialEndsAt);

  return {
    ...subscription,
    effectivePlanId,
    effectivePlan: subscriptionPlans[effectivePlanId] || subscriptionPlans.free,
    developerUnlocked: Boolean(getDevelopmentPreviewPlan(normalized)),
    developerPreviewPlan: getDevelopmentPreviewPlan(normalized),
    trialActive,
    trialExpired,
    trialDaysLeft: getTrialDaysLeft(normalized),
    canStartTrial: subscription.billingStatus === "free" || subscription.billingStatus === "canceled",
  };
}

export function startSubscriptionTrial(settings = {}, plan = "premium", days = 14){
  const normalized = normalizeAppSettings(settings);
  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setDate(startedAt.getDate() + days);

  return {
    ...normalized,
    subscription: {
      ...normalized.subscription,
      plan: "free",
      billingStatus: "trialing",
      trialPlan: plan,
      trialStartedAt: startedAt.toISOString(),
      trialEndsAt: endsAt.toISOString(),
      currentPeriodEnd: endsAt.toISOString(),
      priceId: `${plan}_monthly_demo`,
      cancelAtPeriodEnd: false,
    },
  };
}

export function hasPermission(role, permission){
  const roleConfig = memberRoles[role];
  return Boolean(roleConfig?.permissions.includes(permission));
}

export function getCurrentUserRole(settings = {}){
  const developmentPreviewRole = getDevelopmentPreviewRole(settings);
  if (developmentPreviewRole) return developmentPreviewRole;

  const normalized = normalizeAppSettings(settings);
  return memberRoles[normalized.workspaceProfile.userRole]
    ? normalized.workspaceProfile.userRole
    : "headCoach";
}

export function isRoleAllowed(role, allowedRoles = []){
  if (!allowedRoles.length) return true;
  if (role === "owner") return true;
  return allowedRoles.includes(role);
}

export function getSetupProgress({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  appSettings = {},
} = {}){
  const settings = normalizeAppSettings(appSettings);
  const checks = [
    {
      key: "onboarding",
      label: "Completa onboarding",
      done: settings.onboarding.completed,
      path: "/onboarding",
    },
    {
      key: "workspace",
      label: "Configura squadra e obiettivo",
      done: Boolean(settings.workspaceProfile.teamName && settings.workspaceProfile.seasonGoal),
      path: "/club-settings",
    },
    {
      key: "members",
      label: "Invita staff o ruoli Club",
      done: settings.members.length > 0,
      path: "/club-settings",
    },
    {
      key: "players",
      label: "Inserisci almeno 18 giocatori",
      done: players.length >= 18,
      path: "/players",
    },
    {
      key: "exercises",
      label: "Crea o importa 10 esercizi",
      done: exercises.length >= 10,
      path: "/exercise-library",
    },
    {
      key: "sessions",
      label: "Crea la prima seduta",
      done: sessions.length > 0,
      path: "/trainings",
    },
    {
      key: "matches",
      label: "Inserisci la prima partita",
      done: matches.length > 0,
      path: "/matches",
    },
  ];
  const completed = checks.filter((check) => check.done).length;

  return {
    checks,
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
    next: checks.find((check) => !check.done),
  };
}

export function getCoachRewardProfile({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  physicalTests = [],
} = {}){
  const completeSessions = sessions.filter((session) =>
    session.objective || session.exercises?.length || (session.attendance && Object.keys(session.attendance).length)
  ).length;
  const scoutedMatches = matches.filter((match) =>
    match.opponentScouting?.formation || match.opponentScouting?.lineup?.length || match.matchPlan
  ).length;
  const postMatchReports = matches.filter((match) =>
    match.postMatch?.worked || match.postMatch?.notWorked || match.postMatch?.nextWeekFocus
  ).length;

  const points =
    players.length * 12 +
    exercises.length * 16 +
    sessions.length * 22 +
    completeSessions * 18 +
    matches.length * 20 +
    scoutedMatches * 26 +
    postMatchReports * 30 +
    physicalTests.length * 28;

  const levels = [
    { level: 1, title: "Coach Starter", min: 0, discount: 0 },
    { level: 2, title: "Coach Attivo", min: 150, discount: 5 },
    { level: 3, title: "Coach Pro", min: 450, discount: 10 },
    { level: 4, title: "Coach Elite", min: 900, discount: 15 },
    { level: 5, title: "Academy Partner", min: 1600, discount: 25 },
  ];

  const current = [...levels].reverse().find((item) => points >= item.min) || levels[0];
  const next = levels.find((item) => item.min > points);
  const previousMin = current.min;
  const nextMin = next?.min || current.min;
  const progress = next
    ? Math.min(100, Math.round(((points - previousMin) / (nextMin - previousMin)) * 100))
    : 100;

  const suggestedActions = [
    players.length < 18 ? "Completa la rosa con almeno 18 giocatori" : null,
    exercises.length < 20 ? "Aggiungi esercizi alla libreria" : null,
    sessions.length < 4 ? "Programma piu' sedute del mese" : null,
    physicalTests.length < players.length ? "Aggiorna i test fisici della rosa" : null,
    scoutedMatches < matches.length ? "Compila scouting e distinta avversaria" : null,
  ].filter(Boolean);

  return {
    points,
    level: current.level,
    title: current.title,
    discount: current.discount,
    nextLevel: next,
    progress,
    suggestedActions: suggestedActions.slice(0, 4),
  };
}

export function generateGuidedSession({
  exercises = [],
  duration = 90,
  objective = "Possesso",
  players = 18,
  intensity = "Media",
  field = "Campo intero",
  category = "Prima squadra",
  matchDayDistance = "MD-3",
} = {}){
  const targetDuration = Number(duration || 90);
  const objectiveText = objective.toLowerCase();
  const selected = [];
  let total = 0;

  const categoryAliases = category === "Prima squadra" ? ["Prima squadra", "Adulti"] : [category];
  const scoreExercise = (exercise) => {
    const haystack = [
      exercise.title,
      exercise.category,
      exercise.phase,
      exercise.objective,
      exercise.goal,
      exercise.description,
      ...(exercise.tags || []),
    ].join(" ").toLowerCase();
    const intensityScore = exercise.intensity === intensity ? 2 : 0;
    const objectiveScore = haystack.includes(objectiveText) ? 5 : 0;
    const categoryScore = categoryAliases.includes(exercise.ageGroup) || exercise.ageGroup === "Tutte" ? 1 : 0;
    return objectiveScore + intensityScore + categoryScore;
  };

  const ordered = [...exercises]
    .filter((exercise) => Number(exercise.duration || 0) > 0)
    .sort((a, b) => scoreExercise(b) - scoreExercise(a));

  ordered.forEach((exercise) => {
    if (total >= targetDuration) return;
    const minutes = Number(exercise.duration || 15);
    selected.push({
      exerciseId: exercise.id,
      customDuration: Math.min(minutes, Math.max(8, targetDuration - total)),
      customPlayers: exercise.players || players,
      variantNotes: buildSessionVariantNote({ exercise, field, matchDayDistance }),
    });
    total += minutes;
  });

  if (!selected.length && exercises.length) {
    const fallback = exercises[0];
    selected.push({
      exerciseId: fallback.id,
      customDuration: targetDuration,
      customPlayers: players,
      variantNotes: buildSessionVariantNote({ exercise: fallback, field, matchDayDistance }),
    });
  }

  return {
    title: `Seduta ${objective} ${matchDayDistance}`,
    date: new Date().toISOString().slice(0, 10),
    type: "Allenamento",
    theme: objective,
    objective: `Allenare ${objective} con ${players} giocatori, ${field.toLowerCase()}, intensita' ${intensity.toLowerCase()}.`,
    notes: `Generata da AI Session Builder locale. Categoria: ${category}. Vincolo gara: ${matchDayDistance}.`,
    exercises: selected,
    attendance: {},
  };
}

function buildSessionVariantNote({ exercise, field, matchDayDistance }){
  const fieldNote = field === "Mezzo campo" ? "adatta spazi e tempi di recupero al mezzo campo" : "mantieni ampiezza e riferimenti reali";
  const loadNote = matchDayDistance === "MD-1" ? "riduci contatti e volume" : matchDayDistance === "MD+1" ? "usa come recupero tecnico" : "mantieni intensita' coerente";
  return `${fieldNote}; ${loadNote}; focus ${exercise.goal || exercise.objective || exercise.category || "principio"}.`;
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

// Parsa un risultato tipo "2-1" → { goalsFor: 2, goalsAgainst: 1 }
export function parseMatchResult(result) {
  if (!result || typeof result !== "string") return null;
  const m = result.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { goalsFor: parseInt(m[1], 10), goalsAgainst: parseInt(m[2], 10) };
}

// Aggrega tutti i risultati della stagione
export function getSeasonRecord(matches = []) {
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, played = 0;
  for (const match of matches) {
    const parsed = parseMatchResult(match.result);
    if (!parsed) continue;
    played++;
    goalsFor     += parsed.goalsFor;
    goalsAgainst += parsed.goalsAgainst;
    if (parsed.goalsFor > parsed.goalsAgainst)      wins++;
    else if (parsed.goalsFor === parsed.goalsAgainst) draws++;
    else                                              losses++;
  }
  return { wins, draws, losses, goalsFor, goalsAgainst, played };
}

export function getCoachAlerts({ players = [], matches = [], physicalTests = [], sessions = [], playerStatsMap = {} } = {}){
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

  // Alert diffide / squalifiche da yellow cards (soglia: 5 ammonizioni)
  const SUSPENSION_THRESHOLD = 5;
  players.forEach((player) => {
    const stats = playerStatsMap[String(player.id)];
    if (!stats) return;
    const yellows = Number(stats.yellow_cards || 0);
    if (yellows >= SUSPENSION_THRESHOLD) {
      alerts.push({
        tone: "red",
        text: `${player.name} — squalificato (${yellows} ammonizioni)`,
      });
    } else if (yellows === SUSPENSION_THRESHOLD - 1) {
      alerts.push({
        tone: "orange",
        text: `${player.name} — diffidato (${yellows}/${SUSPENSION_THRESHOLD} ammonizioni)`,
      });
    }
  });

  return alerts.slice(0, 10);
}

// ─── Training Blocks ──────────────────────────────────────────────────────────
export const TRAINING_BLOCKS = [
  { id: "Riscaldamento",       icon: "🔥", color: "orange" },
  { id: "Possesso Palla",      icon: "⚽", color: "blue"   },
  { id: "Giochi di Posizione", icon: "🎯", color: "blue"   },
  { id: "Small Side Games",    icon: "🏃", color: "green"  },
  { id: "Partita a Tema",      icon: "🎪", color: "default"},
  { id: "Partita Finale",      icon: "🏆", color: "orange" },
];

export const CATEGORY_TO_BLOCK = {
  "Riscaldamento":        "Riscaldamento",
  "Psicocinetica":        "Riscaldamento",
  "Rapidità":             "Riscaldamento",
  "Tecnica individuale":  "Riscaldamento",
  "Possesso":             "Possesso Palla",
  "Passaggio":            "Possesso Palla",
  "Combinazione":         "Possesso Palla",
  "Scaglionamento":       "Giochi di Posizione",
  "Ampiezza":             "Giochi di Posizione",
  "Sovrapposizione":      "Giochi di Posizione",
  "Inserimento":          "Giochi di Posizione",
  "Taglio":               "Giochi di Posizione",
  "Superiorità numerica": "Small Side Games",
  "Duello":               "Small Side Games",
  "Cross":                "Small Side Games",
  "Gioco aereo":          "Small Side Games",
  "Fase offensiva":       "Partita a Tema",
  "Fase difensiva":       "Partita a Tema",
  "Pressing":             "Partita a Tema",
  "Penetrazione":         "Partita a Tema",
  "Finalizzazione":       "Partita a Tema",
  "Palle inattive":       "Partita a Tema",
  "Partita":              "Partita Finale",
  "Resistenza":           "Partita Finale",
};

export const RPE_BY_MATCH_DAY = {
  "MD+1": { min: 2, max: 4, label: "Recupero attivo",     color: "blue",    description: "Sessione leggera post-gara" },
  "MD-4": { min: 6, max: 8, label: "Carico moderato",     color: "orange",  description: "Lavoro tecnico-tattico" },
  "MD-3": { min: 8, max: 9, label: "Picco di carico",     color: "red",     description: "Massima intensità settimanale" },
  "MD-2": { min: 5, max: 7, label: "Carico medio",        color: "default", description: "Lavoro tattico e forma" },
  "MD-1": { min: 2, max: 4, label: "Attivazione leggera", color: "green",   description: "Attivazione pre-gara" },
};

export function getBlockFromCategory(category) {
  return CATEGORY_TO_BLOCK[category] || "Partita a Tema";
}

export function getRpeFromIntensity(intensity) {
  if (intensity === "Alta")  return 8;
  if (intensity === "Bassa") return 4;
  return 6;
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
