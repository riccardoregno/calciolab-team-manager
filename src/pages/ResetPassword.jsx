/**
 * ResetPassword — pagina pubblica per reimpostare la password
 *
 * Supabase, dopo resetPasswordForEmail(), manda un link tipo:
 *   https://tuodominio.com/reset-password#access_token=xxx&type=recovery
 *
 * Supabase SDK legge automaticamente l'hash e imposta la sessione.
 * Noi ascoltiamo l'evento PASSWORD_RECOVERY e mostriamo il form.
 */
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const [status,      setStatus]      = useState("loading"); // loading | ready | invalid | success
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback,    setFeedback]    = useState(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    // Supabase elabora il token dell'hash URL e genera l'evento PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // Timeout di sicurezza: se dopo 5s non arriva l'evento, il link è invalido/scaduto
    const timer = setTimeout(() => {
      setStatus((prev) => prev === "loading" ? "invalid" : prev);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    if (password.length < 8) {
      setFeedback({ type: "error", text: "La password deve essere di almeno 8 caratteri." });
      return;
    }
    if (password !== confirm) {
      setFeedback({ type: "error", text: "Le due password non coincidono." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFeedback({ type: "error", text: error.message });
      } else {
        setStatus("success");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.brandMark}>CL</div>
          <div>
            <p style={s.eyebrow}>Sicurezza account</p>
            <strong style={{ fontSize: 20, color: "white", lineHeight: 1.1 }}>CalcioLab</strong>
          </div>
        </div>

        {/* ── Loading ── */}
        {status === "loading" && (
          <div style={s.stateBox}>
            <div style={s.spinner} />
            <p style={s.stateText}>Verifica del link in corso…</p>
          </div>
        )}

        {/* ── Link non valido ── */}
        {status === "invalid" && (
          <div style={s.stateBox}>
            <div style={{ fontSize: 48 }}>⏰</div>
            <h2 style={s.stateTitle}>Link scaduto o non valido</h2>
            <p style={s.stateText}>
              Il link di reimpostazione password è scaduto (valido 1 ora) o è già stato utilizzato.
              Richiedi un nuovo link dal login.
            </p>
            <button type="button" style={s.btnPrimary} onClick={() => window.location.href = "/"}>
              Torna al login →
            </button>
          </div>
        )}

        {/* ── Successo ── */}
        {status === "success" && (
          <div style={s.stateBox}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2 style={s.stateTitle}>Password aggiornata!</h2>
            <p style={s.stateText}>
              La tua password è stata reimpostata con successo. Usa la nuova password per accedere.
            </p>
            <button type="button" style={s.btnPrimary} onClick={() => window.location.href = "/"}>
              Vai al login →
            </button>
          </div>
        )}

        {/* ── Form ── */}
        {status === "ready" && (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
              <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>Nuova password</h2>
              <p style={s.subtitle}>
                Scegli una password sicura di almeno 8 caratteri. Non usare la stessa di altri servizi.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={s.form}>
              {/* Nuova password */}
              <label style={s.fieldLabel}>Nuova password</label>
              <div style={s.pwdWrap}>
                <input
                  style={s.input}
                  type={showPwd ? "text" : "password"}
                  placeholder="Almeno 8 caratteri"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd((p) => !p)} style={s.eyeBtn}
                  aria-label={showPwd ? "Nascondi password" : "Mostra password"}>
                  {showPwd ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                </button>
              </div>

              {/* Conferma password */}
              <label style={s.fieldLabel}>Conferma password</label>
              <div style={s.pwdWrap}>
                <input
                  style={{
                    ...s.input,
                    borderColor: confirm && confirm !== password ? "rgba(239,68,68,0.5)" : undefined,
                  }}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Ripeti la password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirm((p) => !p)} style={s.eyeBtn}
                  aria-label={showConfirm ? "Nascondi password" : "Mostra password"}>
                  {showConfirm ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                </button>
              </div>

              {/* Strength indicator */}
              {password.length > 0 && (
                <PasswordStrength password={password} />
              )}

              {/* Feedback */}
              {feedback && (
                <div style={{ ...s.feedback, ...(feedback.type === "ok" ? s.feedbackOk : s.feedbackErr) }}>
                  {feedback.text}
                </div>
              )}

              <button
                type="submit"
                style={{ ...s.btnPrimary, ...(loading ? { opacity: 0.55, cursor: "not-allowed" } : {}) }}
                disabled={loading}
              >
                {loading ? "Attendere…" : "Salva nuova password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Password strength indicator ──────────────────────────── */
function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score  = checks.filter(Boolean).length;
  const labels = ["Troppo corta", "Debole", "Discreta", "Buona", "Ottima"];
  const colors = ["#ef4444", "#f87171", "#fbbf24", "#4ade80", "#22c55e"];

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0,1,2,3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i < score ? colors[score] : "rgba(255,255,255,0.08)",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: colors[score], fontWeight: 700 }}>
        {labels[score]}
      </p>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = {
  page: {
    minHeight: "100vh", display: "grid", placeItems: "center",
    padding: "24px 16px",
    background: "radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 36%), #0f1115",
    color: "white", fontFamily: "Inter, Arial, sans-serif",
  },
  card: {
    width: "min(480px, 100%)",
    background: "rgba(21,25,34,0.97)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24, padding: "36px 32px",
    boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
    display: "flex", flexDirection: "column", gap: 24,
  },
  logoRow: { display: "flex", alignItems: "center", gap: 14 },
  brandMark: {
    width: 44, height: 44, display: "grid", placeItems: "center",
    borderRadius: 13, background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#e0f2fe", fontWeight: 900, fontSize: 16, flexShrink: 0,
  },
  eyebrow: {
    margin: 0, color: "#7dd3fc", fontSize: 11,
    fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8,
  },
  stateBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 14, textAlign: "center", padding: "8px 0",
  },
  stateTitle: { fontSize: 22, margin: 0, lineHeight: 1.2 },
  stateText:  { color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 360 },
  spinner: {
    width: 36, height: 36, borderRadius: "50%",
    border: "3px solid rgba(255,255,255,0.08)",
    borderTopColor: "#38bdf8",
    animation: "spin 0.8s linear infinite",
  },
  subtitle:   { color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" },
  form:       { display: "grid", gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: -4 },
  pwdWrap:    { position: "relative" },
  input: {
    padding: "13px 46px 13px 16px", borderRadius: 12,
    border: "1px solid #2b3444", background: "#0b1018",
    color: "white", fontSize: 15, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", cursor: "pointer",
    padding: "4px", display: "flex", alignItems: "center",
  },
  feedback:    { padding: "11px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.45, fontWeight: 600 },
  feedbackOk:  { background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac" },
  feedbackErr: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", color: "#fca5a5" },
  btnPrimary: {
    padding: "14px", borderRadius: 14, border: "none",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer",
    boxShadow: "0 12px 28px rgba(37,99,235,0.25)", transition: "opacity 0.15s",
  },
};
