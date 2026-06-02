import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "../../i18n";

/**
 * PWAUpdateBanner — mostra un banner in basso quando il service worker
 * ha scaricato una nuova versione e aspetta di essere attivato.
 *
 * Usa `useRegisterSW` di vite-plugin-pwa (virtual module — nessuna dep aggiuntiva).
 * Non compare durante il primo install, solo sugli aggiornamenti successivi.
 */
export default function PWAUpdateBanner() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Controlla aggiornamenti ogni ora in background
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={bannerStyles.wrap} role="alert" aria-live="polite">
      <div style={bannerStyles.inner}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>✨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={bannerStyles.title}>{t("pwa.updateTitle")}</strong>
          <p style={bannerStyles.desc}>{t("pwa.updateDesc")}</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          style={bannerStyles.updateBtn}
        >
          {t("pwa.updateBtn")}
        </button>
      </div>
    </div>
  );
}

const bannerStyles = {
  wrap: {
    position: "fixed",
    bottom: 80,  // sopra la bottom nav mobile
    left: 12,
    right: 12,
    zIndex: 600,
    pointerEvents: "none",
  },
  inner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 16,
    background: "linear-gradient(135deg, #1e3a5f, #0f172a)",
    border: "1px solid rgba(56,189,248,0.4)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
    pointerEvents: "auto",
  },
  title: {
    display: "block",
    fontSize: 13,
    fontWeight: 800,
    color: "#e2e8f0",
    marginBottom: 2,
  },
  desc: {
    margin: 0,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  updateBtn: {
    background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    border: "none",
    borderRadius: 10,
    color: "white",
    fontWeight: 800,
    fontSize: 12,
    padding: "7px 14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
};
