import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import {
  VIP_LEVELS,
  getNextVipLevel,
  getUnlockedVipRewards,
  getVipLevel,
  getVipProgress,
} from "../../supabase/functions/_shared/vip.ts";
import {
  getCoachRewardProfile,
  getBillingStatus,
  isDevelopmentPremiumUnlocked,
  getSubscriptionPlan,
  normalizeAppSettings,
} from "../utils/helpers";
import { useTranslation } from "../i18n";

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
    yearlyTotal: "149",
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
    yearlyTotal: "449",
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

const CHECKOUT_FUNCTION_URL =
  import.meta.env.VITE_STRIPE_CHECKOUT_URL ||
  "https://sglevvqhlzpllrjrgbod.functions.supabase.co/create-checkout-session";

const CANCEL_SUBSCRIPTION_URL =
  import.meta.env.VITE_STRIPE_CANCEL_SUBSCRIPTION_URL ||
  "https://sglevvqhlzpllrjrgbod.functions.supabase.co/cancel-subscription";

const UPDATE_VIP_URL =
  import.meta.env.VITE_UPDATE_VIP_URL ||
  "https://sglevvqhlzpllrjrgbod.functions.supabase.co/update-vip";

const BILLING_PORTAL_URL =
  import.meta.env.VITE_STRIPE_BILLING_PORTAL_URL ||
  "https://sglevvqhlzpllrjrgbod.functions.supabase.co/billing-portal";

