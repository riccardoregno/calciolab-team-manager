import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getTeamBillingTestState } from "../../lib/teamBillingTest";
import AppCard from "../ui/AppCard";
import PageHeader from "../ui/PageHeader";
import { useTranslation } from "../../i18n";
import Button from "../ui/Button";

const labels = {
  free: "Squadra da attivare",
  incomplete: "Pagamento iniziale in sospeso",
  past_due: "Rinnovo non riuscito. Accesso operativo sospeso fino al pagamento.",
  canceled: "Abbonamento scaduto",
  active: "Squadra attiva",
};

export default function TeamBillingTestPanel({ team }) {
  const { t, language } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const billing = team?.team_billing_test;
  const status = getTeamBillingTestState(billing);
  const fromCheckout = new URLSearchParams(window.location.search).get("checkout") === "success";

  async function open(action) {
    setBusy(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("http://127.0.0.1:54321/functions/v1/team-billing-test", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + (session?.access_token ?? ""),
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, teamId: team.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Operazione Stripe test non riuscita.");
      window.location.assign(data.url);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="billing-test-page">
    <PageHeader title={t("teamContext.billing")} badge={t("teamContext.testMode")} />
    <AppCard title={t("teamContext.price")} className="billing-test-card">
      <p className="billing-test-status" data-status={status} role="status">{language === "it" ? labels[status] : t("teamContext.status." + status)}</p>
      <p>{t("teamContext.billingIntro")}</p>
      {status === "active" && billing.cancel_at_period_end && (
        <p>{t("teamContext.cancelAt", { date: new Date(billing.period_end).toLocaleDateString(language) })}</p>
      )}
      {fromCheckout && status !== "active" && (
        <p>{t("teamContext.pending")}</p>
      )}
      {error && <p role="alert">{error}</p>}
      {team?.role === "owner" ? (
        <div className="billing-test-actions">
          {["free", "canceled"].includes(status) && <Button disabled={busy} onClick={() => open("checkout")}>{t("teamContext.activate")}</Button>}
          {billing?.subscription_id && <Button variant="ghost" disabled={busy} onClick={() => open("portal")}>{t("teamContext.manage")}</Button>}
        </div>
      ) : <p>{t("teamContext.billingOwner")}</p>}
    </AppCard>
    </section>
  );
}
