import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import {
  getCoachRewardProfile,
  getBillingStatus,
  isDevelopmentPremiumUnlocked,
  getSubscriptionPlan,
  normalizeAppSettings,
  premiumFeatures,
  startSubscriptionTrial,
  subscriptionPlans,
} from "../utils/helpers";

const businessModules = [
  {
    title: "Area giocatori",
    status: "Club",
    text: "Ogni atleta vede rendimento, test, obiettivi individuali e programmi assegnati.",
  },
  {
    title: "Sponsor hub",
    status: "Club",
    text: "Spazi sponsor, report visibilita', offerte locali e PDF brandizzati.",
  },
  {
    title: "Marketplace professionisti",
    status: "Club",
    text: "Contatti qualificati per preparatori, fisioterapisti, nutrizionisti e analyst.",
  },
  {
    title: "Scouting community",
    status: "Premium",
    text: "Schede avversari condivise tra allenatori, piu' ordinate delle chat WhatsApp.",
  },
  {
    title: "AI eserciziario",
    status: "Premium",
    text: "Libreria esercizi premium e builder sedute in base a categoria, obiettivo e vincoli.",
  },
  {
    title: "Classifiche e risultati",
    status: "Premium",
    text: "Posizione squadra, trend campionato e prossimi avversari in dashboard.",
  },
];

