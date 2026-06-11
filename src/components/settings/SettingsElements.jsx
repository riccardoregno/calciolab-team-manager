import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { styles } from "../../styles/index.js";
import { normalizeAppSettings } from "../../utils/helpers";
import { sharedStyles, acctStyles, promoStyles } from "../../styles/settings";

export function InfoItem({ label, value }) {
  return (
    <div style={sharedStyles.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function RoadmapItem({ title, text }) {
  return (
    <div style={sharedStyles.roadmapItem}>
      <strong style={{ lineHeight: 1.2 }}>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
export function NumberField({ label, value, onChange }) {
  return (
    <label style={sharedStyles.label}>
      {label}
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.input}
      />
    </label>
  );
}
export function ClubField({ label, children }) {
  return (
    <label style={sharedStyles.clubField}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function InfoMini({ label, value }) {
  return (
    <div style={sharedStyles.infoMini}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function VipBadge() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 1,
      textTransform: "uppercase",
      background: "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(251,146,60,0.16))",
      border: "1px solid rgba(250,204,21,0.45)",
      color: "#fbbf24",
      boxShadow: "0 0 8px rgba(250,204,21,0.2)",
    }}>
      ⭐ VIP
    </span>
  );
}
export function NotifPreviewRow({ icon, title, desc, tone }) {
  const colors = { blue: "#38bdf8", purple: "#a78bfa", red: "#f87171", green: "#22c55e" };
  const color = colors[tone] || "#94a3b8";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: `${color}11`, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <strong style={{ fontSize: 13, color }}>{title}</strong>
        <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 13 }}>{desc}</p>
      </div>
    </div>
  );
}

export function RedeemPromoCard({ team, appSettings = {}, showToast }) {
  const settings = normalizeAppSettings(appSettings);
  const plan = settings.subscription?.plan || "free";
  const billingStatus = settings.subscription?.billingStatus || "free";
  const alreadyActive = billingStatus === "active" && plan !== "free";

  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRedeem(e) {
    e.preventDefault();
    setFeedback(null);
    const code = input.trim().toUpperCase();
    if (!code) return;

    if (!team?.id) {
      setFeedback({ ok: false, text: "Nessun team attivo: impossibile riscattare il codice." });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-promo-code", {
        body: { teamId: team.id, code },
      });

      if (error || !data?.success) {
        const message = data?.error || error?.message || "Codice non valido.";
        setFeedback({ ok: false, text: message });
        return;
      }

      setFeedback({ ok: true, text: `Codice applicato! Piano ${String(data.plan || "").toUpperCase()} attivato.` });
      setInput("");
      showToast?.(`Piano ${String(data.plan || "").toUpperCase()} attivato tramite codice promozionale.`, "success");
    } catch (err) {
      setFeedback({ ok: false, text: err?.message || "Errore durante il riscatto del codice." });
    } finally {
      setSubmitting(false);
    }
  }

  const planColors = { premium: "#38bdf8", club: "#a78bfa" };

  return (
    <AppCard>
      <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>Codice promozionale</h3>
      <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
        Hai ricevuto un codice di accesso? Inseriscilo qui per attivare il piano associato.
      </p>

      {alreadyActive ? (
        <div style={promoStyles.redeemedBox}>
          <span style={{ fontSize: 20 }}>OK</span>
          <div>
            <strong style={{ color: planColors[plan] || "#22c55e" }}>
              Accesso attivo — piano {plan.toUpperCase()}
            </strong>
          </div>
        </div>
      ) : (
        <form onSubmit={handleRedeem} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            placeholder="Inserisci il codice..."
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            disabled={submitting}
            style={{
              ...styles.input,
              flex: "1 1 200px",
              letterSpacing: 3,
              textTransform: "uppercase",
              fontFamily: "monospace",
              fontWeight: 700,
            }}
          />
          <Button type="submit" disabled={submitting}>{submitting ? "Verifica..." : "Applica"}</Button>
        </form>
      )}

      {feedback && (
        <div style={{
          ...acctStyles.feedback,
          marginTop: 12,
          ...(feedback.ok ? acctStyles.feedbackOk : acctStyles.feedbackErr),
        }}>
          {feedback.text}
        </div>
      )}
    </AppCard>
  );
}
