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

// Labels resolved at render time via t() inside the component — see stepLabels below
const STEP_COUNT = 4;

const INVITE_ROLES = [
  { id: "assistantCoach",  label: "Assistente allenatore" },
  { id: "athleticTrainer", label: "Preparatore atletico"  },
  { id: "director",        label: "Dirigente"             },
  { id: "headCoach",       label: "Head Coach"            },
];

const QUICKSTART_ACTIONS = [
  { key: "players",   icon: "👥", path: "/players",                      plan: "free"    },
  { key: "trainings", icon: "📋", path: "/trainings",                    plan: "free"    },
  { key: "matches",   icon: "⚽", path: "/matches",                      plan: "free"    },
  { key: "club",      icon: "🏟️", path: "/settings?tab=club",           plan: "free"    },
  { key: "physical",  icon: "🏃", path: "/physical-tests",               plan: "premium" },
  { key: "invite",    icon: "👋", path: "/settings?tab=club&modal=invite-member", plan: "free" },
];

function recommendPlan(modules) {
  if (modules.some((m) => ["portal", "sponsors"].includes(m))) return "club";
  if (modules.some((m) => ["matchDay", "physical", "ai"].includes(m))) return "premium";
  return "free";
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────
export default function Onboarding({ appSettings = {}, setAppSettings, team }) {
  const { t }     = useTranslation();
  const navigate  = useNavigate();
  const settings  = normalizeAppSettings(appSettings) || {};
  const stepLabels = [
    t("pages.onboarding.whoCareYou"),
    t("pages.onboarding.yourClub"),
    t("pages.onboarding.tools"),
    "Invita il team",
  ];

  const [step, setStep]         = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
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

  // Carica il token invito dal team quando si arriva allo step 4
  useEffect(() => {
    if (step !== 4 || !team?.id || inviteToken !== null) return;
    supabase
      .from("teams")
      .select("settings")
      .eq("id", team.id)
      .maybeSingle()
      .then(({ data }) => {
        setInviteToken(data?.settings?.inviteToken || "");
      })
      .catch(() => setInviteToken(""));
  }, [step, team?.id, inviteToken]);

  function toggleModule(id) {
    const modules = form.modules.includes(id)
      ? form.modules.filter((m) => m !== id)
      : [...form.modules, id];
    setForm({ ...form, modules });
  }

  // Step 1: saves wizard data, shows the success screen (onboarding NOT yet marked done)
  async function preComplete() {
    setSaving(true);
    try {
      setAppSettings?.({
        ...settings,
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
      setShowSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  // Step 2: marks onboarding done on Supabase + local, then navigates
  async function finalize(path = "/") {
    try {
      if (team?.id) {
        await supabase
          .from("teams")
          .update({
            ...(form.clubName?.trim() ? { name: form.clubName.trim() } : {}),
            onboarding_completed: true,
          })
          .eq("id", team.id);
      }
      setAppSettings?.((prev) => ({
        ...normalizeAppSettings(prev),
        onboarding: { completed: true, completedAt: new Date().toISOString(), currentStep: 3 },
      }));
      navigate(path);
    } catch {
      navigate(path);
    }
  }

  const layoutStyle = isMobile
    ? { ...ob.root, gridTemplateColumns: "1fr" }
    : ob.root;

  return (
    <div style={layoutStyle}>

      {/* ── Sidebar desktop / Progress bar mobile ── */}
      {isMobile ? (
        <MobileProgress step={step} total={STEP_COUNT} labels={stepLabels} />
      ) : (
        <aside style={ob.aside}>
          <div style={ob.asideLogo}>⚽ CalcioLab</div>
          <p style={ob.asideTagline}>{t("pages.onboarding.tagline")}</p>

          <div style={ob.stepList}>
            {stepLabels.map((label, i) => {
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
                      {t("pages.onboarding.stepLabel", { n })}
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
              {t("pages.onboarding.settingsNote")}
            </p>
          </div>
        </aside>
      )}

      {/* ── Contenuto step ── */}
      <main style={isMobile ? ob.mainMobile : ob.main}>
        {!showSuccess && step === 1 && (
          <Step1 form={form} setForm={setForm} onNext={() => setStep(2)} isMobile={isMobile} />
        )}
        {!showSuccess && step === 2 && (
          <Step2 form={form} setForm={setForm} onBack={() => setStep(1)} onNext={() => setStep(3)} isMobile={isMobile} />
        )}
        {!showSuccess && step === 3 && (
          <Step3 form={form} toggleModule={toggleModule} onBack={() => setStep(2)} onComplete={() => setStep(4)} saving={saving} isMobile={isMobile} />
        )}
        {!showSuccess && step === 4 && (
          <Step4
            form={form}
            team={team}
            inviteToken={inviteToken}
            onBack={() => setStep(3)}
            onComplete={preComplete}
            isMobile={isMobile}
          />
        )}
        {showSuccess && (
          <SuccessScreen form={form} onNavigate={finalize} isMobile={isMobile} />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mobile progress bar
// ─────────────────────────────────────────────
function MobileProgress({ step, total, labels }) {
  const { t } = useTranslation();
  return (
    <div style={ob.mobileProgress}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 900, fontSize: 16 }}>⚽ CalcioLab</span>
        <span style={{ color: "#64748b", fontSize: 13 }}>{t("pages.onboarding.mobileProgress", { step, total, label: labels[step - 1] })}</span>
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
        {!isMobile && <span style={ob.stepBadge}>{t("pages.onboarding.step", { current: 1, total: STEP_COUNT })}</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>{t("pages.onboarding.welcome")}</h1>
        <p style={ob.stepSubtitle}>{t("pages.onboarding.step1Subtitle")}</p>
      </div>

      <Section label={t("pages.onboarding.yourRoleQuestion")}>
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

      <Section label={t("pages.onboarding.yourTeamQuestion")}>
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
        <Section label={t("pages.onboarding.multiTeam")}>
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
              <strong style={{ fontSize: 14, color: "#e2e8f0" }}>{t("pages.onboarding.managesJunioresLabel")}</strong>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                {t("pages.onboarding.managesJunioresDesc")}
              </p>
            </div>
          </button>
        </Section>
      )}

      <div style={ob.actions}>
        <NextBtn disabled={!canProceed} onClick={onNext} label={t("pages.onboarding.next")} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Identità club + modulo
// ─────────────────────────────────────────────
function Step2({ form, setForm, onBack, onNext, isMobile }) {
  const { t } = useTranslation();
  const [attempted, setAttempted] = useState(false);
  const canProceed = !!form.clubName?.trim();

  function handleNext() {
    setAttempted(true);
    if (canProceed) onNext();
  }

  return (
    <div style={ob.stepContent}>
      <div style={ob.stepHeader}>
        {!isMobile && <span style={ob.stepBadge}>{t("pages.onboarding.step", { current: 2, total: STEP_COUNT })}</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>{t("pages.onboarding.step2Title")}</h1>
        <p style={ob.stepSubtitle}>{t("pages.onboarding.step2Subtitle")}</p>
      </div>

      <div style={ob.formGrid}>
        <FormField label={t("pages.onboarding.clubNameLabel")}>
          <input
            style={{
              ...ob.input,
              ...(attempted && !canProceed
                ? { border: "1.5px solid #ef4444", background: "rgba(239,68,68,0.06)" }
                : {}),
            }}
            value={form.clubName}
            onChange={(e) => setForm({ ...form, clubName: e.target.value })}
            placeholder={t("pages.onboarding.clubNamePlaceholder")}
            autoFocus
          />
          {attempted && !canProceed && (
            <span style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
              {t("pages.onboarding.clubNameRequired")}
            </span>
          )}
        </FormField>

        <FormField label={t("pages.onboarding.teamNameLabel")}>
          <input
            style={ob.input}
            value={form.teamName}
            onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            placeholder={t("pages.onboarding.teamNamePlaceholder")}
          />
        </FormField>

        <FormField label={t("pages.onboarding.seasonLabel")}>
          <input
            style={ob.input}
            value={form.currentSeason}
            onChange={(e) => setForm({ ...form, currentSeason: e.target.value })}
            placeholder="es. 2025/2026"
          />
        </FormField>

        <FormField label={t("pages.onboarding.seasonGoalLabel")}>
          <textarea
            style={{ ...ob.input, minHeight: 90, resize: "vertical" }}
            value={form.seasonGoal}
            onChange={(e) => setForm({ ...form, seasonGoal: e.target.value })}
            placeholder={t("pages.onboarding.seasonGoalPlaceholder")}
          />
        </FormField>
      </div>

      {/* Modulo di gioco */}
      <Section label={t("pages.onboarding.formationLabel")}>
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
        <NextBtn disabled={false} onClick={handleNext} label={t("pages.onboarding.next")} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3 — Strumenti
// ─────────────────────────────────────────────
function Step3({ form, toggleModule, onBack, onComplete, saving, isMobile }) {
  const { t } = useTranslation();
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
        {!isMobile && <span style={ob.stepBadge}>{t("pages.onboarding.step", { current: 3, total: STEP_COUNT })}</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>{t("pages.onboarding.step3Title")}</h1>
        <p style={ob.stepSubtitle}>{t("pages.onboarding.step3Subtitle")}</p>
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
                  {mod.plan === "free" ? t("pages.onboarding.planLabelFree") : mod.plan === "premium" ? t("pages.onboarding.planLabelPremium") : t("pages.onboarding.planLabelClub")}
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
            {t("pages.onboarding.recommendedPlanTitle")}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#cbd5e1" }}>
            {plan === "free"    && t("pages.onboarding.planFreeDesc")}
            {plan === "premium" && t("pages.onboarding.planPremiumDesc")}
            {plan === "club"    && t("pages.onboarding.planClubDesc")}
          </p>
        </div>
        <Badge tone={planBadgeTone[plan]}>
          {t(`pages.onboarding.planLabel${plan.charAt(0).toUpperCase() + plan.slice(1)}`)}
        </Badge>
      </div>

      <div style={ob.actions}>
        <BackBtn onClick={onBack} />
        <button
          onClick={onComplete}
          disabled={saving}
          style={{ ...ob.completeBtn, ...(saving ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
        >
          {saving ? t("pages.onboarding.btnConfiguring") : t("pages.onboarding.btnStart")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 4 — Invita il tuo staff
// ─────────────────────────────────────────────
function Step4({ form, team: _team, inviteToken, onBack, onComplete, isMobile }) {
  const [emails, setEmails]         = useState([]);
  const [inputEmail, setInputEmail] = useState("");
  const [inputRole, setInputRole]   = useState("assistantCoach");
  const [copied, setCopied]         = useState(false);
  const [sending, setSending]       = useState(false);
  const [sentCount, setSentCount]   = useState(0);

  const inviteUrl = inviteToken
    ? `${window.location.origin}/join?token=${inviteToken}`
    : null;

  async function copyLink() {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function addEmail() {
    const v = inputEmail.trim().toLowerCase();
    if (!v.includes("@") || emails.find((e) => e.email === v)) return;
    setEmails([...emails, { email: v, role: inputRole }]);
    setInputEmail("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); addEmail(); }
  }

  async function sendInvites() {
    if (!emails.length) { onComplete(); return; }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || "";

      const inviterName = sessionData?.session?.user?.user_metadata?.first_name
        || sessionData?.session?.user?.email
        || form.clubName
        || "Il tuo coach";
      await Promise.allSettled(
        emails.map((inv) =>
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
              "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({
              type:        "team_invite",
              to:          inv.email,
              inviterName,
              teamName:    form.clubName || "CalcioLab",
              roleName:    INVITE_ROLES.find((r) => r.id === inv.role)?.label || inv.role,
              inviteUrl,
            }),
          }).catch(() => {})
        )
      );
      setSentCount(emails.length);
    } finally {
      setSending(false);
      setTimeout(() => onComplete(), 1400);
    }
  }

  const tokenLoading = inviteToken === null;

  return (
    <div style={ob.stepContent}>
      <div style={ob.stepHeader}>
        {!isMobile && <span style={ob.stepBadge}>Passo 4 di {STEP_COUNT}</span>}
        <h1 style={isMobile ? { ...ob.stepTitle, fontSize: 24 } : ob.stepTitle}>
          Invita il tuo staff 👋
        </h1>
        <p style={ob.stepSubtitle}>
          Condividi il link di invito con assistenti, preparatori e dirigenti. Potrai farlo anche dopo.
        </p>
      </div>

      {/* ── Invite link ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={ob.sectionLabel}>Link di invito</p>
        <div style={{
          display: "flex", gap: 10, alignItems: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14, padding: "12px 16px",
          flexWrap: "wrap",
        }}>
          <code style={{
            flex: 1, fontSize: 12, color: "#64748b",
            wordBreak: "break-all", minWidth: 0,
          }}>
            {tokenLoading ? "Caricamento…" : inviteUrl || "Link non disponibile — completa prima il profilo"}
          </code>
          <button
            onClick={copyLink}
            disabled={!inviteUrl || tokenLoading}
            style={{
              ...ob.nextBtn,
              padding: "8px 18px", fontSize: 13,
              background: copied
                ? "linear-gradient(135deg,#059669,#047857)"
                : "linear-gradient(135deg,#2563eb,#1d4ed8)",
              opacity: !inviteUrl ? 0.4 : 1,
              cursor: !inviteUrl ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "✓ Copiato!" : "Copia link"}
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#334155" }}>
          Chi riceve il link può unirsi direttamente alla tua squadra.
        </p>
      </div>

      {/* ── Email invites ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={ob.sectionLabel}>Oppure invia via email</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            style={{ ...ob.input, flex: "1 1 200px" }}
            type="email"
            placeholder="email@staff.it"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <select
            style={{ ...ob.input, flex: "0 0 auto", minWidth: 160, cursor: "pointer" }}
            value={inputRole}
            onChange={(e) => setInputRole(e.target.value)}
          >
            {INVITE_ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={addEmail}
            style={{
              ...ob.nextBtn,
              padding: "10px 18px", fontSize: 13, whiteSpace: "nowrap",
            }}
          >
            + Aggiungi
          </button>
        </div>

        {/* Lista email */}
        {emails.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {emails.map((inv) => (
              <div key={inv.email} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(96,165,250,0.2)",
                borderRadius: 10, padding: "8px 14px",
              }}>
                <span style={{ fontSize: 13, color: "#93c5fd", flex: 1 }}>{inv.email}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#64748b",
                  background: "rgba(255,255,255,0.07)", borderRadius: 99,
                  padding: "2px 8px",
                }}>
                  {INVITE_ROLES.find((r) => r.id === inv.role)?.label || inv.role}
                </span>
                <button
                  onClick={() => setEmails(emails.filter((e) => e.email !== inv.email))}
                  style={{
                    background: "none", border: "none", color: "#475569",
                    cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0,
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sent feedback ── */}
      {sentCount > 0 && (
        <div style={{
          background: "rgba(5,150,105,0.1)", border: "1px solid rgba(52,211,153,0.3)",
          borderRadius: 14, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>✓</span>
          <span style={{ color: "#6ee7b7", fontSize: 14, fontWeight: 700 }}>
            {sentCount} {sentCount === 1 ? "invito inviato" : "inviti inviati"} con successo!
          </span>
        </div>
      )}

      <div style={ob.actions}>
        <BackBtn onClick={onBack} />
        <button
          onClick={() => onComplete()}
          style={{ ...ob.backBtn, color: "#64748b" }}
        >
          Salta per ora →
        </button>
        {emails.length > 0 && (
          <button
            onClick={sendInvites}
            disabled={sending}
            style={{
              ...ob.nextBtn,
              opacity: sending ? 0.6 : 1,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Invio…" : `Invia ${emails.length} invito${emails.length > 1 ? "i" : ""} →`}
          </button>
        )}
        {emails.length === 0 && (
          <button onClick={() => onComplete()} style={ob.nextBtn}>
            Continua →
          </button>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// Step 5 — Success / Quick-start
// ─────────────────────────────────────────────
function SuccessScreen({ form, onNavigate, isMobile }) {
  const { t } = useTranslation();
  const clubName  = form.clubName  || t("pages.onboarding.success.defaultClub");
  const modules   = form.modules   || [];

  const actions = QUICKSTART_ACTIONS.filter((a) => {
    // Always show free actions; show premium/physical only if selected
    if (a.key === "physical") return modules.includes("physical");
    return true;
  });

  return (
    <div style={ob.stepContent}>
      {/* Hero */}
      <div style={ob.successHero}>
        <div style={ob.successCheck}>✓</div>
        <h1 style={{ margin: "20px 0 8px", fontSize: isMobile ? 26 : 34, fontWeight: 900 }}>
          {t("pages.onboarding.success.title", { club: clubName })}
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 480 }}>
          {t("pages.onboarding.success.subtitle")}
        </p>
      </div>

      {/* Action cards */}
      <p style={{ ...ob.sectionLabel, marginBottom: 14 }}>
        {t("pages.onboarding.success.nextStepsLabel")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 32 }}>
        {actions.map((action, i) => (
          <button
            key={action.key}
            onClick={() => onNavigate(action.path)}
            style={{
              ...ob.quickCard,
              ...(i === 0 ? ob.quickCardPrimary : {}),
            }}
          >
            <span style={ob.quickCardIcon}>{action.icon}</span>
            <div style={{ textAlign: "left", flex: 1 }}>
              <strong style={{ display: "block", fontSize: 14, color: i === 0 ? "#fff" : "#e2e8f0" }}>
                {t(`pages.onboarding.success.actions.${action.key}.title`)}
              </strong>
              <span style={{ fontSize: 12, color: i === 0 ? "rgba(255,255,255,0.65)" : "#64748b" }}>
                {t(`pages.onboarding.success.actions.${action.key}.desc`)}
              </span>
            </div>
            <span style={{ color: i === 0 ? "rgba(255,255,255,0.7)" : "#475569", fontSize: 16 }}>→</span>
          </button>
        ))}
      </div>

      {/* Footer CTA */}
      <div style={{ ...ob.actions, justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <button onClick={() => onNavigate("/")} style={ob.backBtn}>
          {t("pages.onboarding.success.dashboard")}
        </button>
        <button onClick={() => onNavigate("/players")} style={ob.completeBtn}>
          {t("pages.onboarding.success.startRoster")} →
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
  const { t } = useTranslation();
  return (
    <button onClick={onClick} style={ob.backBtn}>← {t("pages.onboarding.back")}</button>
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
  /* Success screen */
  successHero: {
    textAlign: "center",
    padding: "32px 0 36px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  successCheck: {
    width: 72, height: 72, borderRadius: "50%",
    background: "linear-gradient(135deg,#059669,#047857)",
    display: "grid", placeItems: "center",
    fontSize: 32, fontWeight: 900, color: "white",
    boxShadow: "0 12px 32px rgba(5,150,105,0.4)",
  },
  quickCard: {
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 16px", borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer", color: "white", textAlign: "left",
    transition: "all 0.15s ease",
  },
  quickCardPrimary: {
    background: "linear-gradient(135deg,rgba(37,99,235,0.35),rgba(29,78,216,0.35))",
    border: "1px solid rgba(96,165,250,0.4)",
    boxShadow: "0 4px 20px rgba(37,99,235,0.2)",
  },
  quickCardIcon: { fontSize: 22, flexShrink: 0, width: 36, textAlign: "center" },
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
