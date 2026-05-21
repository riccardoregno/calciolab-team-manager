import { Component } from "react";

/**
 * ErrorBoundary — catches render/lifecycle errors in any child subtree.
 * Prevents the entire app from going blank on an unhandled exception.
 * Wrap around individual routes or the whole <Routes> block.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyPage />
 *   </ErrorBoundary>
 *
 * Optional props:
 *   fallback — custom ReactNode shown on error (default: built-in card)
 *   onError  — callback(error, info) for logging
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const err = this.state.error;
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <span style={styles.icon}>⚠️</span>
          <h2 style={styles.title}>Qualcosa è andato storto</h2>
          <p style={styles.subtitle}>Something went wrong in this section.</p>
          {import.meta.env.DEV && err && (
            <pre style={styles.detail}>{err.message}</pre>
          )}
          <button style={styles.btn} onClick={this.reset}>
            Riprova · Retry
          </button>
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
    maxWidth: 420,
    width: "100%",
    borderRadius: 20,
    padding: "32px 28px",
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(239,68,68,0.28)",
    display: "grid",
    gap: 14,
    textAlign: "center",
  },
  icon: { fontSize: 36 },
  title: { margin: 0, fontSize: 20, color: "#f1f5f9" },
  subtitle: { margin: 0, color: "#94a3b8", fontSize: 14 },
  detail: {
    margin: 0,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#fca5a5",
    fontSize: 12,
    textAlign: "left",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  btn: {
    padding: "10px 20px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.07)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    justifySelf: "center",
  },
};
