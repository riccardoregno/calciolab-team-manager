import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "../components/ui/Badge";
import { normalizeAppSettings } from "../utils/helpers";
import { supabase } from "../lib/supabaseClient";
import { useTranslation } from "../i18n";

// ─────────────────────────────────────────────
// Dati configurazione
// ─────────────────────────────────────────────
const TEAM_LEVELS = [
  { id: "prima",        label: "Prima Squadra",  icon: "🏆", desc: "Squadra principale del club" },
  { id: "juniores",     label: "Juniores",        icon: "⚡", desc: "Under 19 / Under 17" },
  { id: "allievi",      label: "Allievi",         icon: "🌱", desc: "Under 15 / Under 16" },
  { id: "giovanissimi", label: "Giovanissimi",    icon: "⭐", desc: "Under 13 / Under 14" },
  { id: "esordienti",   label: "Esordienti",      icon: "🎯", desc: "Under 10 / Under 11 / Under 12" },
];

const STAFF_ROLES = [
  { id: "headCoach",       label: "Head Coach",    icon: "🎛️", desc: "Responsabile tecnico" },
  { id: "assistantCoach",  label: "Assistente",    icon: "📋", desc: "Collaboratore tecnico" },
  { id: "athleticTrainer", label: "Preparatore",   icon: "🏃", desc: "Preparatore atletico" },
  { id: "director",        label: "Dirigente",     icon: "🏢", desc: "Responsabile club" },
  { id: "owner",           label: "Owner / Admin", icon: "👑", desc: "Gestisce tutto il workspace" },
];

const FORMATIONS = [
  { id: "4-3-3",   label: "4-3-3",   desc: "Possesso e pressing alto" },
  { id: "4-2-3-1", label: "4-2-3-1", desc: "Equilibrio e transizioni" },
  { id: "4-4-2",   label: "4-4-2",   desc: "Classico, solidità difensiva" },
  { id: "3-5-2",   label: "3-5-2",   desc: "Ampiezza e densità centrale" },
  { id: "3-4-3",   label: "3-4-3",   desc: "Aggressività e pressing" },
  { id: "5-3-2",   label: "5-3-2",   desc: "Difesa a 5, contropiede" },
  { id: "4-1-4-1", label: "4-1-4-1", desc: "Doppio filtro davanti alla difesa" },
  { id: "4-5-1",   label: "4-5-1",   desc: "Compattezza e ripartenza" },
];

const MODULE_OPTIONS = [
  { id: "players",   label: "Gestione Rosa",       icon: "👥", desc: "Giocatori, status, ruoli e schede", plan: "free" },
  { id: "trainings", label: "Sedute allenamento",  icon: "📋", desc: "Pianifica, registra presenze e carico", plan: "free" },
  { id: "matchDay",  label: "Match Day",           icon: "⚽", desc: "Distinta, piano gara e scouting avversario", plan: "premium" },
  { id: "physical",  label: "Test fisici",         icon: "⏱️", desc: "Gacon, Yo-Yo, sprint e lavori individuali", plan: "premium" },
  { id: "ai",        label: "AI Session Builder",  icon: "✨", desc: "Sedute generate dall'intelligenza artificiale", plan: "premium" },
  { id: "portal",    label: "Area giocatori",      icon: "🎽", desc: "Convocazioni, comunicazioni e rendimento", plan: "club" },
  { id: "sponsors",  label: "Gestione Sponsor",    icon: "🤝", desc: "Hub sponsor, offerte e visibilità brand", plan: "club" },
];

const STEPS = ["Chi sei", "Il tuo club", "Strumenti"];

