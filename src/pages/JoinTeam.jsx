/**
 * JoinTeam — pagina pubblica per gli inviti
 *
 * URL di accesso: /join?token=xxx
 *
 * Flusso:
 * 1. Legge il token dall'URL
 * 2. Mostra l'UI di benvenuto
 * 3. Salva il token in sessionStorage
 * 4. Reindirizza ad Auth con ?mode=register o ?mode=login
 *    → Auth.jsx rileva il token e lo include nella registrazione
 */
import { useEffect, useState } from "react";

export default function JoinTeam() {
  const [token, setToken]   = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(t);
    if (t) sessionStorage.setItem("calciolab_invite_token", t);
  }, []);

  function goTo(mode) {
    window.location.href = `/?invite_mode=${mode}&token=${token}`;
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.brandMark}>CL</div>
          <div>
            <p style={s.eyebrow}>Invito workspace</p>
            <strong style={{ fontSize: 20, lineHeight: 1.1, color: "white" }}>CalcioLab</strong>
          </div>
        </div>

        {/* Hero */}
        <div style={s.hero}>
          <div style={s.inviteIcon}>📨</div>
          <h1 style={s.title}>Sei stato invitato!</h1>
          <p style={s.subtitle}>
            Qualcuno ti ha invitato a collaborare su un workspace <strong>CalcioLab</strong>.
            Crea il tuo account gratuito oppure accedi se ne hai già uno — verrai aggiunto
            automaticamente al team con il ruolo assegnato.
          </p>
        </div>

        {/* Token display */}
        {token && (
          <div style={s.tokenBox}>
            <span style={s.tokenLabel}>Codice invito</span>
            <div style={s.tokenRow}>
              <code style={s.tokenCode}>{token}</code>
              <button
                type="button"
                style={s.copyBtn}
                onClick={() => {
                  navigator.clipboard?.writeText(token);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "✓" : "Copia"}
              </button>
            </div>
          </div>
        )}

        {!token && (
          <div style={s.noTokenWarn}>
            ⚠️ Nessun codice invito trovato nell'URL. Assicurati di aver aperto il link
            corretto ricevuto via email o da chi ti ha invitato.
          </div>
        )}

        {/* CTA buttons */}
        <div style={s.actions}>
          <button
            type="button"
            style={s.btnPrimary}
            onClick={() => goTo("register")}
            disabled={!token}
          >
            Crea account gratuito →
          </button>
          <button
            type="button"
            style={s.btnGhost}
            onClick={() => goTo("login")}
            disabled={!token}
          >
            Ho già un account — Accedi
          </button>
        </div>

        {/* What to expect */}
        <div style={s.features}>
          {[
            { icon: "📋", text: "Accesso alle sedute e al calendario del team" },
            { icon: "👥", text: "Visibilità sulla rosa in base al tuo ruolo" },
            { icon: "⚽", text: "Match day, report e lavagna tattica condivisi" },
            { icon: "🔒", text: "I tuoi dati sono protetti e mai condivisi" },
          ].map(({ icon, text }) => (
            <div key={text} style={s.featureItem}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>{text}</span>
            </div>
          ))}
        </div>

        <p style={s.footer}>
          Hai problemi con il link?{" "}
          <a href="mailto:support@calciolab.app" style={s.footerLink}>
            Contatta il supporto
          </a>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px 16px",
    background: "radial-gradient(circle at top right, rgba(34,197,94,0.12), transparent 40%), #0f1115",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
  },
  card: {
    width: "min(520px, 100%)",
    background: "rgba(21,25,34,0.97)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: "36px 32px",
    boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  brandMark: {
    width: 44, height: 44,
    display: "grid", placeItems: "center",
    borderRadius: 13,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#e0f2fe", fontWeight: 900, fontSize: 16,
    flexShrink: 0,
  },
  eyebrow: {
    margin: 0, color: "#4ade80", fontSize: 11,
    fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8,
  },
  hero: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  inviteIcon: { fontSize: 48, lineHeight: 1 },
  title:      { fontSize: 28, fontWeight: 900, margin: 0, lineHeight: 1.15 },
  subtitle: {
    color: "#94a3b8", fontSize: 14, lineHeight: 1.65,
    maxWidth: 400, margin: 0,
  },
  tokenBox: {
    background: "rgba(34,197,94,0.07)",
    border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: 14,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  tokenLabel: {
    fontSize: 10, fontWeight: 900, textTransform: "uppercase",
    letterSpacing: 0.7, color: "#4ade80",
  },
  tokenRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
  },
  tokenCode: {
    fontSize: 13, fontFamily: "monospace", color: "#86efac",
    background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 8,
    wordBreak: "break-all", flex: 1,
  },
  copyBtn: {
    background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
    color: "#4ade80", borderRadius: 8, padding: "5px 12px",
    fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0,
  },
  noTokenWarn: {
    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
    borderRadius: 12, padding: "12px 16px",
    color: "#fde68a", fontSize: 13, lineHeight: 1.5,
  },
  actions: { display: "flex", flexDirection: "column", gap: 10 },
  btnPrimary: {
    padding: "15px", borderRadius: 14, border: "none",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer",
    boxShadow: "0 12px 28px rgba(34,197,94,0.25)",
    transition: "opacity 0.15s",
  },
  btnGhost: {
    padding: "13px", borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent", color: "#94a3b8",
    fontWeight: 800, fontSize: 14, cursor: "pointer",
  },
  features: { display: "grid", gap: 10 },
  featureItem: {
    display: "flex", gap: 12, alignItems: "flex-start",
    padding: "10px 12px", borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  footer:     { color: "#475569", fontSize: 12, textAlign: "center", margin: 0 },
  footerLink: { color: "#38bdf8" },
};
