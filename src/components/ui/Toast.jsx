import { useState, useCallback } from "react";

/**
 * useToast() — hook leggero per notifiche in-app
 * Uso:
 *   const { showToast, ToastContainer } = useToast();
 *   showToast("Seduta salvata", "ok");
 *   <ToastContainer />  ← metti in fondo al JSX del componente
 *
 * Tipi: "ok" | "error" | "info" | "warn"
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((text, type = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const ToastContainer = useCallback(
    () => (
      <div style={toastStyles.container} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} style={{ ...toastStyles.toast, ...toastStyles[t.type] }}>
            <span style={toastStyles.icon}>{ICONS[t.type]}</span>
            <span>{t.text}</span>
            <button
              style={toastStyles.close}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Chiudi notifica"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    ),
    [toasts],
  );

  return { showToast, ToastContainer };
}

const ICONS = { ok: "✅", error: "❌", info: "ℹ️", warn: "⚠️" };

const toastStyles = {
  container: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    pointerEvents: "none",
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    minWidth: 240,
    maxWidth: 360,
    boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
    animation: "toast-in 0.22s ease",
    pointerEvents: "auto",
    backdropFilter: "blur(6px)",
  },
  ok:    { background: "rgba(22,163,74,0.92)",  color: "#fff", border: "1px solid rgba(134,239,172,0.3)" },
  error: { background: "rgba(220,38,38,0.92)",  color: "#fff", border: "1px solid rgba(252,165,165,0.3)" },
  info:  { background: "rgba(37,99,235,0.92)",  color: "#fff", border: "1px solid rgba(147,197,253,0.3)" },
  warn:  { background: "rgba(202,138,4,0.92)",  color: "#fff", border: "1px solid rgba(253,224,71,0.3)"  },
  icon: { fontSize: 16, flexShrink: 0 },
  close: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    opacity: 0.7,
    padding: "0 2px",
    flexShrink: 0,
  },
};
