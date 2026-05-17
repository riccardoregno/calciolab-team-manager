import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "../utils/helpers";

/* ─── Plan definitions ──────────────────────────────────────── */
const PLANS = [
  {
    id: "free",
    name: "Starter",
    price: "0",
    priceNote: "Sempre gratuito",
    color: "#334155",
    colorEnd: "#1e293b",
    badge: null,
    description: "Per iniziare a gestire rosa, calendario e sedute base.",
    features: [
      "Rosa completa con disponibilità",
      "Calendario stagione",
      "Sedute base e libreria esercizi",
      "Lavagna tattica",
      "Dashboard operativa",
    ],
  },
  {
    id: "premium",
    name: "Premium Coach",
    price: "14,90",
    priceNote: "o 3 rate da € 4,97 senza interessi",
    color: "#1d4ed8",
    colorEnd: "#1e40af",
    badge: "Più scelto",
    description: "Per allenatori che vogliono automatizzare, esportare e lavorare sui dati.",
    features: [
      "Tutto il piano Starter",
      "Match Day avanzato (distinta, piano gara)",
      "Report post gara e analisi tecnica",
      "Test fisici e lavori personalizzati",
      "Scouting avversari e archivio",
      "Generatore sedute intelligente",
      "Export PDF professionali",
    ],
  },
  {
    id: "club",
    name: "Club",
    price: "49,90",
    priceNote: "o 3 rate da € 16,63 senza interessi",
    color: "#15803d",
    colorEnd: "#166534",
    badge: "Completo",
    description: "Per società con staff, sponsor, area giocatori e condivisione dati.",
    features: [
      "Tutto il piano Premium",
      "Accesso staff multi-utente condiviso",
      "Area giocatori (programmi individuali)",
      "Portale sponsor con report visibilità",
      "Statistiche avanzate e classifiche",
      "AI session builder",
      "Export e branding societario",
    ],
  },
];

