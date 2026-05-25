/**
 * BillingBanner
 * Banner sticky globale che mostra lo stato di billing critico:
 * - Trial attivo con ≤7 giorni alla scadenza
 * - Trial scaduto
 * - Pagamento fallito / past_due
 *
 * Dismissabile per sessione (tranne past_due che è sempre visibile).
 * Va inserito subito dopo il Topbar, prima delle Routes.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBillingStatus } from "../../utils/helpers";

const STORAGE_KEY = "calciolab_billing_banner_dismissed";
const TRIAL_WARN_DAYS = 7; // mostra il banner trial da X giorni in poi

export default function BillingBanner({ appSettings }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Legge eventuale dismiss salvato in sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setDismissed(true);
    }
  }, []);

  if (!appSettings) return null;

  const billing = getBillingStatus(appSettings);
  const { billingStatus, trialDaysLeft, trialExpired } = billing;

  // ── Determina quale stato mostrare ───────────────────────────────────────────
  let variant = null; // "trial-warn" | "trial-danger" | "trial-expired" | "past-due"

  if (billingStatus === "past_due") {
    variant = "past-due";
  } else if (trialExpired) {
    variant = "trial-expired";
  } else if (billingStatus === "trialing" && trialDaysLeft <= TRIAL_WARN_DAYS) {
    variant = trialDaysLeft <= 2 ? "trial-danger" : "trial-warn";
  }

  // Niente da mostrare
  if (!variant) return null;

  // past-due non è dismissabile
  const isDismissable = variant !== "past-due";
  if (isDismissable && dismissed) return null;

  // ── Testi e colori per variante ──────────────────────────────────────────────
  const config = {
    "trial-warn": {
      bg:     "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.28)",
      dot:    "#f59e0b",
      icon:   "⏳",
      text:   `Trial in scadenza — rimangono <strong>${trialDaysLeft} giorni</strong>. Attiva ora per non interrompere il servizio.`,
      cta:    "Attiva piano",
    },
    "trial-danger": {
      bg:     "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.3)",
      dot:    "#ef4444",
      icon:   "🚨",
      text:   trialDaysLeft <= 1
        ? "Il tuo trial <strong>scade oggi</strong>! Attiva il piano subito per continuare."
        : `Il tuo trial scade <strong>domani</strong>! Attiva il piano ora.`,
      cta:    "Attiva subito →",
    },
    "trial-expired": {
      bg:     "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.3)",
      dot:    "#ef4444",
      icon:   "🔒",
      text:   "Il tuo trial <strong>è scaduto</strong>. Alcune funzionalità sono limitate — attiva un piano per ripristinarle.",
      cta:    "Scegli piano",
    },
    "past-due": {
      bg:     "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.3)",
      dot:    "#ef4444",
      icon:   "⚠️",
      text:   "Problema con il <strong>metodo di pagamento</strong>. Aggiorna i dati per evitare l'interruzione del servizio.",
      cta:    "Aggiorna ora",
    },
  }[variant];

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      style={{
        background: config.bg,
        borderBottom: `1px solid ${config.border}`,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        flexShrink: 0,
      }}
      role="alert"
    >
      {/* Dot pulsante */}
      <span
        style={{
          width: 8, height: 8, borderRadius: "50%",
          background: config.dot, flexShrink: 0,
          boxShadow: `0 0 0 0 ${config.dot}`,
          animation: "billingPulse 1.8s ease-in-out infinite",
        }}
      />

      <span style={{ fontSize: 16, flexShrink: 0 }}>{config.icon}</span>

      <span
        style={{ flex: 1, fontSize: 13, color: "#cbd5e1", lineHeight: 1.4 }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: config.text }}
      />

      <button
        type="button"
        onClick={() => navigate("/premium")}
        style={{
          background: "rgba(255,255,255,0.1)",
          border: `1px solid ${config.border}`,
          borderRadius: 8,
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 700,
          padding: "5px 12px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {config.cta}
      </button>

      {isDismissable && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Chiudi"
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            padding: "2px 4px",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}

      {/* Animazione pulse */}
      <style>{`
        @keyframes billingPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${config.dot}55; }
          50%       { box-shadow: 0 0 0 5px ${config.dot}00; }
        }
      `}</style>
    </div>
  );
}
