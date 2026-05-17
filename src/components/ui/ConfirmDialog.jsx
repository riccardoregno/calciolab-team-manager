/**
 * ConfirmDialog — modal di conferma che sostituisce window.confirm()
 *
 * Uso nel componente:
 *   const [confirmState, setConfirmState] = useState(null);
 *
 *   // Per aprire:
 *   setConfirmState({
 *     message: "Vuoi eliminare questa seduta?",
 *     onConfirm: () => { ... },
 *     confirmLabel: "Elimina",   // opzionale (default: "Conferma")
 *     confirmTone: "red",        // opzionale: "red" | "blue" (default: "blue")
 *   });
 *
 *   // Nel JSX:
 *   <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
 */
export default function ConfirmDialog({ state, onClose }) {
  if (!state) return null;

  const { message, onConfirm, confirmLabel = "Conferma", confirmTone = "blue" } = state;

  function handleConfirm() {
    onConfirm?.();
    onClose();
  }

  return (
    <div style={dlgStyles.overlay} onClick={onClose}>
      <div style={dlgStyles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={dlgStyles.iconWrap}>⚠️</div>
        <p style={dlgStyles.message}>{message}</p>
        <div style={dlgStyles.actions}>
          <button style={dlgStyles.cancel} onClick={onClose}>Annulla</button>
          <button
            style={{ ...dlgStyles.confirm, ...(confirmTone === "red" ? dlgStyles.confirmRed : dlgStyles.confirmBlue) }}
            onClick={handleConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const dlgStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    zIndex: 9000,
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  panel: {
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "28px 24px",
    maxWidth: 380,
    width: "100%",
    textAlign: "center",
    display: "grid",
    gap: 16,
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  },
  iconWrap: {
    fontSize: 34,
    lineHeight: 1,
  },
  message: {
    margin: 0,
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.55,
  },
  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginTop: 4,
  },
  cancel: {
    padding: "9px 20px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  confirm: {
    padding: "9px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
  },
  confirmBlue: { background: "linear-gradient(135deg,#2563eb,#1d4ed8)" },
  confirmRed:  { background: "linear-gradient(135deg,#dc2626,#b91c1c)" },
};
