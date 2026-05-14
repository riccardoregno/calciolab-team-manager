import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { memberRoles, normalizeAppSettings } from "../utils/helpers";

const moduleOptions = [
  { id: "players", label: "Rosa", plan: "Free" },
  { id: "trainings", label: "Sedute", plan: "Free" },
  { id: "matchDay", label: "Match Day", plan: "Premium" },
  { id: "physical", label: "Test e lavori fisici", plan: "Premium" },
  { id: "ai", label: "AI Session Builder", plan: "Premium" },
  { id: "portal", label: "Area giocatori", plan: "Club" },
  { id: "sponsors", label: "Sponsor", plan: "Club" },
];

export default function Onboarding({ appSettings = {}, setAppSettings }) {
  const navigate = useNavigate();
  const settings = normalizeAppSettings(appSettings);
  const [form, setForm] = useState(settings.workspaceProfile);

  function toggleModule(moduleId) {
    const modules = form.modules.includes(moduleId)
      ? form.modules.filter((item) => item !== moduleId)
      : [...form.modules, moduleId];

    setForm({ ...form, modules, recommendedPlan: recommendPlan(modules) });
  }

  function completeOnboarding() {
    setAppSettings?.({
      ...settings,
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
        currentStep: 3,
      },
      workspaceProfile: {
        ...form,
        recommendedPlan: recommendPlan(form.modules),
      },
      subscription: {
        ...settings.subscription,
        plan: settings.subscription.plan === "free" ? recommendPlan(form.modules) : settings.subscription.plan,
      },
    });
    navigate("/");
  }

  return (
    <div style={onboardingStyles.page}>
      <PageHeader
        title="Onboarding CalcioLab"
        subtitle="Configura squadra, ruolo e moduli: il prodotto diventa subito piu' chiaro per ogni nuovo utente."
        badge={settings.onboarding.completed ? "Completato" : "Da completare"}
      />

      <div style={onboardingStyles.grid}>
        <AppCard title="Identita squadra" subtitle="Dati base del workspace.">
          <div style={onboardingStyles.formGrid}>
            <Field label="Nome societa">
              <input value={form.clubName} onChange={(event) => setForm({ ...form, clubName: event.target.value })} style={styles.input} />
            </Field>
            <Field label="Nome squadra">
              <input value={form.teamName} onChange={(event) => setForm({ ...form, teamName: event.target.value })} style={styles.input} />
            </Field>
            <Field label="Categoria">
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} style={styles.input}>
                <option>Adulti</option>
                <option>Juniores</option>
                <option>Allievi</option>
                <option>Giovanissimi</option>
                <option>Esordienti</option>
              </select>
            </Field>
            <Field label="Il tuo ruolo">
              <select value={form.userRole} onChange={(event) => setForm({ ...form, userRole: event.target.value })} style={styles.input}>
                {Object.entries(memberRoles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Obiettivo stagione">
              <textarea value={form.seasonGoal} onChange={(event) => setForm({ ...form, seasonGoal: event.target.value })} style={{ ...styles.input, minHeight: 100 }} />
            </Field>
          </div>
        </AppCard>

        <AppCard title="Moduli da attivare" subtitle="Da qui consigliamo il piano piu' adatto.">
          <div style={onboardingStyles.modules}>
            {moduleOptions.map((module) => {
              const active = form.modules.includes(module.id);

              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  style={{
                    ...onboardingStyles.moduleButton,
                    borderColor: active ? "#38bdf8" : "rgba(255,255,255,0.08)",
                    background: active ? "rgba(56,189,248,0.13)" : "rgba(255,255,255,0.045)",
                  }}
                >
                  <strong>{module.label}</strong>
                  <Badge tone={module.plan === "Club" ? "purple" : module.plan === "Premium" ? "orange" : "green"}>{module.plan}</Badge>
                </button>
              );
            })}
          </div>

          <div style={onboardingStyles.recommendation}>
            <span>Piano consigliato</span>
            <strong>{recommendPlan(form.modules)}</strong>
          </div>

          <Button onClick={completeOnboarding} style={{ width: "100%", marginTop: 16 }}>
            Completa configurazione
          </Button>
        </AppCard>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={onboardingStyles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function recommendPlan(modules) {
  if (modules.some((module) => ["portal", "sponsors"].includes(module))) return "club";
  if (modules.some((module) => ["matchDay", "physical", "ai"].includes(module))) return "premium";
  return "free";
}

const onboardingStyles = {
  page: { display: "grid", gap: 22 },
  grid: { display: "grid", gridTemplateColumns: "1fr 0.9fr", gap: 22, alignItems: "start" },
  formGrid: { display: "grid", gap: 12 },
  field: { display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  modules: { display: "grid", gap: 10 },
  moduleButton: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, color: "white", cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)" },
  recommendation: { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16, padding: 16, borderRadius: 18, background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.2)", color: "#cbd5e1" },
};