const STRIPE_PRICE_IDS = {
  premium: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_MONTHLY || "",
    yearly:  import.meta.env.VITE_STRIPE_PRICE_PREMIUM_YEARLY  || "",
  },
  club: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_CLUB_MONTHLY || "",
    yearly:  import.meta.env.VITE_STRIPE_PRICE_CLUB_YEARLY  || "",
  },
};

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const settings        = normalizeAppSettings(appSettings);
  const currentPlan     = getSubscriptionPlan(settings);
  const billing         = getBillingStatus(settings);
  const developerUnlocked = isDevelopmentPremiumUnlocked();
  const reward          = getCoachRewardProfile({ players, exercises, sessions, matches, physicalTests });

  const [pendingPlan, setPendingPlan]   = useState(null);
  const [activePeriod, setActivePeriod] = useState("monthly"); // "monthly" | "yearly"
  const [checkoutError, setCheckoutError] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [vipState, setVipState] = useState(null);
  const [vipNotice, setVipNotice] = useState(null);
  const hasActiveSubscription = currentPlan.id !== "free" && ["active", "trialing"].includes(billing.billingStatus);
  const vipPoints = vipState?.points ?? Number(auth.team?.vip_points || 0);
  const vipLevel = vipState?.level || auth.team?.vip_level || getVipLevel(vipPoints).name;
  const vipCurrent = VIP_LEVELS.find((level) => level.name === vipLevel) || getVipLevel(vipPoints);
  const vipProgress = getVipProgress(vipPoints);
  const nextVipLevel = getNextVipLevel(vipPoints);
  const unlockedVipRewards = getUnlockedVipRewards(vipPoints);

  // ── billing handlers ──────────────────────────────────────────
  async function activatePlan(planId) {
    if (planId !== "free" && !developerUnlocked) {
      await handleCheckout(planId);
      return;
    }

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

  async function handleCheckout(planId) {
    const priceId = STRIPE_PRICE_IDS[planId]?.[activePeriod];

    if (!priceId) {
      setCheckoutError(`Price ID Stripe mancante per ${planId} (${activePeriod}).`);
      return;
    }

    setCheckoutError("");
    setBillingMessage("");
    setPendingPlan(`checkout-${planId}`);

    try {
      const headers = await getFunctionHeaders();

      const response = await fetch(CHECKOUT_FUNCTION_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          priceId,
          teamId: auth.team?.id,
          planId,
          period: activePeriod,
          successUrl: `${window.location.origin}/premium?checkout=success`,
          cancelUrl: `${window.location.origin}/premium?checkout=cancel`,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout Stripe non disponibile.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(error?.message || t("pages.premium.checkoutError"));
      setPendingPlan(null);
    }
  }

  async function openBillingPortal() {
    setCheckoutError("");
    setBillingMessage("");
    setPendingPlan("billing-portal");
    try {
      const headers = await getFunctionHeaders();
      const response = await fetch(BILLING_PORTAL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          teamId:    auth.team?.id,
          returnUrl: `${window.location.origin}/premium`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || t("pages.premium.portalError"));
      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(error?.message || t("pages.premium.portalError"));
      setPendingPlan(null);
    }
  }

  async function cancelSubscription() {
    if (!hasActiveSubscription) return;

    setCheckoutError("");
    setBillingMessage("");
    setPendingPlan("cancel-subscription");

    try {
      const headers = await getFunctionHeaders();
      const response = await fetch(CANCEL_SUBSCRIPTION_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subscriptionId: billing.subscriptionId,
          teamId: auth.team?.id,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Disdetta non disponibile.");
      }

      setBillingMessage(t("pages.premium.subscriptionCancelled"));
    } catch (error) {
      setCheckoutError(error?.message || t("pages.premium.cancellationError"));
    } finally {
      setPendingPlan(null);
    }
  }

  async function getFunctionHeaders() {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    const token = data?.session?.access_token || anonKey;

    return {
      "Content-Type": "application/json",
      ...(anonKey ? { apikey: anonKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function syncVipStatus(pointsToAdd = 0) {
    if (!auth.team?.id) return;

    setVipNotice(null);
    setPendingPlan("update-vip");

    try {
      const headers = await getFunctionHeaders();
      const response = await fetch(UPDATE_VIP_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          teamId: auth.team.id,
          pointsToAdd,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Aggiornamento VIP non disponibile.");
      }

      setVipState({
        points: Number(data.newPoints || 0),
        level: data.newLevel || getVipLevel(data.newPoints).name,
      });

      if (data.levelChanged) {
        setVipNotice({
          level: data.newLevel,
          reward: data.reward,
        });
      }
    } catch (error) {
      setCheckoutError(error?.message || t("pages.premium.vipUpdateError"));
    } finally {
      setPendingPlan(null);
    }
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

  function displayPrice(plan) {
    if (plan.price === "0") return t("pages.premium.free");
    return `€ ${plan.price}`;
  }

  /** Returns { total, monthlyEq, discountPct } for yearly plans, null otherwise */
  function getYearlyMeta(plan) {
    if (activePeriod !== "yearly" || !plan.yearlyTotal) return null;
    const total   = parseFloat(plan.yearlyTotal.replace(",", "."));
    const monthly = parseFloat(plan.price.replace(",", "."));
    const monthlyEq   = (total / 12).toFixed(2).replace(".", ",");
    const discountPct = Math.round((1 - total / (monthly * 12)) * 100);
    return { total: `€ ${plan.yearlyTotal}`, monthlyEq: `€ ${monthlyEq}`, discountPct };
  }

  return (
    <div style={ps.page}>
      <style>
        {`
          @keyframes vipRewardPop {
            0% { opacity: 0; transform: translateY(-10px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}
      </style>
      <PageHeader
        title={t("pages.premium.title")}
        subtitle={t("pages.premium.subtitle")}
        badge={t("pages.premium.activePlanBadge", { plan: billing.effectivePlan.name })}
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
              ? t("pages.premium.trialActive", { plan: billing.effectivePlan.name, days: billing.trialDaysLeft })
              : t("pages.premium.trialExpired")}
          </span>
          {billing.trialActive && (
            <button
              type="button"
              style={ps.alertCta}
              onClick={() => activatePlan(billing.trialPlan)}
              disabled={pendingPlan !== null}
            >
              {t("pages.premium.activateNow")}
            </button>
          )}
        </div>
      )}

      {checkoutError && (
        <div style={{ ...ps.alertBanner, borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)" }}>
          <span style={{ fontSize: 13, color: "#fca5a5" }}>{checkoutError}</span>
        </div>
      )}

      {billingMessage && (
        <div style={{ ...ps.alertBanner, borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}>
          <span style={{ fontSize: 13, color: "#86efac" }}>{billingMessage}</span>
        </div>
      )}

      {vipNotice && (
        <div style={ps.vipSuccessBanner}>
          <div>
            <strong style={ps.vipSuccessTitle}>{t("pages.premium.vipReachedTitle", { level: vipNotice.level?.toUpperCase() })}</strong>
            {vipNotice.reward && (
              <p style={ps.vipSuccessText}>{t("pages.premium.rewardCode", { code: vipNotice.reward.promotionCode })}</p>
            )}
          </div>
          <button type="button" style={ps.vipDismiss} onClick={() => setVipNotice(null)}>×</button>
        </div>
      )}

      <AppCard>
        <div style={ps.vipHeader}>
          <div>
            <Badge tone="purple">{t("pages.premium.vipClub")}</Badge>
            <h3 style={ps.vipTitle}>{t("pages.premium.vipLevelLabel", { level: vipCurrent.label })}</h3>
          </div>
          <div style={ps.vipPointsBox}>
            <strong>{vipPoints}</strong>
            <span>{t("pages.premium.vipPoints")}</span>
          </div>
        </div>

        <div style={ps.vipProgressGrid}>
          <div>
            <div style={ps.vipProgressTop}>
              <span>{vipCurrent.label}</span>
              <span>{nextVipLevel ? t("pages.premium.nextVipLevelAt", { label: nextVipLevel.label, min: nextVipLevel.min }) : t("pages.premium.maxLevel")}</span>
            </div>
            <div style={ps.progressTrack}>
              <div style={{ ...ps.progressBar, width: `${vipProgress.percent}%` }} />
            </div>
            <p style={ps.vipSubtitle}>
              {nextVipLevel
                ? t("pages.premium.pointsToNext", { count: vipProgress.pointsToNext })
                : t("pages.premium.allVipUnlocked")}
            </p>
          </div>

          <div style={ps.vipRewardPanel}>
            <strong style={ps.vipPanelTitle}>{t("pages.premium.unlockedRewards")}</strong>
            {unlockedVipRewards.length ? (
              <div style={ps.vipRewardsList}>
                {unlockedVipRewards.map((item) => (
                  <span key={item.level} style={ps.vipRewardChip}>
                    {item.levelLabel}: {item.reward.promotionCode}
                  </span>
                ))}
              </div>
            ) : (
              <p style={ps.vipSubtitle}>{t("pages.premium.firstReward")}</p>
            )}
          </div>
        </div>

        <div style={ps.vipFooter}>
          <span>
            {t("pages.premium.nextObjective")}{" "}
            {nextVipLevel
              ? `${nextVipLevel.label} (${nextVipLevel.min} ${t("pages.premium.vipPoints")})`
              : t("pages.premium.vipMaintained")}
          </span>
          <button
            type="button"
            style={ps.vipSyncBtn}
            onClick={() => syncVipStatus(0)}
            disabled={pendingPlan !== null}
          >
            {pendingPlan === "update-vip" ? t("pages.premium.updating") : t("pages.premium.updateVip")}
          </button>
        </div>
      </AppCard>

      {/* ── Toggle mensile / annuale ── */}
      <div style={ps.periodToggle}>
        <button
          type="button"
          onClick={() => setActivePeriod("monthly")}
          style={{ ...ps.periodBtn, ...(activePeriod === "monthly" ? ps.periodBtnActive : {}) }}
        >
          {t("pages.premium.monthly")}
        </button>
        <button
          type="button"
          onClick={() => setActivePeriod("yearly")}
          style={{ ...ps.periodBtn, ...(activePeriod === "yearly" ? ps.periodBtnActive : {}) }}
        >
          {t("pages.premium.yearly")}
          <span style={ps.discountChip}>{t("pages.premium.yearlyDiscount")}</span>
        </button>
      </div>

      {/* ── Pricing cards ── */}
      <div style={ps.cardGrid}>
        {PLANS.map((plan) => {
          const isActive    = currentPlan.id === plan.id;
          const isPending   = pendingPlan?.includes(plan.id);
          const isFeatured  = plan.id === "premium";
          const hasCheckoutPrice = plan.id === "free" || Boolean(STRIPE_PRICE_IDS[plan.id]?.[activePeriod]);
          const isCheckoutDisabled = isActive || pendingPlan !== null || (!developerUnlocked && !hasCheckoutPrice);

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
                      {t("pages.premium.activeBadge")}
                    </span>
                  )}
                  {isActive && plan.badge && (
                    <span style={{ ...ps.planBadge, background: "rgba(255,255,255,0.25)", marginLeft: 0 }}>
                      {t("pages.premium.activeBadge")}
                    </span>
                  )}
                </div>

                {(() => {
                  const yearlyMeta = getYearlyMeta(plan);
                  if (yearlyMeta) {
                    return (
                      <>
                        <div style={ps.priceBlock}>
                          <strong style={ps.priceAmount}>{yearlyMeta.total}</strong>
                          <span style={ps.pricePer}>{t("pages.premium.perYear")}</span>
                          <span style={{ ...ps.discountChipInline }}>–{yearlyMeta.discountPct}%</span>
                        </div>
                        <p style={ps.priceMonthlyEq}>≈ {yearlyMeta.monthlyEq} {t("pages.premium.perMonth")}</p>
                      </>
                    );
                  }
                  return (
                    <>
                      <div style={ps.priceBlock}>
                        <strong style={ps.priceAmount}>{displayPrice(plan)}</strong>
                        {plan.price !== "0" && (
                          <span style={ps.pricePer}>{t("pages.premium.perMonth")}</span>
                        )}
                      </div>
                      {plan.price !== "0" && (
                        <p style={ps.priceNote}>{plan.priceNote}</p>
                      )}
                    </>
                  );
                })()}
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
                          opacity: isCheckoutDisabled ? 0.6 : 1,
                          cursor: isCheckoutDisabled ? "not-allowed" : "pointer",
                        }}
                        onClick={() => activatePlan(plan.id)}
                        disabled={isCheckoutDisabled}
                        title={!hasCheckoutPrice ? "Configura il Price ID Stripe per questo piano" : undefined}
                      >
                        {isPending
                          ? t("pages.premium.loading")
                          : isActive
                          ? t("pages.premium.activePlan")
                          : developerUnlocked
                          ? t("pages.premium.activatePlan")
                          : t("pages.premium.goToCheckout")}
                      </button>
                      {!developerUnlocked && !isActive && !hasCheckoutPrice && (
                        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                          {t("pages.premium.configurePriceId")}
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
                        {pendingPlan === `trial-${plan.id}` ? t("pages.premium.loading") : !developerUnlocked ? t("pages.premium.waitingDevMode") : t("pages.premium.trialFree")}
                      </button>
                      {!developerUnlocked && (
                        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                          {t("pages.premium.checkoutNotAvailable")}
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
                        {!developerUnlocked ? t("pages.premium.waitingDevMode") : t("pages.premium.returnFree")}
                      </button>
                      {!developerUnlocked && (
                        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
                          {t("pages.premium.checkoutNotAvailable")}
                        </p>
                      )}
                    </>
                  )}

                  {isActive && (
                    <>
                      <p style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, margin: "8px 0 0", textAlign: "center" }}>
                        {t("pages.premium.currentPlanActive")}
                      </p>
                      {hasActiveSubscription && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          <button
                            type="button"
                            style={{
                              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                              cursor: pendingPlan !== null ? "not-allowed" : "pointer",
                              opacity: pendingPlan !== null ? 0.55 : 1,
                              background: "rgba(96,165,250,0.12)",
                              border: "1px solid rgba(96,165,250,0.35)",
                              color: "#93c5fd",
                            }}
                            onClick={openBillingPortal}
                            disabled={pendingPlan !== null}
                          >
                            {pendingPlan === "billing-portal" ? t("pages.premium.loading") : t("pages.premium.manageSubscription")}
                          </button>
                          <button
                            type="button"
                            style={{
                              ...ps.trialBtn,
                              opacity: pendingPlan !== null ? 0.55 : 1,
                              cursor: pendingPlan !== null ? "not-allowed" : "pointer",
                            }}
                            onClick={cancelSubscription}
                            disabled={pendingPlan !== null}
                          >
                            {pendingPlan === "cancel-subscription" ? t("pages.premium.loading") : t("pages.premium.cancelSubscription")}
                          </button>
                        </div>
                      )}
                    </>
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
          {t("pages.premium.devModeNote")}
        </div>
      )}

      {/* ── Feature comparison table ── */}
      <AppCard>
        <h3 style={{ marginTop: 0, marginBottom: 18, lineHeight: 1.2 }}>{t("pages.premium.featureComparison")}</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={ps.table}>
            <thead>
              <tr>
                <th style={ps.thLabel}>{t("pages.premium.featureLabel")}</th>
                {PLANS.map((p) => (
                  <th key={p.id} style={{ ...ps.th, color: p.id === "free" ? "#94a3b8" : p.id === "premium" ? "#60a5fa" : "#4ade80" }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [t("pages.premium.featureRoster"),     true,  true,  true],
                [t("pages.premium.featureCalendar"),   true,  true,  true],
                [t("pages.premium.featureTactical"),   true,  true,  true],
                [t("pages.premium.featureMatchDay"),   false, true,  true],
                [t("pages.premium.featurePostMatch"),  false, true,  true],
                [t("pages.premium.featurePhysical"),   false, true,  true],
                [t("pages.premium.featureScouting"),   false, true,  true],
                [t("pages.premium.featureExport"),     false, true,  true],
                [t("pages.premium.featureGenerator"),  false, true,  true],
                [t("pages.premium.featureStaff"),      false, false, true],
                [t("pages.premium.featurePlayerArea"), false, false, true],
                [t("pages.premium.featureSponsor"),    false, false, true],
                [t("pages.premium.featureAi"),         false, false, true],
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
          <Badge tone="purple">{t("pages.premium.rewardCoach")}</Badge>
          <div style={{ fontSize: 52, fontWeight: 900, margin: "14px 0 0", lineHeight: 1 }}>{reward.points}</div>
          <p style={{ color: "#94a3b8", margin: "4px 0 12px" }}>{t("pages.premium.activityPoints")}</p>
          <h3 style={{ margin: "0 0 10px", lineHeight: 1.2 }}>
            {t("pages.premium.levelLabel", { level: reward.level, title: reward.title })}
          </h3>
          <div style={ps.progressTrack}>
            <div style={{ ...ps.progressBar, width: `${reward.progress}%` }} />
          </div>
          <p style={{ color: "#94a3b8", margin: "8px 0 0", fontSize: 13 }}>
            {t("pages.premium.potentialDiscount")} <strong style={{ color: "white" }}>{reward.discount}%</strong>
            {reward.nextLevel ? t("pages.premium.nextLevelAt", { min: reward.nextLevel.min }) : t("pages.premium.maxLevelReached")}
          </p>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.premium.howToLevelUp")}</h3>
          <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 13 }}>
            {t("pages.premium.levelUpSubtitle")}
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {(reward.suggestedActions.length
              ? reward.suggestedActions
              : [t("pages.premium.continueUpdating")]
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
            {t("pages.premium.inviteStaff")}
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
  priceMonthlyEq: {
    margin: "4px 0 0",
    fontSize: 13,
    fontWeight: 700,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.4,
  },
  discountChipInline: {
    background: "rgba(34,197,94,0.22)",
    color: "#86efac",
    fontSize: 11,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 999,
    lineHeight: 1.4,
    alignSelf: "center",
    marginLeft: 4,
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
  /* vip */
  vipSuccessBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "16px 18px",
    borderRadius: 18,
    border: "1px solid rgba(251,191,36,0.38)",
    background: "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(168,85,247,0.12))",
    boxShadow: "0 18px 60px rgba(251,191,36,0.12)",
    animation: "vipRewardPop 420ms ease-out",
  },
  vipSuccessTitle: {
    display: "block",
    fontSize: 15,
    color: "#fde68a",
    lineHeight: 1.2,
  },
  vipSuccessText: {
    margin: "4px 0 0",
    color: "#fef3c7",
    fontSize: 13,
    fontWeight: 800,
  },
  vipDismiss: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fef3c7",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
  },
  vipHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  vipTitle: {
    margin: "12px 0 4px",
    fontSize: 28,
    lineHeight: 1,
    color: "white",
  },
  vipSubtitle: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.45,
  },
  vipPointsBox: {
    minWidth: 128,
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(168,85,247,0.12)",
    border: "1px solid rgba(168,85,247,0.26)",
    textAlign: "right",
  },
  vipProgressGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.45fr)",
    gap: 18,
    alignItems: "stretch",
  },
  vipProgressTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 9,
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  vipRewardPanel: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  vipPanelTitle: {
    display: "block",
    marginBottom: 10,
    fontSize: 13,
    color: "#e2e8f0",
  },
  vipRewardsList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  vipRewardChip: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.11)",
    border: "1px solid rgba(251,191,36,0.22)",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 900,
  },
  vipFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid rgba(255,255,255,0.07)",
    color: "#94a3b8",
    fontSize: 13,
    flexWrap: "wrap",
  },
  vipSyncBtn: {
    padding: "9px 13px",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.09)",
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
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