function recommendPlan(modules) {
  if (modules.some((m) => ["portal", "sponsors"].includes(m))) return "club";
  if (modules.some((m) => ["matchDay", "physical", "ai"].includes(m))) return "premium";
  return "free";
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────
export default function Onboarding({ appSettings = {}, setAppSettings, team }) {
  const navigate  = useNavigate();
  const settings  = normalizeAppSettings(appSettings) || {};

  const [step, setStep]         = useState(1);
  const [saving, setSaving]     = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 700
  );

  const [form, setForm] = useState({
    ...(settings.workspaceProfile || {}),
    teamLevel:       settings.workspaceProfile?.teamLevel       || "prima",
    managesJuniores: settings.workspaceProfile?.managesJuniores || false,
    userRole:        settings.workspaceProfile?.userRole        || "headCoach",
    clubName:        settings.workspaceProfile?.clubName        || "",
    teamName:        settings.workspaceProfile?.teamName        || "",
    currentSeason:   settings.workspaceProfile?.currentSeason   || "2025/2026",
    seasonGoal:      settings.workspaceProfile?.seasonGoal      || "",
    formation:       settings.workspaceProfile?.formation       || "4-3-3",
    modules:         settings.workspaceProfile?.modules         || ["players", "trainings"],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 700px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function toggleModule(id) {
    const modules = form.modules.includes(id)
      ? form.modules.filter((m) => m !== id)
      : [...form.modules, id];
    setForm({ ...form, modules });
  }

  async function complete() {
    setSaving(true);
    try {
      // Salva nome società + flag onboarding su Supabase teams (se disponibile)
      // Il flag server-side è la fonte di verità: previene il bypass via localStorage
      if (team?.id) {
        await supabase
          .from("teams")
          .update({
            ...(form.clubName?.trim() ? { name: form.clubName.trim() } : {}),
            onboarding_completed: true,
          })
          .eq("id", team.id);
      }

      setAppSettings?.({
        ...settings,
        onboarding: { completed: true, completedAt: new Date().toISOString(), currentStep: 3 },
        workspaceProfile: {
          ...form,
          recommendedPlan: recommendPlan(form.modules),
        },
        subscription: {
          ...settings.subscription,
          plan: settings.subscription?.plan === "free" || !settings.subscription?.plan
            ? recommendPlan(form.modules)
            : settings.subscription.plan,
        },
      });

      navigate("/");
    } finally {
      setSaving(false);
    }
  }

  const layoutStyle = isMobile
    ? { ...ob.root, gridTemplateColumns: "1fr" }
    : ob.root;

  return (
    <div style={layoutStyle}>

      {/* ── Sidebar desktop / Progress bar mobile ── */}
      {isMobile ? (
        <MobileProgress step={step} total={STEPS.length} labels={STEPS} />
      ) : (
        <aside style={ob.aside}>
          <div style={ob.asideLogo}>⚽ CalcioLab</div>
          <p style={ob.asideTagline}>Il workspace per allenatori professionisti.</p>

          <div style={ob.stepList}>
            {STEPS.map((label, i) => {
              const n      = i + 1;
              const done   = step > n;
              const active = step === n;
              return (
                <div key={n} style={ob.stepItem}>
                  <div style={{
                    ...ob.stepDot,
                    background: done ? "#22c55e" : active ? "#2563eb" : "rgba(255,255,255,0.1)",
                    border: done ? "2px solid #22c55e" : active ? "2px solid #60a5fa" : "2px solid rgba(255,255,255,0.15)",
                  }}>
                    {done ? "✓" : n}
                  </div>
                  <div>
                    <p style={{ ...ob.stepLabel, color: active ? "#e2e8f0" : done ? "#94a3b8" : "#475569" }}>
                      Step {n}
                    </p>
                    <p style={{ ...ob.stepName, color: active ? "#fff" : done ? "#94a3b8" : "#334155" }}>
                      {label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={ob.asideFooter}>
            <p style={{ margin: 0, color: "#334155", fontSize: 12 }}>
              Puoi modificare tutto in seguito dalle Impostazioni.
            </p>
          </div>
        </aside>
      )}

      {/* ── Contenuto step ── */}
      <main style={isMobile ? ob.mainMobile : ob.main}>
        {step === 1 && (
          <Step1 form={form} setForm={setForm} onNext={() => setStep(2)} isMobile={isMobile} />
        )}
        {step === 2 && (
          <Step2 form={form} setForm={setForm} onBack={() => setStep(1)} onNext={() => setStep(3)} isMobile={isMobile} />
        )}
        {step === 3 && (
          <Step3 form={form} toggleModule={toggleModule} onBack={() => setStep(2)} onComplete={complete} saving={saving} isMobile={isMobile} />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mobile progress bar
// ─────────────────────────────────────────────
function MobileProgress({ step, total, labels }) {
  return (
    <div style={ob.mobileProgress}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 900, fontSize: 16 }}>⚽ CalcioLab</span>
        <span style={{ color: "#64748b", fontSize: 13 }}>Step {step} di {total} — {labels[step - 1]}</span>
      </div>
      <div style={ob.progressBar}>
        <div style={{ ...ob.progressFill, width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1 — Chi sei
// ─────────────────────────────────────────────
function Step1({ form, setForm, onNext, isMobile }) {
  const { t } = useTranslation();
  const canProceed = form.userRole && form.teamLevel;

  return (
    <div style={ob.stepContent}>
      <div style={ob.stepHeader}>
        {!isMobile && <span style={ob.stepBadge}>Step 1 di 3</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>{t("pages.onboarding.welcome")}</h1>
        <p style={ob.stepSubtitle}>
          Dicci chi sei e che squadra alleni. Personalizzeremo il workspace in base alle tue risposte.
        </p>
      </div>

      <Section label="Qual è il tuo ruolo?">
        <div style={ob.cardGrid}>
          {STAFF_ROLES.map((role) => (
            <SelectCard
              key={role.id}
              icon={role.icon}
              label={role.label}
              desc={role.desc}
              active={form.userRole === role.id}
              onClick={() => setForm({ ...form, userRole: role.id })}
            />
          ))}
        </div>
      </Section>

      <Section label="Che squadra alleni?">
        <div style={ob.cardGrid}>
          {TEAM_LEVELS.map((t) => (
            <SelectCard
              key={t.id}
              icon={t.icon}
              label={t.label}
              desc={t.desc}
              active={form.teamLevel === t.id}
              onClick={() => setForm({ ...form, teamLevel: t.id, managesJuniores: false })}
            />
          ))}
        </div>
      </Section>

      {form.teamLevel === "prima" && (
        <Section label="Gestione multi-squadra">
          <button
            onClick={() => setForm({ ...form, managesJuniores: !form.managesJuniores })}
            style={{
              ...ob.toggleBtn,
              background: form.managesJuniores ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
              border: form.managesJuniores ? "1px solid rgba(96,165,250,0.5)" : "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div style={{ ...ob.toggleCheck, background: form.managesJuniores ? "#2563eb" : "rgba(255,255,255,0.1)" }}>
              {form.managesJuniores && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <strong style={{ fontSize: 14, color: "#e2e8f0" }}>Gestisco anche il settore giovanile</strong>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                Potrai vedere e filtrare i giocatori delle squadre giovanili direttamente da CalcioLab
              </p>
            </div>
          </button>
        </Section>
      )}

      <div style={ob.actions}>
        <NextBtn disabled={!canProceed} onClick={onNext} label="Avanti →" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Identità club + modulo
// ─────────────────────────────────────────────
function Step2({ form, setForm, onBack, onNext, isMobile }) {
  const [attempted, setAttempted] = useState(false);
  const canProceed = !!form.clubName?.trim();

  function handleNext() {
    setAttempted(true);
    if (canProceed) onNext();
  }

  return (
    <div style={ob.stepContent}>
      <div style={ob.stepHeader}>
        {!isMobile && <span style={ob.stepBadge}>Step 2 di 3</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>Identità del tuo club 🏟️</h1>
        <p style={ob.stepSubtitle}>
          Questi dati compaiono nei report, nelle convocazioni e nell'area giocatori.
        </p>
      </div>

      <div style={ob.formGrid}>
        <FormField label="Nome società *">
          <input
            style={{
              ...ob.input,
              ...(attempted && !canProceed
                ? { border: "1.5px solid #ef4444", background: "rgba(239,68,68,0.06)" }
                : {}),
            }}
            value={form.clubName}
            onChange={(e) => setForm({ ...form, clubName: e.target.value })}
            placeholder="es. A.S.D. Calcio Rosso"
            autoFocus
          />
          {attempted && !canProceed && (
            <span style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
              ⚠️ Il nome della società è obbligatorio
            </span>
          )}
        </FormField>

        <FormField label="Nome squadra">
          <input
            style={ob.input}
            value={form.teamName}
            onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            placeholder="es. Prima Squadra, Under 19…"
          />
        </FormField>

        <FormField label="Stagione corrente">
          <input
            style={ob.input}
            value={form.currentSeason}
            onChange={(e) => setForm({ ...form, currentSeason: e.target.value })}
            placeholder="es. 2025/2026"
          />
        </FormField>

        <FormField label="Obiettivo stagione">
          <textarea
            style={{ ...ob.input, minHeight: 90, resize: "vertical" }}
            value={form.seasonGoal}
            onChange={(e) => setForm({ ...form, seasonGoal: e.target.value })}
            placeholder="es. Promozione in Eccellenza, consolidamento categoria…"
          />
        </FormField>
      </div>

      {/* Modulo di gioco */}
      <Section label="Modulo di gioco preferito">
        <div style={ob.formationGrid}>
          {FORMATIONS.map((f) => {
            const active = form.formation === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setForm({ ...form, formation: f.id })}
                style={{
                  ...ob.formationCard,
                  background: active ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                  border: active ? "1.5px solid rgba(96,165,250,0.6)" : "1.5px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.15)" : "none",
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 900, color: active ? "#60a5fa" : "#e2e8f0", fontFamily: "monospace" }}>
                  {f.label}
                </span>
                <span style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{f.desc}</span>
                {active && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#2563eb", display: "grid", placeItems: "center",
                  }}>
                    <span style={{ color: "white", fontSize: 9, fontWeight: 900 }}>✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <div style={ob.actions}>
        <BackBtn onClick={onBack} />
        <NextBtn disabled={false} onClick={handleNext} label="Avanti →" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3 — Strumenti
// ─────────────────────────────────────────────
function Step3({ form, toggleModule, onBack, onComplete, saving, isMobile }) {
  const plan = recommendPlan(form.modules);

  const planColors = {
    free:    { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)",  text: "#22c55e", label: "Free" },
    premium: { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)", text: "#fb923c", label: "Premium" },
    club:    { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.3)", text: "#a855f7", label: "Club" },
  };
  const planBadgeTone = { free: "green", premium: "orange", club: "purple" };

  return (
    <div style={ob.stepContent}>
      <div style={ob.stepHeader}>
        {!isMobile && <span style={ob.stepBadge}>Step 3 di 3</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>Scegli i tuoi strumenti 🧰</h1>
        <p style={ob.stepSubtitle}>
          Seleziona i moduli che vuoi usare. Il piano consigliato si aggiorna in automatico.
        </p>
      </div>

      <div style={ob.moduleGrid}>
        {MODULE_OPTIONS.map((mod) => {
          const active = form.modules.includes(mod.id);
          const pColor = planColors[mod.plan];
          return (
            <button
              key={mod.id}
              onClick={() => toggleModule(mod.id)}
              style={{
                ...ob.moduleCard,
                background: active ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.04)",
                border: active ? "1px solid rgba(96,165,250,0.45)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={ob.moduleTop}>
                <span style={ob.moduleIcon}>{mod.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999,
                  background: pColor.bg, border: `1px solid ${pColor.border}`, color: pColor.text,
                }}>
                  {mod.plan === "free" ? "Free" : mod.plan === "premium" ? "Premium" : "Club"}
                </span>
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <strong style={{ fontSize: 14, color: "#e2e8f0", display: "block" }}>{mod.label}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{mod.desc}</span>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: active ? "#2563eb" : "rgba(255,255,255,0.08)",
                border: active ? "none" : "1px solid rgba(255,255,255,0.15)",
                display: "grid", placeItems: "center",
              }}>
                {active && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Piano consigliato */}
      <div style={{
        ...ob.planBox,
        background: planColors[plan].bg,
        border: `1px solid ${planColors[plan].border}`,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Piano consigliato
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#cbd5e1" }}>
            {plan === "free"    && "Rosa e sedute base — perfetto per iniziare."}
            {plan === "premium" && "Strumenti avanzati per allenatori esigenti."}
            {plan === "club"    && "Workspace completo per il club, staff e sponsor."}
          </p>
        </div>
        <Badge tone={planBadgeTone[plan]}>
          {planColors[plan].label}
        </Badge>
      </div>

      <div style={ob.actions}>
        <BackBtn onClick={onBack} />
        <button
          onClick={onComplete}
          disabled={saving}
          style={{ ...ob.completeBtn, ...(saving ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
        >
          {saving ? "Configurazione in corso…" : "Inizia a lavorare 🚀"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={ob.sectionLabel}>{label}</p>
      {children}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={ob.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function SelectCard({ icon, label, desc, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...ob.selectCard,
        background: active ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
        border: active ? "1.5px solid rgba(96,165,250,0.6)" : "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.15)" : "none",
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ textAlign: "left" }}>
        <strong style={{ fontSize: 13, color: active ? "#e2e8f0" : "#cbd5e1", display: "block" }}>{label}</strong>
        <span style={{ fontSize: 12, color: "#475569" }}>{desc}</span>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginLeft: "auto",
        background: active ? "#2563eb" : "rgba(255,255,255,0.08)",
        border: active ? "none" : "1px solid rgba(255,255,255,0.15)",
        display: "grid", placeItems: "center",
      }}>
        {active && <span style={{ color: "white", fontSize: 10, fontWeight: 900 }}>✓</span>}
      </div>
    </button>
  );
}

function NextBtn({ onClick, disabled, label = "Avanti →" }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...ob.nextBtn,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
    }}>
      {label}
    </button>
  );
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={ob.backBtn}>← Indietro</button>
  );
}

// ─────────────────────────────────────────────
// Stili
// ─────────────────────────────────────────────
const ob = {
  root: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    minHeight: "100vh",
    background: "#080b12",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
  },
  /* Mobile progress */
  mobileProgress: {
    padding: "16px 20px",
    background: "rgba(15,17,21,0.95)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  progressBar: {
    height: 4,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg,#2563eb,#38bdf8)",
    borderRadius: 99,
    transition: "width 0.35s ease",
  },
  /* Aside desktop */
  aside: {
    background: "linear-gradient(180deg, #0f172a 0%, #080b12 100%)",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    padding: "40px 24px",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  },
  asideLogo:    { fontSize: 22, fontWeight: 900, color: "white", marginBottom: 8 },
  asideTagline: { color: "#475569", fontSize: 13, marginTop: 0, marginBottom: 48 },
  stepList:     { display: "flex", flexDirection: "column", gap: 28 },
  stepItem:     { display: "flex", alignItems: "flex-start", gap: 14 },
  stepDot: {
    width: 32, height: 32, borderRadius: "50%",
    display: "grid", placeItems: "center",
    fontSize: 13, fontWeight: 900, color: "white", flexShrink: 0,
  },
  stepLabel: { margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 },
  stepName:  { margin: "2px 0 0", fontSize: 14, fontWeight: 700 },
  asideFooter: { marginTop: "auto", paddingTop: 24 },
  /* Main */
  main:       { padding: "48px 56px", overflowY: "auto", maxWidth: 780 },
  mainMobile: { padding: "24px 20px", overflowY: "auto" },
  stepContent: { display: "grid", gap: 0 },
  stepHeader:  { marginBottom: 32 },
  stepBadge: {
    display: "inline-block", fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: 0.6,
    color: "#38bdf8", background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.25)", borderRadius: 999,
    padding: "4px 12px", marginBottom: 14,
  },
  stepTitle:    { margin: "0 0 10px", fontSize: 32, fontWeight: 900, color: "white", lineHeight: 1.2 },
  stepSubtitle: { margin: 0, color: "#64748b", fontSize: 15, lineHeight: 1.6 },
  sectionLabel: {
    margin: "0 0 12px", fontSize: 12, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 10,
  },
  selectCard: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", borderRadius: 14, cursor: "pointer",
    textAlign: "left", transition: "all 0.15s ease", color: "white",
  },
  /* Formation grid */
  formationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
  },
  formationCard: {
    position: "relative",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "16px 12px", borderRadius: 14, cursor: "pointer",
    transition: "all 0.15s ease", color: "white", textAlign: "center",
  },
  /* Toggle */
  toggleBtn: {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "16px 18px", borderRadius: 16, cursor: "pointer",
    textAlign: "left", width: "100%", color: "white", transition: "all 0.15s ease",
  },
  toggleCheck: {
    width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
    display: "grid", placeItems: "center", transition: "all 0.15s ease",
  },
  /* Form */
  formGrid:   { display: "grid", gap: 16, marginBottom: 28 },
  fieldLabel: {
    fontSize: 12, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: 0.4, color: "#64748b",
  },
  input: {
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0", fontSize: 14, outline: "none",
  },
  /* Module grid */
  moduleGrid: { display: "grid", gap: 10, marginBottom: 24 },
  moduleCard: {
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 16px", borderRadius: 14, cursor: "pointer",
    textAlign: "left", color: "white", transition: "all 0.15s ease", width: "100%",
  },
  moduleTop: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 6, minWidth: 48,
  },
  moduleIcon: { fontSize: 22 },
  /* Plan box */
  planBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 16, padding: "18px 22px", borderRadius: 18, marginBottom: 32,
    flexWrap: "wrap",
  },
  /* Actions */
  actions: {
    display: "flex", gap: 12, alignItems: "center",
    justifyContent: "flex-end", paddingTop: 8,
  },
  backBtn: {
    background: "none", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12, padding: "11px 20px",
    color: "#94a3b8", cursor: "pointer", fontWeight: 700, fontSize: 14,
  },
  nextBtn: {
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    border: "none", borderRadius: 12, padding: "12px 28px",
    color: "white", fontWeight: 800, fontSize: 15,
    boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
  },
  completeBtn: {
    background: "linear-gradient(135deg, #059669, #047857)",
    border: "none", borderRadius: 12, padding: "12px 32px",
    color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer",
    boxShadow: "0 8px 24px rgba(5,150,105,0.35)",
  },
};
