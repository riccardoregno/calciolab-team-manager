import {
  BarChart3,
  BrainCircuit,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Dumbbell,
  Gem,
  GitCompareArrows,
  HeartPulse,
  Home,
  ListChecks,
  MessagesSquare,
  Printer,
  RadioTower,
  Rocket,
  Ruler,
  Scale,
  Search,
  Settings,
  Shirt,
  Target,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";


const allRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];
const playerCalendarRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player"];

// ── Voci principali sempre visibili ──────────────────────────────
export const PRIMARY = [
  { to: "/",          labelKey: "navigation.mobile.home", icon: Home, roles: allRoles },
  { to: "/players",   labelKey: "navigation.mobile.roster", icon: Users, roles: coachRoles },
  { to: "/trainings", labelKey: "navigation.mobile.trainings", icon: ClipboardList, roles: technicalRoles },
  { to: "/matches",   labelKey: "navigation.mobile.matches", icon: Trophy, roles: coachRoles },
  { to: "/statistics", labelKey: "navigation.items.statistics", icon: BarChart3, roles: coachRoles },
];

// ── Drawer "Altro": poche scorciatoie operative, il resto sotto avanzate ──
export const CORE_SECONDARY = [
  { to: "/calendar", labelKey: "navigation.items.calendar", icon: CalendarDays, roles: playerCalendarRoles },
  { to: "/fines", labelKey: "navigation.items.fines", icon: Coins, roles: technicalRoles, cat: "gestione" },
  { to: "/availability",        labelKey: "navigation.items.availability",        icon: HeartPulse, roles: ["owner","headCoach","assistantCoach","athleticTrainer","player"], cat: "squadra" },
  { to: "/staff-chat",          labelKey: "navigation.items.staffChat",           icon: MessagesSquare, roles: coachRoles, cat: "squadra", badge: "chat" },
  { to: "/attendance-register", labelKey: "navigation.items.attendanceRegister",  icon: ClipboardCheck, roles: technicalRoles, cat: "campo" },
  { to: "/exports",             labelKey: "navigation.items.exports",             icon: Printer, roles: managementRoles, cat: "gestione" },
  { to: "/settings",            labelKey: "navigation.items.settings",            icon: Settings, roles: allRoles, cat: "gestione" },
];

export const ADVANCED_SECONDARY = [
  { to: "/onboarding", labelKey: "navigation.items.onboarding", icon: Rocket, roles: ["owner", "headCoach"], cat: "gestione" },
  { to: "/player-compare",      labelKey: "navigation.items.playerCompare",       icon: GitCompareArrows, roles: coachRoles, cat: "analisi" },
  { to: "/season-goals",        labelKey: "navigation.items.seasonGoals",         icon: Target, roles: coachRoles, cat: "analisi" },
  { to: "/physical-tests",      labelKey: "navigation.items.physicalTests",       icon: Timer, roles: physicalRoles, cat: "analisi" },
  { to: "/physical-workouts",   labelKey: "navigation.items.physicalWorkouts",    icon: Dumbbell, roles: physicalRoles, cat: "analisi" },
  { to: "/gps-load",            labelKey: "navigation.items.gpsLoad",             icon: RadioTower, roles: physicalRoles, cat: "analisi" },
  { to: "/set-plays",           labelKey: "navigation.items.setPlays",            icon: Ruler, roles: technicalRoles, cat: "campo" },
  { to: "/tactical-board",      labelKey: "navigation.items.tacticalBoard",       icon: BrainCircuit, roles: technicalRoles, cat: "campo" },
  { to: "/team-generator",      labelKey: "navigation.items.teamGenerator",       icon: Scale, roles: technicalRoles, cat: "campo" },
  { to: "/opponents",           labelKey: "navigation.items.opponents",           icon: Search, roles: technicalRoles, cat: "gara" },
  { to: "/player-portal",       labelKey: "navigation.items.playerPortal",        icon: Shirt, roles: coachRoles, cat: "gestione" },
  { to: "/staff-tasks",         labelKey: "navigation.items.staffTasks",          icon: ListChecks, roles: ["owner","headCoach","assistantCoach","athleticTrainer","director"], cat: "gestione" },
  { to: "/premium",             labelKey: "navigation.items.premium",             icon: Gem, roles: managementRoles, cat: "gestione" },
];


const primaryLabelKeys = {
  "/": "navigation.items.dashboard", "/players": "navigation.mobile.roster",
  "/trainings": "navigation.mobile.trainings", "/matches": "navigation.items.matches",
  "/calendar": "navigation.items.calendar",
};
export const NAVIGATION_ITEMS = [...PRIMARY, ...CORE_SECONDARY, ...ADVANCED_SECONDARY].map((item) => ({
  ...item,
  labelKey: primaryLabelKeys[item.to] || item.labelKey,
}));
const byPath = new Map(NAVIGATION_ITEMS.map((item) => [item.to, item]));
export function navigationItem(path, overrides = {}) {
  const item = byPath.get(path);
  if (!item) throw new Error('Unknown navigation route: ' + path);
  return { ...item, ...overrides };
}

export const primaryMenuGroups = [
  { titleKey: "navigation.groups.home", items: [navigationItem("/")] },
  { titleKey: "navigation.groups.team", items: [navigationItem("/players", { label: "Squadra" })] },
  { titleKey: "navigation.groups.field", items: [navigationItem("/trainings", { label: "Allenamenti" })] },
  { titleKey: "navigation.groups.match", items: [navigationItem("/matches", { label: "Centro partite" })] },
  { titleKey: "navigation.groups.analysis", items: [navigationItem("/statistics")] },
];
export const toolboxGroups = [
  { titleKey: "navigation.groups.home", items: [navigationItem("/calendar"), navigationItem("/onboarding")] },
  { titleKey: "navigation.groups.team", items: [
    navigationItem("/availability"), navigationItem("/player-compare", { featureKey: "statistics" }),
    navigationItem("/season-goals"), navigationItem("/physical-tests", { featureKey: "physicalTests" }),
    navigationItem("/physical-workouts", { featureKey: "physicalWorkouts" }), navigationItem("/gps-load", { featureKey: "physicalTests" }),
    navigationItem("/player-portal"),
  ] },
  { titleKey: "navigation.groups.field", items: [
    ...["/attendance-register", "/tactical-board", "/set-plays", "/team-generator"].map((path) => navigationItem(path)),
    navigationItem("/opponents", { featureKey: "opponents" }),
  ] },
  { titleKey: "navigation.groups.system", items: [
    ...["/fines", "/staff-tasks", "/staff-chat"].map((path) => navigationItem(path)),
    navigationItem("/exports", { featureKey: "exports" }), navigationItem("/premium"), navigationItem("/settings"),
  ] },
];

export function juniorNavigationItems(appSettings = {}) {
  const profile = appSettings.workspaceProfile;
  return profile?.managesJuniores && profile.teamLevel === "prima" ? [{
    to: "/players?gruppo=juniores", labelKey: "navigation.items.juniorRoster", icon: Zap,
    roles: coachRoles, cat: "squadra",
  }] : [];
}
