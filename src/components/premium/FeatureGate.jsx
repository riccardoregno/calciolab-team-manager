import { useNavigate } from "react-router-dom";

import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { getBillingStatus, getSetupProgress, getSubscriptionPlan, isFeatureUnlocked, premiumFeatures } from "../../utils/helpers";

export default function FeatureGate({ featureKey, appSettings, children }) {
  const navigate = useNavigate();
  const feature = premiumFeatures[featureKey];
  const currentPlan = getSubscriptionPlan(appSettings);
  const setup = getSetupProgress({ appSettings });
  const billing = getBillingStatus(appSettings);

  if (!feature || isFeatureUnlocked(featureKey, appSettings)) {
    return children;
  }

  return (
    <div style={gateStyles.page}>
      <AppCard>
        <div style={gateStyles.lockPanel}>
          <div style={gateStyles.lockIcon}>🔒</div>
          <Badge tone="orange">Piano {feature.plan}</Badge>
          <h1 style={gateStyles.title}>{feature.label}</h1>
          <p style={gateStyles.text}>{feature.description}</p>
          <p style={gateStyles.note}>
            Piano attuale: <strong>{currentPlan.name}</strong>.
            {billing.trialExpired
              ? " Il trial e' scaduto: scegli un piano attivo per riaprire questa sezione."
              : " Sblocca questa sezione con trial, Premium o Club."}
          </p>
          <div style={gateStyles.trialBox}>
            <strong>{billing.trialExpired ? "Trial scaduto" : "Trial consigliato"}</strong>
            <span>
              {billing.trialExpired
                ? "Riattiva un piano dalla pagina Premium o simula un abbonamento attivo."
                : `Configurazione al ${setup.percent}%. Puoi avviare una prova di 14 giorni dalla pagina Premium.`}
            </span>
          </div>
          <div style={gateStyles.actions}>
            <Button onClick={() => navigate("/premium")}>
              {billing.trialExpired ? "Riattiva piano" : "Avvia trial"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/onboarding")}>Completa onboarding</Button>
            <Button variant="ghost" onClick={() => navigate("/")}>Torna alla dashboard</Button>
          </div>
        </div>
      </AppCard>
    </div>
  );
}

const gateStyles = {
  page: {
    minHeight: "58vh",
    display: "grid",
    alignItems: "center",
  },
  lockPanel: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: 14,
    padding: "28px 18px",
  },
  lockIcon: {
    width: 74,
    height: 74,
    borderRadius: 22,
    display: "grid",
    placeItems: "center",
    fontSize: 34,
    background: "rgba(251,191,36,0.14)",
    border: "1px solid rgba(251,191,36,0.28)",
  },
  title: {
    margin: 0,
    fontSize: 34,
  },
  text: {
    margin: 0,
    color: "#cbd5e1",
    maxWidth: 620,
    lineHeight: 1.6,
  },
  note: {
    margin: 0,
    color: "#94a3b8",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 8,
  },
  trialBox: {
    display: "grid",
    gap: 6,
    maxWidth: 560,
    padding: 14,
    borderRadius: 16,
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#cbd5e1",
  },
};
