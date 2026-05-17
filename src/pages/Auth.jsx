import { useState, useCallback, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ─── Social proof ──────────────────────────────────────────── */
const STATS = [
  { value: "120+", label: "squadre attive" },
  { value: "4.8k", label: "sedute pianificate" },
  { value: "98%",  label: "soddisfazione staff" },
];

/* ─── Auth ──────────────────────────────────────────────────── */
function Auth() {
  const [mode, setMode] = useState("login"); // "login" | "register" | "reset"

  /* form fields */
  const [firstName,        setFirstName]        = useState("");
  const [lastName,         setLastName]          = useState("");
  const [email,            setEmail]             = useState("");
  const [password,         setPassword]          = useState("");
  const [showPassword,     setShowPassword]      = useState(false);
  const [acceptTerms,      setAcceptTerms]       = useState(false);
  const [acceptNewsletter, setAcceptNewsletter]  = useState(false);

  /* UI state */
  const [loading,      setLoading]      = useState(false);
  const [feedback,     setFeedback]     = useState(null); // { type: "ok"|"error", text }
  const [showResend,   setShowResend]   = useState(false); // mostra il pulsante "Reinvia email"
  const [resendLoading,setResendLoading]= useState(false);
  const [visible,      setVisible]      = useState(true);
  const [isMobile,     setIsMobile]     = useState(
    () => typeof window !== "undefined" && window.innerWidth < 680
  );

  /* Responsive: listen for resize */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 680px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Legge ?invite_mode=register|login dall'URL e imposta la modalità di accesso */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteMode = params.get("invite_mode");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (inviteMode === "register") setMode("register");
    else if (inviteMode === "login") setMode("login");
    // Pulisce i parametri dall'URL senza ricaricare la pagina
    if (inviteMode) {
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  /* Animated mode transition */
  const switchMode = useCallback((next) => {
    setVisible(false);
    setTimeout(() => {
      setMode(next);
      setFeedback(null);
      setShowResend(false);
      setPassword("");
      setShowPassword(false);
      setAcceptTerms(false);
      setVisible(true);
    }, 200);
  }, []);

  /* Reinvia email di conferma */
  async function resendConfirmation() {
    if (!email) { setFeedback({ type: "error", text: "Inserisci la tua email per ricevere il link." }); return; }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) setFeedback({ type: "error", text: error.message });
      else {
        setFeedback({ type: "ok", text: "Email di conferma inviata! Controlla la casella di posta (e lo spam)." });
        setShowResend(false);
      }
    } finally { setResendLoading(false); }
  }

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    /* ─ Reset password ─ */
    if (mode === "reset") {
      if (!email) { setFeedback({ type: "error", text: "Inserisci la tua email." }); return; }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) setFeedback({ type: "error", text: error.message });
        else setFeedback({ type: "ok", text: "Email inviata! Controlla la casella di posta per reimpostare la password." });
      } finally { setLoading(false); }
      return;
    }

    /* ─ Login / Register common validation ─ */
    if (!email || !password) { setFeedback({ type: "error", text: "Inserisci email e password." }); return; }

    if (mode === "register") {
      if (!firstName || !lastName) { setFeedback({ type: "error", text: "Inserisci nome e cognome." }); return; }
      if (!acceptTerms) { setFeedback({ type: "error", text: "Devi accettare i Termini di Servizio e la Privacy Policy per procedere." }); return; }
    }

    setLoading(true);

    try {
      /* ─ Login ─ */
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Errore specifico: email non ancora confermata
          const isUnconfirmed =
            error.message?.toLowerCase().includes("email not confirmed") ||
            error.message?.toLowerCase().includes("email_not_confirmed");
          if (isUnconfirmed) {
            setFeedback({
              type: "error",
              text: "Email non ancora confermata. Controlla la tua casella di posta e clicca il link di attivazione.",
            });
            setShowResend(true);
          } else {
            setFeedback({ type: "error", text: error.message });
          }
        }
        return;
      }

      /* ─ Register ─ */
      if (mode === "register") {
        // Legge eventuale token invito salvato da JoinTeam
        const inviteToken = typeof window !== "undefined"
          ? sessionStorage.getItem("calciolab_invite_token") || ""
          : "";

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name:        firstName,
              last_name:         lastName,
              newsletter_opt_in: acceptNewsletter,
              terms_accepted_at: new Date().toISOString(),
              invite_token:      inviteToken || undefined,
            },
          },
        });

        if (error) { setFeedback({ type: "error", text: error.message }); return; }

        const user = data.user;
        if (user) {
          const { error: profileError } = await supabase.from("profiles").upsert([{
            id:                user.id,
            first_name:        firstName,
            last_name:         lastName,
            email,
            newsletter_opt_in: acceptNewsletter,
            terms_accepted_at: new Date().toISOString(),
          }]);
          if (profileError) { setFeedback({ type: "error", text: "Utente creato, ma errore nel salvataggio del profilo." }); return; }

          // Pulisce il token di invito dopo la registrazione
          if (inviteToken && typeof window !== "undefined") {
            sessionStorage.removeItem("calciolab_invite_token");
          }
        }

        setFeedback({ type: "ok", text: "Registrazione completata! Controlla la mail per confermare l'account." });
        setTimeout(() => switchMode("login"), 2800);
      }
    } finally { setLoading(false); }
  }

  /* ── Labels ── */
  const title    = mode === "login"    ? "Bentornato"
                 : mode === "register" ? "Crea account"
                                       : "Recupera password";
  const subtitle = mode === "login"    ? "Accedi alla tua area allenatore"
                 : mode === "register" ? "Configura il profilo per iniziare a lavorare con CalcioLab"
                                       : "Inserisci la tua email: ti mandiamo un link per reimpostare la password.";
  const btnLabel = mode === "login"    ? "Accedi"
                 : mode === "register" ? "Registrati"
                                       : "Invia link di recupero";

  const formWrapStyle = {
    ...s.formWrap,
    opacity:    visible ? 1 : 0,
    transform:  visible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  };

  const shellStyle = isMobile
    ? { ...s.shell, gridTemplateColumns: "1fr" }
    : s.shell;

  return (
    <div style={s.page}>
      <div style={shellStyle}>

        {/* ── Brand panel — hidden on mobile, replaced by compact header ── */}
        {isMobile ? (
          <div style={s.mobileHeader}>
            <div style={s.brandMarkSm}>CL</div>
            <div>
              <p style={{ ...s.eyebrow, margin: 0 }}>Coach workspace</p>
              <strong style={{ fontSize: 20, lineHeight: 1.1 }}>CalcioLab</strong>
            </div>
          </div>
        ) : (
          <section style={s.panel}>
            <div>
              <div style={s.brandMark}>CL</div>
              <p style={{ ...s.eyebrow, marginTop: 22 }}>Coach workspace</p>
              <h1 style={s.heroTitle}>CalcioLab</h1>
              <p style={s.heroText}>
                Rosa, calendario, sedute e dati partita in un unico ambiente di lavoro per lo staff.
              </p>
            </div>

            {/* Social proof */}
            <div style={s.statsRow}>
              {STATS.map((st) => (
                <div key={st.label} style={s.statItem}>
                  <strong style={s.statValue}>{st.value}</strong>
                  <span style={s.statLabel}>{st.label}</span>
                </div>
              ))}
            </div>

            <div style={s.signalGrid}>
              <div style={s.signalItem}>
                <strong>Rosa</strong>
                <span>Giocatori, disponibilità e gruppi</span>
              </div>
              <div style={s.signalItem}>
                <strong>Campo</strong>
                <span>Sedute, esercizi e match day</span>
              </div>
              <div style={s.signalItem}>
                <strong>Dati</strong>
                <span>Statistiche e report stagione</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Auth card ── */}
        <section style={s.card}>
          <div style={formWrapStyle}>
            <div style={s.cardHeader}>
              <p style={s.eyebrow}>Accesso staff</p>
              <h2 style={s.title}>{title}</h2>
            </div>

            <p style={s.subtitle}>{subtitle}</p>

            <form onSubmit={handleSubmit} style={s.form}>

              {/* Nome + Cognome (solo registrazione) */}
              {mode === "register" && (
                <div style={s.nameGrid}>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="Nome"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                  <input
                    style={s.input}
                    type="text"
                    placeholder="Cognome"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              )}

              {/* Email */}
              <input
                style={s.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              {/* Password con toggle mostra/nascondi */}
              {mode !== "reset" && (
                <div style={s.passwordWrap}>
                  <input
                    style={{ ...s.input, paddingRight: 46 }}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((p) => !p)}
                    style={s.eyeBtn}
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  >
                    {showPassword
                      ? <EyeOff size={16} color="#64748b" />
                      : <Eye     size={16} color="#64748b" />}
                  </button>
                </div>
              )}

              {/* Consensi (solo registrazione) */}
              {mode === "register" && (
                <div style={s.checkboxGroup}>
                  {/* Termini — obbligatorio */}
                  <label style={s.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      style={s.checkbox}
                    />
                    <span style={s.checkboxText}>
                      Ho letto e accetto i{" "}
                      <a href="/terms" target="_blank" style={s.checkboxLink}>Termini di Servizio</a>
                      {" "}e la{" "}
                      <a href="/privacy" target="_blank" style={s.checkboxLink}>Privacy Policy</a>.{" "}
                      <span style={s.requiredStar}>*</span>
                    </span>
                  </label>

                  {/* Newsletter — facoltativo */}
                  <label style={s.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={acceptNewsletter}
                      onChange={(e) => setAcceptNewsletter(e.target.checked)}
                      style={s.checkbox}
                    />
                    <span style={s.checkboxText}>
                      Desidero ricevere{" "}
                      <strong style={{ color: "#cbd5e1" }}>newsletter, offerte e novità</strong>{" "}
                      di CalcioLab. Puoi disiscriverti in qualsiasi momento.{" "}
                      <span style={s.optionalTag}>Facoltativo</span>
                    </span>
                  </label>
                </div>
              )}

              {/* Feedback */}
              {feedback && (
                <div style={{ ...s.feedback, ...(feedback.type === "ok" ? s.feedbackOk : s.feedbackErr) }}>
                  {feedback.text}
                </div>
              )}

              {/* Reinvia email di conferma — visibile solo dopo l'errore "email not confirmed" */}
              {showResend && (
                <button
                  type="button"
                  style={{ ...s.resendBtn, ...(resendLoading ? s.buttonDisabled : {}) }}
                  onClick={resendConfirmation}
                  disabled={resendLoading}
                >
                  {resendLoading ? "Invio in corso…" : "📧 Reinvia email di conferma"}
                </button>
              )}

              <button
                style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }}
                type="submit"
                disabled={loading}
              >
                {loading ? "Attendere…" : btnLabel}
              </button>

              {/* Nota GDPR sotto il pulsante di registrazione */}
              {mode === "register" && (
                <p style={s.gdprNote}>
                  I tuoi dati sono trattati in conformità al GDPR (Reg. UE 2016/679).
                  Non li condivideremo mai con terze parti senza il tuo consenso.
                </p>
              )}
            </form>

            {/* ── Bottom links ── */}
            <div style={s.linksRow}>
              {mode === "login" && (
                <>
                  <button style={s.linkBtn} type="button" onClick={() => switchMode("register")}>
                    Non hai un account? <u>Registrati</u>
                  </button>
                  <button style={{ ...s.linkBtn, ...s.linkBtnMuted }} type="button" onClick={() => switchMode("reset")}>
                    Password dimenticata?
                  </button>
                </>
              )}
              {mode === "register" && (
                <button style={s.linkBtn} type="button" onClick={() => switchMode("login")}>
                  Hai già un account? <u>Accedi</u>
                </button>
              )}
              {mode === "reset" && (
                <button style={s.linkBtn} type="button" onClick={() => switchMode("login")}>
                  ← Torna al login
                </button>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px 16px",
    background: "radial-gradient(circle at top left, rgba(56,189,248,0.14), transparent 34%), #0f1115",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
  },
  shell: {
    width: "min(980px, 100%)",
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 18,
    alignItems: "stretch",
  },
  /* Mobile compact header */
  mobileHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "0 4px 4px",
  },
  brandMarkSm: {
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#e0f2fe",
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
  },
  /* Brand panel */
  panel: {
    minHeight: 460,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderRadius: 22,
    padding: 30,
    background: "linear-gradient(145deg, rgba(37,99,235,0.28), rgba(15,23,42,0.9))",
    border: "1px solid rgba(147,197,253,0.18)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.34)",
  },
  brandMark: {
    width: 54, height: 54,
    display: "grid", placeItems: "center",
    borderRadius: 16,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#e0f2fe", fontWeight: 950, fontSize: 18,
  },
  eyebrow: {
    margin: 0, color: "#7dd3fc", fontSize: 12,
    fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8,
  },
  heroTitle: { margin: "12px 0 10px", fontSize: 46, lineHeight: 1 },
  heroText:  { maxWidth: 520, color: "#cbd5e1", lineHeight: 1.6, margin: 0, fontSize: 14 },
  /* Social proof */
  statsRow: {
    display: "flex", gap: 0, margin: "20px 0",
    borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)",
  },
  statItem: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    padding: "14px 10px", background: "rgba(15,23,42,0.54)",
    borderRight: "1px solid rgba(255,255,255,0.09)",
  },
  statValue: { fontSize: 22, fontWeight: 900, color: "#38bdf8", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#64748b", textAlign: "center", lineHeight: 1.3 },
  signalGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  signalItem: {
    display: "grid", gap: 5, padding: 13, borderRadius: 14,
    background: "rgba(15,23,42,0.54)", border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 13, color: "#94a3b8", lineHeight: 1.4,
  },
  /* Auth card */
  card: {
    width: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
    background: "rgba(21,25,34,0.96)", border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 22, padding: 30, boxShadow: "0 24px 70px rgba(0,0,0,0.32)", overflow: "hidden",
  },
  formWrap:  { display: "flex", flexDirection: "column" },
  cardHeader:{ display: "grid", gap: 8, marginBottom: 8 },
  title:     { fontSize: 32, lineHeight: 1.1, margin: 0 },
  subtitle:  { color: "#a8b3c5", lineHeight: 1.55, fontSize: 14, margin: "0 0 22px" },
  form:      { display: "grid", gap: 12 },
  nameGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input: {
    padding: "13px 16px", borderRadius: 12, border: "1px solid #2b3444",
    background: "#0b1018", color: "white", fontSize: 15, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  /* Password toggle */
  passwordWrap: { position: "relative" },
  eyeBtn: {
    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", cursor: "pointer",
    padding: "4px", display: "flex", alignItems: "center",
  },
  /* Checkboxes */
  checkboxGroup: { display: "grid", gap: 12, padding: "4px 0" },
  checkboxLabel: {
    display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
  },
  checkbox: {
    width: 16, height: 16, marginTop: 2, flexShrink: 0,
    accentColor: "#38bdf8", cursor: "pointer",
  },
  checkboxText: { fontSize: 12, color: "#94a3b8", lineHeight: 1.55 },
  checkboxLink: { color: "#38bdf8", textDecoration: "underline" },
  requiredStar: { color: "#f87171", fontWeight: 900 },
  optionalTag: {
    display: "inline-block", fontSize: 10, fontWeight: 900,
    color: "#64748b", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
    padding: "1px 6px", verticalAlign: "middle", marginLeft: 2,
  },
  /* GDPR note */
  gdprNote: {
    fontSize: 11, color: "#475569", lineHeight: 1.55, margin: "2px 0 0",
    textAlign: "center",
  },
  /* Feedback */
  feedback:    { padding: "11px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.45, fontWeight: 600 },
  feedbackOk:  { background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac" },
  feedbackErr: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", color: "#fca5a5" },
  /* Reinvia email di conferma */
  resendBtn: {
    padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(251,191,36,0.35)",
    background: "rgba(251,191,36,0.09)", color: "#fde68a",
    fontWeight: 800, fontSize: 13, cursor: "pointer",
    transition: "opacity 0.15s", textAlign: "center",
  },
  button: {
    marginTop: 4, padding: "14px 16px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)", color: "white",
    fontWeight: 900, fontSize: 15, cursor: "pointer",
    boxShadow: "0 14px 28px rgba(37,99,235,0.28)", transition: "opacity 0.15s",
  },
  buttonDisabled: { opacity: 0.55, cursor: "not-allowed" },
  linksRow: { marginTop: 18, display: "flex", flexDirection: "column", gap: 8 },
  linkBtn: {
    background: "transparent", border: "none", color: "#94a3b8",
    cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0, lineHeight: 1.4,
  },
  linkBtnMuted: { color: "#64748b", fontSize: 12 },
};

export default Auth;
