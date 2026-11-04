import { subscriptionPlans } from "../utils/helpers.js";

export const COACH_PLANS = [
  {
    ...subscriptionPlans.free,
    color: "#334155", colorEnd: "#1e293b", badge: null,
    features: ["Rosa e disponibilità dei giocatori", "Calendario, sedute e registro presenze", "Risultati e tabellini delle partite", "Statistiche squadra e giocatori, confronti", "Riepilogo multe e collaborazione staff"],
  },
  {
    ...subscriptionPlans.premium,
    color: "#1d4ed8", colorEnd: "#1e40af", badge: "Analisi e report",
    features: ["Tutto il piano Free", "Scheda gara avanzata, distinta e piano partita", "Report post gara e osservazioni tecniche", "Scouting e archivio avversari", "Test fisici e lavori individuali", "Esportazione dei report in PDF", "Area giocatori: rendimento, obiettivi e programmi"],
  },
];
