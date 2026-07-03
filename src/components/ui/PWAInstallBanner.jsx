import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { isNative } from "../../utils/capacitor";

/**
 * PWAInstallBanner — mostra un banner di installazione quando il browser
 * espone l'evento beforeinstallprompt (Chrome/Edge/Android).
 * Su iOS mostra istruzioni manuali (Safari non supporta l'evento).
 */
export default function PWAInstallBanner() {
  const { t } = useTranslation();
  // Hooks must be called unconditionally — early return happens after
  const [installPrompt, setInstallPrompt] = useState(null);
  // Read dismiss flag synchronously via initializer — avoids setState-in-effect
  const [dismissed, setDismissed] = useState(
    () => Boolean(sessionStorage.getItem("calciolab_pwa_dismissed"))
  );
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // All hooks must be above any early return (rules of hooks)
  useEffect(() => {
    if (isNative) return; // guard inside effect, not as early return
    // Già installata come PWA?
    if (window.matchMedia("(display-mode: standalone)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsInstalled(true);
      return;
    }

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Chrome/Edge/Android: intercetta l'evento di installazione
    function handleBeforeInstall(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  // Non mostrare il banner se si sta già girando come app nativa Capacitor
  if (isNative) return null;

  async function handleInstall() {
    if (!installPrompt) return;
    const result = await installPrompt.prompt();
    if (result?.outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  }

  function handleDismiss() {
    sessionStorage.setItem("calciolab_pwa_dismissed", "1");
    setDismissed(true);
  }

  // Non mostrare se: già installata, dismissato, o nessun prompt disponibile (e non iOS)
  if (isInstalled || dismissed || (!installPrompt && !isIOS)) return null;

  return (
    <div style={bannerStyles.wrap}>
      <div style={bannerStyles.inner}>
        <span style={{ fontSize: 22 }}>📱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={bannerStyles.title}>
            {t("pwa.installTitle")}
          </strong>
          <p style={bannerStyles.desc}>
            {isIOS
              ? t("pwa.installIOS")
              : t("pwa.installDesc")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {!isIOS && installPrompt && (
            <button onClick={handleInstall} style={bannerStyles.installBtn}>
              {t("pwa.installBtn")}
            </button>
          )}
          <button onClick={handleDismiss} style={bannerStyles.dismissBtn} aria-label="Chiudi">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

const bannerStyles = {
  wrap: {
    position: "fixed",
    bottom: 72,   // sopra la bottom nav mobile
    left: 12,
    right: 12,
    zIndex: 500,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 16,
    background: "linear-gradient(135deg, #1e293b, #0f172a)",
    border: "1px solid rgba(37,99,235,0.4)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
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
  installBtn: {
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    border: "none",
    borderRadius: 10,
    color: "white",
    fontWeight: 800,
    fontSize: 12,
    padding: "7px 14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dismissBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#64748b",
    cursor: "pointer",
    fontSize: 14,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
};
