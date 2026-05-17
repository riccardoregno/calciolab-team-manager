function Modal({ title, children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.72)",
        backdropFilter: "blur(10px)",
        zIndex: 999,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "calc(100vh - 40px)",
          overflow: "auto",
          overflowX: "hidden",
          borderRadius: 18,
          background:
            "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.42)",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.15 }}>{title}</h2>

          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              minHeight: 0,
              flex: "0 0 auto",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export default Modal;