export default function Premium({
  appSettings = {},
  setAppSettings,
  setSubscription,
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  physicalTests = [],
}) {
  const settings = normalizeAppSettings(appSettings);
  const currentPlan = getSubscriptionPlan(settings);
  const billing = getBillingStatus(settings);
  const developerUnlocked = isDevelopmentPremiumUnlocked();
  const reward = getCoachRewardProfile({ players, exercises, sessions, matches, physicalTests });

  async function activatePlan(plan) {
    console.log("[Premium] activatePlan chiamato, plan:", plan);
    console.log("[Premium] setSubscription disponibile:", typeof setSubscription);
    if (setSubscription) {
      await setSubscription({
        subscription_plan: plan,
        billing_status:    plan === "free" ? "free" : "active",
        trial_plan:        "",
        trial_started_at:  null,
        trial_ends_at:     null,
      });
    } else {
      setAppSettings?.({
        ...settings,
        subscription: { ...settings.subscription, plan, trialPlan: "", billingStatus: plan === "free" ? "free" : "active" },
      });
    }
  }

  async function startTrial(plan) {
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    console.log("[Premium] startTrial chiamato, plan:", plan);
    console.log("[Premium] setSubscription disponibile:", typeof setSubscription);
    if (setSubscription) {
      await setSubscription({
        subscription_plan: "free",
        billing_status:    "trialing",
        trial_plan:        plan,
        trial_started_at:  now,
        trial_ends_at:     end,
        trial_used:        true,
      });
    } else {
      setAppSettings?.(startSubscriptionTrial(settings, plan, 14));
    }
  }

  return (
    <div style={premiumStyles.page}>
      <PageHeader
        title="Premium & Monetizzazione"
        subtitle="Piani, sezioni bloccate, reward coach e moduli futuri per trasformare CalcioLab in una piattaforma a pagamento."
        badge={`Accesso attuale: ${billing.effectivePlan.name}`}
      />

      <AppCard>
        <div style={premiumStyles.billingBanner}>
          <div>
            <Badge tone={billing.trialActive ? "orange" : billing.billingStatus === "active" ? "green" : "blue"}>
              {developerUnlocked ? "Dev unlock" : billing.trialActive ? "Trial attivo" : billing.billingStatus}
            </Badge>
            <h2 style={{ margin: "12px 0 6px" }}>
              {developerUnlocked
                ? "Accesso locale completo: Premium e Club sbloccati"
                : billing.trialActive
                ? `${billing.trialDaysLeft} giorni rimasti di prova ${subscriptionPlans[billing.trialPlan]?.name || ""}`
                : billing.trialExpired
                ? "Trial scaduto"
                : `Piano effettivo: ${billing.effectivePlan.name}`}
            </h2>
            <p style={premiumStyles.muted}>
              {developerUnlocked
                ? "Modalita' attiva solo sul server locale: utile per sviluppare e controllare tutte le sezioni senza limiti."
                : "Struttura pronta per Stripe: customer, subscription, price e periodo corrente sono gia' previsti nel modello dati."}
            </p>
          </div>
          <div style={premiumStyles.billingActions}>
            <Button variant="ghost" onClick={() => startTrial("premium")}>Trial Premium 14 giorni</Button>
            <Button onClick={() => startTrial("club")}>Trial Club 14 giorni</Button>
          </div>
        </div>
      </AppCard>

      <div style={premiumStyles.heroGrid}>
        <AppCard>
          <Badge tone="blue">Reward coach</Badge>
          <h2 style={premiumStyles.bigNumber}>{reward.points}</h2>
          <p style={premiumStyles.muted}>punti attivita'</p>
          <h3 style={{ marginBottom: 8 }}>
            Livello {reward.level} - {reward.title}
          </h3>
          <div style={premiumStyles.progressTrack}>
            <div style={{ ...premiumStyles.progressBar, width: `${reward.progress}%` }} />
          </div>
          <p style={premiumStyles.muted}>
            Sconto potenziale: <strong>{reward.discount}%</strong>
            {reward.nextLevel ? ` · prossimo livello a ${reward.nextLevel.min} punti` : " · livello massimo"}
          </p>
        </AppCard>

        <AppCard title="Come salire di livello" subtitle="Il reward premia dati utili, non solo quantita'.">
          <div style={premiumStyles.actionList}>
            {(reward.suggestedActions.length ? reward.suggestedActions : ["Continua ad aggiornare sedute, test e scouting."]).map((item) => (
              <div key={item} style={premiumStyles.actionItem}>
                <span>↗</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </AppCard>
      </div>

      <div style={premiumStyles.planGrid}>
        {Object.values(subscriptionPlans).map((plan) => (
          <AppCard
            key={plan.id}
            title={plan.name}
            subtitle={plan.description}
            rightContent={
              currentPlan.id === plan.id ? <Badge tone="green">Attivo</Badge> : null
            }
          >
            <div style={premiumStyles.priceRow}>
              <span>€</span>
              <strong>{plan.price}</strong>
              <small>/ mese</small>
            </div>
            <PlanFeatures plan={plan.id} />
            <Button
              variant={currentPlan.id === plan.id ? "ghost" : "primary"}
              onClick={() => activatePlan(plan.id)}
              style={{ width: "100%", marginTop: 18 }}
            >
              {currentPlan.id === plan.id ? "Piano attivo" : "Simula piano attivo"}
            </Button>
            {plan.id !== "free" && (
              <Button
                variant="ghost"
                onClick={() => startTrial(plan.id)}
                style={{ width: "100%", marginTop: 10 }}
              >
                Avvia trial 14 giorni
              </Button>
            )}
          </AppCard>
        ))}
      </div>

      <AppCard title="Moduli monetizzabili" subtitle="Roadmap commerciale pronta per le prossime iterazioni.">
        <div style={premiumStyles.moduleGrid}>
          {businessModules.map((module) => (
            <div key={module.title} style={premiumStyles.moduleCard}>
              <Badge tone={module.status === "Club" ? "purple" : "orange"}>{module.status}</Badge>
              <h3>{module.title}</h3>
              <p>{module.text}</p>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function nextMonthIso() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function PlanFeatures({ plan }) {
  const features = Object.values(premiumFeatures).filter((feature) => {
    if (plan === "free") return feature.plan === "free";
    if (plan === "premium") return feature.plan === "premium";
    return feature.plan === "premium" || feature.plan === "club";
  });

  const fallback = plan === "free"
    ? ["Rosa e calendario", "Sedute base", "Esercizi personali"]
    : [];

  return (
    <div style={premiumStyles.featureList}>
      {[...fallback, ...features.map((feature) => feature.label)].map((item) => (
        <div key={item} style={premiumStyles.featureItem}>
          <span>✓</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

const premiumStyles = {
  page: {
    display: "grid",
    gap: 22,
  },
  billingBanner: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  billingActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "0.9fr 1.1fr",
    gap: 20,
  },
  bigNumber: {
    fontSize: 54,
    margin: "14px 0 0",
    letterSpacing: 0,
  },
  muted: {
    color: "#94a3b8",
    margin: "6px 0 0",
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 16,
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(135deg,#22c55e,#38bdf8)",
  },
  actionList: {
    display: "grid",
    gap: 10,
  },
  actionItem: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 20,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 18,
  },
  featureList: {
    display: "grid",
    gap: 9,
  },
  featureItem: {
    display: "flex",
    gap: 8,
    color: "#cbd5e1",
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 14,
  },
  moduleCard: {
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.72)",
  },
};