/* ─── Component ─────────────────────────────────────────────── */
export default function Premium({
  appSettings = {},
  setSubscription,
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
  physicalTests = [],
}) {
  const navigate = useNavigate();
  const settings        = normalizeAppSettings(appSettings);
  const currentPlan     = getSubscriptionPlan(settings);
  const billing         = getBillingStatus(settings);
  const developerUnlocked = isDevelopmentPremiumUnlocked();
  const reward          = getCoachRewardProfile({ players, exercises, sessions, matches, physicalTests });

  const [pendingPlan, setPendingPlan]   = useState(null);
  const [activePeriod, setActivePeriod] = useState("monthly"); // "monthly" | "yearly"

  // ── billing handlers ──────────────────────────────────────────
  async function activatePlan(planId) {
    if (!setSubscription || !developerUnlocked) return;
    setPendingPlan(`activate-${planId}`);
    await setSubscription({
      subscription_plan: planId,
      billing_status:    planId === "free" ? "free" : "active",
      trial_plan:        "",
      trial_started_at:  null,
      trial_ends_at:     null,
    });
    setPendingPlan(null);
  }

  async function startTrial(planId) {
    if (!setSubscription || !developerUnlocked) return;
    setPendingPlan(`trial-${planId}`);
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await setSubscription({
      subscription_plan: "free",
      billing_status:    "trialing",
      trial_plan:        planId,
      trial_started_at:  now,
      trial_ends_at:     end,
      trial_used:        true,
    });
    setPendingPlan(null);
  }

  const yearlyDiscount = 20; // %

  function displayPrice(plan) {
    if (plan.price === "0") return "Gratis";
    const n = parseFloat(plan.price.replace(",", "."));
    if (activePeriod === "yearly") {
      return `€ ${(n * 12 * (1 - yearlyDiscount / 100) / 12).toFixed(2).replace(".", ",")}`;
    }
    return `€ ${plan.price}`;
  }

  return (
    <div style={ps.page}>
      <PageHeader
        title="Scegli il tuo piano"
        subtitle="Tutto quello che ti serve per gestire la stagione in modo professionale."
        badge={`Piano attivo: ${billing.effectivePlan.name}`}
      />

      {/* ── Stato billing corrente ── */}
      {(billing.trialActive || billing.trialExpired) && (
        <div style={{
          ...ps.alertBanner,
          borderColor: billing.trialActive ? "rgba(251,191,36,0.4)" : "rgba(239,68,68,0.35)",
          background: billing.trialActive ? "rgba(251,191,36,0.08)" : "rgba(239,68,68,0.08)",
        }}>
          <span style={{ fontSize: 13, color: billing.trialActive ? "#fde68a" : "#fca5a5" }}>
            {billing.trialActive
              ? `⏳ Trial ${billing.effectivePlan.name} attivo — ${billing.trialDaysLeft} giorni rimanenti.`
              : "❌ Trial scaduto — scegli un piano per continuare ad usare le funzioni avanzate."}
          </span>
          {billing.trialActive && (
            <button type="button" style={ps.alertCta} onClick={() => activatePlan(billing.trialPlan)}>
              Attiva ora →
            </button>
          )}
        </div>
      )}

      {/* ── Toggle mensile / annuale ── */}
      <div style={ps.periodToggle}>
        <button
          type="button"
          onClick={() => setActivePeriod("monthly")}
          style={{ ...ps.periodBtn, ...(activePeriod === "monthly" ? ps.periodBtnActive : {}) }}
        >
          Mensile
        </button>
        <button
          type="button"
          onClick={() => setActivePeriod("yearly")}
          style={{ ...ps.periodBtn, ...(activePeriod === "yearly" ? ps.periodBtnActive : {}) }}
        >
          Annuale
          <span style={ps.discountChip}>–{yearlyDiscount}%</span>
        </button>
      </div>

      {/* ── Pricing cards ── */}
      <div style={ps.cardGrid}>
        {PLANS.map((plan) => {
          const isActive    = currentPlan.id === plan.id;
          const isPending   = pendingPlan?.includes(plan.id);
          const isFeatured  = plan.id === "premium";

          return (
            <div
              key={plan.id}
              style={{
                ...ps.planCard,
                ...(isFeatured ? ps.planCardFeatured : {}),
              }}
            >
              {/* Colored header */}
              <div style={{
                ...ps.planHeader,
                background: `linear-gradient(145deg, ${plan.color}, ${plan.colorEnd})`,
              }}>
                <div style={ps.planHeaderTop}>
                  <span style={ps.planName}>{plan.name}</span>
                  {plan.badge && (
                    <span style={ps.planBadge}>{plan.badge}</span>
                  )}
                  {isActive && !plan.badge && (
                    <span style={{ ...ps.planBadge, background: "rgba(255,255,255,0.25)" }}>
                      ✓ Attivo
                    </span>
                  )}
                  {isActive && plan.badge && (
                    <span style={{ ...ps.planBadge, background: "rgba(255,255,255,0.25)", marginLeft: 0 }}>
                      ✓ Attivo
                    </span>
                  )}
                </div>

                <div style={ps.priceBlock}>
                  <strong style={ps.priceAmount}>{displayPrice(plan)}</strong>
                  {plan.price !== "0" && (
                    <span style={ps.pricePer}>/ mese</span>
                  )}
                </div>

                {plan.price !== "0" && (
                  <p style={ps.priceNote}>{plan.priceNote}</p>
                )}
              </div>

              {/* Body */}
              <div style={ps.planBody}>
                <p style={ps.planDesc}>{plan.description}</p>

                <ol style={ps.featureList}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={ps.featureItem}>
                      <span style={ps.featureCheck}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ol>

                <div style={ps.planActions}>
                  {plan.id !== "free" && (
                    <>
                      <button
                        type="button"
                        style={{
                          ...ps.ctaBtn,
                          background: `linear-gradient(135deg, ${plan.color}, ${plan.colorEnd})`,
                          opacity: (isActive || isPending || !developerUnlocked) ? 0.6 : 1,
                          cursor: (isActive || !developerUnlocked) ? "not-allowed" : "pointer",
                        }}
                        onClick={() => activatePlan(plan.id)}
                        disabled={isActive || !developerUnlocked || pendingPlan !== null}
                        title={!developerUnlocked ? "Disponibile dopo integrazione Stripe" : undefined}
                      >
                        {isPending
                          ? "Attendere…"
                          : isActive
                          ? "Piano attivo"
                          : developerUnlocked
                          ? "Attiva piano"
                          : "Disponibile a breve"}
                      </button>
                      {!developerUnlocked && !isActive && (
                        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                          Il pagamento online sarà disponibile al lancio ufficiale.
                        </p>
                      )}
                    </>
                  )}

                  {plan.id !== "free" && !billing.trialUsed && !isActive && (
                    <>
                      <button
                        type="button"
                        style={{
                          ...ps.trialBtn,
                          opacity: (!developerUnlocked || pendingPlan !== null) ? 0.55 : 1,
                          cursor: !developerUnlocked ? "not-allowed" : "pointer",
                        }}
                        onClick={() => startTrial(plan.id)}
                        disabled={!developerUnlocked || pendingPlan !== null}
                      >
                        {pendingPlan === `trial-${plan.id}` ? "Attendere…" : !developerUnlocked ? "Disponibile a breve" : "Prova 14 giorni gratis"}
                      </button>
                      {!developerUnlocked && (
                        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                          Il pagamento online sarà disponibile al lancio ufficiale.
                        </p>
                      )}
                    </>
                  )}

                  {plan.id === "free" && currentPlan.id !== "free" && (
                    <>
                      <button
                        type="button"
                        style={{ ...ps.trialBtn, opacity: !developerUnlocked ? 0.55 : 1, cursor: !developerUnlocked ? "not-allowed" : "pointer" }}
                        onClick={() => activatePlan("free")}
                        disabled={!developerUnlocked || pendingPlan !== null}
                      >
                        {!developerUnlocked ? "Disponibile a breve" : "Torna al piano gratuito"}
                      </button>
                      {!developerUnlocked && (
                        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                          Il pagamento online sarà disponibile al lancio ufficiale.
                        </p>
                      )}
                    </>
                  )}

                  {isActive && (
                    <p style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, margin: "8px 0 0", textAlign: "center" }}>
                      Piano corrente attivo
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Dev note ── */}
      {developerUnlocked && (
        <div style={ps.devNote}>
          🛠 Modalità sviluppo attiva — i pulsanti simulano il cambio piano senza Stripe.
          In produzione i pulsanti redirigeranno a Stripe Checkout.
        </div>
      )}

      {/* ── Feature comparison table ── */}
      <AppCard>
        <h3 style={{ marginTop: 0, marginBottom: 18, lineHeight: 1.2 }}>Confronto funzioni</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={ps.table}>
            <thead>
              <tr>
                <th style={ps.thLabel}>Funzione</th>
                {PLANS.map((p) => (
                  <th key={p.id} style={{ ...ps.th, color: p.id === "free" ? "#94a3b8" : p.id === "premium" ? "#60a5fa" : "#4ade80" }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Rosa e disponibilità",         true, true, true],
                ["Calendario e sedute",           true, true, true],
                ["Lavagna tattica",               true, true, true],
                ["Match Day avanzato",            false, true, true],
                ["Report post gara",              false, true, true],
                ["Test fisici",                   false, true, true],
                ["Scouting avversari",            false, true, true],
                ["Export PDF",                    false, true, true],
                ["Generatore sedute",             false, true, true],
                ["Staff multi-utente",            false, false, true],
                ["Area giocatori",                false, false, true],
                ["Portale sponsor",               false, false, true],
                ["AI session builder",            false, false, true],
              ].map(([label, free, premium, club]) => (
                <tr key={label} style={ps.tableRow}>
                  <td style={ps.tdLabel}>{label}</td>
                  <td style={ps.td}>{free  ? <span style={ps.tick}>✓</span> : <span style={ps.cross}>–</span>}</td>
                  <td style={ps.td}>{premium ? <span style={ps.tick}>✓</span> : <span style={ps.cross}>–</span>}</td>
                  <td style={ps.td}>{club  ? <span style={ps.tick}>✓</span> : <span style={ps.cross}>–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* ── Reward coach ── */}
      <div style={ps.heroGrid}>
        <AppCard>
          <Badge tone="purple">Reward coach</Badge>
          <div style={{ fontSize: 52, fontWeight: 900, margin: "14px 0 0", lineHeight: 1 }}>{reward.points}</div>
          <p style={{ color: "#94a3b8", margin: "4px 0 12px" }}>punti attività</p>
          <h3 style={{ margin: "0 0 10px", lineHeight: 1.2 }}>
            Livello {reward.level} — {reward.title}
          </h3>
          <div style={ps.progressTrack}>
            <div style={{ ...ps.progressBar, width: `${reward.progress}%` }} />
          </div>
          <p style={{ color: "#94a3b8", margin: "8px 0 0", fontSize: 13 }}>
            Sconto potenziale: <strong style={{ color: "white" }}>{reward.discount}%</strong>
            {reward.nextLevel ? ` · prossimo livello a ${reward.nextLevel.min} pt` : " · livello massimo"}
          </p>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>Come salire di livello</h3>
          <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 13 }}>
            Il reward premia dati utili, non solo quantità.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {(reward.suggestedActions.length
              ? reward.suggestedActions
              : ["Continua ad aggiornare sedute, test e scouting."]
            ).map((item) => (
              <div key={item} style={ps.actionItem}>
                <span style={{ color: "#22c55e", fontWeight: 900 }}>+</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button
            style={{ marginTop: 18 }}
            variant="ghost"
            onClick={() => navigate("/settings")}
          >
            Invita staff → più punti
          </Button>
        </AppCard>
      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const ps = {
  page: {
    display: "grid",
    gap: 22,
  },
  alertBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 18px",
    borderRadius: 14,
    border: "1px solid",
    flexWrap: "wrap",
  },
  alertCta: {
    background: "transparent",
    border: "none",
    color: "#fbbf24",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  },
  periodToggle: {
    display: "flex",
    gap: 0,
    alignSelf: "center",
    justifySelf: "center",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    overflow: "hidden",
    width: "fit-content",
  },
  periodBtn: {
    padding: "10px 22px",
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "background 0.15s, color 0.15s",
  },
  periodBtnActive: {
    background: "rgba(56,189,248,0.14)",
    color: "#38bdf8",
  },
  discountChip: {
    background: "rgba(34,197,94,0.2)",
    color: "#86efac",
    fontSize: 11,
    fontWeight: 900,
    padding: "2px 7px",
    borderRadius: 999,
    lineHeight: 1.4,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 18,
    alignItems: "stretch",
  },
  planCard: {
    display: "flex",
    flexDirection: "column",
    borderRadius: 20,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(21,25,34,0.96)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    transition: "transform 0.15s",
  },
  planCardFeatured: {
    border: "1px solid rgba(56,189,248,0.4)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.2), 0 16px 50px rgba(37,99,235,0.2)",
    transform: "scale(1.02)",
  },
  planHeader: {
    padding: "24px 22px 20px",
    color: "white",
    flexShrink: 0,
  },
  planHeaderTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  planName: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 0,
    lineHeight: 1.1,
  },
  planBadge: {
    background: "rgba(255,255,255,0.2)",
    color: "white",
    fontSize: 10,
    fontWeight: 900,
    padding: "3px 9px",
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  priceBlock: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 6,
  },
  priceAmount: {
    fontSize: 40,
    fontWeight: 900,
    lineHeight: 1,
  },
  pricePer: {
    fontSize: 13,
    opacity: 0.75,
    fontWeight: 700,
  },
  priceNote: {
    margin: 0,
    fontSize: 11,
    opacity: 0.7,
    lineHeight: 1.4,
    fontWeight: 600,
  },
  planBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "20px 22px 22px",
  },
  planDesc: {
    color: "#94a3b8",
    margin: "0 0 18px",
    fontSize: 13,
    lineHeight: 1.55,
  },
  featureList: {
    flex: 1,
    listStyle: "none",
    padding: 0,
    margin: "0 0 20px",
    display: "grid",
    gap: 10,
  },
  featureItem: {
    display: "flex",
    gap: 10,
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.4,
    alignItems: "flex-start",
  },
  featureCheck: {
    color: "#22c55e",
    fontWeight: 900,
    flexShrink: 0,
    marginTop: 1,
  },
  planActions: {
    display: "grid",
    gap: 8,
    marginTop: "auto",
  },
  ctaBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 14,
    border: "none",
    color: "white",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    transition: "opacity 0.15s",
    lineHeight: 1.2,
  },
  trialBtn: {
    width: "100%",
    padding: "11px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#94a3b8",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    lineHeight: 1.2,
  },
  devNote: {
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(251,191,36,0.08)",
    border: "1px solid rgba(251,191,36,0.2)",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  /* comparison table */
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    minWidth: 480,
  },
  th: {
    padding: "10px 16px",
    fontWeight: 900,
    textAlign: "center",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    fontSize: 13,
  },
  thLabel: {
    padding: "10px 16px",
    fontWeight: 900,
    textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  td: {
    padding: "10px 16px",
    textAlign: "center",
  },
  tdLabel: {
    padding: "10px 16px",
    color: "#cbd5e1",
    textAlign: "left",
  },
  tick: { color: "#22c55e", fontWeight: 900 },
  cross: { color: "#475569" },
  /* reward */
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "0.9fr 1.1fr",
    gap: 20,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(135deg,#a855f7,#38bdf8)",
  },
  actionItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.4,
  },
};
