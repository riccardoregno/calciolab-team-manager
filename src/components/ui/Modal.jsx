import { useState, useEffect, useId, useRef } from "react";
import { useTranslation } from "../../i18n";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function Modal({ title, children, onClose }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus first focusable element on open
  useEffect(() => {
    const first = panelRef.current?.querySelector(FOCUSABLE);
    first?.focus();
  }, []);

  // Escape closes, focus trap on Tab
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const nodes = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const titleId = useId();

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    backdropFilter: "blur(10px)",
    zIndex: 999,
    display: "grid",
    alignItems: isMobile ? "flex-end" : "center",
    justifyItems: "center",
    padding: isMobile ? 0 : 20,
  };

  const panelStyle = isMobile ? {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "92vh",
    overflow: "auto",
    overflowX: "hidden",
    borderRadius: "20px 20px 0 0",
    background: "linear-gradient(145deg, rgba(15,23,42,0.99), rgba(30,41,59,0.98))",
    border: "1px solid rgba(255,255,255,0.12)",
    borderBottom: "none",
    boxShadow: "0 -12px 48px rgba(0,0,0,0.55)",
    padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
  } : {
    width: "100%",
    maxWidth: 720,
    maxHeight: "calc(100vh - 40px)",
    overflow: "auto",
    overflowX: "hidden",
    borderRadius: 18,
    background: "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.42)",
    padding: 24,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{
            width: 36, height: 4, borderRadius: 99,
            background: "rgba(255,255,255,0.22)",
            margin: "0 auto 14px",
          }} />
        )}

        <div style={{
          display: "flex", justifyContent: "space-between",
          gap: 16, alignItems: "flex-start", marginBottom: 20,
        }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: isMobile ? 18 : 22, lineHeight: 1.15 }}>
            {title}
          </h2>

          <button
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            style={{
              width: 44, height: 44, minHeight: 44, flex: "0 0 auto",
              borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)", color: "white",
              cursor: "pointer", fontWeight: 900, fontSize: 20,
              display: "grid", placeItems: "center",
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
