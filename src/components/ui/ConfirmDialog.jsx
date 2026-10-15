import Modal from "./Modal";

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
    <Modal title="Conferma operazione" onClose={onClose} role="alertdialog" compact>
      <div style={dlgStyles.panel}>
        <div style={dlgStyles.iconWrap}>⚠️</div>
        <p style={dlgStyles.message}>{message}</p>
        <div style={dlgStyles.actions}>
          <button type="button" style={dlgStyles.cancel} onClick={onClose}>Annulla</button>
          <button
            type="button"
            style={{ ...dlgStyles.confirm, ...(confirmTone === "red" ? dlgStyles.confirmRed : dlgStyles.confirmBlue) }}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const dlgStyles = {
  panel: {
    textAlign: "center",
    display: "grid",
    gap: 16,
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
