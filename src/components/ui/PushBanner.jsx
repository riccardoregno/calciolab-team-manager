/**
 * PushBanner
 * Mostra un toast in-app quando arriva una push notification in foreground.
 * Auto-dismiss dopo 4 secondi, dismissable manualmente.
 */
import { useEffect, useRef, useState } from "react";
import { isNative } from "../../utils/capacitor";

export default function PushBanner() {
  const [notification, setNotification] = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isNative) return;

    function handlePush(e) {
      const n = e.detail;
      if (!n) return;
      setNotification({
        title: n.title || "CalcioLab",
        body:  n.body  || n.data?.body || "",
        data:  n.data  || {},
      });
      setVisible(true);

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 4000);
    }

    window.addEventListener("calciolab:push", handlePush);
    return () => {
      window.removeEventListener("calciolab:push", handlePush);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible || !notification) return null;

  return (
    <div style={bs.wrap} onClick={() => setVisible(false)} role="alert">
      <div style={bs.icon}>🔔</div>
      <div style={bs.content}>
        <strong style={bs.title}>{notification.title}</strong>
        {notification.body && <p style={bs.body}>{notification.body}</p>}
      </div>
      <button
        type="button"
        style={bs.close}
        onClick={(e) => { e.stopPropagation(); setVisible(false); }}
        aria-label="Chiudi"
      >
        ×
      </button>
    </div>
  );
}

const bs = {
  wrap: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 18px",
    borderRadius: 18,
    background: "rgba(21,25,34,0.97)",
    border: "1px solid rgba(255,255,255,0.13)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
    backdropFilter: "blur(12px)",
    maxWidth: "min(380px, calc(100vw - 32px))",
    cursor: "pointer",
    animation: "pushSlideIn 0.25s ease-out",
  },
  icon:  { fontSize: 22, flexShrink: 0, marginTop: 1 },
  content: { flex: 1, minWidth: 0 },
  title: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    color: "#e2e8f0",
    lineHeight: 1.3,
    marginBottom: 2,
  },
  body: {
    margin: 0,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  close: {
    background: "none",
    border: "none",
    color: "#475569",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    padding: "0 2px",
    flexShrink: 0,
    alignSelf: "center",
  },
};
