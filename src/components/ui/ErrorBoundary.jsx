import { Component } from "react";

/**
 * ErrorBoundary — catches render/lifecycle errors in any child subtree.
 * Prevents the entire app from going blank on an unhandled exception.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyPage />
 *   </ErrorBoundary>
 *
 * Optional props:
 *   fallback — custom ReactNode shown on error (default: built-in card)
 *   onError  — callback(error, info) for logging/Sentry
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null, copied: false };
    this.reset = this.reset.bind(this);
    this.copyError = this.copyError.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Genera un ID breve per il riferimento in supporto
    const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
    // Log sempre in console (visibile nei DevTools utente → aiuta il supporto)
    console.error(
      `[CalcioLab ErrorBoundary] ID: ${this.state.errorId}\n`,
      error,
      "\nComponent stack:",
      info.componentStack,
    );
  }

  reset() {
    this.setState({ hasError: false, error: null, errorId: null, copied: false });
  }

  async copyError() {
    const { error, errorId } = this.state;
    const text = `CalcioLab Error ID: ${errorId}\n${error?.message || ""}\n${error?.stack || ""}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Fallback per browser senza clipboard API
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, errorId, copied } = this.state;
    const isDev = import.meta.env.DEV;

    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <span style={styles.icon}>⚠️</span>
          <h2 style={styles.title}>Qualcosa è andato storto</h2>
          <p style={styles.subtitle}>
            Si è verificato un errore imprevisto in questa sezione.
          </p>

          {/* Error ID — sempre visibile (utile per il supporto) */}
          <div style={styles.idBox}>
            <span style={styles.idLabel}>Error ID</span>
            <span style={styles.idCode}>{errorId}</span>
          </div>

          {/* Dettaglio errore — in dev mostra il messaggio completo */}
          {isDev && error && (
            <pre style={styles.detail}>{error.message}{"\n"}{error.stack}</pre>
          )}

          {/* Azioni */}
          <div style={styles.actions}>
            <button style={styles.btnPrimary} onClick={this.reset}>
              ↺ Riprova
            </button>
            <button
              style={styles.btnSecondary}
              onClick={() => window.location.assign("/")}
            >
              🏠 Dashboard
            </button>
            <button
              style={styles.btnSecondary}
              onClick={() => window.location.reload()}
            >
              ⟳ Ricarica app
            </button>
          </div>

          {/* Copy + link supporto */}
          <div style={styles.supportRow}>
            <button style={styles.copyBtn} onClick={this.copyError}>
              {copied ? "✓ Copiato!" : "📋 Copia dettagli"}
            </button>
            <a
              href={`mailto:info@calciolab.it?subject=Errore%20${errorId}&body=Error%20ID%3A%20${errorId}`}
              style={styles.supportLink}
            >
              Contatta supporto →
            </a>
          </div>
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    padding: 24,
  },
  card: {
    maxWidth: 440,
    width: "100%",
    borderRadius: 20,
    padding: "32px 28px",
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(239,68,68,0.28)",
    display: "grid",
    gap: 14,
    textAlign: "center",
  },
  icon:     { fontSize: 38 },
  title:    { margin: 0, fontSize: 20, color: "#f1f5f9", fontWeight: 800 },
  subtitle: { margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.6 },
  idBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.07)",
    border: "1px solid rgba(239,68,68,0.15)",
  },
  idLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" },
  idCode:  { fontSize: 14, fontWeight: 800, color: "#fca5a5", fontFamily: "monospace" },
  detail: {
    margin: 0,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#fca5a5",
    fontSize: 11,
    textAlign: "left",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: 160,
    overflowY: "auto",
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btnPrimary: {
    padding: "9px 20px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },
  btnSecondary: {
    padding: "9px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  supportRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  copyBtn: {
    background: "none",
    border: "none",
    color: "#60a5fa",
    cursor: "pointer",
    fontSize: 13,
    padding: "2px 4px",
  },
  supportLink: {
    fontSize: 13,
    color: "#475569",
    textDecoration: "none",
  },
};
